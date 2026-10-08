import type * as Types from '@app/Types.ts'
import * as SMTP from '@smtp/index.ts'
import * as Utils from '@utils/index.ts'

/**
 * Send email through SMTP.
 * @description Manages connection auth and delivery flow.
 */
export class SmtpClient {
  /** SMTP authentication handler */
  private auth: SMTP.SmtpAuth
  /** SMTP command handler */
  private commands: SMTP.SmtpCommand
  /** SMTP server configuration */
  private config: Types.SmtpConnectionConfig
  /** Internal connection state tracking */
  private connectionState: Types.SmtpConnectionState
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
      conn: null,
      tlsConn: null,
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
      await this.openTcpConnection()
      if (this.config.secure) {
        await this.upgradeToTLS()
      }
      await this.commands.readResponse()
      const ehloResponse = await this.commands.sendCommand(`EHLO ${this.config.host}`)
      if (!this.config.secure) {
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
    if (!this.isConnected) {
      return
    }
    try {
      await this.commands.sendCommand('QUIT')
    } catch {
      // Ignore errors
    }
    this.commands.close()
  }

  /**
   * Report connection availability.
   * @description Returns true when TCP or TLS is active.
   * @returns True when connection is active
   */
  get isConnected(): boolean {
    return Boolean(this.connectionState.conn || this.connectionState.tlsConn)
  }

  /**
   * Send SMTP message.
   * @description Validates recipients sends envelope then DATA.
   * @param message - The email message to send
   * @returns Structured SMTP delivery result
   * @throws {Error} When message validation fails or transmission is unsuccessful
   */
  async sendMessage(message: Types.EmailMessage): Promise<Types.SmtpSendResult> {
    if (!this.isConnected) {
      throw new Error('Not connected to SMTP server')
    }
    if (message.attachments && message.attachments.length > 0) {
      for (const attachment of message.attachments) {
        Utils.validateEmailAttachment(attachment)
      }
    }
    if (message.embeddedImages && message.embeddedImages.length > 0) {
      for (const attachment of message.embeddedImages) {
        Utils.validateEmbeddedImage(attachment)
      }
    }
    try {
      const fromAddress = message.from || this.config.auth?.user || 'noreply@localhost'
      const senderAddress = SMTP.SmtpAddress.parseAddress(fromAddress)
      const senderEmail = senderAddress.email
      Utils.validateMailboxAddress(senderEmail)
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
        Utils.validateMailboxAddress(recipient.email)
        try {
          await this.commands.sendCommand(`RCPT TO:<${recipient.email}>`)
          acceptedRecipients.push(recipient.email)
        } catch (error) {
          if (error instanceof SMTP.SmtpTimeoutError) {
            throw error
          }
          rejectedRecipients.push(recipient.email)
        }
      }
      if (acceptedRecipients.length === 0) {
        throw new Error('All recipients were rejected by SMTP server')
      }
      await this.commands.sendCommand('DATA')
      const formattedMessage = this.messageFormatter.formatMessage(message)
      const dkimSignedMessage = await this.signWithDkim(formattedMessage)
      const smtpSafeMessage = Utils.encodeSmtpData(dkimSignedMessage)
      await this.commands.sendData(smtpSafeMessage)
      const dataResponse = await this.commands.sendCommand('.')
      const messageIdMatch = dkimSignedMessage.match(/\r\nMessage-ID:\s*(<[^>\r\n]+>)/i) ||
        dkimSignedMessage.match(/^Message-ID:\s*(<[^>\r\n]+>)/i)
      const messageId = messageIdMatch ? (messageIdMatch[1] ?? '') : ''
      return {
        acceptedRecipients,
        envelope: {
          from: senderEmail,
          to: allRecipients.map((recipient) => recipient.email)
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
  private async signWithDkim(messageContent: string): Promise<string> {
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
        ? this.config.dkim.headerFieldNames.map((headerName) => headerName.toLowerCase())
        : ['from', 'to', 'subject', 'date', 'message-id', 'mime-version', 'content-type']
    const selectedHeaderLines = rawHeaderLines.filter((headerLine) => {
      const separatorIndex = headerLine.indexOf(':')
      if (separatorIndex < 1) {
        return false
      }
      const headerName = headerLine.slice(0, separatorIndex).trim().toLowerCase()
      return selectedHeaderNames.includes(headerName)
    })
    const signedHeaderNames = selectedHeaderLines.map((headerLine) => {
      const separatorIndex = headerLine.indexOf(':')
      return headerLine.slice(0, separatorIndex).trim().toLowerCase()
    })
    const canonicalizedHeaderLines = selectedHeaderLines.map((headerLine) => {
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
    const dkimHeaderPrefix =
      `v=1; a=rsa-sha256; c=relaxed/relaxed; d=${domainName}; s=${keySelector}; h=${signedHeaderList}; bh=${bodyHashBase64}; b=`
    const dkimSigningLine = `dkim-signature:${dkimHeaderPrefix}`
    const signingPayload = [...canonicalizedHeaderLines, dkimSigningLine].join('\r\n')
    const pemBody = this.config.dkim.privateKey
      .replace('-----BEGIN PRIVATE KEY-----', '')
      .replace('-----END PRIVATE KEY-----', '')
      .replace(/\s+/g, '')
    const binaryDer = Uint8Array.from(atob(pemBody), (char) => char.charCodeAt(0))
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
   * Open TCP connection.
   * @description Connects to configured host within connection timeout.
   * @throws {SmtpTimeoutError} When TCP connect exceeds connection timeout
   */
  private async openTcpConnection(): Promise<void> {
    const connectionTimeoutMs = this.config.connectionTimeoutMs ?? SMTP.defaultConnectionTimeoutMs
    const connectAbort = new AbortController()
    const pendingConn = Deno.connect({
      hostname: this.config.host,
      port: this.config.port,
      signal: connectAbort.signal
    })
    this.connectionState.conn = await SMTP.withTimeout(
      pendingConn,
      connectionTimeoutMs,
      `Connection to ${this.config.host}:${this.config.port} timed out after ${connectionTimeoutMs} ms`,
      () => {
        connectAbort.abort()
        // Runtimes that ignore the signal may still connect; close that socket.
        pendingConn.then((lateConn) => lateConn.close(), () => {})
      }
    )
  }

  /**
   * Upgrade transport to TLS.
   * @description Starts TLS over plain connection and completes handshake within connection timeout.
   * @throws {Error} When no plain connection exists or handshake fails
   * @throws {SmtpTimeoutError} When TLS handshake exceeds connection timeout
   */
  private async upgradeToTLS(): Promise<void> {
    if (!this.connectionState.conn) {
      throw new Error('No connection to upgrade')
    }
    const connectionTimeoutMs = this.config.connectionTimeoutMs ?? SMTP.defaultConnectionTimeoutMs
    const tlsConn = await Deno.startTls(this.connectionState.conn as Deno.TcpConn, {
      hostname: this.config.host
    })
    this.connectionState.conn = null
    this.connectionState.tlsConn = tlsConn
    await SMTP.withTimeout(
      tlsConn.handshake(),
      connectionTimeoutMs,
      `TLS handshake with ${this.config.host}:${this.config.port} timed out after ${connectionTimeoutMs} ms`,
      () => this.commands.close()
    )
  }
}
