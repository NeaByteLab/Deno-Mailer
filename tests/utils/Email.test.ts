import { assertThrows } from '@std/assert'
import * as Utils from '@utils/index.ts'

Deno.test('isValidEmail accepts valid email', () => {
  Utils.isValidEmail('user.name@example.com')
})

Deno.test('isValidEmail rejects invalid domain label', () => {
  assertThrows(
    () => Utils.isValidEmail('user@-example.com'),
    Error,
    'cannot start or end with a hyphen'
  )
})

Deno.test('isValidEmail rejects missing at symbol', () => {
  assertThrows(() => Utils.isValidEmail('user.example.com'), Error, 'exactly one @ symbol')
})
