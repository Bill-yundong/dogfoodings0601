import { DateTime, Duration } from 'luxon';
import {
  Attendee,
  CandidateSlot,
  TimeSlot,
  SolverOptions,
  ScheduleResult,
  AttendeeAvailability,
} from '../types';
import {
  getAttendeeAvailability,
  getWorkingHoursInUTC,
} from '../attendees';

const TIME_SLOT_INTERVAL = 15;

export function findMeetingSlots(
  attendees: Attendee[],
  options: SolverOptions
): ScheduleResult {
  const { durationMinutes, searchDays = 14 } = options;
  const now = DateTime.utc();
  const searchStart = now.startOf('hour');
  const searchEnd = searchStart.plus({ days: searchDays });

  const candidateSlots: CandidateSlot[] = [];

  let currentSlotStart = searchStart;
  while (currentSlotStart.plus({ minutes: durationMinutes }) <= searchEnd) {
    const slot: TimeSlot = {
      start: currentSlotStart.toJSDate(),
      end: currentSlotStart.plus({ minutes: durationMinutes }).toJSDate(),
      durationMinutes,
    };

    const availability = attendees.map(a => getAttendeeAvailability(slot, a));
    const workingHoursCount = availability.filter(a => a.isInWorkingHours).length;

    if (workingHoursCount > 0) {
      const weight = calculateWeight(availability, attendees.length);

      candidateSlots.push({
        ...slot,
        weight,
        availability,
        workingHoursCount,
        conflicts: [],
      });
    }

    currentSlotStart = currentSlotStart.plus({ minutes: TIME_SLOT_INTERVAL });
  }

  const sortedCandidates = candidateSlots
    .sort((a, b) => {
      if (b.weight !== a.weight) return b.weight - a.weight;
      if (b.workingHoursCount !== a.workingHoursCount) return b.workingHoursCount - a.workingHoursCount;
      return a.start.getTime() - b.start.getTime();
    });

  const deduplicated = deduplicateSlots(sortedCandidates, durationMinutes);

  return {
    topCandidates: deduplicated.slice(0, 3),
    totalAttendees: attendees.length,
    searchRange: {
      start: searchStart.toJSDate(),
      end: searchEnd.toJSDate(),
    },
  };
}

export function calculateWeight(
  availability: AttendeeAvailability[],
  totalAttendees: number
): number {
  let weight = 0;

  for (const avail of availability) {
    if (avail.isInWorkingHours) {
      const baseScore = 10;
      const priorityBonus = avail.attendee.priority || 1;
      weight += baseScore * priorityBonus;
    }
  }

  const workingRatio = availability.filter(a => a.isInWorkingHours).length / totalAttendees;
  const consensusBonus = workingRatio >= 0.8 ? 50 : workingRatio >= 0.5 ? 20 : 0;

  return weight + consensusBonus;
}

export function deduplicateSlots(
  slots: CandidateSlot[],
  durationMinutes: number
): CandidateSlot[] {
  const uniqueSlots: CandidateSlot[] = [];
  const seenSlots = new Set<string>();

  for (const slot of slots) {
    const utcStart = DateTime.fromJSDate(slot.start).toUTC();
    const startOfDay = utcStart.startOf('day').toISO();
    const timeKey = `${startOfDay}-${utcStart.hour}-${utcStart.minute}-${slot.weight}-${slot.workingHoursCount}`;

    if (!seenSlots.has(timeKey)) {
      const isRedundant = uniqueSlots.some(existing => {
        const diff = Math.abs(existing.start.getTime() - slot.start.getTime());
        return diff < durationMinutes * 60 * 1000 &&
               existing.workingHoursCount === slot.workingHoursCount &&
               Math.abs(existing.weight - slot.weight) < 0.1;
      });

      if (!isRedundant) {
        seenSlots.add(timeKey);
        uniqueSlots.push(slot);
      }
    }

    if (uniqueSlots.length >= 50) break;
  }

  return uniqueSlots;
}

export function getIntersectionOfWorkingHours(
  attendees: Attendee[],
  date: Date
): { start: Date; end: Date } | null {
  if (attendees.length === 0) return null;

  const ranges = attendees.map(a => getWorkingHoursInUTC(date, a));

  let intersectionStart = new Date(Math.max(...ranges.map(r => r.start.getTime())));
  let intersectionEnd = new Date(Math.min(...ranges.map(r => r.end.getTime())));

  if (intersectionStart >= intersectionEnd) {
    return null;
  }

  return { start: intersectionStart, end: intersectionEnd };
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) {
    return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
  }
  return `${minutes}分钟`;
}
