/**
 * Generates unique Content-ID for embedded attachments.
 * @param domain - Domain name for Content-ID (defaults to 'deno-mailer.local')
 * @returns Generated Content-ID string
 */
export function generateContentId(domain = 'deno-mailer.local'): string {
  const randomBytes = new Uint8Array(16)
  crypto.getRandomValues(randomBytes)
  const hexString = Array.from(randomBytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
  const timestamp = Date.now().toString(36)
  return `<${timestamp}-${hexString}@${domain}>`
}

/**
 * Validates Content-ID format.
 * @param cid - Content-ID string to validate
 * @throws {Error} When Content-ID validation fails
 */
export function isValidContentId(cid: string): void {
  if (!cid) {
    throw new Error('Content-ID is required')
  }
  if (!cid.startsWith('<') || !cid.endsWith('>')) {
    throw new Error('Content-ID must be enclosed in angle brackets')
  }
  if (!cid.includes('@')) {
    throw new Error('Content-ID must contain @ symbol')
  }
  if (cid.length < 10 || cid.length > 100) {
    throw new Error('Content-ID must be between 10 and 100 characters')
  }
}
