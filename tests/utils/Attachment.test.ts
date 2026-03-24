import { assertThrows } from '@std/assert'
import * as Utils from '@utils/index.ts'

Deno.test('validateEmailAttachment accepts binary attachment', () => {
  Utils.validateEmailAttachment({
    filename: 'hello.txt',
    content: new Uint8Array([72, 105]),
    contentType: 'text/plain',
    encoding: 'base64'
  })
})

Deno.test(
  'validateEmailAttachment rejects contentType containing line break (header injection)',
  () => {
    assertThrows(
      () =>
        Utils.validateEmailAttachment({
          filename: 'f.txt',
          content: 'x',
          contentType: 'text/plain\r\nBcc: x@y.com'
        }),
      Error,
      'Attachment content type cannot contain line breaks'
    )
  }
)

Deno.test('validateEmailAttachment rejects empty filename after trim', () => {
  assertThrows(
    () =>
      Utils.validateEmailAttachment({
        filename: '   ',
        content: 'x'
      }),
    Error,
    'Attachment filename cannot be empty'
  )
})

Deno.test(
  'validateEmailAttachment rejects filename containing double quote (MIME param safety)',
  () => {
    assertThrows(
      () =>
        Utils.validateEmailAttachment({
          filename: 'evil".txt',
          content: 'x'
        }),
      Error,
      'Attachment filename cannot contain quotes or line breaks'
    )
  }
)

Deno.test('validateEmailAttachment rejects filename containing newline', () => {
  assertThrows(
    () =>
      Utils.validateEmailAttachment({
        filename: 'a\nb.txt',
        content: 'x'
      }),
    Error,
    'Attachment filename cannot contain quotes or line breaks'
  )
})

Deno.test('validateEmailAttachment rejects filename longer than 255 characters', () => {
  assertThrows(
    () =>
      Utils.validateEmailAttachment({
        filename: `${'a'.repeat(256)}.txt`,
        content: 'x'
      }),
    Error,
    'Attachment filename must be less than 255 characters'
  )
})

Deno.test('validateEmailAttachment rejects missing attachment object', () => {
  assertThrows(() => Utils.validateEmailAttachment(null as never), Error, 'Attachment is required')
})

Deno.test('validateEmailAttachment rejects missing content', () => {
  assertThrows(
    () =>
      Utils.validateEmailAttachment({
        filename: 'f.txt',
        content: '' as never
      }),
    Error,
    'Attachment content is required'
  )
})

Deno.test('validateEmailAttachment rejects non-string contentType', () => {
  assertThrows(
    () =>
      Utils.validateEmailAttachment({
        filename: 'f.txt',
        content: 'x',
        contentType: 1 as never
      }),
    Error,
    'Attachment content type must be a string'
  )
})

Deno.test('validateEmailAttachment rejects unsupported encoding', () => {
  assertThrows(
    () =>
      Utils.validateEmailAttachment({
        filename: 'hello.txt',
        content: 'hello',
        encoding: 'utf8' as never
      }),
    Error,
    'Attachment encoding must be base64, 7bit, or quoted-printable'
  )
})

Deno.test('validateEmbeddedImage rejects Content-ID inner value with carriage return', () => {
  assertThrows(
    () =>
      Utils.validateEmbeddedImage({
        filename: 'i.png',
        content: 'abc',
        cid: '<img\r@example.com>'
      }),
    Error,
    'Embedded attachment Content-ID cannot contain line breaks'
  )
})

Deno.test('validateEmbeddedImage rejects cid without angle brackets', () => {
  assertThrows(
    () =>
      Utils.validateEmbeddedImage({
        filename: 'inline.png',
        content: 'abc',
        cid: 'image@example.com'
      }),
    Error,
    'Embedded attachment Content-ID must be enclosed in angle brackets'
  )
})

Deno.test('validateEmbeddedImage rejects empty Content-ID string', () => {
  assertThrows(
    () =>
      Utils.validateEmbeddedImage({
        filename: 'inline.png',
        content: 'abc',
        cid: ''
      }),
    Error,
    'Embedded attachment Content-ID is required'
  )
})

Deno.test('validateEmbeddedImage rejects invalid disposition value', () => {
  assertThrows(
    () =>
      Utils.validateEmbeddedImage({
        filename: 'inline.png',
        content: 'abc',
        cid: '<img@example.com>',
        disposition: 'promotional' as never
      }),
    Error,
    'Embedded attachment disposition must be inline or attachment'
  )
})
