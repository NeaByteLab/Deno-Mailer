import { assertThrows } from '@std/assert'
import * as Utils from '@utils/index.ts'

Deno.test('isValidConfig accepts valid SMTP config', () => {
  Utils.isValidConfig({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      type: 'password',
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
          type: 'password',
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

Deno.test('isValidConfig accepts oauth2 SMTP config', () => {
  Utils.isValidConfig({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      type: 'oauth2',
      user: 'vernie18@ethereal.email',
      accessToken: 'token-value'
    }
  })
})

Deno.test('isValidConfig rejects auth without type discriminator', () => {
  assertThrows(
    () =>
      Utils.isValidConfig({
        host: 'smtp.ethereal.email',
        port: 587,
        auth: {
          user: 'vernie18@ethereal.email',
          pass: 'secret'
        } as never
      }),
    Error,
    'auth type must be password or oauth2'
  )
})

Deno.test('isValidConfig accepts SMTP config with dkim and pool settings', () => {
  Utils.isValidConfig({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    dkim: {
      domainName: 'example.com',
      keySelector: 'mail',
      privateKey: '-----BEGIN PRIVATE KEY-----test-----END PRIVATE KEY-----'
    },
    pool: {
      maxConnections: 2,
      maxMessagesPerConnection: 100,
      idleTimeoutMs: 60000
    }
  })
})

Deno.test('isValidConfig rejects invalid SMTP pool maxConnections', () => {
  assertThrows(
    () =>
      Utils.isValidConfig({
        host: 'smtp.ethereal.email',
        port: 587,
        pool: {
          maxConnections: 0
        }
      }),
    Error,
    'maxConnections must be integer >= 1'
  )
})

Deno.test('isValidConfig rejects missing SMTP dkim private key', () => {
  assertThrows(
    () =>
      Utils.isValidConfig({
        host: 'smtp.ethereal.email',
        port: 587,
        dkim: {
          domainName: 'example.com',
          keySelector: 'mail',
          privateKey: ''
        }
      }),
    Error,
    'dkim privateKey is required'
  )
})

Deno.test('isValidConfig accepts SMTP boolean pool option', () => {
  Utils.isValidConfig({
    host: 'smtp.ethereal.email',
    port: 587,
    pool: true
  })
})

Deno.test('isValidConfig rejects invalid SMTP pool idle timeout', () => {
  assertThrows(
    () =>
      Utils.isValidConfig({
        host: 'smtp.ethereal.email',
        port: 587,
        pool: {
          idleTimeoutMs: -1
        }
      }),
    Error,
    'idleTimeoutMs must be integer >= 0'
  )
})

Deno.test('isValidConfig rejects invalid SMTP max messages per connection', () => {
  assertThrows(
    () =>
      Utils.isValidConfig({
        host: 'smtp.ethereal.email',
        port: 587,
        pool: {
          maxMessagesPerConnection: 0
        }
      }),
    Error,
    'maxMessagesPerConnection must be integer >= 1'
  )
})
