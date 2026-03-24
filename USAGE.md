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

```ts
// Port 587 with STARTTLS upgrade.
{
  host: 'smtp.gmail.com',
  port: 587,
  secure: false
}

// Port 465 with direct TLS.
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

### Attachment Encoding Options

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
      content: fileBase64Content,
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

## API Reference

### Main API

| Method                       | Description               | Parameters             | Returns                   |
| ---------------------------- | ------------------------- | ---------------------- | ------------------------- |
| `mailer.transporter(config)` | Creates email transporter | `SmtpConnectionConfig` | `EmailSender`             |
| `transporter.send(message)`  | Sends email message       | `EmailMessage`         | `Promise<SmtpSendResult>` |

### Configuration Options

| Option                          | Type           | Required | Description                  | Example                            |
| ------------------------------- | -------------- | -------- | ---------------------------- | ---------------------------------- |
| `host`                          | string         | yes      | SMTP server hostname         | `'smtp.gmail.com'`                 |
| `port`                          | number         | yes      | SMTP server port             | `587`, `465`, `25`                 |
| `secure`                        | boolean        | no       | Use TLS connection           | `true` (465), `false` (587)        |
| `auth.type`                     | string         | no       | Auth mode                    | `'password'`, `'oauth2'`           |
| `auth.user`                     | string         | no       | SMTP username                | `'user@example.com'`               |
| `auth.pass`                     | string         | no       | SMTP password                | `'your-password'`                  |
| `auth.accessToken`              | string         | no       | OAuth2 bearer token          | `'ya29.a0...'`                     |
| `pool`                          | boolean/object | no       | Enable SMTP client reuse     | `true`, `{...}`                    |
| `pool.maxConnections`           | number         | no       | Maximum pooled clients       | `2`                                |
| `pool.maxMessagesPerConnection` | number         | no       | Recycle client after N sends | `100`                              |
| `pool.idleTimeoutMs`            | number         | no       | Idle disconnect timeout ms   | `60000`                            |
| `dkim.domainName`               | string         | no       | DKIM signing domain          | `'example.com'`                    |
| `dkim.keySelector`              | string         | no       | DKIM DNS selector            | `'mail'`                           |
| `dkim.privateKey`               | string         | no       | PEM private signing key      | `'-----BEGIN PRIVATE KEY-----...'` |

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

Attachment and embedded image encoding supports `base64`, `7bit`, and `quoted-printable`.
Embedded image disposition supports `inline` and `attachment`.

### Send Result

`transporter.send()` now resolves a structured result:

- `messageId`: Message-ID header value
- `envelope`: SMTP envelope sender and recipients
- `acceptedRecipients`: recipients accepted by server
- `rejectedRecipients`: recipients rejected by server
- `response`: final SMTP DATA completion response

### Error Handling

```ts
// Catch transport or SMTP response errors.
try {
  await transporter.send(message)
} catch (error) {
  console.error('Email failed:', error.message)
  if (error.message.includes('authentication')) {
    // Handle auth error.
  } else if (error.message.includes('connection')) {
    // Handle connectivity error.
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

- Use `secure: false` for `587` (STARTTLS)
- Use `secure: true` for `465` (direct TLS)
- Verify the server certificate chain

### Debug Snippet

```ts
// Log success and failure details.
try {
  await transporter.send(message)
  console.log('Email sent successfully')
} catch (error) {
  console.error('SMTP Error:', error.message)
}
```
