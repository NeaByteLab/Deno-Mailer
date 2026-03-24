import { assertMatch, assertThrows } from '@std/assert'
import * as SMTP from '@smtp/index.ts'

const smtpMessage = new SMTP.SmtpMessage({
  host: 'smtp.ethereal.email',
  port: 587,
  secure: false
})

Deno.test('SmtpMessage accepts safe custom headers', () => {
  const formattedMessage = smtpMessage.formatMessage({
    from: 'sender@example.com',
    to: 'receiver@example.com',
    subject: 'Header',
    text: 'body',
    headers: {
      'X-Security-Test': 'safe-value',
      'X-Trace_Id': 'trace-123'
    }
  })
  assertMatch(formattedMessage, /X-Security-Test: safe-value/)
  assertMatch(formattedMessage, /X-Trace_Id: trace-123/)
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

Deno.test('SmtpMessage rejects custom header names with invalid characters', () => {
  assertThrows(
    () =>
      smtpMessage.formatMessage({
        from: 'sender@example.com',
        to: 'receiver@example.com',
        subject: 'Header',
        text: 'body',
        headers: {
          'Bad Header': 'value'
        }
      }),
    Error,
    'contains invalid characters'
  )
})

Deno.test('SmtpMessage rejects custom header names with line breaks', () => {
  assertThrows(
    () =>
      smtpMessage.formatMessage({
        from: 'sender@example.com',
        to: 'receiver@example.com',
        subject: 'Header',
        text: 'body',
        headers: {
          'X-Test\r\nBcc': 'value'
        }
      }),
    Error,
    'contains invalid characters'
  )
})

Deno.test('SmtpMessage rejects custom header values with line breaks', () => {
  assertThrows(
    () =>
      smtpMessage.formatMessage({
        from: 'sender@example.com',
        to: 'receiver@example.com',
        subject: 'Header',
        text: 'body',
        headers: {
          'X-Test': 'ok\r\nBcc: victim@example.com'
        }
      }),
    Error,
    'value contains line break characters'
  )
})

Deno.test('SmtpMessage rejects empty custom header names', () => {
  assertThrows(
    () =>
      smtpMessage.formatMessage({
        from: 'sender@example.com',
        to: 'receiver@example.com',
        subject: 'Header',
        text: 'body',
        headers: {
          '   ': 'value'
        }
      }),
    Error,
    'name cannot be empty'
  )
})

Deno.test('SmtpMessage rejects reserved custom header names', () => {
  assertThrows(
    () =>
      smtpMessage.formatMessage({
        from: 'sender@example.com',
        to: 'receiver@example.com',
        subject: 'Header',
        text: 'body',
        headers: {
          Subject: 'Injected subject'
        }
      }),
    Error,
    'reserved and cannot be overridden'
  )
})

Deno.test('SmtpMessage rejects reserved headers case-insensitively', () => {
  assertThrows(
    () =>
      smtpMessage.formatMessage({
        from: 'sender@example.com',
        to: 'receiver@example.com',
        subject: 'Header',
        text: 'body',
        headers: {
          'mImE-vErSiOn': '2.0'
        }
      }),
    Error,
    'reserved and cannot be overridden'
  )
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
