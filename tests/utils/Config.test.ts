import { assertThrows } from '@std/assert'
import * as Utils from '@utils/index.ts'

Deno.test('validateSmtpConfig accepts oauth2 SMTP config', () => {
  Utils.validateSmtpConfig({
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

Deno.test('validateSmtpConfig accepts SMTP boolean pool option', () => {
  Utils.validateSmtpConfig({
    host: 'smtp.ethereal.email',
    port: 587,
    pool: true
  })
})

Deno.test('validateSmtpConfig accepts SMTP config with dkim and pool settings', () => {
  Utils.validateSmtpConfig({
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

Deno.test('validateSmtpConfig accepts valid SMTP config', () => {
  Utils.validateSmtpConfig({
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

Deno.test('validateSmtpConfig rejects auth without type discriminator', () => {
  assertThrows(
    () =>
      Utils.validateSmtpConfig({
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

Deno.test('validateSmtpConfig rejects empty auth user', () => {
  assertThrows(
    () =>
      Utils.validateSmtpConfig({
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

Deno.test('validateSmtpConfig rejects invalid port range', () => {
  assertThrows(
    () =>
      Utils.validateSmtpConfig({
        host: 'smtp.ethereal.email',
        port: 70000
      }),
    Error,
    'between 1 and 65535'
  )
})

Deno.test('validateSmtpConfig rejects invalid SMTP max messages per connection', () => {
  assertThrows(
    () =>
      Utils.validateSmtpConfig({
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

Deno.test('validateSmtpConfig rejects invalid SMTP pool idle timeout', () => {
  assertThrows(
    () =>
      Utils.validateSmtpConfig({
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

Deno.test('validateSmtpConfig rejects invalid SMTP pool maxConnections', () => {
  assertThrows(
    () =>
      Utils.validateSmtpConfig({
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

Deno.test('validateSmtpConfig rejects missing SMTP dkim private key', () => {
  assertThrows(
    () =>
      Utils.validateSmtpConfig({
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

Deno.test('validateSmtpConfig rejects non-boolean secure flag', () => {
  assertThrows(
    () =>
      Utils.validateSmtpConfig({
        host: 'smtp.example.com',
        port: 587,
        secure: 'false' as never
      }),
    Error,
    'secure option must be a boolean'
  )
})

Deno.test('validateSmtpConfig rejects non-integer pool maxConnections', () => {
  assertThrows(
    () =>
      Utils.validateSmtpConfig({
        host: 'smtp.example.com',
        port: 587,
        pool: {
          maxConnections: 2.5
        }
      }),
    Error,
    'maxConnections must be integer >= 1'
  )
})

Deno.test('validateSmtpConfig rejects non-integer SMTP port', () => {
  assertThrows(
    () =>
      Utils.validateSmtpConfig({
        host: 'smtp.example.com',
        port: 587.5
      }),
    Error,
    'must be an integer'
  )
})

Deno.test('validateSmtpConfig rejects null configuration object', () => {
  assertThrows(() => Utils.validateSmtpConfig(null as never), Error, 'Configuration is required')
})

Deno.test('validateSmtpConfig rejects oauth2 access token longer than 8192 characters', () => {
  const longToken = `${'t'.repeat(8193)}`
  assertThrows(
    () =>
      Utils.validateSmtpConfig({
        host: 'smtp.example.com',
        port: 587,
        auth: {
          type: 'oauth2',
          user: 'user@example.com',
          accessToken: longToken
        }
      }),
    Error,
    'access token must be less than 8192 characters'
  )
})

Deno.test('validateSmtpConfig rejects password longer than 253 characters', () => {
  const longPass = `${'p'.repeat(254)}`
  assertThrows(
    () =>
      Utils.validateSmtpConfig({
        host: 'smtp.example.com',
        port: 587,
        auth: {
          type: 'password',
          user: 'user@example.com',
          pass: longPass
        }
      }),
    Error,
    'password must be less than 253 characters'
  )
})

Deno.test('validateSmtpConfig rejects SMTP auth user longer than 253 characters', () => {
  const longUser = `${'u'.repeat(254)}@example.com`
  assertThrows(
    () =>
      Utils.validateSmtpConfig({
        host: 'smtp.example.com',
        port: 587,
        auth: {
          type: 'password',
          user: longUser,
          pass: 'secret'
        }
      }),
    Error,
    'auth user must be less than 253 characters'
  )
})

Deno.test('validateSmtpConfig rejects SMTP host longer than 253 characters', () => {
  const longHost = `${'h'.repeat(254)}.com`
  assertThrows(
    () =>
      Utils.validateSmtpConfig({
        host: longHost,
        port: 587
      }),
    Error,
    '253 characters or less'
  )
})

Deno.test('validateSmtpConfig rejects SMTP host that is only whitespace', () => {
  assertThrows(
    () =>
      Utils.validateSmtpConfig({
        host: '   ',
        port: 587
      }),
    Error,
    'host cannot be empty'
  )
})
