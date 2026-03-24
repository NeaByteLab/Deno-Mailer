import type * as Types from '@app/Types.ts'
import * as SMTP from '@smtp/index.ts'
import * as Utils from '@utils/index.ts'

/**
 * Build SMTP MIME message.
 * @description Formats headers, body, and multipart sections.
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
   * Format attachments section.
   * @description Builds multipart body including attached files.
   * @param message - Email message with attachments
   * @param boundary - MIME boundary string
   * @returns Formatted message body
   * @throws {Error} When attachments are missing
   */
  private formatAttachments(message: Types.EmailMessage, boundary: string): string {
    const parts = []
    if (message.text || message.html) {
      const contentBoundary = `content_${Date.now()}`
      parts.push(`--${boundary}`)
      parts.push(`Content-Type: multipart/alternative; boundary="${contentBoundary}"`)
      parts.push('')
      if (message.text) {
        parts.push(`--${contentBoundary}`)
        parts.push('Content-Type: text/plain; charset=utf-8')
        parts.push('')
        parts.push(message.text)
        parts.push('')
      }
      if (message.html) {
        parts.push(`--${contentBoundary}`)
        parts.push('Content-Type: text/html; charset=utf-8')
        parts.push('')
        parts.push(message.html)
        parts.push('')
      }
      parts.push(`--${contentBoundary}--`)
      parts.push('')
    }
    if (!message.attachments) {
      throw new Error('Attachments are required')
    }
    for (const attachment of message.attachments) {
      parts.push(`--${boundary}`)
      parts.push(`Content-Type: ${attachment.contentType || 'application/octet-stream'}`)
      parts.push(`Content-Disposition: attachment; filename="${attachment.filename}"`)
      parts.push(`Content-Transfer-Encoding: ${attachment.encoding || 'base64'}`)
      parts.push('')
      if (attachment.content instanceof Uint8Array) {
        parts.push(btoa(String.fromCharCode(...attachment.content)))
      } else {
        parts.push(attachment.content)
      }
      parts.push('')
    }
    parts.push(`--${boundary}--`)
    return parts.join('\r\n')
  }

  /**
   * Format calendar section.
   * @description Appends text, HTML, and calendar invitation.
   * @param message - Email message with calendar event
   * @param boundary - MIME boundary string
   * @returns Formatted message body
   * @throws {Error} When calendar event is missing
   */
  private formatCalendarEvent(message: Types.EmailMessage, boundary: string): string {
    const parts = []
    if (message.text) {
      parts.push(`--${boundary}`)
      parts.push('Content-Type: text/plain; charset=utf-8')
      parts.push('')
      parts.push(message.text)
      parts.push('')
    }
    if (message.html) {
      parts.push(`--${boundary}`)
      parts.push('Content-Type: text/html; charset=utf-8')
      parts.push('')
      parts.push(message.html)
      parts.push('')
    }
    parts.push(`--${boundary}`)
    parts.push('Content-Type: text/calendar; charset=utf-8; method=REQUEST')
    parts.push('Content-Disposition: inline')
    parts.push('')
    if (!message.calendarEvent) {
      throw new Error('Calendar event is required')
    }
    parts.push(SMTP.SmtpCalendar.formatCalendarEvent(message.calendarEvent))
    parts.push('')
    parts.push(`--${boundary}--`)
    return parts.join('\r\n')
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
    const parts = []
    if (message.text || message.html) {
      const contentBoundary = `content_${Date.now()}`
      parts.push(`--${boundary}`)
      parts.push(`Content-Type: multipart/alternative; boundary="${contentBoundary}"`)
      parts.push('')
      if (message.text) {
        parts.push(`--${contentBoundary}`)
        parts.push('Content-Type: text/plain; charset=utf-8')
        parts.push('')
        parts.push(message.text)
        parts.push('')
      }
      if (message.html) {
        parts.push(`--${contentBoundary}`)
        parts.push('Content-Type: text/html; charset=utf-8')
        parts.push('')
        parts.push(message.html)
        parts.push('')
      }
      parts.push(`--${contentBoundary}--`)
      parts.push('')
    }
    for (const attachment of message.embeddedImages) {
      parts.push(`--${boundary}`)
      parts.push(`Content-Type: ${attachment.contentType || 'application/octet-stream'}`)
      parts.push(
        `Content-Disposition: ${
          attachment.disposition || 'inline'
        }; filename="${attachment.filename}"`
      )
      parts.push(`Content-ID: ${attachment.cid}`)
      parts.push(`Content-Transfer-Encoding: ${attachment.encoding || 'base64'}`)
      parts.push('')
      if (attachment.content instanceof Uint8Array) {
        parts.push(btoa(String.fromCharCode(...attachment.content)))
      } else {
        parts.push(attachment.content)
      }
      parts.push('')
    }
    parts.push(`--${boundary}--`)
    return parts.join('\r\n')
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
