import { assertRejects } from '@std/assert'
import * as SMTP from '@smtp/index.ts'

Deno.test('SmtpConnection upgradeToTLS rejects without tcp connection', async () => {
  const smtpConnection = new SMTP.SmtpConnection({
    conn: null,
    tlsConn: null,
    config: {
      host: 'smtp.ethereal.email',
      port: 587
    }
  })
  await assertRejects(() => smtpConnection.upgradeToTLS(), Error, 'No connection to upgrade')
})
