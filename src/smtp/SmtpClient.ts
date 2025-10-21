import type { EmailMessage, SmtpConnectionConfig, SmtpConnectionState } from '@app/Types.ts'
import { AddressParser, MessageFormatter, SmtpAuth, SmtpCommand } from '@smtp/index.ts'
import { isValidAttachment, isValidEmail, isValidEmbedded } from '@utils/index.ts'

/**
 * SMTP client for sending email messages.
 * @description Handles SMTP connections, authentication, and message transmission.
 */
export class SmtpClient {
  /** Raw TCP connection */
  private conn: Deno.Conn | null = null
  /** TLS encrypted connection */
  private tlsConn: Deno.TlsConn | null = null
  /** SMTP server configuration */
  private config: SmtpConnectionConfig
  /** Internal connection state tracking */
  private connectionState: SmtpConnectionState
  /** SMTP command handler */
  private commands: SmtpCommand
  /** SMTP authentication handler */
  private auth: SmtpAuth
  /** Email message formatter */
  private messageFormatter: MessageFormatter

  /**
   * Creates a new SMTP client instance.
   * @param config - SMTP server connection configuration
   */
  constructor(config: SmtpConnectionConfig) {
    this.config = config
    this.connectionState = {
      conn: this.conn,
      tlsConn: this.tlsConn,
      config: this.config
    }
    this.commands = new SmtpCommand(this.connectionState)
    this.auth = new SmtpAuth(this.connectionState)
    this.messageFormatter = new MessageFormatter(this.config)
  }

  /**
   * Establishes connection to SMTP server.
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
   * Closes connection to SMTP server.
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
   * Sends an email message via SMTP.
   * @param message - The email message to send
   * @throws {Error} When message validation fails or transmission is unsuccessful
   */
  async sendMessage(message: EmailMessage): Promise<void> {
    if (!this.conn && !this.tlsConn) {
      throw new Error('Not connected to SMTP server')
    }
    if (message.attachments && message.attachments.length > 0) {
      for (const attachment of message.attachments) {
        isValidAttachment(attachment)
      }
    }
    if (message.embeddedImages && message.embeddedImages.length > 0) {
      for (const attachment of message.embeddedImages) {
        isValidEmbedded(attachment)
      }
    }
    try {
      const fromAddress = message.from || this.config.auth?.user || 'noreply@localhost'
      const senderAddress = AddressParser.parseAddress(fromAddress)
      const senderEmail = senderAddress.email
      isValidEmail(senderEmail)
      await this.commands.sendCommand(`MAIL FROM:<${senderEmail}>`)
      const allRecipients: Array<{ email: string; displayName?: string }> = []
      const toRecipients = AddressParser.parseAddressList(message.to)
      allRecipients.push(...toRecipients)
      if (message.cc) {
        const ccRecipients = AddressParser.parseAddressList(message.cc)
        allRecipients.push(...ccRecipients)
      }
      if (message.bcc) {
        const bccRecipients = AddressParser.parseAddressList(message.bcc)
        allRecipients.push(...bccRecipients)
      }
      const recipientPromises = allRecipients.map((recipient) => {
        isValidEmail(recipient.email)
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
   * Upgrades plain TCP connection to TLS encryption.
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
