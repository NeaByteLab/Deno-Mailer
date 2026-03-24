import type * as Types from '@app/Types.ts'
import * as SMTP from '@smtp/index.ts'
import * as Utils from '@utils/index.ts'

/**
 * Build SMTP MIME message.
 * @description Formats headers body and multipart sections.
 */
export class SmtpMessage {
  /** Allowed custom header name pattern */
  private readonly customHeaderNamePattern = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/
  /** Reserved custom headers to block */
  private readonly blockedCustomHeaderNames = new Set([
    'bcc',
    'cc',
    'content-disposition',
    'content-id',
    'content-transfer-encoding',
    'content-type',
    'date',
    'from',
    'message-id',
    'mime-version',
    'reply-to',
    'subject',
    'to'
  ])

  /**
   * Create message formatter.
   * @description Stores SMTP config for generated headers.
   * @param config - SMTP connection configuration for generating message headers
   */
  constructor(private config: Types.SmtpConnectionConfig) {}

  /**
   * Format complete message.
   * @description Builds MIME headers and body from input.
   * @param message - Email message to format
   * @returns Formatted MIME message string
   * @throws {Error} When message validation fails
   */
  formatMessage(message: Types.EmailMessage): string {
    const fromAddress = SMTP.SmtpAddress.parseAddress(message.from)
    const toAddresses = SMTP.SmtpAddress.parseAddressList(message.to)
    const headers = this.buildHeaders(message, fromAddress, toAddresses)
    let body = ''
    const boundary = `boundary_${Date.now()}`
    if (message.embeddedImages && message.embeddedImages.length > 0) {
      headers.push(`Content-Type: multipart/related; boundary="${boundary}"`)
      body = this.formatEmbeddedImages(message, boundary)
    } else if (message.calendarEvent) {
      headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`)
      body = this.formatCalendarEvent(message, boundary)
    } else if (message.attachments && message.attachments.length > 0) {
      headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`)
      body = this.formatAttachments(message, boundary)
    } else if (message.html && message.text) {
      headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`)
      body = this.formatTextAndHtml(message, boundary)
    } else if (message.html) {
      headers.push('Content-Type: text/html; charset=utf-8')
      body = this.formatHtmlOnly(message)
    } else {
      headers.push('Content-Type: text/plain; charset=utf-8')
      body = this.formatTextOnly(message)
    }
    const formattedMessage = headers.join('\r\n') + '\r\n\r\n' + body
    return formattedMessage + '\r\n'
  }

  /**
   * Build message headers.
   * @description Creates standard and custom email headers.
   * @param message - Email message data
   * @param fromAddress - Parsed sender address
   * @param toAddresses - Parsed recipient addresses
   * @returns Array of header strings
   */
  private buildHeaders(
    message: Types.EmailMessage,
    fromAddress: Types.ProcessedContact,
    toAddresses: Types.ProcessedContact[]
  ): string[] {
    const headers = [
      `From: ${SMTP.SmtpAddress.formatAddressForHeader(fromAddress)}`,
      `To: ${toAddresses.map((addr) => SMTP.SmtpAddress.formatAddressForHeader(addr)).join(', ')}`,
      `Subject: ${message.subject}`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: <${Date.now()}@${this.config.host}>`,
      'MIME-Version: 1.0'
    ]
    if (message.cc) {
      const ccAddresses = SMTP.SmtpAddress.parseAddressList(message.cc)
      headers.push(
        `Cc: ${ccAddresses.map((addr) => SMTP.SmtpAddress.formatAddressForHeader(addr)).join(', ')}`
      )
    }
    const replyToAddress = message.replyTo
      ? SMTP.SmtpAddress.parseAddress(message.replyTo)
      : fromAddress
    headers.push(`Reply-To: ${SMTP.SmtpAddress.formatAddressForHeader(replyToAddress)}`)
    if (message.headers) {
      for (const [key, value] of Object.entries(message.headers)) {
        headers.push(this.formatCustomHeader(key, value))
      }
    }
    return headers
  }

  /**
   * Encode content using 7bit.
   * @description Validates ASCII-only payload for 7bit transport.
   * @param content - Input payload
   * @returns ASCII-safe string content
   * @throws {Error} When payload contains non-ASCII bytes
   */
  private encode7Bit(content: string | Uint8Array): string {
    const sourceBytes = content instanceof Uint8Array ? content : new TextEncoder().encode(content)
    for (const byte of sourceBytes) {
      if (byte > 127) {
        throw new Error('7bit encoding requires ASCII-only content')
      }
    }
    return new TextDecoder().decode(sourceBytes)
  }

  /**
   * Encode content using base64.
   * @description Converts string or bytes to base64 payload.
   * @param content - Input payload
   * @returns Base64 encoded string
   */
  private encodeBase64(content: string | Uint8Array): string {
    const sourceBytes = content instanceof Uint8Array ? content : new TextEncoder().encode(content)
    return btoa(String.fromCharCode(...sourceBytes))
  }

  /**
   * Encode content using quoted-printable.
   * @description Escapes bytes per RFC 2045 quoted-printable.
   * @param content - Input payload
   * @returns Quoted-printable encoded string
   */
  private encodeQuotedPrintable(content: string | Uint8Array): string {
    const sourceBytes = content instanceof Uint8Array ? content : new TextEncoder().encode(content)
    let encodedValue = ''
    for (const byte of sourceBytes) {
      if (byte === 9 || byte === 32 || (byte >= 33 && byte <= 60) || (byte >= 62 && byte <= 126)) {
        encodedValue += String.fromCharCode(byte)
      } else {
        encodedValue += `=${byte.toString(16).toUpperCase().padStart(2, '0')}`
      }
    }
    return encodedValue
  }

  /**
   * Encode transfer content.
   * @description Produces MIME-safe body for selected encoding.
   * @param content - Attachment content
   * @param encoding - Requested transfer encoding
   * @returns Encoded attachment payload
   */
  private encodeTransferContent(
    content: string | Uint8Array,
    encoding: 'base64' | '7bit' | 'quoted-printable'
  ): string {
    if (encoding === 'base64') {
      return this.encodeBase64(content)
    }
    if (encoding === 'quoted-printable') {
      return this.encodeQuotedPrintable(content)
    }
    return this.encode7Bit(content)
  }

  /**
   * Format attachments section.
   * @description Builds multipart body including attached files.
   * @param message - Email message with attachments
   * @param boundary - MIME boundary string
   * @returns Formatted message body
   * @throws {Error} When attachments are missing
   */
  private formatAttachments(message: Types.EmailMessage, boundary: string): string {
    const mimeParts: string[] = []
    if (message.text || message.html) {
      const contentBoundary = `content_${Date.now()}`
      mimeParts.push(`--${boundary}`)
      mimeParts.push(`Content-Type: multipart/alternative; boundary="${contentBoundary}"`)
      mimeParts.push('')
      if (message.text) {
        mimeParts.push(`--${contentBoundary}`)
        mimeParts.push('Content-Type: text/plain; charset=utf-8')
        mimeParts.push('')
        mimeParts.push(message.text)
        mimeParts.push('')
      }
      if (message.html) {
        mimeParts.push(`--${contentBoundary}`)
        mimeParts.push('Content-Type: text/html; charset=utf-8')
        mimeParts.push('')
        mimeParts.push(message.html)
        mimeParts.push('')
      }
      mimeParts.push(`--${contentBoundary}--`)
      mimeParts.push('')
    }
    if (!message.attachments) {
      throw new Error('Attachments are required')
    }
    for (const attachment of message.attachments) {
      mimeParts.push(`--${boundary}`)
      mimeParts.push(`Content-Type: ${attachment.contentType || 'application/octet-stream'}`)
      mimeParts.push(`Content-Disposition: attachment; filename="${attachment.filename}"`)
      const transferEncoding = attachment.encoding || 'base64'
      mimeParts.push(`Content-Transfer-Encoding: ${transferEncoding}`)
      mimeParts.push('')
      mimeParts.push(this.encodeTransferContent(attachment.content, transferEncoding))
      mimeParts.push('')
    }
    mimeParts.push(`--${boundary}--`)
    return mimeParts.join('\r\n')
  }

  /**
   * Format calendar section.
   * @description Appends text HTML and calendar invitation.
   * @param message - Email message with calendar event
   * @param boundary - MIME boundary string
   * @returns Formatted message body
   * @throws {Error} When calendar event is missing
   */
  private formatCalendarEvent(message: Types.EmailMessage, boundary: string): string {
    const mimeParts: string[] = []
    if (message.text) {
      mimeParts.push(`--${boundary}`)
      mimeParts.push('Content-Type: text/plain; charset=utf-8')
      mimeParts.push('')
      mimeParts.push(message.text)
      mimeParts.push('')
    }
    if (message.html) {
      mimeParts.push(`--${boundary}`)
      mimeParts.push('Content-Type: text/html; charset=utf-8')
      mimeParts.push('')
      mimeParts.push(message.html)
      mimeParts.push('')
    }
    mimeParts.push(`--${boundary}`)
    mimeParts.push('Content-Type: text/calendar; charset=utf-8; method=REQUEST')
    mimeParts.push('Content-Disposition: inline')
    mimeParts.push('')
    if (!message.calendarEvent) {
      throw new Error('Calendar event is required')
    }
    mimeParts.push(SMTP.SmtpCalendar.formatCalendarEvent(message.calendarEvent))
    mimeParts.push('')
    mimeParts.push(`--${boundary}--`)
    return mimeParts.join('\r\n')
  }

  /**
   * Format custom header.
   * @description Validates custom header name and value safety.
   * @param customHeaderKey - Custom header name
   * @param customHeaderValue - Custom header value
   * @returns Safe custom header string
   * @throws {Error} When custom header key or value is invalid
   */
  private formatCustomHeader(customHeaderKey: string, customHeaderValue: string): string {
    const trimmedHeaderKey = customHeaderKey.trim()
    const normalizedHeaderKey = trimmedHeaderKey.toLowerCase()
    if (trimmedHeaderKey.length === 0) {
      throw new Error('Custom header name cannot be empty')
    }
    if (this.blockedCustomHeaderNames.has(normalizedHeaderKey)) {
      throw new Error(`Custom header "${trimmedHeaderKey}" is reserved and cannot be overridden`)
    }
    if (!this.customHeaderNamePattern.test(trimmedHeaderKey)) {
      throw new Error(`Custom header "${trimmedHeaderKey}" contains invalid characters`)
    }
    if (trimmedHeaderKey.includes('\r') || trimmedHeaderKey.includes('\n')) {
      throw new Error(`Custom header "${trimmedHeaderKey}" contains line break characters`)
    }
    if (customHeaderValue.includes('\r') || customHeaderValue.includes('\n')) {
      throw new Error(`Custom header "${trimmedHeaderKey}" value contains line break characters`)
    }
    return `${trimmedHeaderKey}: ${customHeaderValue}`
  }

  /**
   * Format embedded images section.
   * @description Builds related parts and inline image payloads.
   * @param message - Email message with embedded attachments
   * @param boundary - MIME boundary string
   * @returns Formatted message body
   * @throws {Error} When embedded attachments are missing
   */
  private formatEmbeddedImages(message: Types.EmailMessage, boundary: string): string {
    if (!message.embeddedImages) {
      throw new Error('Embedded attachments are required')
    }
    for (const attachment of message.embeddedImages) {
      Utils.isValidEmbedded(attachment)
    }
    const mimeParts: string[] = []
    if (message.text || message.html) {
      const contentBoundary = `content_${Date.now()}`
      mimeParts.push(`--${boundary}`)
      mimeParts.push(`Content-Type: multipart/alternative; boundary="${contentBoundary}"`)
      mimeParts.push('')
      if (message.text) {
        mimeParts.push(`--${contentBoundary}`)
        mimeParts.push('Content-Type: text/plain; charset=utf-8')
        mimeParts.push('')
        mimeParts.push(message.text)
        mimeParts.push('')
      }
      if (message.html) {
        mimeParts.push(`--${contentBoundary}`)
        mimeParts.push('Content-Type: text/html; charset=utf-8')
        mimeParts.push('')
        mimeParts.push(message.html)
        mimeParts.push('')
      }
      mimeParts.push(`--${contentBoundary}--`)
      mimeParts.push('')
    }
    for (const attachment of message.embeddedImages) {
      mimeParts.push(`--${boundary}`)
      mimeParts.push(`Content-Type: ${attachment.contentType || 'application/octet-stream'}`)
      mimeParts.push(
        `Content-Disposition: ${
          attachment.disposition || 'inline'
        }; filename="${attachment.filename}"`
      )
      mimeParts.push(`Content-ID: ${attachment.cid}`)
      const transferEncoding = attachment.encoding || 'base64'
      mimeParts.push(`Content-Transfer-Encoding: ${transferEncoding}`)
      mimeParts.push('')
      mimeParts.push(this.encodeTransferContent(attachment.content, transferEncoding))
      mimeParts.push('')
    }
    mimeParts.push(`--${boundary}--`)
    return mimeParts.join('\r\n')
  }

  /**
   * Format HTML body.
   * @description Returns HTML content when present.
   * @param message - Email message with HTML content
   * @returns HTML content string
   */
  private formatHtmlOnly(message: Types.EmailMessage): string {
    return message.html || ''
  }

  /**
   * Format text and HTML.
   * @description Builds multipart alternative text and HTML.
   * @param message - Email message with both text and HTML content
   * @param boundary - MIME boundary string
   * @returns Formatted message body
   */
  private formatTextAndHtml(message: Types.EmailMessage, boundary: string): string {
    return [
      `--${boundary}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      message.text || '',
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=utf-8',
      '',
      message.html || '',
      '',
      `--${boundary}--`
    ].join('\r\n')
  }

  /**
   * Format plain text body.
   * @description Returns plain text content fallback.
   * @param message - Email message with text content
   * @returns Text content string
   */
  private formatTextOnly(message: Types.EmailMessage): string {
    return message.text || ''
  }
}
