import { assertEquals, assertThrows } from '@std/assert'
import * as SMTP from '@smtp/index.ts'

Deno.test('SmtpAddress parses display name format', () => {
  const parsedAddress = SMTP.SmtpAddress.parseAddress('Jane Doe <jane@example.com>')
  assertEquals(parsedAddress.email, 'jane@example.com')
  assertEquals(parsedAddress.displayName, 'Jane Doe')
})

Deno.test('SmtpAddress parses name and address object format', () => {
  const parsedAddress = SMTP.SmtpAddress.parseAddress({
    name: 'John',
    address: 'john@example.com'
  })
  assertEquals(parsedAddress.email, 'john@example.com')
  assertEquals(parsedAddress.displayName, 'John')
})

Deno.test('SmtpAddress rejects invalid address input', () => {
  assertThrows(() => SMTP.SmtpAddress.parseAddress(123 as never), Error, 'Invalid address format')
})
