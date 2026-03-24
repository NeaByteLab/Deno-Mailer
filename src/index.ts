import type * as Types from '@app/Types.ts'
import * as SMTP from '@smtp/index.ts'
import * as Utils from '@utils/index.ts'

/**
 * Main email service.
 * @description Exposes transporter factory for SMTP message sending.
 */
export const mailer: Types.EmailService = {
  /**
   * Create email transporter.
   * @description Validates config and returns sender abstraction.
   * @param config - SMTP connection configuration
   * @returns Email sender instance
   * @throws {Error} When configuration is invalid
   */
  transporter(config: Types.SmtpConnectionConfig): Types.EmailSender {
    Utils.validateSmtpConfig(config)
    return createTransporter(config)
  }
}

/**
 * Create transporter instance.
 * @description Builds sender with pooled or direct clients.
 * @param config - SMTP connection configuration
 * @returns Email sender implementation
 */
function createTransporter(config: Types.SmtpConnectionConfig): Types.EmailSender {
  const clientPool = new SmtpClientPool(config)
  return {
    async send(message: Types.EmailMessage): Promise<Types.SmtpSendResult> {
      const shouldUsePool = Boolean(config.pool)
      const client = shouldUsePool ? await clientPool.acquireClient() : new SMTP.SmtpClient(config)
      let isSendSuccessful = false
      try {
        if (!client.isConnected) {
          await client.connect()
        }
        const sendResult = await client.sendMessage(message)
        isSendSuccessful = true
        return sendResult
      } finally {
        if (shouldUsePool) {
          if (isSendSuccessful) {
            clientPool.markMessageProcessed(client)
          }
          clientPool.releaseClient(client)
        } else {
          await client.disconnect()
        }
      }
    }
  }
}

/**
 * Manage reusable SMTP clients.
 * @description Provides bounded client reuse for send operations.
 */
class SmtpClientPool {
  /** Busy SMTP clients currently in use */
  private busyClients = new Set<SMTP.SmtpClient>()
  /** Idle timer per pooled client */
  private idleTimerByClient = new Map<SMTP.SmtpClient, number>()
  /** Processed message count per pooled client */
  private messageCountByClient = new Map<SMTP.SmtpClient, number>()
  /** Maximum messages before recycle */
  private maxMessagesPerConnection: number
  /** Maximum number of pooled clients */
  private maxConnections: number
  /** Idle timeout for pooled clients */
  private poolIdleTimeoutMs: number
  /** Idle pooled SMTP clients */
  private readyClients: SMTP.SmtpClient[] = []
  /** Waiting client acquire resolvers */
  private waitQueue: Array<(client: SMTP.SmtpClient) => void> = []

  /**
   * Create SMTP client pool.
   * @description Configures pooled capacity from transport settings.
   * @param config - SMTP connection configuration
   */
  constructor(private config: Types.SmtpConnectionConfig) {
    if (typeof config.pool === 'object') {
      this.maxConnections = Math.max(1, config.pool.maxConnections ?? 1)
      this.maxMessagesPerConnection = Math.max(
        1,
        config.pool.maxMessagesPerConnection ?? Number.MAX_SAFE_INTEGER
      )
      this.poolIdleTimeoutMs = Math.max(0, config.pool.idleTimeoutMs ?? 60000)
    } else {
      this.maxConnections = 1
      this.maxMessagesPerConnection = Number.MAX_SAFE_INTEGER
      this.poolIdleTimeoutMs = 60000
    }
  }

  /**
   * Acquire pooled SMTP client.
   * @description Returns idle client or creates new one.
   * @returns Available SMTP client instance
   */
  async acquireClient(): Promise<SMTP.SmtpClient> {
    const readyClient = this.readyClients.pop()
    if (readyClient) {
      const activeIdleTimer = this.idleTimerByClient.get(readyClient)
      if (activeIdleTimer !== undefined) {
        clearTimeout(activeIdleTimer)
        this.idleTimerByClient.delete(readyClient)
      }
      this.busyClients.add(readyClient)
      return readyClient
    }
    const totalClientCount = this.readyClients.length + this.busyClients.size
    if (totalClientCount < this.maxConnections) {
      const newClient = new SMTP.SmtpClient(this.config)
      this.busyClients.add(newClient)
      return newClient
    }
    return await new Promise<SMTP.SmtpClient>((resolve) => {
      this.waitQueue.push(resolve)
    })
  }

  /**
   * Release pooled SMTP client.
   * @description Marks idle or hands off waiting sender.
   * @param client - SMTP client instance to release
   */
  releaseClient(client: SMTP.SmtpClient): void {
    this.busyClients.delete(client)
    const nextWaiter = this.waitQueue.shift()
    const processedMessageCount = this.messageCountByClient.get(client) ?? 0
    if (processedMessageCount >= this.maxMessagesPerConnection) {
      this.messageCountByClient.delete(client)
      void client.disconnect()
      if (nextWaiter) {
        const recycledClient = new SMTP.SmtpClient(this.config)
        this.busyClients.add(recycledClient)
        nextWaiter(recycledClient)
      }
      return
    }
    if (nextWaiter) {
      this.busyClients.add(client)
      nextWaiter(client)
      return
    }
    this.readyClients.push(client)
    const idleTimerId = setTimeout(() => {
      this.readyClients = this.readyClients.filter((pooledClient) => pooledClient !== client)
      this.idleTimerByClient.delete(client)
      this.messageCountByClient.delete(client)
      void client.disconnect()
    }, this.poolIdleTimeoutMs)
    this.idleTimerByClient.set(client, idleTimerId)
  }

  /**
   * Increment client usage count.
   * @description Tracks message count for recycle policy.
   * @param client - SMTP client instance to count
   */
  markMessageProcessed(client: SMTP.SmtpClient): void {
    const currentMessageCount = this.messageCountByClient.get(client) ?? 0
    this.messageCountByClient.set(client, currentMessageCount + 1)
  }
}

/**
 * Default mailer export.
 * @description Provides main library entry for SMTP sending.
 */
export default mailer

/**
 * Re-export all types.
 * @description Exposes shared interfaces and type aliases.
 */
export type * from '@app/Types.ts'
