import { assertEquals, assertMatch, assertThrows } from '@std/assert'
import * as SMTP from '@smtp/index.ts'

/** Must match `reservedHeaderNames` in `src/smtp/Message.ts` (USAGE reserved list). */
const reservedCustomHeaderNames = [
  'bcc',
  'cc',
  'content-disposition',
  'content-id',
  'content-transfer-encoding',
  'content-type',
  'date',
  'from',
  'message-id',
  'mime-version',
  'reply-to',
  'subject',
  'to'
] as const

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

Deno.test('SmtpMessage base64 encodes Uint8Array attachment as raw bytes', () => {
  const formattedMessage = smtpMessage.formatMessage({
    from: 'sender@example.com',
    to: 'receiver@example.com',
    subject: 'Attachment',
    text: 'body',
    attachments: [
      {
        filename: 'raw.bin',
        content: new Uint8Array([72, 105]),
        contentType: 'application/octet-stream',
        encoding: 'base64'
      }
    ]
  })
  assertMatch(formattedMessage, /SGk=/)
})

Deno.test('SmtpMessage base64 encodes string attachment content', () => {
  const formattedMessage = smtpMessage.formatMessage({
    from: 'sender@example.com',
    to: 'receiver@example.com',
    subject: 'Attachment',
    text: 'body',
    attachments: [
      {
        filename: 'hello.txt',
        content: 'Hello',
        contentType: 'text/plain',
        encoding: 'base64'
      }
    ]
  })
  assertMatch(formattedMessage, /Content-Transfer-Encoding: base64/)
  assertMatch(formattedMessage, /SGVsbG8=/)
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

const minimalCalendarEvent = {
  uid: 'event-1',
  summary: 'Meeting',
  startTime: '2024-01-15T10:00:00Z',
  endTime: '2024-01-15T11:00:00Z'
}

Deno.test('SmtpMessage prefers calendarEvent over attachments (USAGE combining order)', () => {
  const formattedMessage = smtpMessage.formatMessage({
    from: 'sender@example.com',
    to: 'receiver@example.com',
    subject: 'Both',
    text: 'invite',
    calendarEvent: minimalCalendarEvent,
    attachments: [
      {
        filename: 'file.txt',
        content: 'data',
        contentType: 'text/plain',
        encoding: '7bit'
      }
    ]
  })
  assertMatch(formattedMessage, /text\/calendar/)
  assertEquals(formattedMessage.includes('filename="file.txt"'), false)
})

Deno.test('SmtpMessage prefers embeddedImages over calendarEvent (USAGE combining order)', () => {
  const formattedMessage = smtpMessage.formatMessage({
    from: 'sender@example.com',
    to: 'receiver@example.com',
    subject: 'Both',
    html: '<img src="cid:x" />',
    calendarEvent: minimalCalendarEvent,
    embeddedImages: [
      {
        filename: 'x.png',
        content: 'abc',
        contentType: 'image/png',
        cid: '<x@example.com>'
      }
    ]
  })
  assertMatch(formattedMessage, /multipart\/related/)
  assertEquals(formattedMessage.includes('text/calendar'), false)
})

Deno.test('SmtpMessage quoted-printable encodes utf8 attachment content', () => {
  const formattedMessage = smtpMessage.formatMessage({
    from: 'sender@example.com',
    to: 'receiver@example.com',
    subject: 'Attachment',
    text: 'body',
    attachments: [
      {
        filename: 'hello.txt',
        content: 'Halo ñ',
        contentType: 'text/plain',
        encoding: 'quoted-printable'
      }
    ]
  })
  assertMatch(formattedMessage, /Content-Transfer-Encoding: quoted-printable/)
  assertMatch(formattedMessage, /Halo =C3=B1/)
})

Deno.test(
  'SmtpMessage rejects attachment filename that breaks MIME quoted param (USAGE send path)',
  () => {
    assertThrows(
      () =>
        smtpMessage.formatMessage({
          from: 'sender@example.com',
          to: 'receiver@example.com',
          subject: 'Attach',
          text: 'body',
          attachments: [
            {
              filename: 'a"b.txt',
              content: 'x',
              contentType: 'text/plain',
              encoding: '7bit'
            }
          ]
        }),
      Error,
      'cannot contain quotes or line breaks'
    )
  }
)

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

Deno.test('SmtpMessage rejects custom header value with bare CR only', () => {
  assertThrows(
    () =>
      smtpMessage.formatMessage({
        from: 'sender@example.com',
        to: 'receiver@example.com',
        subject: 'Header',
        text: 'body',
        headers: {
          'X-Test': 'one\rtwo'
        }
      }),
    Error,
    'value contains line break characters'
  )
})

Deno.test('SmtpMessage rejects custom header value with bare LF only', () => {
  assertThrows(
    () =>
      smtpMessage.formatMessage({
        from: 'sender@example.com',
        to: 'receiver@example.com',
        subject: 'Header',
        text: 'body',
        headers: {
          'X-Test': 'one\ntwo'
        }
      }),
    Error,
    'value contains line break characters'
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

Deno.test('SmtpMessage rejects every reserved custom header name (USAGE contract)', () => {
  for (const headerName of reservedCustomHeaderNames) {
    assertThrows(
      () =>
        smtpMessage.formatMessage({
          from: 'sender@example.com',
          to: 'receiver@example.com',
          subject: 'Header',
          text: 'body',
          headers: { [headerName]: 'injected' }
        }),
      Error,
      'reserved and cannot be overridden'
    )
  }
})

Deno.test('SmtpMessage rejects non-ascii attachment for 7bit encoding', () => {
  assertThrows(
    () =>
      smtpMessage.formatMessage({
        from: 'sender@example.com',
        to: 'receiver@example.com',
        subject: 'Attachment',
        text: 'body',
        attachments: [
          {
            filename: 'hello.txt',
            content: 'Halo ñ',
            contentType: 'text/plain',
            encoding: '7bit'
          }
        ]
      }),
    Error,
    '7bit encoding requires ASCII-only content'
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

Deno.test('SmtpMessage rejects subject with carriage return', () => {
  assertThrows(
    () =>
      smtpMessage.formatMessage({
        from: 'sender@example.com',
        to: 'receiver@example.com',
        subject: 'Hi\rX',
        text: 'body'
      }),
    Error,
    'Subject cannot contain line break characters'
  )
})

Deno.test('SmtpMessage rejects subject with line feed (header injection)', () => {
  assertThrows(
    () =>
      smtpMessage.formatMessage({
        from: 'sender@example.com',
        to: 'receiver@example.com',
        subject: 'Hello\nBcc: victim@evil.com',
        text: 'body'
      }),
    Error,
    'Subject cannot contain line break characters'
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

Deno.test('SmtpMessage trims custom header names before validation', () => {
  const formattedMessage = smtpMessage.formatMessage({
    from: 'sender@example.com',
    to: 'receiver@example.com',
    subject: 'Header',
    text: 'body',
    headers: {
      '  X-Padded-Name  ': 'value'
    }
  })
  assertMatch(formattedMessage, /X-Padded-Name: value/)
})
