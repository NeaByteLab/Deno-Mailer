import type { EmailMessage, ProcessedContact, SmtpConnectionConfig } from '@app/Types.ts'
import { AddressParser, CalendarFormatter } from '@smtp/index.ts'
import { isValidEmbedded } from '@utils/index.ts'

/**
 * Formats email messages for SMTP transmission.
 * @description Creates MIME messages with headers, content, and attachments.
 */
export class MessageFormatter {
  /**
   * Creates a new message formatter.
   * @param config - SMTP connection configuration for generating message headers
   */
  constructor(private config: SmtpConnectionConfig) {}

  /**
   * Formats complete email message for SMTP transmission.
   * @param message - Email message to format
   * @returns Formatted MIME message string
   * @throws {Error} When message validation fails
   */
  formatMessage(message: EmailMessage): string {
    const fromAddress = AddressParser.parseAddress(message.from)
    const toAddresses = AddressParser.parseAddressList(message.to)
    const headers = this.buildHeaders(message, fromAddress, toAddresses)
    let body = ''
    const boundary = `boundary_${Date.now()}`
    if (message.embeddedImages && message.embeddedImages.length > 0) {
      headers.push(`Content-Type: multipart/related; boundary="${boundary}"`)
      body = this.formatembeddedImages(message, boundary)
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
   * Builds email headers from message data.
   * @param message - Email message data
   * @param fromAddress - Parsed sender address
   * @param toAddresses - Parsed recipient addresses
   * @returns Array of header strings
   */
  private buildHeaders(
    message: EmailMessage,
    fromAddress: ProcessedContact,
    toAddresses: ProcessedContact[]
  ): string[] {
    const headers = [
      `From: ${AddressParser.formatAddressForHeader(fromAddress)}`,
      `To: ${toAddresses.map((addr) => AddressParser.formatAddressForHeader(addr)).join(', ')}`,
      `Subject: ${message.subject}`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: <${Date.now()}@${this.config.host}>`,
      'MIME-Version: 1.0'
    ]
    if (message.cc) {
      const ccAddresses = AddressParser.parseAddressList(message.cc)
      headers.push(
        `Cc: ${ccAddresses.map((addr) => AddressParser.formatAddressForHeader(addr)).join(', ')}`
      )
    }
    const replyToAddress = message.replyTo
      ? AddressParser.parseAddress(message.replyTo)
      : fromAddress
    headers.push(`Reply-To: ${AddressParser.formatAddressForHeader(replyToAddress)}`)
    if (message.headers) {
      for (const [key, value] of Object.entries(message.headers)) {
        headers.push(`${key}: ${value}`)
      }
    }
    return headers
  }

  /**
   * Formats message with file attachments.
   * @param message - Email message with attachments
   * @param boundary - MIME boundary string
   * @returns Formatted message body
   * @throws {Error} When attachments are missing
   */
  private formatAttachments(message: EmailMessage, boundary: string): string {
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
   * Formats message with calendar event.
   * @param message - Email message with calendar event
   * @param boundary - MIME boundary string
   * @returns Formatted message body
   * @throws {Error} When calendar event is missing
   */
  private formatCalendarEvent(message: EmailMessage, boundary: string): string {
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
    parts.push(CalendarFormatter.formatCalendarEvent(message.calendarEvent))
    parts.push('')
    parts.push(`--${boundary}--`)
    return parts.join('\r\n')
  }

  /**
   * Formats message with embedded images.
   * @param message - Email message with embedded attachments
   * @param boundary - MIME boundary string
   * @returns Formatted message body
   * @throws {Error} When embedded attachments are missing
   */
  private formatembeddedImages(message: EmailMessage, boundary: string): string {
    if (!message.embeddedImages) {
      throw new Error('Embedded attachments are required')
    }
    for (const attachment of message.embeddedImages) {
      isValidEmbedded(attachment)
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
   * Formats HTML-only message.
   * @param message - Email message with HTML content
   * @returns HTML content string
   */
  private formatHtmlOnly(message: EmailMessage): string {
    return message.html || ''
  }

  /**
   * Formats message with both text and HTML content.
   * @param message - Email message with both text and HTML content
   * @param boundary - MIME boundary string
   * @returns Formatted message body
   */
  private formatTextAndHtml(message: EmailMessage, boundary: string): string {
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
   * Formats text-only message.
   * @param message - Email message with text content
   * @returns Text content string
   */
  private formatTextOnly(message: EmailMessage): string {
    return message.text || ''
  }
}
