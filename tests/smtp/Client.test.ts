import { assertRejects } from '@std/assert'
import * as SMTP from '@smtp/index.ts'

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
