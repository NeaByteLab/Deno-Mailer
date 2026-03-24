# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Added OAuth2 integration test toggle and token placeholders in `.env.example`
- Added optional OAuth2 live integration scenario in `tests/Integration.test.ts`
- Added strict auth config validation test coverage in `tests/utils/Config.test.ts`
- Added custom header security unit tests in `tests/smtp/Message.test.ts`
- Added SMTP config options for DKIM signing and connection pooling
- Added structured SMTP send result type with envelope and recipient status fields

### Changed

- Updated `README.md` and `USAGE.md` to document explicit auth type configuration
- Updated SMTP auth flow to support XOAUTH2 for OAuth2 credentials
- Updated SMTP config validation to enforce explicit auth discriminator
- Updated auth and config types to discriminated union structure
- Updated SMTP message header handling with strict validation in `src/smtp/Message.ts`
- Updated transporter flow to support pooled SMTP client reuse
- Updated SMTP client send flow to return structured delivery metadata

### Breaking

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

[Unreleased]: https://github.com/NeaByteLab/Deno-Mailer/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/NeaByteLab/Deno-Mailer/compare/9618b63...v0.2.0
[0.1.0]: https://github.com/NeaByteLab/Deno-Mailer/commit/9618b63
