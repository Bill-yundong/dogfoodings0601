export interface WorkingHours {
  start: string;
  end: string;
}

export interface LunchBreak {
  start: string;
  end: string;
}

export interface AttendeeConfig {
  name: string;
  email: string;
  timezone: string;
  workingHours: WorkingHours;
  lunchBreak?: LunchBreak;
  nonWorkingDays?: number[];
  priority?: number;
}

export interface Attendee {
  name: string;
  email: string;
  timezone: string;
  workingHours: WorkingHours;
  lunchBreak?: LunchBreak;
  nonWorkingDays: number[];
  priority: number;
}

export interface TimeSlot {
  start: Date;
  end: Date;
  durationMinutes: number;
}

export interface AttendeeAvailability {
  attendee: Attendee;
  isInWorkingHours: boolean;
  isDuringLunch: boolean;
  localStartTime: string;
  localEndTime: string;
}

export interface CandidateSlot extends TimeSlot {
  weight: number;
  availability: AttendeeAvailability[];
  workingHoursCount: number;
  conflicts: ConflictDetail[];
}

export interface CalendarEvent {
  uid: string;
  summary: string;
  start: Date;
  end: Date;
  allDay: boolean;
}

export interface ConflictDetail {
  attendeeName: string;
  eventSummary: string;
  eventStart: Date;
  eventEnd: Date;
  overlapMinutes: number;
}

export interface SolverOptions {
  durationMinutes: number;
  searchDays: number;
  startTime?: string;
  endTime?: string;
}

export interface ScheduleResult {
  topCandidates: CandidateSlot[];
  totalAttendees: number;
  searchRange: {
    start: Date;
    end: Date;
  };
}
