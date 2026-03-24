import { assertEquals, assertThrows } from '@std/assert'
import * as App from '@app/index.ts'

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
