import type * as Types from '@app/Types.ts'

/**
 * Build iCalendar VCALENDAR payloads.
 * @description Formats calendar invites as RFC 5545 text.
 */
export class SmtpCalendar {
  /**
   * Format invite to iCalendar text.
   * @description Joins VCALENDAR lines from invite fields.
   * @param invite - Calendar invite payload from caller
   * @returns Single VCALENDAR document string
   */
  static formatCalendarEvent(invite: Types.CalendarInvite): string {
    SmtpCalendar.rejectFieldLineBreaks('Calendar uid', invite.uid)
    SmtpCalendar.rejectFieldLineBreaks('Calendar summary', invite.summary)
    SmtpCalendar.rejectFieldLineBreaks('Calendar startTime', invite.startTime)
    SmtpCalendar.rejectFieldLineBreaks('Calendar endTime', invite.endTime)
    if (invite.description) {
      SmtpCalendar.rejectFieldLineBreaks('Calendar description', invite.description)
    }
    if (invite.location) {
      SmtpCalendar.rejectFieldLineBreaks('Calendar location', invite.location)
    }
    if (invite.organizer) {
      SmtpCalendar.rejectFieldLineBreaks('Calendar organizer', invite.organizer)
    }
    if (invite.attendees) {
      for (const attendeeEmail of invite.attendees) {
        SmtpCalendar.rejectFieldLineBreaks('Calendar attendee', attendeeEmail)
      }
    }
    const formatIsoTimestampForIcs = (isoDateTime: string): string => {
      return new Date(isoDateTime).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    }
    const icalPropertyLines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Deno Mailer//EN',
      'METHOD:REQUEST',
      'BEGIN:VEVENT',
      `UID:${invite.uid}`,
      `DTSTAMP:${formatIsoTimestampForIcs(new Date().toISOString())}`,
      `DTSTART:${formatIsoTimestampForIcs(invite.startTime)}`,
      `DTEND:${formatIsoTimestampForIcs(invite.endTime)}`,
      `SUMMARY:${invite.summary}`
    ]
    if (invite.description) {
      icalPropertyLines.push(`DESCRIPTION:${invite.description}`)
    }
    if (invite.location) {
      icalPropertyLines.push(`LOCATION:${invite.location}`)
    }
    if (invite.organizer) {
      icalPropertyLines.push(`ORGANIZER:MAILTO:${invite.organizer}`)
    }
    if (invite.attendees) {
      for (const attendeeEmail of invite.attendees) {
        icalPropertyLines.push(`ATTENDEE:MAILTO:${attendeeEmail}`)
      }
    }
    if (invite.status) {
      icalPropertyLines.push(`STATUS:${invite.status}`)
    }
    icalPropertyLines.push('END:VEVENT')
    icalPropertyLines.push('END:VCALENDAR')
    return icalPropertyLines.join('\r\n')
  }

  /**
   * Throw when field text spans lines.
   * @description Rejects CR or LF inside one ICS property value.
   * @param fieldDisplayName - Name shown in thrown Error message
   * @param rawFieldText - User-provided string to validate
   * @throws {Error} When rawFieldText contains line breaks
   */
  private static rejectFieldLineBreaks(fieldDisplayName: string, rawFieldText: string): void {
    if (rawFieldText.includes('\r') || rawFieldText.includes('\n')) {
      throw new Error(`${fieldDisplayName} cannot contain line break characters`)
    }
  }
}
