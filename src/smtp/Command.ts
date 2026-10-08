import type * as Types from '@app/Types.ts'
import { defaultSocketTimeoutMs, withTimeout } from '@smtp/Timeout.ts'

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
   * Close active transport.
   * @description Closes TLS or TCP socket and clears shared connection state.
   */
  close(): void {
    const transport = this.state.tlsConn ?? this.state.conn
    this.state.tlsConn = null
    this.state.conn = null
    try {
      transport?.close()
    } catch {
      // Already closed
    }
  }

  /**
   * Read server response.
   * @description Reads server reply until final status line.
   * @returns Server response string
   * @throws {Error} When connection is closed or server returns error code
   * @throws {SmtpTimeoutError} When server sends nothing within socket timeout
   */
  async readResponse(): Promise<string> {
    if (!this.state.conn && !this.state.tlsConn) {
      throw new Error('Not connected')
    }
    const decoder = new TextDecoder()
    const buffer = new Uint8Array(1024)
    const socketTimeoutMs = this.state.config.socketTimeoutMs ?? defaultSocketTimeoutMs
    const readChunk = async (): Promise<number | null> => {
      const transport = this.state.tlsConn ?? this.state.conn
      if (!transport) {
        throw new Error('Connection closed')
      }
      return await withTimeout(
        transport.read(buffer),
        socketTimeoutMs,
        `SMTP server response timed out after ${socketTimeoutMs} ms`,
        () => this.close()
      )
    }
    let response = ''
    while (true) {
      const bytesRead = await readChunk()
      if (bytesRead === null) {
        throw new Error('Connection closed')
      }
      response += decoder.decode(buffer.subarray(0, bytesRead))
      const completeLines = response.split('\r\n').filter((line) => line.length > 0)
      const lastLine = completeLines[completeLines.length - 1]
      if (!lastLine) {
        continue
      }
      if (/^\d{3}\s/.test(lastLine)) {
        break
      }
    }
    const finalLines = response.split('\r\n').filter((line) => line.length > 0)
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
   * @throws {Error} When not connected or server returns error
   * @throws {SmtpTimeoutError} When write or response exceeds socket timeout
   */
  async sendCommand(command: string): Promise<string> {
    await this.writeAll(new TextEncoder().encode(`${command}\r\n`))
    return await this.readResponse()
  }

  /**
   * Send raw SMTP data.
   * @description Writes payload bytes without reading response.
   * @param data - Raw data to send
   * @throws {Error} When not connected to server
   * @throws {SmtpTimeoutError} When a write exceeds socket timeout
   */
  async sendData(data: string): Promise<void> {
    await this.writeAll(new TextEncoder().encode(data))
  }

  /**
   * Write full payload to transport.
   * @description Repeats partial socket writes; each write is bounded by socket timeout.
   * @param payload - Bytes to write
   * @throws {Error} When not connected to server
   * @throws {SmtpTimeoutError} When a write exceeds socket timeout
   */
  private async writeAll(payload: Uint8Array): Promise<void> {
    const socketTimeoutMs = this.state.config.socketTimeoutMs ?? defaultSocketTimeoutMs
    let bytesWritten = 0
    while (bytesWritten < payload.length) {
      const transport = this.state.tlsConn ?? this.state.conn
      if (!transport) {
        throw new Error('Not connected')
      }
      bytesWritten += await withTimeout(
        transport.write(payload.subarray(bytesWritten)),
        socketTimeoutMs,
        `SMTP socket write timed out after ${socketTimeoutMs} ms`,
        () => this.close()
      )
    }
  }
}
