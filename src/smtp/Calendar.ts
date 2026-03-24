import type * as Types from '@app/Types.ts'

/**
 * Format calendar invite payload.
 * @description Builds RFC 5545 text for calendar attachments.
 */
export class SmtpCalendar {
  /**
   * Format calendar event.
   * @description Converts invite fields into VCALENDAR content.
   * @param event - Calendar event data to format
   * @returns iCalendar formatted string
   */
  static formatCalendarEvent(event: Types.CalendarInvite): string {
    const formatDateTime = (dateTime: string): string => {
      return new Date(dateTime).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    }
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Deno Mailer//EN',
      'METHOD:REQUEST',
      'BEGIN:VEVENT',
      `UID:${event.uid}`,
      `DTSTAMP:${formatDateTime(new Date().toISOString())}`,
      `DTSTART:${formatDateTime(event.startTime)}`,
      `DTEND:${formatDateTime(event.endTime)}`,
      `SUMMARY:${event.summary}`
    ]
    if (event.description) {
      lines.push(`DESCRIPTION:${event.description}`)
    }
    if (event.location) {
      lines.push(`LOCATION:${event.location}`)
    }
    if (event.organizer) {
      lines.push(`ORGANIZER:MAILTO:${event.organizer}`)
    }
    if (event.attendees) {
      for (const attendee of event.attendees) {
        lines.push(`ATTENDEE:MAILTO:${attendee}`)
      }
    }
    if (event.status) {
      lines.push(`STATUS:${event.status}`)
    }
    lines.push('END:VEVENT')
    lines.push('END:VCALENDAR')
    return lines.join('\r\n')
  }
}
