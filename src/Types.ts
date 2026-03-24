/**
 * Calendar event invitation data.
 * @description Defines calendar payload fields for event invites.
 */
export interface CalendarInvite {
  /** Unique identifier for the calendar event */
  uid: string
  /** Event title or summary */
  summary: string
  /** Optional event description */
  description?: string
  /** Optional event location */
  location?: string
  /** Event start time in ISO format */
  startTime: string
  /** Event end time in ISO format */
  endTime: string
  /** Optional organizer email address */
  organizer?: string
  /** Optional list of attendee email addresses */
  attendees?: string[]
  /** Optional event status */
  status?: 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED'
}

/**
 * Email attachment data.
 * @description Defines attachment payload for SMTP MIME messages.
 */
export interface EmailAttachment {
  /** Name of the attached file */
  filename: string
  /** File content as string or binary data */
  content: string | Uint8Array
  /** MIME content type of the attachment */
  contentType?: string
  /** Content transfer encoding method */
  encoding?: 'base64' | '7bit' | 'quoted-printable'
}

/**
 * Email contact information.
 * @description Describes email address and optional display name.
 */
export interface EmailContact {
  /** Optional display name for the contact */
  name?: string
  /** Email address */
  address: string
}

/**
 * Complete email message structure.
 * @description Defines sender recipients body and message options.
 */
export interface EmailMessage {
  /** Sender email address or contact */
  from: EmailRecipient
  /** Primary recipient(s) */
  to: EmailRecipient
  /** Optional carbon copy recipient(s) */
  cc?: EmailRecipient
  /** Optional blind carbon copy recipient(s) */
  bcc?: EmailRecipient
  /** Optional reply-to address */
  replyTo?: EmailRecipient
  /** Email subject line */
  subject: string
  /** Plain text content */
  text?: string
  /** HTML content */
  html?: string
  /** File attachments */
  attachments?: EmailAttachment[]
  /** Embedded images with Content-ID */
  embeddedImages?: EmbeddedImage[]
  /** Calendar event invitation */
  calendarEvent?: CalendarInvite
  /** Custom email headers */
  headers?: Record<string, string>
}

/**
 * Email recipient type.
 * @description Allows string object or array recipient formats.
 */
export type EmailRecipient = string | EmailContact | (string | EmailContact)[]

/**
 * Email sender interface.
 * @description Defines async message send capability contract.
 */
export interface EmailSender {
  /**
   * Sends an email message.
   * @description Sends one message and returns SMTP result data.
   * @param message - The email message to send
   * @returns Structured SMTP delivery result
   * @throws {Error} When message sending fails
   */
  send(message: EmailMessage): Promise<SmtpSendResult>
}

/**
 * Email service interface.
 * @description Defines factory for creating SMTP senders.
 */
export interface EmailService {
  /**
   * Create email transporter.
   * @description Builds sender from SMTP connection configuration.
   * @param config - SMTP connection configuration
   * @returns Email sender instance
   */
  transporter(config: SmtpConnectionConfig): EmailSender
}

/**
 * Embedded image attachment.
 * @description Extends attachment with CID and disposition fields.
 */
export interface EmbeddedImage extends EmailAttachment {
  /** Content-ID for referencing in HTML */
  cid: string
  /** Content disposition type */
  disposition?: 'inline' | 'attachment'
}

/**
 * Processed email contact.
 * @description Represents normalized address for SMTP processing.
 */
export interface ProcessedContact {
  /** Email address */
  email: string
  /** Optional display name */
  displayName?: string
}

/** Base SMTP auth fields. */
export interface SmtpAuthBase<TKind extends SmtpAuthKind> {
  /** Authentication type discriminator */
  type: TKind
  /** SMTP account username */
  user: string
}

/** Supported SMTP auth credential variants. */
export type SmtpAuthCredential = SmtpPasswordAuthCredential | SmtpOAuth2AuthCredential

/** Supported SMTP auth type. */
export type SmtpAuthKind = 'password' | 'oauth2'

/** SMTP oauth2 auth credentials. */
export interface SmtpOAuth2AuthCredential extends SmtpAuthBase<'oauth2'> {
  /** OAuth2 bearer access token */
  accessToken: string
}

/** SMTP password auth credentials. */
export interface SmtpPasswordAuthCredential extends SmtpAuthBase<'password'> {
  /** SMTP password value */
  pass: string
}

/**
 * SMTP connection configuration.
 * @description Defines host port auth DKIM and pooling options.
 */
export interface SmtpConnectionConfig {
  /** SMTP server hostname */
  host: string
  /** SMTP server port number */
  port: number
  /** Whether to use secure TLS connection */
  secure?: boolean
  /** Optional authentication credentials */
  auth?: SmtpAuthCredential
  /** Optional DKIM signing configuration */
  dkim?: SmtpDkimConfig
  /** Optional SMTP connection pool configuration */
  pool?: SmtpPoolConfig | boolean
}

/**
 * SMTP connection state.
 * @description Holds active sockets and SMTP config reference.
 */
export interface SmtpConnectionState {
  /** Raw TCP connection */
  conn: Deno.Conn | null
  /** TLS encrypted connection */
  tlsConn: Deno.TlsConn | null
  /** Connection configuration */
  config: SmtpConnectionConfig
}

/** SMTP DKIM signing configuration. */
export interface SmtpDkimConfig {
  /** Signing domain for DKIM signature */
  domainName: string
  /** Key selector prefix from DNS record */
  keySelector: string
  /** PEM private key for signing */
  privateKey: string
  /** Optional signed header list override */
  headerFieldNames?: string[]
}

/** SMTP delivery envelope details. */
export interface SmtpEnvelope {
  /** SMTP MAIL FROM sender */
  from: string
  /** SMTP RCPT TO recipients */
  to: string[]
}

/** SMTP pool behavior configuration. */
export interface SmtpPoolConfig {
  /** Maximum pooled SMTP connections */
  maxConnections?: number
  /** Maximum messages per connection */
  maxMessagesPerConnection?: number
  /** Idle close timeout in milliseconds */
  idleTimeoutMs?: number
}

/** SMTP send operation result. */
export interface SmtpSendResult {
  /** Accepted SMTP recipients */
  acceptedRecipients: string[]
  /** Envelope sender and recipient list */
  envelope: SmtpEnvelope
  /** Generated Message-ID header */
  messageId: string
  /** Rejected SMTP recipients */
  rejectedRecipients: string[]
  /** Final SMTP server response */
  response: string
}
