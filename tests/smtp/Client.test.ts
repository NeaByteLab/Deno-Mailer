import { assert, assertEquals, assertRejects } from '@std/assert'
import * as SMTP from '@smtp/index.ts'
import { startSmtpServer } from '@tests/helpers/SmtpServer.ts'

const testMessage = {
  from: 'sender@example.com',
  to: 'receiver@example.com',
  subject: 'Test',
  text: 'Hello'
}

Deno.test('SmtpClient connect closes socket when greeting exceeds socketTimeoutMs', async () => {
  const server = startSmtpServer(['greeting'])
  const smtpClient = new SMTP.SmtpClient({
    host: '127.0.0.1',
    port: server.port,
    socketTimeoutMs: 200
  })
  await assertRejects(() => smtpClient.connect(), Error, 'timed out')
  assertEquals(smtpClient.isConnected, false)
  const [outcome] = await server.outcomes
  assertEquals(outcome?.clientClosed, true)
})

Deno.test('SmtpClient sendMessage delivers DATA larger than one socket write', async () => {
  const server = startSmtpServer(['none'])
  const smtpClient = new SMTP.SmtpClient({
    host: '127.0.0.1',
    port: server.port,
    socketTimeoutMs: 5000
  })
  const text = `${'x'.repeat(76)}\n`.repeat(128 * 1024)
  await smtpClient.connect()
  const sendResult = await smtpClient.sendMessage({ ...testMessage, text })
  await smtpClient.disconnect()
  const [outcome] = await server.outcomes
  assertEquals(sendResult.response, '250 OK queued\r\n')
  assert((outcome?.dataBytes ?? 0) > text.length)
})

Deno.test('SmtpClient sendMessage rejects when not connected to server', async () => {
  const smtpClient = new SMTP.SmtpClient({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false
  })
  await assertRejects(
    () =>
      smtpClient.sendMessage({
        from: 'sender@example.com',
        to: 'receiver@example.com',
        subject: 'Test',
        text: 'Hello'
      }),
    Error,
    'Not connected to SMTP server'
  )
})

Deno.test('SmtpClient sendMessage reports RCPT timeout instead of rejected recipients', async () => {
  const server = startSmtpServer(['rcpt'])
  const smtpClient = new SMTP.SmtpClient({
    host: '127.0.0.1',
    port: server.port,
    socketTimeoutMs: 200
  })
  await smtpClient.connect()
  await assertRejects(() => smtpClient.sendMessage(testMessage), Error, 'timed out')
  assertEquals(smtpClient.isConnected, false)
  const [outcome] = await server.outcomes
  assertEquals(outcome?.clientClosed, true)
})
