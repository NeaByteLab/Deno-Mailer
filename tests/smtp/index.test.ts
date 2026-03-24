import { assertEquals } from '@std/assert'
import * as SMTP from '@smtp/index.ts'

Deno.test('smtp barrel exports SMTP classes used by consumers', () => {
  assertEquals(typeof SMTP.SmtpAddress, 'function')
  assertEquals(typeof SMTP.SmtpAuth, 'function')
  assertEquals(typeof SMTP.SmtpCalendar, 'function')
  assertEquals(typeof SMTP.SmtpClient, 'function')
  assertEquals(typeof SMTP.SmtpCommand, 'function')
  assertEquals(typeof SMTP.SmtpConnection, 'function')
  assertEquals(typeof SMTP.SmtpMessage, 'function')
})
