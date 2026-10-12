import type { SmtpConnectOptions, SmtpTlsOptions, SmtpTransport } from '@runtime/Transport.ts'

/**
 * Open a plain TCP transport on Deno.
 * @description Connects with the native Deno socket API.
 * @param options - Target host, port and optional abort signal
 * @returns Connected transport
 * @throws {Error} When the runtime does not expose Deno sockets
 */
export async function connectDenoTransport(options: SmtpConnectOptions): Promise<SmtpTransport> {
  const host = globalThis as unknown as { Deno?: DenoSockets }
  if (!host.Deno) {
    throw new Error('Deno sockets are unavailable on this runtime')
  }
  const connection = await host.Deno.connect(
    options.signal
      ? { hostname: options.hostname, port: options.port, signal: options.signal }
      : { hostname: options.hostname, port: options.port }
  )
  return new DenoTransport(host.Deno, connection, false)
}

/**
 * Deno socket transport.
 * @description Wraps a Deno TCP or TLS connection behind the SMTP transport contract.
 */
class DenoTransport implements SmtpTransport {
  /**
   * Wrap a Deno connection.
   * @description Stores the socket together with the namespace used for TLS upgrades.
   * @param deno - Deno socket namespace
   * @param connection - Open Deno connection
   * @param isSecure - True when the connection already carries TLS
   */
  constructor(
    private deno: DenoSockets,
    private connection: DenoConnection,
    readonly isSecure: boolean
  ) {}

  /**
   * Read bytes from the socket.
   * @description Delegates to the native read.
   * @param target - Buffer that receives the bytes
   * @returns Byte count written into target, or null at end of stream
   */
  read(target: Uint8Array): Promise<number | null> {
    return this.connection.read(target)
  }

  /**
   * Write bytes to the socket.
   * @description Delegates to the native write, which may accept a partial payload.
   * @param payload - Bytes to send
   * @returns Number of bytes accepted by the socket
   */
  write(payload: Uint8Array): Promise<number> {
    return this.connection.write(payload)
  }

  /**
   * Upgrade the socket to TLS.
   * @description Starts TLS over the plain socket and awaits the handshake. The secured socket
   * is closed when the handshake fails or the signal aborts, since the caller cannot reach it
   * before this resolves.
   * @param options - TLS handshake options
   * @returns Secured transport replacing this one
   * @throws {Error} When the transport already carries TLS, or the handshake fails or is aborted
   */
  async startTls(options: SmtpTlsOptions): Promise<SmtpTransport> {
    if (this.isSecure) {
      throw new Error('Transport is already secured')
    }
    const secured = await this.deno.startTls(this.connection, { hostname: options.hostname })
    const closeSecured = (): void => {
      try {
        secured.close()
      } catch {
        // Already closed
      }
    }
    if (options.signal?.aborted) {
      closeSecured()
      throw new Error('TLS handshake was aborted')
    }
    options.signal?.addEventListener('abort', closeSecured, { once: true })
    try {
      await secured.handshake()
    } catch (error) {
      closeSecured()
      throw error
    } finally {
      options.signal?.removeEventListener('abort', closeSecured)
    }
    return new DenoTransport(this.deno, secured, true)
  }

  /**
   * Close the socket.
   * @description Ignores failures from an already closed socket.
   */
  close(): void {
    try {
      this.connection.close()
    } catch {
      // Already closed
    }
  }
}

/**
 * Deno connection shape used here.
 * @description Structural view of `Deno.Conn`, declared locally so the module type-checks
 * without Deno's ambient library when it is bundled for npm.
 */
interface DenoConnection {
  /** Reads the next bytes into target, or resolves null at end of stream */
  read(target: Uint8Array): Promise<number | null>
  /** Writes bytes and resolves the accepted count */
  write(payload: Uint8Array): Promise<number>
  /** Releases the socket */
  close(): void
}

/** Structural view of `Deno.TlsConn`. */
interface DenoTlsConnection extends DenoConnection {
  /** Resolves once the TLS handshake completes */
  handshake(): Promise<void>
}

/** Structural view of the Deno socket namespace. */
interface DenoSockets {
  /** Opens a TCP connection */
  connect(options: {
    hostname: string
    port: number
    signal?: AbortSignal
  }): Promise<DenoConnection>
  /** Upgrades a plain connection to TLS */
  startTls(
    connection: DenoConnection,
    options: { hostname: string }
  ): Promise<DenoTlsConnection>
}
