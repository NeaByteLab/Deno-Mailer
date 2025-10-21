import type { EmailMessage, EmailSender, EmailService, SmtpConnectionConfig } from '@app/Types.ts'
import { SmtpClient } from '@smtp/index.ts'
import { isValidConfig } from '@utils/index.ts'

/**
 * Main email service for sending messages via SMTP.
 */
export const mailer: EmailService = {
  /**
   * Creates an email transporter with SMTP configuration.
   * @param config - SMTP connection configuration
   * @returns Email sender instance
   * @throws {Error} When configuration is invalid
   */
  transporter(config: SmtpConnectionConfig): EmailSender {
    isValidConfig(config)
    return createTransporter(config)
  }
}

/**
 * Creates email transporter instance.
 * @param config - SMTP connection configuration
 * @returns Email sender implementation
 */
function createTransporter(config: SmtpConnectionConfig): EmailSender {
  return {
    async send(message: EmailMessage): Promise<void> {
      const client = new SmtpClient(config)
      try {
        await client.connect()
        await client.sendMessage(message)
      } finally {
        await client.disconnect()
      }
    }
  }
}

/**
 * Default export of the email service.
 * @description Main entry point for the Deno-Mailer library.
 */
export default mailer

/**
 * Re-exports all type definitions.
 * @description Provides access to all TypeScript interfaces and types.
 */
export * from '@app/Types.ts'
