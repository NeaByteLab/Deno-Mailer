/**
 * Byte transport used by the SMTP layer.
 * @description Duplex socket abstraction implemented once per host runtime.
 */
export interface SmtpTransport {
  /** True once the transport carries TLS traffic */
  readonly isSecure: boolean
  /**
   * Read bytes from the peer.
   * @description Fills target with the next available bytes.
   * @param target - Buffer that receives the bytes
   * @returns Byte count written into target, or null at end of stream
   */
  read(target: Uint8Array): Promise<number | null>
  /**
   * Write bytes to the peer.
   * @description Hands payload to the socket and reports accepted bytes.
   * @param payload - Bytes to send
   * @returns Number of bytes accepted by the socket
   */
  write(payload: Uint8Array): Promise<number>
  /**
   * Upgrade the transport to TLS.
   * @description Resolves only after the TLS handshake completes.
   * @param options - TLS handshake options
   * @returns Secured transport replacing this one
   */
  startTls(options: SmtpTlsOptions): Promise<SmtpTransport>
  /**
   * Close the transport.
   * @description Releases the socket; repeat calls are ignored.
   */
  close(): void
}

/** Options for opening a plain TCP transport. */
export interface SmtpConnectOptions {
  /** Target host name or address */
  hostname: string
  /** Target TCP port */
  port: number
  /** Optional signal that aborts a pending connect */
  signal?: AbortSignal
}

/** Options for upgrading a transport to TLS. */
export interface SmtpTlsOptions {
  /** Server name used for certificate verification and SNI */
  hostname: string
  /** Optional signal that closes the socket when the handshake is abandoned */
  signal?: AbortSignal
}

/**
 * Open a plain TCP transport.
 * @description Selects the Deno or Node implementation for the host runtime.
 * @param options - Target host, port and optional abort signal
 * @returns Connected transport
 * @throws {Error} When the socket cannot be opened
 */
export async function connectTransport(options: SmtpConnectOptions): Promise<SmtpTransport> {
  if (!cachedConnector) {
    const host = globalThis as unknown as { Deno?: { connect?: unknown } }
    // Runtime-selected module: each transport imports APIs the other runtime lacks,
    // so neither may be reached by a static import.
    if (typeof host.Deno?.connect === 'function') {
      cachedConnector = (await import('@runtime/DenoTransport.ts')).connectDenoTransport
    } else {
      cachedConnector = (await import('@runtime/NodeTransport.ts')).connectNodeTransport
    }
  }
  return await cachedConnector(options)
}

/** Opens a plain TCP transport for one specific runtime. */
type TransportConnector = (options: SmtpConnectOptions) => Promise<SmtpTransport>

/** Connector for the detected runtime, resolved on first connect. */
let cachedConnector: TransportConnector | null = null
