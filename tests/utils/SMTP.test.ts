import { assertEquals } from '@std/assert'
import * as Utils from '@utils/index.ts'

Deno.test('encodeSmtpData does not stuff dot mid-line', () => {
  assertEquals(Utils.encodeSmtpData('a.b.c'), 'a.b.c')
})

Deno.test('encodeSmtpData dot-stuffs after each CRLF before a dot', () => {
  const input = 'hello\r\n.\r\nworld'
  const out = Utils.encodeSmtpData(input)
  assertEquals(out, 'hello\r\n..\r\nworld')
})

Deno.test('encodeSmtpData dot-stuffs line that begins with dot', () => {
  assertEquals(Utils.encodeSmtpData('.'), '..')
  assertEquals(Utils.encodeSmtpData('.\r\n'), '..\r\n')
})

Deno.test('encodeSmtpData handles empty string', () => {
  assertEquals(Utils.encodeSmtpData(''), '')
})

Deno.test('encodeSmtpData normalizes bare LF to CRLF', () => {
  assertEquals(Utils.encodeSmtpData('a\nb'), 'a\r\nb')
})

Deno.test('encodeSmtpData preserves existing CRLF', () => {
  assertEquals(Utils.encodeSmtpData('a\r\nb'), 'a\r\nb')
})

Deno.test('encodeSmtpData stuffs dot after normalized CRLF', () => {
  assertEquals(Utils.encodeSmtpData('a\n.b'), 'a\r\n..b')
})

Deno.test('encodeSmtpData stuffs first dot of line that starts with two dots', () => {
  assertEquals(Utils.encodeSmtpData('a\r\n..end'), 'a\r\n...end')
})
