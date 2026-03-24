import type * as Types from '@app/Types.ts'
import * as SMTP from '@smtp/index.ts'
import * as Utils from '@utils/index.ts'

/**
 * Send email through SMTP.
 * @description Manages connection auth and delivery flow.
 */
export class SmtpClient {
  /** Raw TCP connection */
  private conn: Deno.Conn | null = null
  /** TLS encrypted connection */
  private tlsConn: Deno.TlsConn | null = null
  /** SMTP server configuration */
  private config: Types.SmtpConnectionConfig
  /** Internal connection state tracking */
  private connectionState: Types.SmtpConnectionState
  /** SMTP command handler */
  private commands: SMTP.SmtpCommand
  /** SMTP authentication handler */
  private auth: SMTP.SmtpAuth
  /** Email message formatter */
  private messageFormatter: SMTP.SmtpMessage

  /**
   * Create SMTP client.
   * @description Initializes connection state and helper classes.
   * @param config - SMTP server connection configuration
   */
  constructor(config: Types.SmtpConnectionConfig) {
    this.config = config
    this.connectionState = {
      conn: this.conn,
      tlsConn: this.tlsConn,
      config: this.config
    }
    this.commands = new SMTP.SmtpCommand(this.connectionState)
    this.auth = new SMTP.SmtpAuth(this.connectionState)
    this.messageFormatter = new SMTP.SmtpMessage(this.config)
  }

