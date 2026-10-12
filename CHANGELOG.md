# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2026-10-12

### Added

- Added Node and Bun support: the package now runs on Deno, Node `>=22` and Bun `>=1.1`. Node and Bun install it from JSR with `npx jsr add @neabyte/deno-mailer`, which serves the same source as ESM with type declarations
- Added `SmtpTransport` runtime abstraction with a native Deno implementation and a `node:net`/`node:tls` implementation selected at connect time
- Added `deno task bundle`, `deno task smoke:node` and `deno task smoke:bun`, which send a message through a bundled build against a loopback SMTP server on each runtime
- Added `connectionTimeoutMs` SMTP config option (default `30000`) bounding TCP connect and each TLS handshake
- Added `socketTimeoutMs` SMTP config option (default `60000`) bounding each server reply wait and socket write
- Added config validation for timeout options (integer between `1` and `2147483647`)
- Added loopback SMTP server test helper and transport timeout regression tests

### Changed

- **Breaking:** `SmtpConnectionState` now carries a single `transport: SmtpTransport | null` field instead of `conn: Deno.Conn | null` and `tlsConn: Deno.TlsConn | null`, removing `Deno.*` from the published type surface
- Updated the TLS upgrade to resolve only after the handshake completes, so one timeout covers the whole upgrade on every runtime
- Updated SMTP client to close its socket on timeout so pooled clients reconnect instead of reusing a dead connection
- Updated RCPT handling to fail the send on timeout instead of counting the recipient as rejected
- Updated implicit TLS (`secure: true`) to connect over TCP then start TLS, so connect and handshake are bounded separately
- Updated `SmtpAuth` to share `SmtpCommand` wire I/O instead of a duplicate reader and writer
- Updated CI to run the check and test tasks against both the pinned Deno release and the latest `v2.x`
- Updated `deno task check` to verify formatting instead of rewriting it; use `deno task fmt` to format

### Removed

- **Breaking:** Removed the exported `SmtpConnection` class. It was unreachable from `SmtpClient` and reimplemented the transport without read, write or connect timeouts, without partial-write handling, and without multi-line reply parsing

### Fixed

- Fixed `deno check` failing on Deno `>=2.6`, where the pooled idle timer handle is an object rather than a number
- Fixed SMTP writes ignoring partial socket writes, which truncated messages larger than one write (64 KiB over TLS) and left `send()` waiting indefinitely
- Fixed the Node and Bun TLS upgrade rejecting data buffered before the handshake, which would otherwise allow STARTTLS command injection
- Fixed the secured socket leaking when a TLS handshake exceeded `connectionTimeoutMs`; the abandoned handshake is now aborted and its socket closed
- Fixed TLS upgrades to an SMTP host given as an IP address, which `node:tls` rejects when the address is offered as an SNI name

## [0.3.0] - 2026-03-25

### Added

- Added OAuth2 integration test toggle and token placeholders in `.env.example`
- Added optional OAuth2 live integration scenario in `tests/Integration.test.ts`
- Added strict auth config validation test coverage in `tests/utils/Config.test.ts`
- Added custom header security unit tests in `tests/smtp/Message.test.ts`
- Added SMTP config options for DKIM signing and connection pooling
- Added structured SMTP send result type with envelope and recipient status fields
- Added transfer-encoding unit tests for `base64`, `quoted-printable`, and `7bit` payload behavior

### Changed

- Updated `README.md` and `USAGE.md` to document explicit auth type configuration
- Updated SMTP auth flow to support XOAUTH2 for OAuth2 credentials
- Updated SMTP config validation to enforce explicit auth discriminator
- Updated auth and config types to discriminated union structure
- Updated SMTP message header handling with strict validation in `src/smtp/Message.ts`
- Updated transporter flow to support pooled SMTP client reuse
- Updated SMTP client send flow to return structured delivery metadata
- Updated SMTP command response parsing to handle multiline server responses reliably
- Updated SMTP connection handshake to use `EHLO` and re-send `EHLO` after STARTTLS upgrade
- Updated STARTTLS negotiation to require advertised capability on submission flow
- Updated SMTP DATA payload sending to apply CRLF normalization and RFC 5321 dot-stuffing
- Updated attachment and embedded image encoding logic to match declared transfer encoding
- Updated `src` JSDoc style for consistency (`index.ts`, `Types.ts`, `utils`, `smtp`)
- Reordered `tests/smtp/Message.test.ts` case names alphabetically

