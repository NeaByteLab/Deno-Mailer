import type * as Types from '@app/Types.ts'

/**
 * Execute SMTP wire commands.
 * @description Sends commands and validates protocol responses.
 */
export class SmtpCommand {
  /**
   * Create command handler.
   * @description Stores shared state for SMTP transport I/O.
   * @param state - Shared SMTP connection state
   */
  constructor(private state: Types.SmtpConnectionState) {}

  /**
   * Read server response.
   * @description Reads response and validates SMTP status class.
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
   * Send SMTP command.
   * @description Writes command and waits for server reply.
   * @param command - SMTP command to send
   * @returns Server response string
   * @throws {Error} When command times out or server returns error
   */
  async sendCommand(command: string): Promise<string> {
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
    return await this.readResponse()
  }

  /**
   * Send raw SMTP data.
   * @description Writes payload bytes without reading response.
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
