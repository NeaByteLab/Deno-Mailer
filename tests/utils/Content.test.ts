import { assertMatch, assertThrows } from '@std/assert'
import * as Utils from '@utils/index.ts'

Deno.test('generateContentId returns cid with domain', () => {
  const cid = Utils.generateContentId('example.com')
  assertMatch(cid, /^<.+@example\.com>$/)
})

Deno.test('isValidContentId accepts generated cid', () => {
  const cid = Utils.generateContentId('example.com')
  Utils.isValidContentId(cid)
})

Deno.test('isValidContentId rejects cid without at symbol', () => {
  assertThrows(() => Utils.isValidContentId('<abcdef>'), Error, 'must contain @ symbol')
})
