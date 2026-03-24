import type * as Types from '@app/Types.ts'
import * as SMTP from '@smtp/index.ts'
import * as Utils from '@utils/index.ts'

/**
 * Send email through SMTP.
 * @description Manages connection, auth, and message delivery flow.
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
   * @description Opens socket, upgrades TLS, then authenticates.
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
        await this.commands.sendCommand(`HELO ${this.config.host}`)
      } else {
        this.conn = await Deno.connect({
          hostname: this.config.host,
          port: this.config.port
        })
        this.connectionState.conn = this.conn
        await this.commands.readResponse()
        await this.commands.sendCommand(`HELO ${this.config.host}`)
        if (this.config.port === 587) {
          await this.commands.sendCommand('startTLS')
          await this.upgradeToTLS()
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
   * Send SMTP message.
   * @description Validates recipients, sends envelope, then DATA.
   * @param message - The email message to send
   * @throws {Error} When message validation fails or transmission is unsuccessful
   */
  async sendMessage(message: Types.EmailMessage): Promise<void> {
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
      const recipientPromises = allRecipients.map((recipient) => {
        Utils.isValidEmail(recipient.email)
        return this.commands.sendCommand(`RCPT TO:<${recipient.email}>`)
      })
      await Promise.all(recipientPromises)
      await this.commands.sendCommand('DATA')
      const messageContent = this.messageFormatter.formatMessage(message)
      await this.commands.sendData(messageContent)
      await this.commands.sendCommand('.')
    } catch (error) {
      throw new Error(
        `Failed to send message: ${error instanceof Error ? error.message : String(error)}`
      )
    }
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
