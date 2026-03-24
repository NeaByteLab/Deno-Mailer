import { assertMatch } from '@std/assert'
import * as SMTP from '@smtp/index.ts'

Deno.test('SmtpCalendar formats minimal calendar event', () => {
  const calendarBody = SMTP.SmtpCalendar.formatCalendarEvent({
    uid: 'event-1',
    summary: 'Daily Sync',
    startTime: '2026-01-01T10:00:00Z',
    endTime: '2026-01-01T11:00:00Z'
  })
  assertMatch(calendarBody, /BEGIN:VCALENDAR/)
  assertMatch(calendarBody, /SUMMARY:Daily Sync/)
  assertMatch(calendarBody, /END:VCALENDAR/)
})
