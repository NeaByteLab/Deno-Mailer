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

Deno.test('mailer transporter returns sender with send function', () => {
  const sender = App.mailer.transporter({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false
  })
  assertEquals(typeof sender.send, 'function')
})
