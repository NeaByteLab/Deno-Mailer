<div align="center">

# Deno Mailer

Lightweight SMTP mailer for Deno, Node and Bun, with flexible configuration and formatting.

[![Deno](https://img.shields.io/badge/deno-%3E%3D2.x-000000?logo=deno&logoColor=white)](https://deno.com) [![Node](https://img.shields.io/badge/node-%3E%3D22-5FA04E?logo=nodedotjs&logoColor=white)](https://nodejs.org) [![Bun](https://img.shields.io/badge/bun-%3E%3D1.1-FBF0DF?logo=bun&logoColor=black)](https://bun.sh) [![JSR](https://jsr.io/badges/@neabyte/deno-mailer)](https://jsr.io/@neabyte/deno-mailer) [![CI](https://github.com/NeaByteLab/Deno-Mailer/actions/workflows/ci.yml/badge.svg)](https://github.com/NeaByteLab/Deno-Mailer/actions/workflows/ci.yml) [![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

</div>

## Features

- **Simple SMTP transport**: create transporter and send emails with minimal setup
- **Connection pooling support**: reuse SMTP clients with configurable pool limits
- **Bounded network timeouts**: connect, TLS handshake, and socket inactivity limits close stalled connections
- **DKIM signing support**: sign outgoing messages with RSA private key
- **Flexible recipients**: supports string, object, and mixed recipient formats
- **Rich message content**: plain text, HTML, mixed body, and custom headers
- **Attachments and inline media**: supports file attachments and embedded images
- **Transfer encodings**: base64, 7bit, quoted-printable for attachment content
- **Calendar invitations**: generates ICS calendar payload for meeting invites
- **Structured send result**: returns message id, envelope, accepted, rejected, and response
- **Runs on Deno, Node and Bun**: one source, native `Deno.connect` on Deno and `node:net`/`node:tls` elsewhere
- **Zero external runtime deps**: built on runtime primitives only

## Installation

```bash
# Deno, from JSR.
deno add jsr:@neabyte/deno-mailer
```

```bash
# Node.
npx jsr add @neabyte/deno-mailer
```

```bash
# Bun.
bunx jsr add @neabyte/deno-mailer
```

Requires Deno `>=2.x`, Node `>=22` or Bun `>=1.1`. On Node and Bun, `jsr add` registers the
`@jsr` registry in your project and installs the same source as ESM with type declarations,
so the import specifier stays `@neabyte/deno-mailer`.

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

```bash
# Bundle the library and send a message through it on Node and on Bun.
deno task smoke:node
deno task smoke:bun
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
