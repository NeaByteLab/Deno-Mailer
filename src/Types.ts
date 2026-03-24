/**
 * Calendar event invitation data.
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
 */
export interface EmailContact {
  /** Optional display name for the contact */
  name?: string
  /** Email address */
  address: string
}

/**
 * Complete email message structure.
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
 * Email recipient type that can be a string, EmailContact object, or array of either.
 */
export type EmailRecipient = string | EmailContact | (string | EmailContact)[]

/**
 * Email sender interface.
 */
export interface EmailSender {
  /**
   * Sends an email message.
   * @param message - The email message to send
   * @throws {Error} When message sending fails
   */
  send(message: EmailMessage): Promise<void>
}

/**
 * Email service interface.
 */
export interface EmailService {
  /**
   * Creates an email transporter with SMTP configuration.
   * @param config - SMTP connection configuration
   * @returns Email sender instance
   */
  transporter(config: SmtpConnectionConfig): EmailSender
}

/**
 * Embedded image attachment.
 */
export interface EmbeddedImage extends EmailAttachment {
  /** Content-ID for referencing in HTML */
  cid: string
  /** Content disposition type */
  disposition?: 'inline' | 'attachment'
}

/**
 * Processed email contact.
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
}

/**
 * SMTP connection state.
 */
export interface SmtpConnectionState {
  /** Raw TCP connection */
  conn: Deno.Conn | null
  /** TLS encrypted connection */
  tlsConn: Deno.TlsConn | null
  /** Connection configuration */
  config: SmtpConnectionConfig
}
