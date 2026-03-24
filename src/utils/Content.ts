/**
 * Generate unique MIME Content-ID token.
 * @description Combines random bytes, timestamp, and mailbox domain.
 * @param mailboxDomain - Host part after @ inside angle brackets
 * @returns Bracketed Content-ID suitable for MIME headers
 */
export function generateContentId(mailboxDomain = 'deno-mailer.local'): string {
  const randomEntropyBytes = new Uint8Array(16)
  crypto.getRandomValues(randomEntropyBytes)
  const randomHexFingerprint = Array.from(randomEntropyBytes)
    .map((byteValue) => byteValue.toString(16).padStart(2, '0'))
    .join('')
  const timeBase36Prefix = Date.now().toString(36)
  return `<${timeBase36Prefix}-${randomHexFingerprint}@${mailboxDomain}>`
}

/**
 * Validate Content-ID header value shape.
 * @description Requires brackets, @, length bounds, no line breaks.
 * @param rawContentId - Candidate Content-ID string from caller
 * @throws {Error} When format or length rules are violated
 */
export function validateContentId(rawContentId: string): void {
  if (!rawContentId) {
    throw new Error('Content-ID is required')
  }
  if (!rawContentId.startsWith('<') || !rawContentId.endsWith('>')) {
    throw new Error('Content-ID must be enclosed in angle brackets')
  }
  if (rawContentId.includes('\r') || rawContentId.includes('\n')) {
    throw new Error('Content-ID cannot contain line break characters')
  }
  if (!rawContentId.includes('@')) {
    throw new Error('Content-ID must contain @ symbol')
  }
  if (rawContentId.length < 10 || rawContentId.length > 100) {
    throw new Error('Content-ID must be between 10 and 100 characters')
  }
}
