import { assertMatch, assertThrows } from '@std/assert'
import * as Utils from '@utils/index.ts'

Deno.test('generateContentId returns cid with domain', () => {
  const cid = Utils.generateContentId('example.com')
  assertMatch(cid, /^<.+@example\.com>$/)
})

Deno.test('validateContentId accepts generated cid', () => {
  const cid = Utils.generateContentId('example.com')
  Utils.validateContentId(cid)
})

Deno.test('validateContentId rejects cid containing carriage return', () => {
  assertThrows(() => Utils.validateContentId('<ab\r@c.example>'), Error, 'line break characters')
})

Deno.test('validateContentId rejects cid containing line feed', () => {
  assertThrows(() => Utils.validateContentId('<a\nb@c.d>'), Error, 'line break characters')
})

Deno.test('validateContentId rejects cid longer than 100 characters', () => {
  const longInner = `${'x'.repeat(95)}@y.com`
  assertThrows(
    () => Utils.validateContentId(`<${longInner}>`),
    Error,
    'between 10 and 100 characters'
  )
})

Deno.test('validateContentId rejects cid shorter than 10 characters', () => {
  assertThrows(() => Utils.validateContentId('<a@b.co>'), Error, 'between 10 and 100 characters')
})

Deno.test('validateContentId rejects cid without at symbol', () => {
  assertThrows(() => Utils.validateContentId('<abcdef>'), Error, 'must contain @ symbol')
})