  /**
   * Connect to SMTP server.
   * @description Opens socket upgrades TLS then authenticates.
   * @throws {Error} When connection fails or authentication is rejected
   */
  async connect(): Promise<void> {
    try {
      if (this.config.secure) {
        this.tlsConn = await Deno.connectTls({
          hostname: this.config.host,
          port: this.config.port
        })
        this.connectionState.tlsConn = this.tlsConn
        await this.commands.readResponse()
        await this.commands.sendCommand(`EHLO ${this.config.host}`)
      } else {
        this.conn = await Deno.connect({
          hostname: this.config.host,
          port: this.config.port
        })
        this.connectionState.conn = this.conn
        await this.commands.readResponse()
        const ehloResponse = await this.commands.sendCommand(`EHLO ${this.config.host}`)
        const hasStartTlsSupport = /\bSTARTTLS\b/i.test(ehloResponse)
        if (this.config.port === 587 && !hasStartTlsSupport) {
          throw new Error('STARTTLS is required on port 587 but server does not advertise support')
        }
        if (hasStartTlsSupport) {
          await this.commands.sendCommand('STARTTLS')
          await this.upgradeToTLS()
          await this.commands.sendCommand(`EHLO ${this.config.host}`)
        }
      }
      if (this.config.auth) {
        await this.auth.authenticate()
      }
    } catch (error) {
      throw new Error(
        `SMTP connection failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Disconnect from SMTP server.
   * @description Sends QUIT and closes active transport.
   */
  async disconnect(): Promise<void> {
    if (this.tlsConn) {
      try {
        await this.commands.sendCommand('QUIT')
      } catch {
        // Ignore errors
      }
      this.tlsConn.close()
      this.tlsConn = null
      this.connectionState.tlsConn = null
    } else if (this.conn) {
      try {
        await this.commands.sendCommand('QUIT')
      } catch {
        // Ignore errors
      }
      this.conn.close()
      this.conn = null
      this.connectionState.conn = null
    }
  }

  /**
   * Report connection availability.
   * @description Returns true when TCP or TLS is active.
   * @returns True when connection is active
   */
  get isConnected(): boolean {
    return Boolean(this.conn || this.tlsConn)
  }

  /**
   * Send SMTP message.
   * @description Validates recipients sends envelope then DATA.
   * @param message - The email message to send
   * @returns Structured SMTP delivery result
   * @throws {Error} When message validation fails or transmission is unsuccessful
   */
  async sendMessage(message: Types.EmailMessage): Promise<Types.SmtpSendResult> {
    if (!this.conn && !this.tlsConn) {
      throw new Error('Not connected to SMTP server')
    }
    if (message.attachments && message.attachments.length > 0) {
      for (const attachment of message.attachments) {
        Utils.isValidAttachment(attachment)
      }
    }
    if (message.embeddedImages && message.embeddedImages.length > 0) {
      for (const attachment of message.embeddedImages) {
        Utils.isValidEmbedded(attachment)
      }
    }
    try {
      const fromAddress = message.from || this.config.auth?.user || 'noreply@localhost'
      const senderAddress = SMTP.SmtpAddress.parseAddress(fromAddress)
      const senderEmail = senderAddress.email
      Utils.isValidEmail(senderEmail)
      await this.commands.sendCommand(`MAIL FROM:<${senderEmail}>`)
      const allRecipients: Array<{ email: string; displayName?: string }> = []
      const toRecipients = SMTP.SmtpAddress.parseAddressList(message.to)
      allRecipients.push(...toRecipients)
      if (message.cc) {
        const ccRecipients = SMTP.SmtpAddress.parseAddressList(message.cc)
        allRecipients.push(...ccRecipients)
      }
      if (message.bcc) {
        const bccRecipients = SMTP.SmtpAddress.parseAddressList(message.bcc)
        allRecipients.push(...bccRecipients)
      }
      const acceptedRecipients: string[] = []
      const rejectedRecipients: string[] = []
      for (const recipient of allRecipients) {
        Utils.isValidEmail(recipient.email)
        try {
          await this.commands.sendCommand(`RCPT TO:<${recipient.email}>`)
          acceptedRecipients.push(recipient.email)
        } catch {
          rejectedRecipients.push(recipient.email)
        }
      }
      if (acceptedRecipients.length === 0) {
        throw new Error('All recipients were rejected by SMTP server')
      }
      await this.commands.sendCommand('DATA')
      const formattedMessage = this.messageFormatter.formatMessage(message)
      const dkimSignedMessage = await this.applyDkimSignatureIfEnabled(formattedMessage)
      const smtpSafeMessage = this.toSmtpDataStream(dkimSignedMessage)
      await this.commands.sendData(smtpSafeMessage)
      const dataResponse = await this.commands.sendCommand('.')
      const messageIdMatch =
        dkimSignedMessage.match(/\r\nMessage-ID:\s*(<[^>\r\n]+>)/i) ||
        dkimSignedMessage.match(/^Message-ID:\s*(<[^>\r\n]+>)/i)
      const messageId = messageIdMatch ? (messageIdMatch[1] ?? '') : ''
      return {
        acceptedRecipients,
        envelope: {
          from: senderEmail,
          to: allRecipients.map(recipient => recipient.email)
        },
        messageId,
        rejectedRecipients,
        response: dataResponse
      }
    } catch (error) {
      throw new Error(
        `Failed to send message: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Apply DKIM signature.
   * @description Signs message and prepends DKIM-Signature header.
   * @param messageContent - Fully formatted SMTP message content
   * @returns DKIM-signed message content or original input
   * @throws {Error} When DKIM configuration or key import is invalid
   */
  private async applyDkimSignatureIfEnabled(messageContent: string): Promise<string> {
    if (!this.config.dkim) {
      return messageContent
    }
    const headerBodySplitIndex = messageContent.indexOf('\r\n\r\n')
    if (headerBodySplitIndex < 0) {
      throw new Error('Unable to sign DKIM message without header and body split')
    }
    const rawHeaderSection = messageContent.slice(0, headerBodySplitIndex)
    const rawBodySection = messageContent.slice(headerBodySplitIndex + 4)
    const rawHeaderLines = rawHeaderSection.split('\r\n')
    const selectedHeaderNames =
      this.config.dkim.headerFieldNames && this.config.dkim.headerFieldNames.length > 0
        ? this.config.dkim.headerFieldNames.map(headerName => headerName.toLowerCase())
        : ['from', 'to', 'subject', 'date', 'message-id', 'mime-version', 'content-type']
    const selectedHeaderLines = rawHeaderLines.filter(headerLine => {
      const separatorIndex = headerLine.indexOf(':')
      if (separatorIndex < 1) {
        return false
      }
      const headerName = headerLine.slice(0, separatorIndex).trim().toLowerCase()
      return selectedHeaderNames.includes(headerName)
    })
    const signedHeaderNames = selectedHeaderLines.map(headerLine => {
      const separatorIndex = headerLine.indexOf(':')
      return headerLine.slice(0, separatorIndex).trim().toLowerCase()
    })
    const canonicalizedHeaderLines = selectedHeaderLines.map(headerLine => {
      const separatorIndex = headerLine.indexOf(':')
      const headerName = headerLine.slice(0, separatorIndex).trim().toLowerCase()
      const headerValue = headerLine
        .slice(separatorIndex + 1)
        .trim()
        .replace(/\s+/g, ' ')
      return `${headerName}:${headerValue}`
    })
    const normalizedBody = rawBodySection.replace(/\r?\n/g, '\r\n')
    const canonicalizedBody = normalizedBody.replace(/(\r\n)*$/, '\r\n')
    const bodyHashBuffer = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(canonicalizedBody)
    )
    const bodyHashBase64 = btoa(String.fromCharCode(...new Uint8Array(bodyHashBuffer)))
    const domainName = this.config.dkim.domainName
    const keySelector = this.config.dkim.keySelector
    const signedHeaderList = signedHeaderNames.join(':')
    const dkimHeaderPrefix = `v=1; a=rsa-sha256; c=relaxed/relaxed; d=${domainName}; s=${keySelector}; h=${signedHeaderList}; bh=${bodyHashBase64}; b=`
    const dkimSigningLine = `dkim-signature:${dkimHeaderPrefix}`
    const signingPayload = [...canonicalizedHeaderLines, dkimSigningLine].join('\r\n')
    const pemBody = this.config.dkim.privateKey
      .replace('-----BEGIN PRIVATE KEY-----', '')
      .replace('-----END PRIVATE KEY-----', '')
      .replace(/\s+/g, '')
    const binaryDer = Uint8Array.from(atob(pemBody), char => char.charCodeAt(0))
    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8',
      binaryDer,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256'
      },
      false,
      ['sign']
    )
    const signatureBuffer = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      new TextEncoder().encode(signingPayload)
    )
    const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
    const dkimHeader = `DKIM-Signature: ${dkimHeaderPrefix}${signatureBase64}`
    return `${dkimHeader}\r\n${rawHeaderSection}\r\n\r\n${rawBodySection}`
  }

  /**
   * Prepare SMTP DATA payload.
   * @description Applies CRLF normalization and dot-stuffing.
   * @param messageContent - Raw MIME message content
   * @returns SMTP-safe DATA payload
   */
  private toSmtpDataStream(messageContent: string): string {
    const normalizedContent = messageContent.replace(/\r?\n/g, '\r\n')
    return normalizedContent.replace(/(^|\r\n)\./g, '$1..')
  }

  /**
   * Upgrade transport to TLS.
   * @description Starts TLS over existing plain connection.
   */
  private async upgradeToTLS(): Promise<void> {
    if (!this.conn) {
      throw new Error('No connection to upgrade')
    }
    this.tlsConn = await Deno.startTls(this.conn as Deno.TcpConn, {
      hostname: this.config.host
    })
    this.conn = null
    this.connectionState.conn = null
    this.connectionState.tlsConn = this.tlsConn
  }
}
