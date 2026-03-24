<div align="center">

# Deno Mailer

Lightweight Deno SMTP mailer with flexible configuration and formatting.

[![Deno](https://img.shields.io/badge/deno-%3E%3D2.x-000000?logo=deno&logoColor=white)](https://deno.com) [![JSR](https://jsr.io/badges/@neabyte/deno-mailer)](https://jsr.io/@neabyte/deno-mailer) [![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

</div>

## Features

- **Simple SMTP transport**: create transporter and send emails with minimal setup
- **Flexible recipients**: supports string, object, and mixed recipient formats
- **Rich message content**: plain text, HTML, mixed body, and custom headers
- **Attachments and inline media**: supports file attachments and embedded images
- **Calendar invitations**: generates ICS calendar payload for meeting invites
- **Zero external runtime deps**: built with Deno native capabilities

## Installation

```bash
# Install package from JSR.
deno add jsr:@neabyte/deno-mailer
```

## Quick Start

```ts
// Import package entry.
import mailer from '@neabyte/deno-mailer'

// Create SMTP transporter instance.
const transporter = mailer.transporter({
  host: 'smtp.domain.com',
  port: 587,
  secure: false,
  auth: {
    user: 'user@domain.com',
    pass: 'password'
  }
})

// Send one email with text and HTML parts.
await transporter.send({
  from: '"John Doe" <john.doe@example.com>',
  to: 'recipient@domain.com',
  subject: 'Test Email',
  text: 'This is a test email',
  html: '<b>This is a test email</b>'
})
```

## Build and Check

```bash
# Run format, lint, and type-check.
deno task check
```

## Reference

- [USAGE.md](USAGE.md): complete API usage, configuration, and troubleshooting

## Contributing

Contributions are welcome. Open an issue or submit a pull request.

## License

This project is licensed under the MIT license. See [LICENSE](LICENSE).
