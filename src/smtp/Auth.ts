import type * as Types from '@app/Types.ts'

/**
 * Authenticate SMTP session.
 * @description Supports AUTH LOGIN with AUTH PLAIN fallback.
 */
export class SmtpAuth {
  /**
   * Create auth handler.
   * @description Stores shared connection state for auth flow.
   * @param state - Shared SMTP connection state
   */
  constructor(private state: Types.SmtpConnectionState) {}

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
      await this.sendCommand(`AUTH XOAUTH2 ${encodedOAuth2}`)
      return
    }
    try {
      await this.sendCommand('AUTH LOGIN')
      const username = btoa(this.state.config.auth.user)
      await this.sendCommand(username)
      const password = btoa(this.state.config.auth.pass)
      await this.sendCommand(password)
    } catch {
      const credentials =
        `${this.state.config.auth.user}\0${this.state.config.auth.user}\0${this.state.config.auth.pass}`
      const encoded = btoa(credentials)
      await this.sendCommand('AUTH PLAIN')
      await this.sendCommand(encoded)
    }
  }

  /**
   * Read server response.
   * @description Reads response and validates SMTP status class.
   * @returns Server response string
   * @throws {Error} When connection is closed or server returns error code
   */
  private async readResponse(): Promise<string> {
    if (!this.state.conn && !this.state.tlsConn) {
      throw new Error('Not connected')
    }
    const decoder = new TextDecoder()
    const buffer = new Uint8Array(1024)
    const readChunk = async (): Promise<number | null> => {
      if (this.state.tlsConn) {
        return await this.state.tlsConn.read(buffer)
      } else if (this.state.conn) {
        return await this.state.conn.read(buffer)
      } else {
        throw new Error('Connection closed')
      }
    }
    const readUntilComplete = async (response: string): Promise<string> => {
      const n = await readChunk()
      if (n === null) {
        throw new Error('Connection closed')
      }
      const newResponse = response + decoder.decode(buffer.subarray(0, n))
      if (newResponse.endsWith('\r\n')) {
        return newResponse
      }
      return await readUntilComplete(newResponse)
    }
    const response = await readUntilComplete('')
    const code = response.substring(0, 3)
    if (!response.startsWith('2') && !response.startsWith('3')) {
      throw new Error(`SMTP Error ${code}: ${response}`)
    }
    return response
  }

  /**
   * Send SMTP command.
   * @description Writes command and waits for server reply.
   * @param command - SMTP command to send
   * @throws {Error} When command times out or server returns error
   */
  private async sendCommand(command: string): Promise<void> {
    if (!this.state.conn && !this.state.tlsConn) {
      throw new Error('Not connected')
    }
    const encoder = new TextEncoder()
    const data = encoder.encode(`${command}\r\n`)
    if (this.state.tlsConn) {
      await this.state.tlsConn.write(data)
    } else if (this.state.conn) {
      await this.state.conn.write(data)
    }
    await this.readResponse()
  }
}
