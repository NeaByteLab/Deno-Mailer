import { assertThrows } from '@std/assert'
import * as Utils from '@utils/index.ts'

Deno.test('isValidConfig accepts valid SMTP config', () => {
  Utils.isValidConfig({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: 'vernie18@ethereal.email',
      pass: 'E63awnsa2hbZT9s8s4'
    }
  })
})

Deno.test('isValidConfig rejects empty auth user', () => {
  assertThrows(
    () =>
      Utils.isValidConfig({
        host: 'smtp.ethereal.email',
        port: 587,
        auth: {
          user: '',
          pass: 'secret'
        }
      }),
    Error,
    'auth user is required'
  )
})

Deno.test('isValidConfig rejects invalid port range', () => {
  assertThrows(
    () =>
      Utils.isValidConfig({
        host: 'smtp.ethereal.email',
        port: 70000
      }),
    Error,
    'between 1 and 65535'
  )
})
