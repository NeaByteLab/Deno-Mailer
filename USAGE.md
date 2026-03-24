# Usage

This document explains the full **Deno Mailer** usage flow, from SMTP configuration to advanced message features like attachments, embedded images, calendar invites, and troubleshooting.

## Table of Contents

- [Installation](#installation)
- [Configuration](#configuration)
  - [SMTP Settings](#smtp-settings)
  - [Authentication](#authentication)
  - [DKIM Signing](#dkim-signing)
  - [Pooling and Reuse](#pooling-and-reuse)
  - [TLS and SSL Options](#tls-and-ssl-options)
- [Basic Usage](#basic-usage)
  - [Simple Text Email](#simple-text-email)
  - [HTML Email](#html-email)
  - [Mixed Content](#mixed-content)
  - [Multiple Recipients](#multiple-recipients)
  - [Advanced Recipient Formats](#advanced-recipient-formats)
- [Advanced Features](#advanced-features)
  - [Combining Body Modes](#combining-body-modes)
  - [File Attachments](#file-attachments)
  - [Attachment Encoding Options](#attachment-encoding-options)
  - [Embedded Images](#embedded-images)
  - [Embedded Image Disposition](#embedded-image-disposition)
  - [Calendar Invitations](#calendar-invitations)
  - [Custom Headers](#custom-headers)
- [API Reference](#api-reference)
  - [Main API](#main-api)
  - [Configuration Options](#configuration-options)
  - [Message Properties](#message-properties)
  - [Send Result](#send-result)
  - [Error Handling](#error-handling)
- [Provider Examples](#provider-examples)
  - [Gmail SMTP](#gmail-smtp)
  - [Outlook SMTP](#outlook-smtp)
  - [Custom SMTP Server](#custom-smtp-server)
- [Troubleshooting](#troubleshooting)

## Installation

```bash
# Install package from JSR.
deno add jsr:@neabyte/deno-mailer
```

Import the mailer from the same specifier your project uses for JSR (after `deno add`, the import map entry is usually `@neabyte/deno-mailer`):

```ts
import { mailer } from 'jsr:@neabyte/deno-mailer'
// or: import { mailer } from '@neabyte/deno-mailer'
```

Types ship with the package. Use `import type { EmailMessage, SmtpConnectionConfig, SmtpSendResult } from 'jsr:@neabyte/deno-mailer'` when you only need types.

> [!TIP]
> After `deno add`, prefer the import map key (often `@neabyte/deno-mailer`) so paths stay short and consistent.

## Configuration

### SMTP Settings

```ts
// Define SMTP host, port, and auth.
const config = {
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    type: 'password',
    user: 'your-email@gmail.com',
    pass: 'your-app-password'
  }
}
```

### Authentication

Deno Mailer supports two explicit authentication modes:

- `type: 'password'` using LOGIN with PLAIN fallback
- `type: 'oauth2'` using XOAUTH2 bearer token

```ts
// Password authentication object.
auth: {
  type: 'password',
  user: 'username',
  pass: 'password'
}

// OAuth2 authentication object.
auth: {
  type: 'oauth2',
  user: 'username',
  accessToken: 'access-token-value'
}

// For local SMTP without auth, omit `auth`.
```

> [!IMPORTANT]
> When you pass `auth`, you must set `type` to `'password'` or `'oauth2'` and include the matching fields (`pass` or `accessToken`). Implicit auth objects are not supported.

### DKIM Signing

```ts
// Enable DKIM signing with selector and private key.
const transporter = mailer.transporter({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    type: 'password',
    user: 'your-email@gmail.com',
    pass: 'your-app-password'
  },
  dkim: {
    domainName: 'example.com',
    keySelector: 'mail',
    privateKey: Deno.env.get('DKIM_PRIVATE_KEY') || ''
  }
})
```

Optional `dkim.headerFieldNames` lists which message headers are included in the DKIM `h=` tag (use lowercase names). If you omit it, the default set is `from`, `to`, `subject`, `date`, `message-id`, `mime-version`, `content-type`.

> [!WARNING]
> If you set `dkim`, validation requires non-empty `domainName`, `keySelector`, and `privateKey`. An empty `privateKey` (for example from a missing env var) fails at transporter creation.

### Pooling and Reuse

```ts
// Reuse SMTP clients across sends with bounded pool config.
const transporter = mailer.transporter({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    type: 'password',
    user: 'your-email@gmail.com',
    pass: 'your-app-password'
  },
  pool: {
    maxConnections: 2,
    maxMessagesPerConnection: 100,
    idleTimeoutMs: 60000
  }
})
```

### TLS and SSL Options

When `secure` is omitted, it behaves like `false` (plain TCP first, then optional `STARTTLS`).

With `secure: false`, the client opens a plain TCP connection, sends `EHLO`, then:

- If the server advertises `STARTTLS`, the client upgrades to TLS and sends `EHLO` again (this applies to any port where the server offers `STARTTLS`, not only 587).
- On **port 587**, the server **must** advertise `STARTTLS`. If it does not, the client throws an error.

With `secure: true`, the connection uses TLS from the first byte (typical for port 465). Use this for implicit TLS, not for port 587 submission with `STARTTLS`.

> [!WARNING]
> If **587** fails with a STARTTLS error, confirm the server advertises `STARTTLS` after `EHLO`. Some setups expect **port 465** with `secure: true` (implicit TLS) instead.

```ts
// Port 587: plain connect, then mandatory STARTTLS upgrade after EHLO.
{
  host: 'smtp.gmail.com',
  port: 587,
  secure: false
}

// Port 465: TLS from connect.
{
  host: 'smtp.gmail.com',
  port: 465,
  secure: true
}
```

## Basic Usage

### Simple Text Email

```ts
// Send plain text email and inspect delivery result.
const result = await transporter.send({
  from: 'sender@example.com',
  to: 'recipient@example.com',
  subject: 'Hello World',
  text: 'This is a plain text email'
})
console.log(result.acceptedRecipients)
```

### HTML Email

```ts
// Send HTML email body.
await transporter.send({
  from: 'sender@example.com',
  to: 'recipient@example.com',
  subject: 'HTML Email',
  html: '<h1>Hello!</h1><p>This is an <strong>HTML</strong> email.</p>'
})
```

### Mixed Content

```ts
// Send text and HTML alternatives together.
await transporter.send({
  from: 'sender@example.com',
  to: 'recipient@example.com',
  subject: 'Mixed Content',
  text: 'This is the plain text version',
  html: '<h1>This is the HTML version</h1>'
})
```

### Multiple Recipients

```ts
// Use to, cc, bcc, and replyTo fields.
await transporter.send({
  from: 'sender@example.com',
  to: ['user1@example.com', 'user2@example.com'],
  cc: 'manager@example.com',
  bcc: 'admin@example.com',
  replyTo: 'support@example.com',
  subject: 'Email to Multiple Recipients',
  text: 'This email goes to multiple people'
})
```

### Advanced Recipient Formats

```ts
// Mix string and object recipient formats.
await transporter.send({
  from: { name: 'John Doe', address: 'john@example.com' },
  to: [
    'user1@example.com',
    { name: 'Jane Smith', address: 'jane@example.com' },
    '"Display Name" <user3@example.com>'
  ],
  cc: ['manager@example.com', { name: 'Team Lead', address: 'lead@example.com' }],
  bcc: 'admin@example.com',
  replyTo: { name: 'Support Team', address: 'support@example.com' },
  subject: 'Advanced Recipient Formats',
  text: 'Supports various recipient formats'
})
```

## Advanced Features

### Combining Body Modes

The formatter builds **one** MIME structure per message. It does **not** combine embedded images, calendar parts, and file attachments into a single custom multipart tree. Evaluation order is:

1. `embeddedImages` → multipart/related (with HTML and related parts)
2. Else `calendarEvent` → multipart/alternative including the calendar
3. Else `attachments` → multipart/mixed
4. Else `html` and `text` together → multipart/alternative
5. Else `html` only, or plain `text` only

If you set more than one of `embeddedImages`, `calendarEvent`, and `attachments`, the earlier branch wins and the others are ignored for structure (for example calendar plus attachments in one send is not supported as one merged layout).

> [!IMPORTANT]
> Only **one** of these shapes applies per message: embedded images **or** calendar **or** file attachments for the top-level MIME choice. You cannot merge them into a single custom multipart tree in one send.

### File Attachments

```ts
// Send one attachment.
await transporter.send({
  from: 'sender@example.com',
  to: 'recipient@example.com',
  subject: 'Email with Attachment',
  text: 'Check the attached file',
  attachments: [
    {
      filename: 'document.pdf',
      content: fileContent,
      contentType: 'application/pdf',
      encoding: 'base64'
    }
  ]
})
```

`filename` cannot contain `"`, CR, or LF (they would break the MIME `filename="..."` parameter). If you set `contentType`, it cannot contain CR or LF. Embedded image `cid` values cannot contain line breaks inside the angle brackets.

### Attachment Encoding Options

Transfer encoding behavior:

- **`base64`:** Pass **raw** content (`string` as UTF-8 text, or `Uint8Array` as bytes). The library encodes to Base64. Do **not** pass a string that is already Base64 unless you want it encoded again (wrong for binary files).
- **`7bit`:** Content must be **ASCII only** (bytes 0–127). Non-ASCII input throws.
- **`quoted-printable`:** Bytes are escaped per quoted-printable rules. The encoder does **not** fold lines to ~76 characters, which some strict MTAs expect for long lines.

> [!NOTE]
> For `base64`, pass **raw** file bytes or text. Passing an already Base64-encoded string will be encoded again and corrupt binary payloads.

```ts
// Use base64, 7bit, or quoted-printable transfer encoding.
await transporter.send({
  from: 'sender@example.com',
  to: 'recipient@example.com',
  subject: 'Attachment Encoding Options',
  text: 'Different transfer encodings are supported',
  attachments: [
    {
      filename: 'base64.txt',
      content: rawFileContent,
      contentType: 'text/plain',
      encoding: 'base64'
    },
    {
      filename: 'plain.txt',
      content: 'Plain text body',
      contentType: 'text/plain',
      encoding: '7bit'
    },
    {
      filename: 'qp.txt',
      content: 'Quoted printable body',
      contentType: 'text/plain',
      encoding: 'quoted-printable'
    }
  ]
})
```

```ts
// Send multiple attachments with mixed content types.
await transporter.send({
  from: 'sender@example.com',
  to: 'recipient@example.com',
  subject: 'Multiple Attachments',
  text: 'Check the attached files',
  attachments: [
    {
      filename: 'document.pdf',
      content: pdfData,
      contentType: 'application/pdf',
      encoding: 'base64'
    },
    {
      filename: 'image.jpg',
      content: imgData,
      contentType: 'image/jpeg',
      encoding: 'base64'
    },
    {
      filename: 'readme.txt',
      content: 'Plain text content',
      contentType: 'text/plain',
      encoding: '7bit'
    }
  ]
})
```

### Embedded Images

```ts
// Embed inline image in HTML body.
await transporter.send({
  from: 'sender@example.com',
  to: 'recipient@example.com',
  subject: 'Email with Image',
  html: '<h1>Hello!</h1><img src="cid:logo">',
  embeddedImages: [
    {
      filename: 'logo.png',
      content: imageContent,
      contentType: 'image/png',
      cid: '<logo@example.com>',
      disposition: 'inline'
    }
  ]
})
```

### Embedded Image Disposition

```ts
// Set inline or attachment disposition for embedded images.
await transporter.send({
  from: 'sender@example.com',
  to: 'recipient@example.com',
  subject: 'Embedded Image Disposition',
  html: '<h1>Hello!</h1><img src="cid:logo">',
  embeddedImages: [
    {
      filename: 'logo.png',
      content: imageContent,
      contentType: 'image/png',
      cid: '<logo@example.com>',
      disposition: 'inline',
      encoding: 'base64'
    },
    {
      filename: 'badge.png',
      content: badgeContent,
      contentType: 'image/png',
      cid: '<badge@example.com>',
      disposition: 'attachment',
      encoding: 'base64'
    }
  ]
})
```

### Calendar Invitations

```ts
// Send basic calendar invitation.
await transporter.send({
  from: 'sender@example.com',
  to: 'recipient@example.com',
  subject: 'Meeting Invitation',
  text: 'You are invited to a meeting',
  calendarEvent: {
    uid: 'meeting-123',
    summary: 'Team Meeting',
    description: 'Weekly team sync',
    location: 'Conference Room A',
    startTime: '2024-01-15T10:00:00Z',
    endTime: '2024-01-15T11:00:00Z',
    organizer: 'organizer@example.com',
    attendees: ['attendee1@example.com', 'attendee2@example.com']
  }
})
```

```ts
// Send complete calendar event payload.
await transporter.send({
  from: 'sender@example.com',
  to: 'recipient@example.com',
  subject: 'Important Meeting',
  text: 'Please attend this important meeting',
  html: '<h1>Important Meeting</h1><p>Please attend this meeting.</p>',
  calendarEvent: {
    uid: 'important-meeting-456',
    summary: 'Quarterly Review',
    description: 'Q4 performance review and planning for next quarter',
    location: 'Main Conference Room, Building A',
    startTime: '2024-01-20T14:00:00Z',
    endTime: '2024-01-20T16:00:00Z',
    organizer: 'manager@company.com',
    attendees: ['employee1@company.com', 'employee2@company.com', 'hr@company.com'],
    status: 'CONFIRMED'
  }
})
```

### Custom Headers

```ts
// Attach custom SMTP headers.
await transporter.send({
  from: 'sender@example.com',
  to: 'recipient@example.com',
  subject: 'Custom Headers',
  text: 'Email with custom headers',
  headers: {
    'X-Priority': '1',
    'X-Custom-Header': 'Custom Value'
  }
})
```

Rules:

- Header **names** must match token characters (see RFC 5322 `atext`-style set used in code). Empty names are rejected.
- Names and values must **not** contain CR or LF.
- These names are **reserved** and cannot be set via `headers` (the library owns them): `bcc`, `cc`, `content-disposition`, `content-id`, `content-transfer-encoding`, `content-type`, `date`, `from`, `message-id`, `mime-version`, `reply-to`, `subject`, `to`.

> [!WARNING]
> Setting a reserved header name (case-insensitive) throws. Use the top-level `to`, `cc`, `bcc`, `replyTo`, `subject`, and body fields instead of duplicating them in `headers`.

## API Reference

### Main API

| Method                       | Description               | Parameters             | Returns                   |
| ---------------------------- | ------------------------- | ---------------------- | ------------------------- |
| `mailer.transporter(config)` | Creates email transporter | `SmtpConnectionConfig` | `EmailSender`             |
| `transporter.send(message)`  | Sends email message       | `EmailMessage`         | `Promise<SmtpSendResult>` |

### Configuration Options

| Option                          | Type           | Required                | Description                   | Example                               |
| ------------------------------- | -------------- | ----------------------- | ----------------------------- | ------------------------------------- |
| `host`                          | string         | yes                     | SMTP server hostname          | `'smtp.gmail.com'`                    |
| `port`                          | number         | yes                     | SMTP server port              | `587`, `465`, `25`                    |
| `secure`                        | boolean        | no                      | Implicit TLS from connect     | `true` (465), `false` or omit (587)   |
| `auth`                          | object         | no                      | Omit for servers without AUTH | See [Authentication](#authentication) |
| `auth.type`                     | string         | when `auth` set         | Password or OAuth2            | `'password'`, `'oauth2'`              |
| `auth.user`                     | string         | when `auth` set         | SMTP username                 | `'user@example.com'`                  |
| `auth.pass`                     | string         | when `type: 'password'` | SMTP password                 | `'your-password'`                     |
| `auth.accessToken`              | string         | when `type: 'oauth2'`   | OAuth2 bearer token           | `'ya29.a0...'`                        |
| `pool`                          | boolean/object | no                      | Enable SMTP client reuse      | `true`, `{...}`                       |
| `pool.maxConnections`           | number         | no                      | Maximum pooled clients        | `2`                                   |
| `pool.maxMessagesPerConnection` | number         | no                      | Recycle client after N sends  | `100`                                 |
| `pool.idleTimeoutMs`            | number         | no                      | Idle disconnect timeout ms    | `60000`                               |
| `dkim.domainName`               | string         | no                      | DKIM signing domain           | `'example.com'`                       |
| `dkim.keySelector`              | string         | no                      | DKIM DNS selector             | `'mail'`                              |
| `dkim.privateKey`               | string         | no                      | PEM private signing key       | `'-----BEGIN PRIVATE KEY-----...'`    |
| `dkim.headerFieldNames`         | string[]       | no                      | Headers in DKIM `h=` list     | `['from','to','subject',...]`         |

### Message Properties

| Property         | Type          | Required | Description                  |
| ---------------- | ------------- | -------- | ---------------------------- |
| `from`           | string/object | yes      | Sender email address         |
| `to`             | string/array  | yes      | Recipient email address(es)  |
| `subject`        | string        | yes      | Email subject line           |
| `text`           | string        | no       | Plain text content           |
| `html`           | string        | no       | HTML content                 |
| `cc`             | string/array  | no       | Carbon copy recipients       |
| `bcc`            | string/array  | no       | Blind carbon copy recipients |
| `replyTo`        | string/object | no       | Reply-to address             |
| `attachments`    | array         | no       | File attachments             |
| `embeddedImages` | array         | no       | Embedded images              |
| `calendarEvent`  | object        | no       | Calendar invitation          |
| `headers`        | object        | no       | Custom email headers         |

Attachment and embedded image `encoding` supports `base64` (library encodes raw content), `7bit` (ASCII only), and `quoted-printable` (no automatic line folding). Embedded image `disposition` supports `inline` and `attachment`.

For SMTP envelope validation, mailbox strings used as bare emails (after parsing) cannot contain CR or LF.

The `subject` string cannot contain CR or LF. For `calendarEvent`, values in `uid`, `summary`, `startTime`, `endTime`, `description`, `location`, `organizer`, and each `attendees` entry cannot contain CR or LF.

### Send Result

`transporter.send()` resolves a structured result:

- `messageId`: value from the generated `Message-ID` header (empty string if parsing ever fails)
- `envelope`: `from` is SMTP `MAIL FROM`, `to` lists every address used in `RCPT TO` (includes `to`, `cc`, and `bcc` recipients)
- `acceptedRecipients`: addresses accepted by the server for `RCPT TO`
- `rejectedRecipients`: addresses rejected for `RCPT TO`
- `response`: final SMTP response after the terminating `DATA` dot

> [!NOTE]
> `envelope.to` lists every address sent in `RCPT TO`, including **BCC** recipients. Do not treat that list as a public “visible To” header if you must hide BCC addresses in your own UI or logs.

### Error Handling

Many failures surface as `Error` messages prefixed with `Failed to send message:` or `SMTP connection failed:` plus the underlying reason. Simple `message.includes('…')` checks can miss cases if the wording changes, so prefer logging the full message or matching a broader substring.

```ts
// Catch transport or SMTP response errors.
try {
  await transporter.send(message)
} catch (error) {
  const text = error instanceof Error ? error.message : String(error)
  console.error('Email failed:', text)
  if (/authentication|auth/i.test(text)) {
    // Handle auth error.
  } else if (/connection|connect|STARTTLS|TLS/i.test(text)) {
    // Handle connectivity or TLS error.
  }
}
```

## Provider Examples

### Gmail SMTP

```ts
// Gmail STARTTLS setup.
const transporter = mailer.transporter({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    type: 'password',
    user: 'your-email@gmail.com',
    pass: 'your-app-password'
  }
})
```

### Outlook SMTP

```ts
// Outlook STARTTLS setup.
const transporter = mailer.transporter({
  host: 'smtp-mail.outlook.com',
  port: 587,
  secure: false,
  auth: {
    type: 'password',
    user: 'your-email@outlook.com',
    pass: 'your-password'
  }
})
```

### Custom SMTP Server

```ts
// Custom SMTP setup.
const transporter = mailer.transporter({
  host: 'mail.yourcompany.com',
  port: 587,
  secure: false,
  auth: {
    type: 'password',
    user: 'noreply@yourcompany.com',
    pass: 'your-password'
  }
})
```

## Troubleshooting

### Authentication Failed

- Verify SMTP username and password
- For Gmail, use App Passwords instead of account password
- If 2FA is enabled, generate and use an App Password

### Connection Timeout

- Verify SMTP host and port values
- Check firewall or network restrictions
- Try alternative SMTP ports (`587`, `465`, `25`)

### TLS Errors

- On port `587`, the server must advertise `STARTTLS` or the client will error
- Use `secure: false` for `587` (STARTTLS after EHLO)
- Use `secure: true` for `465` (direct TLS)
- Verify the server certificate chain

### Debug Snippet

```ts
// Log success and failure details.
try {
  await transporter.send(message)
  console.log('Email sent successfully')
} catch (error) {
  const text = error instanceof Error ? error.message : String(error)
  console.error('SMTP Error:', text)
}
```
