/** Default TCP connect and TLS handshake timeout in milliseconds. */
export const defaultConnectionTimeoutMs = 30000

/** Default SMTP socket inactivity timeout in milliseconds. */
export const defaultSocketTimeoutMs = 60000

/**
 * SMTP operation timeout.
 * @description Raised when connect, handshake, read, or write exceeds its limit.
 */
export class SmtpTimeoutError extends Error {
  /** Error name for diagnostics */
  override name = 'SmtpTimeoutError'
}

/**
 * Await operation with deadline.
 * @description Rejects once the deadline passes and runs cleanup that cancels the operation.
 * @param operation - Pending socket operation
 * @param timeoutMs - Deadline in milliseconds
 * @param message - Timeout error message
 * @param onTimeout - Releases resources held by the operation
 * @returns Operation result when it settles before the deadline
 * @throws {SmtpTimeoutError} When the deadline passes first
 */
export async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  message: string,
  onTimeout: () => void
): Promise<T> {
  const { promise: deadline, reject } = Promise.withResolvers<never>()
  const timerId = setTimeout(() => {
    reject(new SmtpTimeoutError(message))
    onTimeout()
  }, timeoutMs)
  try {
    return await Promise.race([operation, deadline])
  } finally {
    clearTimeout(timerId)
  }
}
