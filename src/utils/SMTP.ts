/**
 * Normalize MIME body for SMTP DATA.
 * @description Converts newlines to CRLF and stuffs leading-dot lines.
 * @param rawMimeMessageBody - Full MIME text before wire framing
 * @returns DATA-phase-safe payload with dot stuffing applied
 */
export function encodeSmtpData(rawMimeMessageBody: string): string {
  const crlfNormalizedBody = rawMimeMessageBody.replace(/\r?\n/g, '\r\n')
  return crlfNormalizedBody.replace(/(^|\r\n)\./g, '$1..')
}
