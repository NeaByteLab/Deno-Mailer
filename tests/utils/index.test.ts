import { assertEquals } from '@std/assert'
import * as Utils from '@utils/index.ts'

Deno.test('utils barrel exports validation and content helpers', () => {
  assertEquals(typeof Utils.isValidAttachment, 'function')
  assertEquals(typeof Utils.isValidConfig, 'function')
  assertEquals(typeof Utils.generateContentId, 'function')
  assertEquals(typeof Utils.isValidEmail, 'function')
})
