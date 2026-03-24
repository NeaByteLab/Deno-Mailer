import { assertThrows } from '@std/assert'
import * as Utils from '@utils/index.ts'

Deno.test('validateMailboxAddress accepts valid email', () => {
  Utils.validateMailboxAddress('user.name@example.com')
})

Deno.test('validateMailboxAddress rejects address containing carriage return', () => {
  assertThrows(
    () => Utils.validateMailboxAddress('user\r@example.com'),
    Error,
    'line break characters'
  )
})

Deno.test('validateMailboxAddress rejects address containing newline (SMTP header safety)', () => {
  assertThrows(
    () => Utils.validateMailboxAddress('user@example.com\nBcc: other@evil.com'),
    Error,
    'line break characters'
  )
})

Deno.test('validateMailboxAddress rejects empty string', () => {
  assertThrows(() => Utils.validateMailboxAddress(''), Error, 'Email is required')
})

Deno.test('validateMailboxAddress rejects invalid domain label', () => {
  assertThrows(
    () => Utils.validateMailboxAddress('user@-example.com'),
    Error,
    'cannot start or end with a hyphen'
  )
})

Deno.test('validateMailboxAddress rejects local part longer than 64 characters', () => {
  const local = `${'a'.repeat(65)}`
  assertThrows(() => Utils.validateMailboxAddress(`${local}@x.co`), Error, 'local part is too long')
})

Deno.test('validateMailboxAddress rejects missing at symbol', () => {
  assertThrows(
    () => Utils.validateMailboxAddress('user.example.com'),
    Error,
    'exactly one @ symbol'
  )
})

Deno.test('validateMailboxAddress rejects multiple at symbols', () => {
  assertThrows(() => Utils.validateMailboxAddress('a@b@c.com'), Error, 'exactly one @ symbol')
})