### Breaking

- Renamed `@utils` exports from `isValid*` style to `validate*`:
  `validateEmailAttachment`, `validateEmbeddedImage`, `validateSmtpConfig`,
  `validateContentId`, `validateMailboxAddress`
- Renamed SMTP DATA preparation helper `toSmtpSafeDataStream` to `encodeSmtpData`
- Renamed `SmtpAddress.formatAddressForHeader` to `SmtpAddress.formatForHeader`
- Removed implicit auth shape without `auth.type`
- Replaced previous auth credential model with explicit variants:
  `type: 'password'` with `user` and `pass`,
  `type: 'oauth2'` with `user` and `accessToken`
- Disallowed overriding reserved SMTP headers via `message.headers`
- Rejected custom headers containing invalid names or CRLF line breaks
- Changed `EmailSender.send()` return type from `Promise<void>` to `Promise<SmtpSendResult>`

## [0.2.0] - 2026-03-24

### Added

- Added test suite under `tests/` covering:
  SMTP address parsing, SMTP connection behavior, SMTP message formatting,
  calendar formatting, and utility validation helpers
- Added integration test coverage for real SMTP send flows:
  plain text, HTML, attachments, embedded images, calendar invite,
  mixed recipients, custom headers, and secure TLS transport
- Added test environment setup examples in `README.md` using `.env` and shell exports
- Added dedicated CI workflow at `.github/workflows/ci.yml` for check and test
- Added `.env.example` template for integration credentials and secure-test toggle

### Changed

- Expanded `USAGE.md` with attachment encoding options (`base64`, `7bit`, `quoted-printable`)
  and embedded image disposition options (`inline`, `attachment`)
- Updated `.gitignore` for env and local build artifacts
- Updated `README.md` features and testing section with env-based integration flow
- Updated README badge to use CI workflow status
- Updated `deno.json` version to `0.2.0`
- Updated `deno task test` to include net and env permissions

### Breaking

- Renamed SMTP public symbols:
  `AddressParser` to `SmtpAddress`,
  `CalendarFormatter` to `SmtpCalendar`,
  `ConnectionManager` to `SmtpConnection`,
  `MessageFormatter` to `SmtpMessage`
- Renamed SMTP module files:
  `SmtpAuth.ts` to `Auth.ts`,
  `SmtpClient.ts` to `Client.ts`,
  `SmtpCommand.ts` to `Command.ts`
- Renamed utility module file:
  `ContentId.ts` to `Content.ts`
- Switched root type re-export to `export type *` in `src/index.ts`

## [0.1.0] - 2025-10-22

### Added

- Initial public release of `@neabyte/deno-mailer`
- SMTP email client with transporter API and message sender interface
- Core email capabilities: plain text, HTML, mixed body, and custom headers
- Flexible recipient handling for string, object, and mixed address formats
- Attachment and embedded image support with MIME multipart formatting
- Calendar invite support through generated iCalendar payloads
- SMTP connection flow with STARTTLS and TLS transport options
- SMTP authentication support with LOGIN and PLAIN mechanisms
- Utility modules for SMTP config, attachment, content-id, and email validation
- JSR publish workflow and package metadata setup

### Changed

- Refactored SMTP modules to align naming and documentation
- Refactored utility modules to unify imports and content helper naming
- Updated docs split between `README.md` and `USAGE.md`
- Updated `@std/assert` dependency import version

[Unreleased]: https://github.com/NeaByteLab/Deno-Mailer/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/NeaByteLab/Deno-Mailer/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/NeaByteLab/Deno-Mailer/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/NeaByteLab/Deno-Mailer/releases/tag/v0.1.0
