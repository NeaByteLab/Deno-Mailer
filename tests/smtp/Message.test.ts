import { assertMatch, assertThrows } from '@std/assert'
import * as SMTP from '@smtp/index.ts'

const smtpMessage = new SMTP.SmtpMessage({
  host: 'smtp.ethereal.email',
  port: 587,
  secure: false
})

Deno.test('SmtpMessage formats multipart html and text', () => {
  const formattedMessage = smtpMessage.formatMessage({
    from: 'sender@example.com',
    to: 'receiver@example.com',
    subject: 'Mixed',
    text: 'text-part',
    html: '<b>html-part</b>'
  })
  assertMatch(formattedMessage, /multipart\/alternative/)
  assertMatch(formattedMessage, /text-part/)
  assertMatch(formattedMessage, /<b>html-part<\/b>/)
})

Deno.test('SmtpMessage formats plain text message', () => {
  const formattedMessage = smtpMessage.formatMessage({
    from: 'sender@example.com',
    to: 'receiver@example.com',
    subject: 'Plain',
    text: 'hello'
  })
  assertMatch(formattedMessage, /Content-Type: text\/plain; charset=utf-8/)
  assertMatch(formattedMessage, /Subject: Plain/)
  assertMatch(formattedMessage, /hello/)
})

Deno.test('SmtpMessage throws when embedded cid is invalid', () => {
  assertThrows(
    () =>
      smtpMessage.formatMessage({
        from: 'sender@example.com',
        to: 'receiver@example.com',
        subject: 'Inline',
        html: '<img src="cid:logo" />',
        embeddedImages: [
          {
            filename: 'logo.png',
            content: 'abc',
            cid: 'logo'
          }
        ]
      }),
    Error,
    'Content-ID must be enclosed in angle brackets'
  )
})
