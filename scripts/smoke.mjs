import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import net from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import tls from 'node:tls'
import { fileURLToPath } from 'node:url'

/** Address used as the envelope sender in the smoke message. */
const senderAddress = 'sender@example.com'
/** Recipients the smoke message is addressed to. */
const recipientAddresses = ['first@example.com', 'second@example.com']
/** Subject line asserted inside the received DATA payload. */
const messageSubject = 'Smoke Test Subject'
/** Body text asserted inside the received DATA payload. */
const messageBody = 'Smoke test body line for the bundled library.'
/** Queue identifier echoed by the fake server after the DATA terminator. */
const queueId = 'SMOKE-1'

/**
 * Report a failed assertion and exit.
 * @description Prints the failure to stderr and terminates with status 1.
 * @param message - Description of the failed expectation
 */
function fail(message) {
  console.error(`smoke failed: ${message}`)
  process.exit(1)
}

/**
 * Assert a condition.
 * @description Exits with a non-zero status when the condition is falsy.
 * @param condition - Value expected to be truthy
 * @param message - Description of the failed expectation
 */
function assert(condition, message) {
  if (!condition) {
    fail(message)
  }
}

/**
 * Extract an address from an SMTP command line.
 * @description Reads the value between angle brackets, if present.
 * @param line - Raw SMTP command line
 * @returns Bare email address or an empty string
 */
function extractAddress(line) {
  const start = line.indexOf('<')
  const end = line.indexOf('>', start + 1)
  if (start === -1 || end === -1) {
    return ''
  }
  return line.slice(start + 1, end)
}

/**
 * Start a loopback SMTP server.
 * @description Speaks a minimal session, advertising STARTTLS when TLS material is supplied.
 * @param credentials - PEM key and certificate enabling STARTTLS, or null for plaintext
 * @returns Server handle with port, captured sessions, and a close helper
 */
async function startSmtpServer(credentials) {
  const sessions = []
  const sockets = new Set()
  const server = net.createServer((socket) => {
    const session = { recipients: [], sender: '', data: '', complete: false, secured: false }
    sessions.push(session)
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
    serveSession(socket, session, credentials, sockets)
    socket.write('220 127.0.0.1 ESMTP smoke\r\n')
  })
  const { promise, resolve, reject } = Promise.withResolvers()
  server.once('error', reject)
  server.listen(0, '127.0.0.1', resolve)
  await promise
  return {
    port: server.address().port,
    sessions,
    close() {
      for (const socket of sockets) {
        socket.destroy()
      }
      server.close()
    }
  }
}

/**
 * Drive one SMTP session over a socket.
 * @description Parses commands and, on STARTTLS, re-attaches itself to the secured socket.
 * @param socket - Plain or secured socket carrying the session
 * @param session - Mutable record of what the server observed
 * @param credentials - PEM key and certificate enabling STARTTLS, or null for plaintext
 * @param sockets - Open socket registry used for teardown
 */
function serveSession(socket, session, credentials, sockets) {
  let buffer = ''
  let inData = false
  // No setEncoding: the raw socket must stay in binary mode, otherwise handing it to
  // TLSSocket on STARTTLS corrupts the handshake framing.
  socket.on('error', () => {})
  const onData = (raw) => {
    const chunk = raw.toString('latin1')
    buffer += chunk
    for (;;) {
      if (inData) {
        session.data += buffer
        buffer = ''
        const terminator = session.data.indexOf('\r\n.\r\n')
        if (terminator === -1) {
          break
        }
        buffer = session.data.slice(terminator + 5)
        session.data = session.data.slice(0, terminator)
        session.complete = true
        inData = false
        socket.write(`250 OK queued as ${queueId}\r\n`)
        continue
      }
      const lineEnd = buffer.indexOf('\r\n')
      if (lineEnd === -1) {
        break
      }
      const line = buffer.slice(0, lineEnd)
      buffer = buffer.slice(lineEnd + 2)
      const spaceIndex = line.indexOf(' ')
      const verb = line.slice(0, spaceIndex === -1 ? line.length : spaceIndex).toUpperCase()
      if (verb === 'EHLO' || verb === 'HELO') {
        const offer = credentials && !session.secured ? '250-STARTTLS\r\n' : ''
        socket.write(`250-127.0.0.1 greets you\r\n250-SIZE 10485760\r\n${offer}250 8BITMIME\r\n`)
        continue
      }
      if (verb === 'STARTTLS' && credentials && !session.secured) {
        socket.removeListener('data', onData)
        socket.write('220 2.0.0 Ready to start TLS\r\n')
        session.secured = true
        const secured = new tls.TLSSocket(socket, {
          isServer: true,
          key: credentials.key,
          cert: credentials.cert
        })
        sockets.add(secured)
        secured.on('close', () => sockets.delete(secured))
        serveSession(secured, session, credentials, sockets)
        return
      }
      if (verb === 'MAIL') {
        session.sender = extractAddress(line)
        socket.write('250 2.1.0 Sender ok\r\n')
        continue
      }
      if (verb === 'RCPT') {
        session.recipients.push(extractAddress(line))
        socket.write('250 2.1.5 Recipient ok\r\n')
        continue
      }
      if (verb === 'DATA') {
        inData = true
        socket.write('354 End data with <CR><LF>.<CR><LF>\r\n')
        continue
      }
      if (verb === 'QUIT') {
        socket.write('221 2.0.0 Bye\r\n')
        socket.end()
        continue
      }
      socket.write('502 5.5.1 Command not implemented\r\n')
    }
  }
  socket.on('data', onData)
}

