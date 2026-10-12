import type { SmtpConnectOptions, SmtpTlsOptions, SmtpTransport } from '@runtime/Transport.ts'
import { connect as connectTcp, isIP, type Socket } from 'node:net'
import { connect as connectTls, type TLSSocket } from 'node:tls'

/**
 * Open a plain TCP transport on Node and Bun.
 * @description Connects with `node:net` and resolves once the socket is usable.
 * @param options - Target host, port and optional abort signal
 * @returns Connected transport
 * @throws {Error} When the socket fails or the signal aborts first
 */
export function connectNodeTransport(options: SmtpConnectOptions): Promise<SmtpTransport> {
  const { promise, resolve, reject } = Promise.withResolvers<SmtpTransport>()
  const socket = connectTcp({ host: options.hostname, port: options.port })
  const settle = (outcome: () => void): void => {
    socket.removeListener('connect', onConnect)
    socket.removeListener('error', onError)
    options.signal?.removeEventListener('abort', onAbort)
    outcome()
  }
  const onConnect = (): void => settle(() => resolve(new NodeTransport(socket, false)))
  const onError = (error: Error): void => settle(() => reject(error))
  const onAbort = (): void => {
    settle(() => {
      socket.destroy()
      reject(new Error(`Connection to ${options.hostname}:${options.port} was aborted`))
    })
  }
  socket.once('connect', onConnect)
  socket.once('error', onError)
  if (options.signal?.aborted) {
    onAbort()
  } else {
    options.signal?.addEventListener('abort', onAbort, { once: true })
  }
  return promise
}

/**
 * Node socket transport.
 * @description Adapts a push-based `node:net` or `node:tls` socket to pull-based reads.
 */
class NodeTransport implements SmtpTransport {
  /** Received chunks not yet handed to a reader */
  private pending: Uint8Array[] = []
  /** Bytes of the first pending chunk already consumed */
  private consumed = 0
  /** True once the peer closed its side */
  private ended = false
  /** First socket error, replayed to the next reader */
  private failure: Error | null = null
  /** Wakes the parked reader when bytes, end or error arrive */
  private notify: (() => void) | null = null

  /**
   * Wrap a connected socket.
   * @description Attaches the buffering listeners used by `read`.
   * @param socket - Connected Node socket
   * @param isSecure - True when the socket already carries TLS
   */
  constructor(private socket: Socket, readonly isSecure: boolean) {
    socket.on('data', this.onData)
    socket.on('end', this.onEnd)
    socket.on('close', this.onEnd)
    socket.on('error', this.onError)
  }

  /**
   * Read bytes from the socket.
   * @description Drains buffered chunks, parking until data, end or error arrives.
   * @param target - Buffer that receives the bytes
   * @returns Byte count written into target, or null at end of stream
   * @throws {Error} When the socket failed
   */
  async read(target: Uint8Array): Promise<number | null> {
    while (this.pending.length === 0) {
      if (this.failure) {
        throw this.failure
      }
      if (this.ended) {
        return null
      }
      const { promise, resolve } = Promise.withResolvers<void>()
      this.notify = resolve
      await promise
    }
    let written = 0
    while (written < target.length && this.pending.length > 0) {
      const chunk = this.pending[0] as Uint8Array
      const available = chunk.length - this.consumed
      const take = Math.min(available, target.length - written)
      target.set(chunk.subarray(this.consumed, this.consumed + take), written)
      written += take
      this.consumed += take
      if (this.consumed === chunk.length) {
        this.pending.shift()
        this.consumed = 0
      }
    }
    return written
  }

  /**
   * Write bytes to the socket.
   * @description Resolves once the payload has been flushed to the kernel.
   * @param payload - Bytes to send
   * @returns Number of bytes accepted by the socket
   * @throws {Error} When the socket failed
   */
  write(payload: Uint8Array): Promise<number> {
    const { promise, resolve, reject } = Promise.withResolvers<number>()
    if (this.failure) {
      reject(this.failure)
      return promise
    }
    this.socket.write(payload, (error) => {
      if (error) {
        reject(error)
        return
      }
      resolve(payload.length)
    })
    return promise
  }

