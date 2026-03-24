import type * as Types from '@app/Types.ts'
import * as SMTP from '@smtp/index.ts'
import * as Utils from '@utils/index.ts'

/**
 * Main email service for sending messages via SMTP.
 */
export const mailer: Types.EmailService = {
  /**
   * Creates an email transporter with SMTP configuration.
   * @param config - SMTP connection configuration
   * @returns Email sender instance
   * @throws {Error} When configuration is invalid
   */
  transporter(config: Types.SmtpConnectionConfig): Types.EmailSender {
    Utils.isValidConfig(config)
    return createTransporter(config)
  }
}

/**
 * Creates email transporter instance.
 * @param config - SMTP connection configuration
 * @returns Email sender implementation
 */
function createTransporter(config: Types.SmtpConnectionConfig): Types.EmailSender {
  return {
    async send(message: Types.EmailMessage): Promise<void> {
      const client = new SMTP.SmtpClient(config)
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
export type * from '@app/Types.ts'
