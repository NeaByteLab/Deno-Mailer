import type * as Types from '@app/Types.ts'

/**
 * Validates SMTP connection configuration.
 * @description Runs nested checks for host port auth and options.
 * @param config - SMTP configuration to validate
 * @throws {Error} When configuration validation fails
 */
export function validateSmtpConfig(config: Types.SmtpConnectionConfig): void {
  if (!config) {
    throw new Error('Configuration is required')
  }
  validateSmtpAuth(config.auth ?? undefined)
  validateSmtpDkim(config.dkim ?? undefined)
  validateSmtpHost(config.host)
  validateSmtpPool(config.pool ?? undefined)
  validateSmtpPort(config.port)
  validateSmtpSecure(config.secure ?? false)
}

/**
 * Validates SMTP authentication credentials.
 * @description Checks password and oauth2 shapes and lengths.
 * @param auth - Authentication credentials to validate
 * @throws {Error} When authentication validation fails
 */
function validateSmtpAuth(auth: Types.SmtpAuthCredential | undefined): void {
  if (auth) {
    if (!auth.user || auth.user.length === 0) {
      throw new Error('SMTP auth user is required')
    }
    if (auth.user.length > 253) {
      throw new Error('SMTP auth user must be less than 253 characters')
    }
    if (auth.type === 'password') {
      if (!auth.pass || auth.pass.length === 0) {
        throw new Error('SMTP auth password is required')
      }
      if (auth.pass.length > 253) {
        throw new Error('SMTP auth password must be less than 253 characters')
      }
      return
    }
    if (auth.type === 'oauth2') {
      if (!auth.accessToken || auth.accessToken.length === 0) {
        throw new Error('SMTP oauth2 access token is required')
      }
      if (auth.accessToken.length > 8192) {
        throw new Error('SMTP oauth2 access token must be less than 8192 characters')
      }
      return
    }
    throw new Error('SMTP auth type must be password or oauth2')
  }
}

/**
 * Validates SMTP DKIM configuration.
 * @description Ensures domain selector and private key exist.
 * @param dkim - DKIM settings to validate
 * @throws {Error} When DKIM validation fails
 */
function validateSmtpDkim(dkim: Types.SmtpDkimConfig | undefined): void {
  if (!dkim) {
    return
  }
  if (!dkim.domainName || dkim.domainName.trim().length === 0) {
    throw new Error('SMTP dkim domainName is required')
  }
  if (!dkim.keySelector || dkim.keySelector.trim().length === 0) {
    throw new Error('SMTP dkim keySelector is required')
  }
  if (!dkim.privateKey || dkim.privateKey.trim().length === 0) {
    throw new Error('SMTP dkim privateKey is required')
  }
}

/**
 * Validates SMTP host configuration.
 * @description Checks host type length and non-empty value.
 * @param host - Host string to validate
 * @throws {Error} When host validation fails
 */
function validateSmtpHost(host: string): void {
  if (!host) {
    throw new Error('SMTP host is required')
  }
  if (typeof host !== 'string') {
    throw new Error('SMTP host must be a string')
  }
  if (host.trim().length === 0) {
    throw new Error('SMTP host cannot be empty')
  }
  if (host.length > 253) {
    throw new Error('SMTP host must be 253 characters or less')
  }
}

/**
 * Validates SMTP pool configuration.
 * @description Validates pool booleans and numeric constraints.
 * @param pool - Pool settings to validate
 * @throws {Error} When pool validation fails
 */
function validateSmtpPool(pool: Types.SmtpPoolConfig | boolean | undefined): void {
  if (pool === undefined) {
    return
  }
  if (typeof pool === 'boolean') {
    return
  }
  if (
    pool.maxConnections !== undefined &&
    (!Number.isInteger(pool.maxConnections) || pool.maxConnections < 1)
  ) {
    throw new Error('SMTP pool maxConnections must be integer >= 1')
  }
  if (
    pool.maxMessagesPerConnection !== undefined &&
    (!Number.isInteger(pool.maxMessagesPerConnection) || pool.maxMessagesPerConnection < 1)
  ) {
    throw new Error('SMTP pool maxMessagesPerConnection must be integer >= 1')
  }
  if (
    pool.idleTimeoutMs !== undefined &&
    (!Number.isInteger(pool.idleTimeoutMs) || pool.idleTimeoutMs < 0)
  ) {
    throw new Error('SMTP pool idleTimeoutMs must be integer >= 0')
  }
}

/**
 * Validates SMTP port configuration.
 * @description Checks port type integer and allowed range.
 * @param port - Port number to validate
 * @throws {Error} When port validation fails
 */
function validateSmtpPort(port: number): void {
  if (!port) {
    throw new Error('SMTP port is required')
  }
  if (typeof port !== 'number') {
    throw new Error('SMTP port must be a number')
  }
  if (!Number.isInteger(port)) {
    throw new Error('SMTP port must be an integer')
  }
  if (port < 1 || port > 65535) {
    throw new Error('SMTP port must be between 1 and 65535')
  }
}

/**
 * Validates SMTP secure configuration.
 * @description Ensures secure flag is boolean type only.
 * @param secure - Secure flag to validate
 * @throws {Error} When secure validation fails
 */
function validateSmtpSecure(secure: boolean): void {
  if (typeof secure !== 'boolean') {
    throw new Error('SMTP secure option must be a boolean')
  }
}
