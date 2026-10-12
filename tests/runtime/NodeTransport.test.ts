import { assert, assertEquals } from '@std/assert'
import type * as Types from '@app/Types.ts'
import { connectNodeTransport } from '@runtime/NodeTransport.ts'
import { SmtpCommand } from '@smtp/Command.ts'
import { startSmtpServer } from '@tests/helpers/SmtpServer.ts'

Deno.test('node transport completes a scripted SMTP session', async () => {
  const server = startSmtpServer(['none'])
  const transport = await connectNodeTransport({ hostname: '127.0.0.1', port: server.port })
  const state: Types.SmtpConnectionState = {
    transport,
    config: { host: '127.0.0.1', port: server.port }
  }
  const commands = new SmtpCommand(state)
  const greeting = await commands.readResponse()
  assert(greeting.startsWith('220'), `unexpected greeting: ${greeting}`)
  assert((await commands.sendCommand('EHLO transport.test')).startsWith('250'))
  assert((await commands.sendCommand('MAIL FROM:<sender@transport.test>')).startsWith('250'))
  assert((await commands.sendCommand('RCPT TO:<rcpt@transport.test>')).startsWith('250'))
  assert((await commands.sendCommand('DATA')).startsWith('354'))
  await commands.sendData(`Subject: parity\r\n\r\n${'payload line\r\n'.repeat(4000)}`)
  assert((await commands.sendCommand('.')).startsWith('250'))
  assert((await commands.sendCommand('QUIT')).startsWith('221'))
  commands.close()
  const [outcome] = await server.outcomes
  assertEquals(
    outcome?.dataBytes,
    'Subject: parity\r\n\r\n'.length + 'payload line\r\n'.length * 4000
  )
})

Deno.test('node transport splits reads and reports end of stream', async () => {
  const listener = Deno.listen({ hostname: '127.0.0.1', port: 0 })
  const served = (async () => {
    const connection = await listener.accept()
    await connection.write(new TextEncoder().encode('ABCDEFGHIJ'))
    connection.close()
    listener.close()
  })()
  const transport = await connectNodeTransport({
    hostname: '127.0.0.1',
    port: listener.addr.port
  })
  const target = new Uint8Array(4)
  const chunks: string[] = []
  const decoder = new TextDecoder()
  while (true) {
    const bytesRead = await transport.read(target)
    if (bytesRead === null) {
      break
    }
    chunks.push(decoder.decode(target.subarray(0, bytesRead)))
  }
  transport.close()
  await served
  assertEquals(chunks.join(''), 'ABCDEFGHIJ')
  assert(chunks.every((chunk) => chunk.length <= 4), `oversized read: ${chunks.join('|')}`)
})

Deno.test('node transport aborts a pending connect', async () => {
  const abort = new AbortController()
  abort.abort()
  let failure: Error | null = null
  try {
    await connectNodeTransport({ hostname: '127.0.0.1', port: 1, signal: abort.signal })
  } catch (error) {
    failure = error as Error
  }
  assert(failure, 'expected the aborted connect to reject')
  assert(/aborted/i.test(failure.message), `unexpected message: ${failure.message}`)
})

Deno.test('node transport refuses a TLS upgrade with buffered plaintext', async () => {
  const listener = Deno.listen({ hostname: '127.0.0.1', port: 0 })
  const served = (async () => {
    const connection = await listener.accept()
    await connection.write(new TextEncoder().encode('220 ready\r\n250 injected\r\n'))
    return connection
  })()
  const transport = await connectNodeTransport({
    hostname: '127.0.0.1',
    port: listener.addr.port
  })
  const connection = await served
  // A zero-length read parks until bytes land, then leaves them buffered.
  assertEquals(await transport.read(new Uint8Array(0)), 0)
  let failure: Error | null = null
  try {
    await transport.startTls({ hostname: 'localhost' })
  } catch (error) {
    failure = error as Error
  }
  transport.close()
  connection.close()
  listener.close()
  assert(failure, 'expected the upgrade to reject')
  assert(
    /before the TLS handshake/.test(failure.message),
    `unexpected message: ${failure.message}`
  )
})

Deno.test('node transport aborts an unanswered TLS handshake to an IP host', async () => {
  const listener = Deno.listen({ hostname: '127.0.0.1', port: 0 })
  const served = listener.accept()
  const transport = await connectNodeTransport({
    hostname: '127.0.0.1',
    port: listener.addr.port
  })
  const connection = await served
  const abort = new AbortController()
  // An IP host must not be offered as an SNI name; node:tls rejects that outright.
  const upgrade = transport.startTls({ hostname: '127.0.0.1', signal: abort.signal })
  // The upgrade registers its abort listener synchronously, so no wait is needed here.
  abort.abort()
  let failure: Error | null = null
  try {
    await upgrade
  } catch (error) {
    failure = error as Error
  }
  connection.close()
  listener.close()
  assert(failure, 'expected the abandoned handshake to reject')
  assert(/aborted/i.test(failure.message), `unexpected message: ${failure.message}`)
})
