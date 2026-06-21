import * as fs from 'fs';
import * as path from 'path';
import { DateTime } from 'luxon';
import { rrulestr } from 'rrule';
import { CalendarEvent, ConflictDetail, CandidateSlot, Attendee } from '../types';

export function loadCalendarsFromDirectory(
  dirPath: string,
  attendeeNameMap?: Map<string, string>
): Map<string, CalendarEvent[]> {
  const absoluteDir = path.resolve(dirPath);
  const attendeeCalendars = new Map<string, CalendarEvent[]>();

  if (!fs.existsSync(absoluteDir)) {
    console.warn(`日历目录不存在: ${absoluteDir}`);
    return attendeeCalendars;
  }

  const files = fs.readdirSync(absoluteDir).filter(f => f.endsWith('.ics') || f.endsWith('.ical'));

  for (const file of files) {
    const filePath = path.join(absoluteDir, file);
    const attendeeName = deriveAttendeeName(file, attendeeNameMap);
    const events = parseICalFile(filePath);
    attendeeCalendars.set(attendeeName, events);
  }

  return attendeeCalendars;
}

function deriveAttendeeName(
  fileName: string,
  attendeeNameMap?: Map<string, string>
): string {
  const baseName = fileName.replace(/\.(ics|ical)$/i, '');
  if (attendeeNameMap && attendeeNameMap.has(baseName)) {
    return attendeeNameMap.get(baseName)!;
  }
  return baseName;
}

export function parseICalFile(filePath: string): CalendarEvent[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  return parseICalContent(content);
}

export function parseICalContent(content: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const lines = unfoldICalLines(content.split(/\r?\n/));
  
  let inEvent = false;
  let currentEvent: Partial<CalendarEvent> & { rrule?: string; exdates?: string; dtstartTz?: string } = {};
  let timezone = 'UTC';

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      currentEvent = {};
    } else if (line === 'END:VEVENT') {
      inEvent = false;
      if (currentEvent.start && currentEvent.end) {
        const expandedEvents = expandRecurringEvent(currentEvent, timezone);
        events.push(...expandedEvents);
      }
    } else if (inEvent) {
      const { key, value, params } = parseICalLine(line);

      switch (key.toUpperCase()) {
        case 'UID':
          currentEvent.uid = value;
          break;
        case 'SUMMARY':
          currentEvent.summary = value;
          break;
        case 'DTSTART': {
          const tzid = params.get('TZID') || timezone;
          currentEvent.dtstartTz = tzid;
          currentEvent.start = parseICalDate(value, tzid);
          break;
        }
        case 'DTEND': {
          const tzid = params.get('TZID') || timezone;
          currentEvent.end = parseICalDate(value, tzid);
          break;
        }
        case 'DTSTART;VALUE=DATE':
        case 'DTSTART;VALUE=DATE-TIME':
          currentEvent.start = parseICalDate(value, timezone);
          break;
        case 'DTEND;VALUE=DATE':
        case 'DTEND;VALUE=DATE-TIME':
          currentEvent.end = parseICalDate(value, timezone);
          break;
        case 'RRULE':
          currentEvent.rrule = value;
          break;
        case 'EXDATE':
          currentEvent.exdates = value;
          break;
      }
    } else if (line.startsWith('TZID:')) {
      timezone = line.substring(5);
    }
  }

  return events;
}

function unfoldICalLines(lines: string[]): string[] {
  const unfolded: string[] = [];
  let currentLine = '';

  for (const line of lines) {
    if (line.startsWith(' ') || line.startsWith('\t')) {
      currentLine += line.substring(1);
    } else {
      if (currentLine) unfolded.push(currentLine);
      currentLine = line;
    }
  }
  if (currentLine) unfolded.push(currentLine);

  return unfolded;
}

function parseICalLine(line: string): { key: string; value: string; params: Map<string, string> } {
  const params = new Map<string, string>();
  let keyEnd = line.indexOf(':');
  
  if (keyEnd === -1) {
    return { key: line, value: '', params };
  }

  let keyPart = line.substring(0, keyEnd);
  const value = line.substring(keyEnd + 1);

  const paramMatch = keyPart.match(/^([^;]+)(;.*)?$/);
  if (!paramMatch) {
    return { key: keyPart, value, params };
  }

  const key = paramMatch[1];
  const paramStr = paramMatch[2] || '';

  if (paramStr) {
    const paramPairs = paramStr.substring(1).split(';');
    for (const pair of paramPairs) {
      const eqIdx = pair.indexOf('=');
      if (eqIdx > 0) {
        params.set(pair.substring(0, eqIdx), pair.substring(eqIdx + 1));
      }
    }
  }

  return { key, value, params };
}

