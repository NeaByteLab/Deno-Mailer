import type * as Types from '@app/Types.ts'

/**
 * Validate email attachment fields.
 * @description Checks filename, MIME type, encoding, and content.
 * @param emailAttachment - File part to validate before MIME build
 * @throws {Error} When required fields or encoding rules fail
 */
export function validateEmailAttachment(emailAttachment: Types.EmailAttachment): void {
  if (!emailAttachment) {
    throw new Error('Attachment is required')
  }
  if (!emailAttachment.filename) {
    throw new Error('Attachment filename is required')
  }
  if (typeof emailAttachment.filename !== 'string') {
    throw new Error('Attachment filename must be a string')
  }
  if (emailAttachment.filename.trim().length === 0) {
    throw new Error('Attachment filename cannot be empty')
  }
  if (emailAttachment.filename.length > 255) {
    throw new Error('Attachment filename must be less than 255 characters')
  }
  if (
    emailAttachment.filename.includes('"') ||
    emailAttachment.filename.includes('\r') ||
    emailAttachment.filename.includes('\n')
  ) {
    throw new Error('Attachment filename cannot contain quotes or line breaks')
  }
  if (!emailAttachment.content) {
    throw new Error('Attachment content is required')
  }
  if (
    typeof emailAttachment.content !== 'string' &&
    !(emailAttachment.content instanceof Uint8Array)
  ) {
    throw new Error('Attachment content must be a string or Uint8Array')
  }
  if (emailAttachment.contentType && typeof emailAttachment.contentType !== 'string') {
    throw new Error('Attachment content type must be a string')
  }
  if (
    emailAttachment.contentType &&
    (emailAttachment.contentType.includes('\r') || emailAttachment.contentType.includes('\n'))
  ) {
    throw new Error('Attachment content type cannot contain line breaks')
  }
  if (
    emailAttachment.encoding &&
    !['base64', '7bit', 'quoted-printable'].includes(emailAttachment.encoding)
  ) {
    throw new Error('Attachment encoding must be base64, 7bit, or quoted-printable')
  }
}

/**
 * Validate embedded image attachment fields.
 * @description Runs attachment checks plus Content-ID and disposition.
 * @param embeddedImage - Inline image part with cid and optional disposition
 * @throws {Error} When attachment, cid, or disposition rules fail
 */
export function validateEmbeddedImage(embeddedImage: Types.EmbeddedImage): void {
  validateEmailAttachment(embeddedImage)
  if (!embeddedImage.cid) {
    throw new Error('Embedded attachment Content-ID is required')
  }
  if (typeof embeddedImage.cid !== 'string') {
    throw new Error('Embedded attachment Content-ID must be a string')
  }
  if (!embeddedImage.cid.startsWith('<') || !embeddedImage.cid.endsWith('>')) {
    throw new Error('Embedded attachment Content-ID must be enclosed in angle brackets')
  }
  const contentIdInnerValue = embeddedImage.cid.slice(1, -1)
  if (contentIdInnerValue.includes('\r') || contentIdInnerValue.includes('\n')) {
    throw new Error('Embedded attachment Content-ID cannot contain line breaks')
  }
  if (embeddedImage.disposition && !['inline', 'attachment'].includes(embeddedImage.disposition)) {
    throw new Error('Embedded attachment disposition must be inline or attachment')
  }
}
