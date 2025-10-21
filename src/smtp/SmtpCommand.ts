import type { SmtpConnectionState } from '@app/Types.ts'

/**
 * Handles low-level SMTP command execution.
 * @description Handles SMTP command execution with error handling and timeouts.
 */
export class SmtpCommand {
  /**
   * Creates a new SMTP command handler.
   * @param state - Shared SMTP connection state
   */
  constructor(private state: SmtpConnectionState) {}

  /**
   * Reads SMTP server response.
   * @returns Server response string
   * @throws {Error} When connection is closed or server returns error code
   */
  async readResponse(): Promise<string> {
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
  async sendCommand(command: string): Promise<void> {
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

  /**
   * Sends raw data to SMTP server.
   * @param data - Raw data to send
   * @throws {Error} When not connected to server or timeout occurs
   */
  async sendData(data: string): Promise<void> {
    if (!this.state.conn && !this.state.tlsConn) {
      throw new Error('Not connected')
    }
    const encoder = new TextEncoder()
    const encoded = encoder.encode(data)
    if (this.state.tlsConn) {
      await this.state.tlsConn.write(encoded)
    } else if (this.state.conn) {
      await this.state.conn.write(encoded)
    }
  }
}
