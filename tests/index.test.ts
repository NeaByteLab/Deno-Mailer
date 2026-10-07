import { assertEquals, assertRejects, assertThrows } from '@std/assert'
import * as App from '@app/index.ts'
import { startSmtpServer } from '@tests/helpers/SmtpServer.ts'

Deno.test('mailer pooled transporter reconnects after a timed-out send', async () => {
  const server = startSmtpServer(['greeting', 'none'])
  const sender = App.mailer.transporter({
    host: '127.0.0.1',
    port: server.port,
    socketTimeoutMs: 200,
    pool: { idleTimeoutMs: 0 }
  })
  const message = {
    from: 'sender@example.com',
    to: 'receiver@example.com',
    subject: 'Test',
    text: 'Hello'
  }
  await assertRejects(() => sender.send(message), Error, 'timed out')
  const sendResult = await sender.send(message)
  assertEquals(sendResult.response, '250 OK queued\r\n')
  const outcomes = await server.outcomes
  assertEquals(outcomes.map((outcome) => outcome.clientClosed), [true, true])
})

Deno.test('mailer transporter rejects invalid config', () => {
  assertThrows(
    () =>
      App.mailer.transporter({
        host: '',
        port: 587
      }),
    Error,
    'SMTP host is required'
  )
})

Deno.test('mailer transporter rejects password auth missing pass', () => {
  assertThrows(
    () =>
      App.mailer.transporter({
        host: 'smtp.example.com',
        port: 587,
        auth: {
          type: 'password',
          user: 'user@example.com',
          pass: ''
        }
      }),
    Error,
    'password is required'
  )
})

Deno.test('mailer transporter rejects zero port', () => {
  assertThrows(
    () =>
      App.mailer.transporter({
        host: 'smtp.example.com',
        port: 0
      }),
    Error,
    'SMTP port is required'
  )
})

Deno.test('mailer transporter returns sender with send function', () => {
  const sender = App.mailer.transporter({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false
  })
  assertEquals(typeof sender.send, 'function')
})
