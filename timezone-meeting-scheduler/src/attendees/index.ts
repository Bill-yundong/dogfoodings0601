import * as fs from 'fs';
import * as path from 'path';
import { DateTime } from 'luxon';
import { Attendee, AttendeeConfig, AttendeeAvailability, TimeSlot } from '../types';

export function loadAttendeesFromJson(filePath: string): Attendee[] {
  const absolutePath = path.resolve(filePath);
  const rawData = fs.readFileSync(absolutePath, 'utf-8');
  const configs: AttendeeConfig[] = JSON.parse(rawData);
  
  return configs.map(config => validateAndTransformConfig(config));
}

function validateAndTransformConfig(config: AttendeeConfig): Attendee {
  if (!config.name || !config.timezone || !config.workingHours) {
    throw new Error(`Invalid attendee config: name, timezone, and workingHours are required`);
  }

  validateTimeFormat(config.workingHours.start);
  validateTimeFormat(config.workingHours.end);
  
  if (config.lunchBreak) {
    validateTimeFormat(config.lunchBreak.start);
    validateTimeFormat(config.lunchBreak.end);
  }

  return {
    name: config.name,
    email: config.email || '',
    timezone: config.timezone,
    workingHours: config.workingHours,
    lunchBreak: config.lunchBreak,
    nonWorkingDays: config.nonWorkingDays || [0, 6],
    priority: config.priority || 1,
  };
}

function validateTimeFormat(time: string): void {
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timeRegex.test(time)) {
    throw new Error(`Invalid time format: ${time}. Expected HH:mm format.`);
  }
}

export function isTimeInWorkingHours(
  utcDate: Date,
  attendee: Attendee
): { isInWorkingHours: boolean; isDuringLunch: boolean } {
  const localTime = DateTime.fromJSDate(utcDate).setZone(attendee.timezone);
  const dayOfWeek = localTime.weekday % 7;

  if (attendee.nonWorkingDays.includes(dayOfWeek)) {
    return { isInWorkingHours: false, isDuringLunch: false };
  }

  const timeString = localTime.toFormat('HH:mm');
  const { workingHours, lunchBreak } = attendee;

  const isInWorkingHours = timeString >= workingHours.start && timeString < workingHours.end;

  let isDuringLunch = false;
  if (lunchBreak && isInWorkingHours) {
    isDuringLunch = timeString >= lunchBreak.start && timeString < lunchBreak.end;
  }

  return { isInWorkingHours: isInWorkingHours && !isDuringLunch, isDuringLunch };
}

export function getLocalTimeString(utcDate: Date, timezone: string): string {
  return DateTime.fromJSDate(utcDate)
    .setZone(timezone)
    .toFormat('yyyy-MM-dd HH:mm ZZZZ');
}

export function getAttendeeAvailability(
  slot: TimeSlot,
  attendee: Attendee
): AttendeeAvailability {
  const startCheck = isTimeInWorkingHours(slot.start, attendee);
  const endCheck = isTimeInWorkingHours(slot.end, attendee);

  const isInWorkingHours = startCheck.isInWorkingHours && endCheck.isInWorkingHours;
  const isDuringLunch = startCheck.isDuringLunch || endCheck.isDuringLunch;

  return {
    attendee,
    isInWorkingHours,
    isDuringLunch,
    localStartTime: getLocalTimeString(slot.start, attendee.timezone),
    localEndTime: getLocalTimeString(slot.end, attendee.timezone),
  };
}

export function getWorkingHoursInUTC(
  date: Date,
  attendee: Attendee
): { start: Date; end: Date } {
  const localDate = DateTime.fromJSDate(date).setZone(attendee.timezone);
  const [startHour, startMin] = attendee.workingHours.start.split(':').map(Number);
  const [endHour, endMin] = attendee.workingHours.end.split(':').map(Number);

  const localStart = localDate.set({
    hour: startHour,
    minute: startMin,
    second: 0,
    millisecond: 0,
  });

  const localEnd = localDate.set({
    hour: endHour,
    minute: endMin,
    second: 0,
    millisecond: 0,
  });

  return {
    start: localStart.toUTC().toJSDate(),
    end: localEnd.toUTC().toJSDate(),
  };
}
