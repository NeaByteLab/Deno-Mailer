<div align="center">

# Deno Mailer

Lightweight Deno SMTP mailer with flexible configuration and formatting.

[![Deno](https://img.shields.io/badge/deno-%3E%3D2.x-000000?logo=deno&logoColor=white)](https://deno.com) [![JSR](https://jsr.io/badges/@neabyte/deno-mailer)](https://jsr.io/@neabyte/deno-mailer) [![CI](https://github.com/NeaByteLab/Deno-Mailer/actions/workflows/ci.yml/badge.svg)](https://github.com/NeaByteLab/Deno-Mailer/actions/workflows/ci.yml) [![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

</div>

## Features

- **Simple SMTP transport**: create transporter and send emails with minimal setup
- **Connection pooling support**: reuse SMTP clients with configurable pool limits
- **DKIM signing support**: sign outgoing messages with RSA private key
- **Flexible recipients**: supports string, object, and mixed recipient formats
- **Rich message content**: plain text, HTML, mixed body, and custom headers
- **Attachments and inline media**: supports file attachments and embedded images
- **Transfer encodings**: base64, 7bit, quoted-printable for attachment content
- **Calendar invitations**: generates ICS calendar payload for meeting invites
- **Structured send result**: returns message id, envelope, accepted, rejected, and response
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
    type: 'password',
    user: 'user@domain.com',
    pass: 'password'
  }
})

// Send one email with text and HTML parts.
const result = await transporter.send({
  from: '"John Doe" <john.doe@example.com>',
  to: 'recipient@domain.com',
  subject: 'Test Email',
  text: 'This is a test email',
  html: '<b>This is a test email</b>'
})
console.log(result.messageId)
```

## Build and Check

```bash
# Run format, lint, and type-check.
deno task check
```

## Test

```bash
# Copy env template for SMTP integration tests.
cp .env.example .env
```

```bash
# Set ETHEREAL_USER and ETHEREAL_PASS in .env, then run test suite.
deno task test
```

```bash
# Alternative: export credentials in shell, then run test suite.
export ETHEREAL_USER=your-ethereal-username
export ETHEREAL_PASS=your-ethereal-password

# Optional: run OAuth2 integration test too.
export SMTP_OAUTH2_ACCESS_TOKEN=your-oauth2-access-token
export RUN_OAUTH2_SMTP_TEST=true

# Optional: run secure TLS (port 465) integration test too.
export RUN_SECURE_SMTP_TEST=true

# Run full unit and integration tests.
deno task test
```

## Reference

- [USAGE.md](USAGE.md): complete API usage, configuration, and troubleshooting
- [CHANGELOG.md](CHANGELOG.md): release history and notable changes

## Contributing

Contributions are welcome. Open an issue or submit a pull request.

## License

This project is licensed under the MIT license. See [LICENSE](LICENSE).
