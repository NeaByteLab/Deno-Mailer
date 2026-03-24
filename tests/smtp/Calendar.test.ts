import { assertMatch, assertThrows } from '@std/assert'
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

Deno.test('SmtpCalendar rejects attendee containing carriage return', () => {
  assertThrows(
    () =>
      SMTP.SmtpCalendar.formatCalendarEvent({
        uid: 'e1',
        summary: 'Meet',
        startTime: '2026-01-01T10:00:00Z',
        endTime: '2026-01-01T11:00:00Z',
        attendees: ['a@b.com\rc@d.com']
      }),
    Error,
    'Calendar attendee cannot contain line break characters'
  )
})

Deno.test('SmtpCalendar rejects uid containing line break (ICS line injection)', () => {
  assertThrows(
    () =>
      SMTP.SmtpCalendar.formatCalendarEvent({
        uid: 'bad\nuid',
        summary: 'Meet',
        startTime: '2026-01-01T10:00:00Z',
        endTime: '2026-01-01T11:00:00Z'
      }),
    Error,
    'Calendar uid cannot contain line break characters'
  )
})
