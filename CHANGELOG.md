# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Added test suite under `tests/` covering:
  SMTP address parsing, SMTP connection behavior, SMTP message formatting,
  calendar formatting, and utility validation helpers
- Added integration test coverage for real SMTP send flows:
  plain text, HTML, attachments, embedded images, calendar invite,
  mixed recipients, custom headers, and secure TLS transport
- Added test environment setup examples in `README.md` using `.env` and shell exports

### Changed

- Sorted test case descriptions in ascending A-Z order for consistency
- Improved several test descriptions to be clearer and more specific
- Expanded `USAGE.md` with attachment encoding options (`base64`, `7bit`, `quoted-printable`)
  and embedded image disposition options (`inline`, `attachment`)
- Updated `README.md` features to mention transfer encoding support

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

[Unreleased]: https://github.com/NeaByteLab/Deno-Mailer/compare/9618b63...HEAD
[0.1.0]: https://github.com/NeaByteLab/Deno-Mailer/commit/9618b63
