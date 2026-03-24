import { assertEquals } from '@std/assert'
import * as App from '@app/index.ts'

const etherealUser = Deno.env.get('ETHEREAL_USER')
const etherealPass = Deno.env.get('ETHEREAL_PASS')
const oauth2AccessToken = Deno.env.get('SMTP_OAUTH2_ACCESS_TOKEN')
const runSecureSmtpTest = Deno.env.get('RUN_SECURE_SMTP_TEST') === 'true'
const runOAuth2SmtpTest = Deno.env.get('RUN_OAUTH2_SMTP_TEST') === 'true'
const hasEtherealCredentials = Boolean(etherealUser && etherealPass)

const smtpConfig = {
  host: 'smtp.ethereal.email',
  port: 587,
  secure: false,
  auth: {
    type: 'password' as const,
    user: etherealUser ?? '',
    pass: etherealPass ?? ''
  }
}

const secureSmtpConfig = {
  host: 'smtp.ethereal.email',
  port: 465,
  secure: true,
  auth: {
    type: 'password' as const,
    user: etherealUser ?? '',
    pass: etherealPass ?? ''
  }
}

const oauth2SmtpConfig = {
  host: 'smtp.ethereal.email',
  port: 587,
  secure: false,
  auth: {
    type: 'oauth2' as const,
    user: etherealUser ?? '',
    accessToken: oauth2AccessToken ?? ''
  }
}

Deno.test('create transporter with Ethereal SMTP config', () => {
  if (!hasEtherealCredentials) {
    return
  }
  const sender = App.mailer.transporter(smtpConfig)
  assertEquals(typeof sender.send, 'function')
})

Deno.test('send calendar invite email with Ethereal SMTP account', async () => {
  if (!hasEtherealCredentials) {
    return
  }
  const calendarEvent = {
    uid: `integration-${Date.now()}@deno-mailer.local`,
    summary: 'Deno-Mailer Integration Meeting',
    startTime: '2026-03-25T09:00:00Z',
    endTime: '2026-03-25T10:00:00Z',
    status: 'CONFIRMED' as const,
    ...(etherealUser ? { organizer: etherealUser, attendees: [etherealUser] } : {})
  }
  const sender = App.mailer.transporter(smtpConfig)
  await sender.send({
    from: `Mailer Integration <${etherealUser}>`,
    to: `Mailer Integration <${etherealUser}>`,
    subject: 'Deno-Mailer calendar integration test',
    text: 'Calendar invite test',
    calendarEvent
  })
})

Deno.test('send email over oauth2 configuration', async () => {
  if (!etherealUser || !oauth2AccessToken || !runOAuth2SmtpTest) {
    return
  }
  const sender = App.mailer.transporter(oauth2SmtpConfig)
  await sender.send({
    from: `Mailer Integration <${etherealUser}>`,
    to: `Mailer Integration <${etherealUser}>`,
    subject: 'Deno-Mailer oauth2 integration test',
    text: 'OAuth2 send test'
  })
})

Deno.test('send email over secure TLS configuration', async () => {
  if (!hasEtherealCredentials || !runSecureSmtpTest) {
    return
  }
  const sender = App.mailer.transporter(secureSmtpConfig)
  await sender.send({
    from: `Mailer Integration <${etherealUser}>`,
    to: `Mailer Integration <${etherealUser}>`,
    subject: 'Deno-Mailer secure tls integration test',
    text: 'Secure TLS send test'
  })
})

Deno.test('send email with Ethereal SMTP account', async () => {
  if (!hasEtherealCredentials) {
    return
  }
  const sender = App.mailer.transporter(smtpConfig)
  await sender.send({
    from: `Mailer Integration <${etherealUser}>`,
    to: `Mailer Integration <${etherealUser}>`,
    subject: 'Deno-Mailer integration test',
    text: 'This message is sent by Deno test integration.'
  })
})

Deno.test('send email with cc bcc and replyTo fields', async () => {
  if (!hasEtherealCredentials) {
    return
  }
  const sender = App.mailer.transporter(smtpConfig)
  await sender.send({
    from: {
      name: 'Mailer Integration',
      address: etherealUser ?? ''
    },
    to: [{ name: 'Primary', address: etherealUser ?? '' }],
    cc: [`CC User <${etherealUser}>`],
    bcc: [etherealUser ?? ''],
    replyTo: {
      name: 'Reply Handler',
      address: etherealUser ?? ''
    },
    subject: 'Deno-Mailer cc bcc replyTo integration test',
    text: 'Testing cc bcc and replyTo fields'
  })
})

Deno.test('send email with custom headers and mixed recipients', async () => {
  if (!hasEtherealCredentials) {
    return
  }
  const sender = App.mailer.transporter(smtpConfig)
  await sender.send({
    from: `Mailer Integration <${etherealUser}>`,
    to: [etherealUser ?? '', { name: 'Secondary', address: etherealUser ?? '' }],
    subject: 'Deno-Mailer headers integration test',
    text: 'Testing custom headers and mixed recipient formats',
    headers: {
      'X-Integration-Test': `headers-${Date.now()}`,
      'X-Mailer-Suite': 'Deno-Mailer'
    }
  })
})

Deno.test('send email with string attachment content and 7bit encoding', async () => {
  if (!hasEtherealCredentials) {
    return
  }
  const sender = App.mailer.transporter(smtpConfig)
  await sender.send({
    from: `Mailer Integration <${etherealUser}>`,
    to: `Mailer Integration <${etherealUser}>`,
    subject: 'Deno-Mailer string attachment integration test',
    text: 'String attachment content test',
    attachments: [
      {
        filename: 'plain.txt',
        content: 'plain text attachment',
        contentType: 'text/plain',
        encoding: '7bit'
      }
    ]
  })
})

Deno.test('send embedded image email with Ethereal SMTP account', async () => {
  if (!hasEtherealCredentials) {
    return
  }
  const sender = App.mailer.transporter(smtpConfig)
  await sender.send({
    from: `Mailer Integration <${etherealUser}>`,
    to: `Mailer Integration <${etherealUser}>`,
    subject: 'Deno-Mailer embedded image integration test',
    html: '<p>Inline image <img src="cid:integration-image"></p>',
    embeddedImages: [
      {
        filename: 'inline.txt',
        content: new Uint8Array([73, 109, 97, 103, 101]),
        contentType: 'text/plain',
        cid: '<integration-image>',
        encoding: 'base64'
      }
    ]
  })
})

Deno.test('send html and attachment email with Ethereal SMTP account', async () => {
  if (!hasEtherealCredentials) {
    return
  }
  const sender = App.mailer.transporter(smtpConfig)
  await sender.send({
    from: `Mailer Integration <${etherealUser}>`,
    to: `Mailer Integration <${etherealUser}>`,
    subject: 'Deno-Mailer attachment integration test',
    text: 'Attachment text version',
    html: '<p><b>Attachment</b> html version</p>',
    attachments: [
      {
        filename: 'integration.txt',
        content: new Uint8Array([72, 101, 108, 108, 111]),
        contentType: 'text/plain',
        encoding: 'base64'
      }
    ]
  })
})
