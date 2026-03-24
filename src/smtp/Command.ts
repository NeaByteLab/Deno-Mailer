import type * as Types from '@app/Types.ts'

/**
 * Execute SMTP wire commands.
 * @description Sends commands and validates SMTP responses.
 */
export class SmtpCommand {
  /**
   * Create command handler.
   * @description Stores shared SMTP transport state.
   * @param state - Shared SMTP connection state
   */
  constructor(private state: Types.SmtpConnectionState) {}

  /**
   * Read server response.
   * @description Reads server reply until final status line.
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
    let response = ''
    while (true) {
      const bytesRead = await readChunk()
      if (bytesRead === null) {
        throw new Error('Connection closed')
      }
      response += decoder.decode(buffer.subarray(0, bytesRead))
      const completeLines = response.split('\r\n').filter(line => line.length > 0)
      const lastLine = completeLines[completeLines.length - 1]
      if (!lastLine) {
        continue
      }
      if (/^\d{3}\s/.test(lastLine)) {
        break
      }
    }
    const finalLines = response.split('\r\n').filter(line => line.length > 0)
    const finalLine = finalLines[finalLines.length - 1] ?? response
    const statusCode = finalLine.substring(0, 3)
    if (!finalLine.startsWith('2') && !finalLine.startsWith('3')) {
      throw new Error(`SMTP Error ${statusCode}: ${response}`)
    }
    return response
  }

  /**
   * Send SMTP command.
   * @description Writes command and waits for response.
   * @param command - SMTP command to send
   * @returns Server response string
   * @throws {Error} When command times out or server returns error
   */
  async sendCommand(command: string): Promise<string> {
    if (!this.state.conn && !this.state.tlsConn) {
      throw new Error('Not connected')
    }
    const encoder = new TextEncoder()
    const commandPayload = encoder.encode(`${command}\r\n`)
    if (this.state.tlsConn) {
      await this.state.tlsConn.write(commandPayload)
    } else if (this.state.conn) {
      await this.state.conn.write(commandPayload)
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