/**
 * Send one message and verify both sides of the exchange.
 * @description Runs a full send against a loopback server and asserts the observed session.
 * @param mailer - Library entry point under test
 * @param credentials - PEM key and certificate enabling STARTTLS, or null for plaintext
 * @param label - Scenario name used in failure messages
 */
async function runScenario(mailer, credentials, label) {
  const server = await startSmtpServer(credentials)
  const guard = setTimeout(() => {
    server.close()
    fail(`${label}: timed out after 20s waiting for the send to complete`)
  }, 20000)
  if (typeof guard.unref === 'function') {
    guard.unref()
  }
  let result
  try {
    const transport = mailer.transporter({
      host: '127.0.0.1',
      port: server.port,
      secure: false
    })
    result = await transport.send({
      from: senderAddress,
      to: recipientAddresses,
      subject: messageSubject,
      text: messageBody
    })
  } catch (error) {
    server.close()
    clearTimeout(guard)
    fail(`${label}: send threw: ${(error && error.stack) || error}`)
  }
  clearTimeout(guard)
  const session = server.sessions[0]
  server.close()
  assert(session !== undefined, `${label}: server accepted no connection`)
  assert(
    session.secured === Boolean(credentials),
    `${label}: expected secured=${Boolean(credentials)}, saw ${session.secured}`
  )
  assert(session.complete, `${label}: server never saw the end-of-data terminator`)
  assert(
    JSON.stringify(result.acceptedRecipients) === JSON.stringify(recipientAddresses),
    `${label}: acceptedRecipients mismatch: ${JSON.stringify(result.acceptedRecipients)}`
  )
  assert(
    JSON.stringify(session.recipients) === JSON.stringify(recipientAddresses),
    `${label}: server recipients mismatch: ${JSON.stringify(session.recipients)}`
  )
  assert(session.sender === senderAddress, `${label}: server sender mismatch: ${session.sender}`)
  assert(
    typeof result.messageId === 'string' && result.messageId.length > 0,
    `${label}: messageId is not a non-empty string: ${JSON.stringify(result.messageId)}`
  )
  assert(
    typeof result.response === 'string' && result.response.startsWith('250'),
    `${label}: response does not start with 250: ${JSON.stringify(result.response)}`
  )
  assert(
    session.data.includes(`Subject: ${messageSubject}`),
    `${label}: DATA payload is missing the Subject header`
  )
  assert(session.data.includes(messageBody), `${label}: DATA payload is missing the body text`)
}

/**
 * Re-run this script with a throwaway trusted certificate.
 * @description The STARTTLS leg needs the self-signed certificate in the trust store, and
 * `NODE_EXTRA_CA_CERTS` is only read at process start, so the run is forwarded to a child.
 * @returns Exit status of the child process
 */
function relaunchWithTrustedCertificate() {
  const workDir = mkdtempSync(join(tmpdir(), 'deno-mailer-smoke-'))
  const keyPath = join(workDir, 'key.pem')
  const certPath = join(workDir, 'cert.pem')
  try {
    const generated = spawnSync('openssl', [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-keyout',
      keyPath,
      '-out',
      certPath,
      '-days',
      '1',
      '-nodes',
      '-subj',
      '/CN=127.0.0.1',
      '-addext',
      'subjectAltName=IP:127.0.0.1'
    ], { stdio: 'ignore' })
    if (generated.status !== 0) {
      fail('openssl is required to generate the smoke certificate')
    }
    const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_EXTRA_CA_CERTS: certPath,
        SMOKE_TLS_KEY: keyPath,
        SMOKE_TLS_CERT: certPath
      }
    })
    return child.status ?? 1
  } finally {
    rmSync(workDir, { recursive: true, force: true })
  }
}

/**
 * Run the cross-runtime smoke test.
 * @description Sends a plaintext message and a STARTTLS message through the bundled library.
 */
async function main() {
  if (!process.env.SMOKE_TLS_CERT) {
    process.exit(relaunchWithTrustedCertificate())
  }
  const runtime = typeof globalThis.Bun === 'undefined' ? 'node' : 'bun'
  const packageUrl = new URL('../dist/mailer.mjs', import.meta.url)
  let mailer
  try {
    const imported = await import(packageUrl.href)
    mailer = imported.default ?? imported.mailer
  } catch (error) {
    fail(`cannot import ${packageUrl.href}: ${error && error.message}`)
  }
  assert(mailer && typeof mailer.transporter === 'function', 'bundle exposes no transporter')
  const { readFileSync } = await import('node:fs')
  const credentials = {
    key: readFileSync(process.env.SMOKE_TLS_KEY),
    cert: readFileSync(process.env.SMOKE_TLS_CERT)
  }
  await runScenario(mailer, null, 'plaintext')
  await runScenario(mailer, credentials, 'starttls')
  console.log(`smoke ok (${runtime}): plaintext and starttls`)
}

await main()
