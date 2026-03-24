import { assertEquals } from '@std/assert'
import * as Utils from '@utils/index.ts'

Deno.test('utils barrel exports validation and content helpers', () => {
  assertEquals(typeof Utils.validateEmailAttachment, 'function')
  assertEquals(typeof Utils.validateEmbeddedImage, 'function')
  assertEquals(typeof Utils.validateSmtpConfig, 'function')
  assertEquals(typeof Utils.generateContentId, 'function')
  assertEquals(typeof Utils.validateContentId, 'function')
  assertEquals(typeof Utils.validateMailboxAddress, 'function')
  assertEquals(typeof Utils.encodeSmtpData, 'function')
})
