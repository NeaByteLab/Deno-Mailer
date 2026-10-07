import type * as Types from '@app/Types.ts'
import { SmtpCommand } from '@smtp/Command.ts'

/**
 * Authenticate SMTP session.
 * @description Supports AUTH LOGIN with AUTH PLAIN fallback.
 */
export class SmtpAuth {
  /** SMTP command handler */
  private commands: SmtpCommand

  /**
   * Create auth handler.
   * @description Stores shared connection state for auth flow.
   * @param state - Shared SMTP connection state
   */
  constructor(private state: Types.SmtpConnectionState) {
    this.commands = new SmtpCommand(state)
  }

  /**
   * Perform SMTP authentication.
   * @description Sends credentials using LOGIN then PLAIN fallback.
   * @throws {Error} When authentication fails or connection is not available
   */
  async authenticate(): Promise<void> {
    if (!this.state.config.auth) {
      return
    }
    if (this.state.config.auth.type === 'oauth2') {
      const oauth2Payload =
        `user=${this.state.config.auth.user}\x01auth=Bearer ${this.state.config.auth.accessToken}\x01\x01`
      const encodedOAuth2 = btoa(oauth2Payload)
      await this.commands.sendCommand(`AUTH XOAUTH2 ${encodedOAuth2}`)
      return
    }
    try {
      await this.commands.sendCommand('AUTH LOGIN')
      const username = btoa(this.state.config.auth.user)
      await this.commands.sendCommand(username)
      const password = btoa(this.state.config.auth.pass)
      await this.commands.sendCommand(password)
    } catch {
      const credentials =
        `${this.state.config.auth.user}\0${this.state.config.auth.user}\0${this.state.config.auth.pass}`
      const encoded = btoa(credentials)
      await this.commands.sendCommand('AUTH PLAIN')
      await this.commands.sendCommand(encoded)
    }
  }
}
