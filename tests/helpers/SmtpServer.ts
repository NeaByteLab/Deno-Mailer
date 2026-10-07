/** Protocol point where a scripted session stops answering. */
export type SmtpStallPoint = 'greeting' | 'rcpt' | 'none'

/** Observed result of one scripted SMTP session. */
export interface SmtpSessionOutcome {
  /** True when the client closed its socket before the server gave up */
  clientClosed: boolean
  /** DATA payload bytes received before the end-of-data marker */
  dataBytes: number
}

/** Running scripted SMTP server. */
export interface ScriptedSmtpServer {
  /** Loopback port the server listens on */
  port: number
  /** Settles after every scripted session has ended */
  outcomes: Promise<SmtpSessionOutcome[]>
}

/**
 * Start scripted loopback SMTP server.
 * @description Serves one session per plan entry, in accept order, then stops listening.
 * @param plans - Stall point for each accepted connection
 * @param holdMs - How long a stalled session waits for the client to hang up
 * @returns Server port and session outcomes
 */
export function startSmtpServer(plans: SmtpStallPoint[], holdMs = 3000): ScriptedSmtpServer {
  const listener = Deno.listen({ hostname: '127.0.0.1', port: 0 })
  const outcomes = (async () => {
    const results: SmtpSessionOutcome[] = []
    try {
      for (const plan of plans) {
        results.push(await runSession(await listener.accept(), plan, holdMs))
      }
    } finally {
      listener.close()
    }
    return results
  })()
  return { port: listener.addr.port, outcomes }
}

/**
 * Serve one scripted SMTP session.
 * @description Answers EHLO MAIL RCPT DATA QUIT unless the plan stalls first.
 * @param conn - Accepted client connection
 * @param plan - Stall point for this session
 * @param holdMs - How long a stall waits for the client to hang up
 * @returns Session outcome
 */
async function runSession(
  conn: Deno.Conn,
  plan: SmtpStallPoint,
  holdMs: number
): Promise<SmtpSessionOutcome> {
  const buffer = new Uint8Array(64 * 1024)
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  let pending = ''
  let dataBytes = 0
  const readMore = async (): Promise<boolean> => {
    const bytesRead = await conn.read(buffer)
    if (bytesRead === null) {
      return false
    }
    pending += decoder.decode(buffer.subarray(0, bytesRead))
    return true
  }
  const readLine = async (): Promise<string | null> => {
    while (!pending.includes('\r\n')) {
      if (!(await readMore())) {
        return null
      }
    }
    const lineEnd = pending.indexOf('\r\n')
    const line = pending.slice(0, lineEnd)
    pending = pending.slice(lineEnd + 2)
    return line
  }
  const readData = async (): Promise<number> => {
    let searchFrom = 0
    while (true) {
      const markerIndex = pending.indexOf('\r\n.\r\n', searchFrom)
      if (markerIndex >= 0) {
        pending = pending.slice(markerIndex + 5)
        return markerIndex + 2
      }
      searchFrom = Math.max(0, pending.length - 4)
      if (!(await readMore())) {
        return pending.length
      }
    }
  }
  const reply = async (text: string): Promise<void> => {
    await conn.write(encoder.encode(`${text}\r\n`))
  }
  const awaitHangup = async (): Promise<boolean> => {
    const { promise: holdExpired, resolve } = Promise.withResolvers<false>()
    const holdTimer = setTimeout(() => resolve(false), holdMs)
    const hangup = (async () => {
      while (await readMore()) {
        // Discard anything the client sends while the server stalls.
      }
      return true
    })()
    try {
      return await Promise.race([hangup, holdExpired])
    } finally {
      clearTimeout(holdTimer)
    }
  }
  try {
    if (plan === 'greeting') {
      return { clientClosed: await awaitHangup(), dataBytes }
    }
    await reply('220 scripted ESMTP')
    while (true) {
      const line = await readLine()
      if (line === null) {
        return { clientClosed: true, dataBytes }
      }
      const verb = line.slice(0, 4).toUpperCase()
      if (verb === 'RCPT' && plan === 'rcpt') {
        return { clientClosed: await awaitHangup(), dataBytes }
      }
      if (verb === 'DATA') {
        await reply('354 Send data')
        dataBytes = await readData()
        await reply('250 OK queued')
      } else if (verb === 'QUIT') {
        await reply('221 Bye')
        return { clientClosed: await awaitHangup(), dataBytes }
      } else {
        await reply(['EHLO', 'MAIL', 'RCPT'].includes(verb) ? '250 OK' : '502 Unsupported')
      }
    }
  } finally {
    conn.close()
  }
}
