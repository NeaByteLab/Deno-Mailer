import type { CalendarInvite } from '@app/Types.ts'

/**
 * Formats calendar events for email transmission.
 * @description Creates iCalendar (RFC 5545) formatted calendar events for email attachments.
 */
export class CalendarFormatter {
  /**
   * Formats calendar event as iCalendar data.
   * @param event - Calendar event data to format
   * @returns iCalendar formatted string
   */
  static formatCalendarEvent(event: CalendarInvite): string {
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