function parseICalDate(value: string, timezone: string): Date {
  if (value.length === 8) {
    const year = parseInt(value.substring(0, 4));
    const month = parseInt(value.substring(4, 6)) - 1;
    const day = parseInt(value.substring(6, 8));
    return DateTime.fromObject({ year, month, day }, { zone: timezone }).toUTC().toJSDate();
  }

  const dateTimeMatch = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (dateTimeMatch) {
    const [, year, month, day, hour, minute, second, z] = dateTimeMatch;
    if (z) {
      return DateTime.utc(
        parseInt(year),
        parseInt(month),
        parseInt(day),
        parseInt(hour),
        parseInt(minute),
        parseInt(second)
      ).toJSDate();
    } else {
      return DateTime.fromObject(
        {
          year: parseInt(year),
          month: parseInt(month) - 1,
          day: parseInt(day),
          hour: parseInt(hour),
          minute: parseInt(minute),
          second: parseInt(second),
        },
        { zone: timezone }
      ).toUTC().toJSDate();
    }
  }

  return new Date(value);
}

function expandRecurringEvent(
  event: Partial<CalendarEvent> & { rrule?: string; exdates?: string; dtstartTz?: string },
  defaultTimezone: string
): CalendarEvent[] {
  if (!event.start || !event.end || !event.uid) {
    return [];
  }

  const baseEvent: CalendarEvent = {
    uid: event.uid,
    summary: event.summary || 'Untitled Event',
    start: event.start,
    end: event.end,
    allDay: false,
  };

  if (!event.rrule) {
    return [baseEvent];
  }

  try {
    const tz = event.dtstartTz || defaultTimezone;
    const durationMs = event.end.getTime() - event.start.getTime();
    const dtstartLocal = DateTime.fromJSDate(event.start).setZone(tz);

    const rruleStr = `DTSTART:${dtstartLocal.toFormat("yyyyMMdd'T'HHmmss")}\nRRULE:${event.rrule}`;
    const rule = rrulestr(rruleStr);

    const twoYearsLater = DateTime.utc().plus({ years: 2 }).toJSDate();
    const occurrences = rule.between(new Date(), twoYearsLater, true);

    const exdates = parseExdates(event.exdates, tz);
    const exdateSet = new Set(exdates.map(d => d.getTime()));

    const events: CalendarEvent[] = [];
    for (const occurrence of occurrences.slice(0, 100)) {
      const occurrenceTime = occurrence.getTime();
      if (!exdateSet.has(occurrenceTime)) {
        const dtStart = DateTime.fromJSDate(occurrence).setZone(tz, { keepLocalTime: false });
        const utcStart = dtStart.toUTC().toJSDate();
        const utcEnd = new Date(utcStart.getTime() + durationMs);

        events.push({
          ...baseEvent,
          start: utcStart,
          end: utcEnd,
        });
      }
    }

    return events.length > 0 ? events : [baseEvent];
  } catch (e) {
    console.warn(`解析循环事件失败 ${event.uid}:`, e);
    return [baseEvent];
  }
}

function parseExdates(exdatesStr: string | undefined, timezone: string): Date[] {
  if (!exdatesStr) return [];
  
  const dates: Date[] = [];
  const parts = exdatesStr.split(',');
  
  for (const part of parts) {
    try {
      dates.push(parseICalDate(part.trim(), timezone));
    } catch (e) {
      console.warn(`解析 EXDATE 失败: ${part}`);
    }
  }
  
  return dates;
}

export function detectConflicts(
  candidate: CandidateSlot,
  attendeeCalendars: Map<string, CalendarEvent[]>
): ConflictDetail[] {
  const conflicts: ConflictDetail[] = [];

  for (const [attendeeName, events] of attendeeCalendars) {
    for (const event of events) {
      const overlap = calculateOverlap(candidate.start, candidate.end, event.start, event.end);
      if (overlap > 0) {
        conflicts.push({
          attendeeName,
          eventSummary: event.summary,
          eventStart: event.start,
          eventEnd: event.end,
          overlapMinutes: Math.ceil(overlap / (1000 * 60)),
        });
      }
    }
  }

  return conflicts;
}

export function detectConflictsForAll(
  candidates: CandidateSlot[],
  attendeeCalendars: Map<string, CalendarEvent[]>
): CandidateSlot[] {
  return candidates.map(candidate => ({
    ...candidate,
    conflicts: detectConflicts(candidate, attendeeCalendars),
  }));
}

function calculateOverlap(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): number {
  const overlapStart = Math.max(start1.getTime(), start2.getTime());
  const overlapEnd = Math.min(end1.getTime(), end2.getTime());
  return Math.max(0, overlapEnd - overlapStart);
}

export function buildAttendeeNameMap(attendees: Attendee[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const attendee of attendees) {
    const safeName = attendee.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    map.set(safeName, attendee.name);
    if (attendee.email) {
      const emailPrefix = attendee.email.split('@')[0].toLowerCase();
      map.set(emailPrefix, attendee.name);
    }
  }
  return map;
}
