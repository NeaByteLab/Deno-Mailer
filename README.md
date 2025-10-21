# Deno Mailer [![Deno](https://img.shields.io/badge/Deno-2.5.4-blue)](https://deno.land) [![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

A lightweight SMTP client for Deno. Built with native APIs, zero dependencies, simple setup.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
  - [SMTP Settings](#smtp-settings)
  - [Authentication](#authentication)
  - [TLS/SSL Options](#tlsssl-options)
- [Basic Usage](#basic-usage)
  - [Simple Text Email](#simple-text-email)
  - [HTML Email](#html-email)
  - [Mixed Content](#mixed-content)
  - [Multiple Recipients](#multiple-recipients)
  - [Advanced Recipient Formats](#advanced-recipient-formats)
- [Advanced Features](#advanced-features)
  - [File Attachments](#file-attachments)
  - [Embedded Images](#embedded-images)
  - [Calendar Invitations](#calendar-invitations)
  - [Custom Headers](#custom-headers)
- [API Reference](#api-reference)
  - [Main API](#main-api)
  - [Configuration Options](#configuration-options)
  - [Message Properties](#message-properties)
  - [Error Handling](#error-handling)
- [Examples](#examples)
  - [Gmail SMTP](#gmail-smtp)
  - [Outlook SMTP](#outlook-smtp)
  - [Custom SMTP Server](#custom-smtp-server)
- [Troubleshooting](#troubleshooting)
  - [Common Issues](#common-issues)
  - [Debug Mode](#debug-mode)
- [Contributing](#contributing)
- [License](#license)

## Installation

```bash
deno install @neabyte/deno-mailer
```

## Quick Start

```ts
import mailer from '@neabyte/deno-mailer'

const transporter = mailer.transporter({
  host: 'smtp.domain.com',
  port: 587,
  secure: false,
  auth: {
    user: 'user@domain.com',
    pass: 'password'
  }
})

await transporter.send({
  from: '"John Doe" <john.doe@example.com>',
  to: 'recipient@domain.com',
  subject: 'Test Email',
  text: 'This is a test email',
  html: '<b>This is a test email</b>'
})
```

## Configuration

### SMTP Settings

```ts
const config = {
  host: 'smtp.gmail.com', // SMTP server hostname
  port: 587, // SMTP server port
  secure: false, // Use TLS (true for port 465, false for 587)
  auth: {
    user: 'your-email@gmail.com',
    pass: 'your-app-password'
  }
}
```

### Authentication

Deno-Mailer supports both LOGIN and PLAIN authentication methods:

```ts
// Basic authentication
auth: {
  user: 'username',
  pass: 'password'
}

// No authentication (for local SMTP servers)
// Simply omit the auth property
```

### TLS/SSL Options

```ts
// Port 587 with STARTTLS (recommended)
{
  host: 'smtp.gmail.com',
  port: 587,
  secure: false  // Will upgrade to TLS via STARTTLS
}

// Port 465 with direct TLS
{
  host: 'smtp.gmail.com',
  port: 465,
  secure: true   // Direct TLS connection
}
```

## Basic Usage

### Simple Text Email

```ts
await transporter.send({
  from: 'sender@example.com',
  to: 'recipient@example.com',
  subject: 'Hello World',
  text: 'This is a plain text email'
})
```

### HTML Email

```ts
await transporter.send({
  from: 'sender@example.com',
  to: 'recipient@example.com',
  subject: 'HTML Email',
  html: '<h1>Hello!</h1><p>This is an <strong>HTML</strong> email.</p>'
})
```

### Mixed Content

```ts
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
// Mixed recipient formats
await transporter.send({
  from: { name: 'John Doe', address: 'john@example.com' },
  to: [
    'user1@example.com',
    { name: 'Jane Smith', address: 'jane@example.com' },
    '"Display Name" <user3@example.com>'
  ],
  cc: [
    'manager@example.com',
    { name: 'Team Lead', address: 'lead@example.com' }
  ],
  bcc: 'admin@example.com',
  replyTo: { name: 'Support Team', address: 'support@example.com' },
  subject: 'Advanced Recipient Formats',
  text: 'Supports various recipient formats'
})
```

## Advanced Features

### File Attachments

```ts
// Single attachment
await transporter.send({
  from: 'sender@example.com',
  to: 'recipient@example.com',
  subject: 'Email with Attachment',
  text: 'Check the attached file',
  attachments: [{
    filename: 'document.pdf',
    content: fileContent, // Uint8Array or base64 string
    contentType: 'application/pdf',
    encoding: 'base64' // 'base64', '7bit', or 'quoted-printable'
  }]
})

// Multiple attachments with different encodings
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
await transporter.send({
  from: 'sender@example.com',
  to: 'recipient@example.com',
  subject: 'Email with Image',
  html: '<h1>Hello!</h1><img src="cid:logo">',
  embeddedImages: [{
    filename: 'logo.png',
    content: imageContent,
    contentType: 'image/png',
    cid: '<logo@example.com>',
    disposition: 'inline' // 'inline' or 'attachment'
  }]
})
```

### Calendar Invitations

```ts
// Basic calendar event
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

// Complete calendar event with all options
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
    attendees: [
      'employee1@company.com',
      'employee2@company.com',
      'hr@company.com'
    ],
    status: 'CONFIRMED'
  }
})
```

### Custom Headers

```ts
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

| Method                       | Description               | Parameters             | Returns         |
| ---------------------------- | ------------------------- | ---------------------- | --------------- |
| `mailer.transporter(config)` | Creates email transporter | `SmtpConnectionConfig` | `EmailSender`   |
| `transporter.send(message)`  | Sends email message       | `EmailMessage`         | `Promise<void>` |

### Configuration Options

| Option      | Type    | Required | Description          | Example                               |
| ----------- | ------- | -------- | -------------------- | ------------------------------------- |
| `host`      | string  | ✅       | SMTP server hostname | `'smtp.gmail.com'`                    |
| `port`      | number  | ✅       | SMTP server port     | `587`, `465`, `25`                    |
| `secure`    | boolean | ❌       | Use TLS connection   | `true` (port 465), `false` (port 587) |
| `auth.user` | string  | ❌       | SMTP username        | `'user@example.com'`                  |
| `auth.pass` | string  | ❌       | SMTP password        | `'your-password'`                     |

### Message Properties

| Property         | Type          | Required | Description                  | Examples                                                                    |
| ---------------- | ------------- | -------- | ---------------------------- | --------------------------------------------------------------------------- |
| `from`           | string/object | ✅       | Sender email address         | `'user@example.com'`, `{name: 'John', address: 'john@example.com'}`         |
| `to`             | string/array  | ✅       | Recipient email address(es)  | `'user@example.com'`, `['user1@example.com', 'user2@example.com']`          |
| `subject`        | string        | ✅       | Email subject line           | `'Hello World'`                                                             |
| `text`           | string        | ❌       | Plain text content           | `'This is plain text'`                                                      |
| `html`           | string        | ❌       | HTML content                 | `'<h1>Hello</h1>'`                                                          |
| `cc`             | string/array  | ❌       | Carbon copy recipients       | `'cc@example.com'`                                                          |
| `bcc`            | string/array  | ❌       | Blind carbon copy recipients | `'bcc@example.com'`                                                         |
| `replyTo`        | string/object | ❌       | Reply-to address             | `'reply@example.com'`                                                       |
| `attachments`    | array         | ❌       | File attachments             | `[{filename: 'file.pdf', content: data}]`                                   |
| `embeddedImages` | array         | ❌       | Embedded images              | `[{filename: 'img.png', content: data, cid: '<img@example.com>'}]`          |
| `calendarEvent`  | object        | ❌       | Calendar invitation          | `{uid: 'event-123', summary: 'Meeting', startTime: '2024-01-01T10:00:00Z'}` |
| `headers`        | object        | ❌       | Custom email headers         | `{'X-Priority': '1'}`                                                       |

### Error Handling

```ts
try {
  await transporter.send(message)
} catch (error) {
  console.error('Email failed:', error.message)
  // Handle specific error types
  if (error.message.includes('authentication')) {
    // Handle auth errors
  } else if (error.message.includes('connection')) {
    // Handle connection errors
  }
}
```

## Examples

### Gmail SMTP

```ts
const transporter = mailer.transporter({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: 'your-email@gmail.com',
    pass: 'your-app-password' // Use App Password, not regular password
  }
})
```

### Outlook SMTP

```ts
const transporter = mailer.transporter({
  host: 'smtp-mail.outlook.com',
  port: 587,
  secure: false,
  auth: {
    user: 'your-email@outlook.com',
    pass: 'your-password'
  }
})
```

### Custom SMTP Server

```ts
const transporter = mailer.transporter({
  host: 'mail.yourcompany.com',
  port: 587,
  secure: false,
  auth: {
    user: 'noreply@yourcompany.com',
    pass: 'your-password'
  }
})
```

## Troubleshooting

### Common Issues

**Authentication Failed**

- Verify username/password are correct
- For Gmail, use App Passwords instead of regular passwords
- Check if 2FA is enabled and use App Password

**Connection Timeout**

- Verify SMTP server hostname and port
- Check firewall settings
- Try different ports (587, 465, 25)

**TLS Errors**

- Ensure `secure: false` for port 587 (STARTTLS)
- Use `secure: true` for port 465 (direct TLS)
- Check server TLS certificate

### Debug Mode

```ts
// Add error logging
try {
  await transporter.send(message)
  console.log('Email sent successfully')
} catch (error) {
  console.error('SMTP Error:', error.message)
}
```

## Contributing

Contributions are welcome! Please feel free to submit a [Pull Request](https://github.com/NeaByteLab/Deno-Mailer/pulls).

## License

This project is licensed under the MIT license. See the [LICENSE](LICENSE) file for more info.