  /**
   * Upgrade the socket to TLS.
   * @description Hands the plain socket to `node:tls` and awaits the handshake. The secured
   * socket is destroyed when the handshake fails or the signal aborts, since the caller cannot
   * reach it before this resolves.
   * @param options - TLS handshake options
   * @returns Secured transport replacing this one
   * @throws {Error} When the transport is already secured, unread bytes are buffered,
   *   or the handshake fails or is aborted
   */
  startTls(options: SmtpTlsOptions): Promise<SmtpTransport> {
    if (this.isSecure) {
      throw new Error('Transport is already secured')
    }
    // Bytes arriving before the upgrade are plaintext the server was not asked for and
    // would otherwise be injected into the secured session (STARTTLS command injection).
    if (this.pending.length > 0) {
      throw new Error('Unexpected data received before the TLS handshake')
    }
    this.detach()
    const { promise, resolve, reject } = Promise.withResolvers<SmtpTransport>()
    let secured: TLSSocket
    try {
      // SNI must carry a host name; Node rejects an IP literal outright, while the
      // certificate is still matched against the address through `host`.
      secured = connectTls({
        socket: this.socket,
        host: options.hostname,
        ...(isIP(options.hostname) === 0 ? { servername: options.hostname } : {})
      })
    } catch (error) {
      // The socket is already detached, so leaving it open would strand later reads.
      this.socket.destroy()
      reject(error as Error)
      return promise
    }
    const settle = (outcome: () => void): void => {
      secured.removeListener('secureConnect', onSecure)
      secured.removeListener('error', onFailure)
      options.signal?.removeEventListener('abort', onAbort)
      outcome()
    }
    const onSecure = (): void => settle(() => resolve(new NodeTransport(secured, true)))
    const onFailure = (error: Error): void => {
      settle(() => {
        secured.destroy()
        reject(error)
      })
    }
    const onAbort = (): void => {
      settle(() => {
        secured.destroy()
        reject(new Error('TLS handshake was aborted'))
      })
    }
    secured.once('secureConnect', onSecure)
    secured.once('error', onFailure)
    if (options.signal?.aborted) {
      onAbort()
    } else {
      options.signal?.addEventListener('abort', onAbort, { once: true })
    }
    return promise
  }

  /**
   * Close the socket.
   * @description Detaches listeners and destroys the socket.
   */
  close(): void {
    this.detach()
    this.socket.destroy()
    this.ended = true
    this.wake()
  }

  /**
   * Stop consuming socket events.
   * @description Removes the buffering listeners so another owner can take the socket.
   */
  private detach(): void {
    this.socket.removeListener('data', this.onData)
    this.socket.removeListener('end', this.onEnd)
    this.socket.removeListener('close', this.onEnd)
    this.socket.removeListener('error', this.onError)
  }

  /**
   * Buffer an inbound chunk.
   * @description Queues the bytes and wakes a parked reader.
   * @param chunk - Bytes delivered by the socket
   */
  private onData = (chunk: Uint8Array): void => {
    this.pending.push(chunk)
    this.wake()
  }

  /**
   * Record end of stream.
   * @description Marks the transport drained and wakes a parked reader.
   */
  private onEnd = (): void => {
    this.ended = true
    this.wake()
  }

  /**
   * Record a socket failure.
   * @description Stores the first error and wakes a parked reader.
   * @param error - Error reported by the socket
   */
  private onError = (error: Error): void => {
    this.failure ??= error
    this.ended = true
    this.wake()
  }

  /**
   * Wake the parked reader.
   * @description Resolves and clears the pending read notification.
   */
  private wake(): void {
    const notify = this.notify
    this.notify = null
    notify?.()
  }
}
