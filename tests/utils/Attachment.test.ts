import { assertThrows } from '@std/assert'
import * as Utils from '@utils/index.ts'

Deno.test('isValidAttachment accepts binary attachment', () => {
  Utils.isValidAttachment({
    filename: 'hello.txt',
    content: new Uint8Array([72, 105]),
    contentType: 'text/plain',
    encoding: 'base64'
  })
})

Deno.test('isValidAttachment rejects unsupported encoding', () => {
  assertThrows(
    () =>
      Utils.isValidAttachment({
        filename: 'hello.txt',
        content: 'hello',
        encoding: 'utf8' as never
      }),
    Error,
    'encoding must be base64'
  )
})

Deno.test('isValidEmbedded rejects cid without angle brackets', () => {
  assertThrows(
    () =>
      Utils.isValidEmbedded({
        filename: 'inline.png',
        content: 'abc',
        cid: 'image@example.com'
      }),
    Error,
    'must be enclosed in angle brackets'
  )
})
