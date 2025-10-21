import type { SmtpConnectionState } from '@app/Types.ts'

/**
 * Manages SMTP connection lifecycle.
 * @description Handles TCP/TLS connections with timeout protection.
 */
export class ConnectionManager {
  /**
   * Creates a new connection manager.
   * @param state - Shared SMTP connection state
   */
  constructor(private state: SmtpConnectionState) {}

  /**
   * Establishes SMTP connection with optional TLS upgrade.
   * @throws {Error} When connection fails or timeout occurs
   */
  async connect(): Promise<void> {
    try {
      this.state.conn = await Deno.connect({
        hostname: this.state.config.host,
        port: this.state.config.port
      })
      await this.readResponse()
      await this.sendCommand(`HELO ${this.state.config.host}`)
      if (!this.state.config.secure && this.state.config.port === 587) {
        await this.sendCommand('startTLS')
        await this.upgradeToTLS()
      }
    } catch (error) {
      throw new Error(
        `SMTP connection failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Closes SMTP connection gracefully.
   */
  async disconnect(): Promise<void> {
    if (this.state.tlsConn) {
      try {
        await this.sendCommand('QUIT')
      } catch {
        // Ignore errors
      }
      this.state.tlsConn.close()
      this.state.tlsConn = null
    } else if (this.state.conn) {
      try {
        await this.sendCommand('QUIT')
      } catch {
        // Ignore errors
      }
      this.state.conn.close()
      this.state.conn = null
    }
  }

  /**
   * Upgrades TCP connection to TLS encryption.
   * @throws {Error} When no connection exists to upgrade
   */
  async upgradeToTLS(): Promise<void> {
    if (!this.state.conn) {
      throw new Error('No connection to upgrade')
    }
    this.state.tlsConn = await Deno.startTls(this.state.conn as Deno.TcpConn, {
      hostname: this.state.config.host
    })
    this.state.conn = null
  }

  /**
   * Reads SMTP server response.
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
   * Sends SMTP command to server.
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
