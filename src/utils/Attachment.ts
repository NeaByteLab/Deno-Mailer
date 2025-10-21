import type { EmailAttachment, EmbeddedImage } from '@app/Types.ts'

/**
 * Validates email attachment data.
 * @param attachment - Attachment to validate
 * @throws {Error} When attachment validation fails
 */
export function isValidAttachment(attachment: EmailAttachment): void {
  if (!attachment) {
    throw new Error('Attachment is required')
  }
  if (!attachment.filename) {
    throw new Error('Attachment filename is required')
  }
  if (typeof attachment.filename !== 'string') {
    throw new Error('Attachment filename must be a string')
  }
  if (attachment.filename.trim().length === 0) {
    throw new Error('Attachment filename cannot be empty')
  }
  if (attachment.filename.length > 255) {
    throw new Error('Attachment filename must be less than 255 characters')
  }
  if (!attachment.content) {
    throw new Error('Attachment content is required')
  }
  if (typeof attachment.content !== 'string' && !(attachment.content instanceof Uint8Array)) {
    throw new Error('Attachment content must be a string or Uint8Array')
  }
  if (attachment.contentType && typeof attachment.contentType !== 'string') {
    throw new Error('Attachment content type must be a string')
  }
  if (
    attachment.encoding &&
    !['base64', '7bit', 'quoted-printable'].includes(attachment.encoding)
  ) {
    throw new Error('Attachment encoding must be base64, 7bit, or quoted-printable')
  }
}

/**
 * Validates embedded image attachment data.
 * @param attachment - Embedded attachment to validate
 * @throws {Error} When embedded attachment validation fails
 */
export function isValidEmbedded(attachment: EmbeddedImage): void {
  isValidAttachment(attachment)
  if (!attachment.cid) {
    throw new Error('Embedded attachment Content-ID is required')
  }
  if (typeof attachment.cid !== 'string') {
    throw new Error('Embedded attachment Content-ID must be a string')
  }
  if (!attachment.cid.startsWith('<') || !attachment.cid.endsWith('>')) {
    throw new Error('Embedded attachment Content-ID must be enclosed in angle brackets')
  }
  if (attachment.disposition && !['inline', 'attachment'].includes(attachment.disposition)) {
    throw new Error('Embedded attachment disposition must be inline or attachment')
  }
}
