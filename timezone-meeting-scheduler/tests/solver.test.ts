import { DateTime } from 'luxon';
import { calculateWeight, deduplicateSlots, findMeetingSlots } from '../src/solver';
import { Attendee, AttendeeAvailability, CandidateSlot, TimeSlot } from '../src/types';

describe('Solver Module', () => {
  describe('calculateWeight() - 所有人同时区返回满分权重', () => {
    const createAttendee = (name: string, timezone: string): Attendee => ({
      name,
      email: `${name.toLowerCase()}@example.com`,
      timezone,
      workingHours: { start: '09:00', end: '18:00' },
      nonWorkingDays: [0, 6],
      priority: 1,
    });

    const createAvailability = (
      attendee: Attendee,
      isInWorkingHours: boolean,
      slot: TimeSlot
    ): AttendeeAvailability => ({
      attendee,
      isInWorkingHours,
      isDuringLunch: false,
      localStartTime: DateTime.fromJSDate(slot.start).setZone(attendee.timezone).toISO() || '',
      localEndTime: DateTime.fromJSDate(slot.end).setZone(attendee.timezone).toISO() || '',
    });

    test('3人同时区全部在工作时间，权重计算正确', () => {
      const attendees: Attendee[] = [
        createAttendee('Alice', 'Asia/Shanghai'),
        createAttendee('Bob', 'Asia/Shanghai'),
        createAttendee('Charlie', 'Asia/Shanghai'),
      ];

      const slot: TimeSlot = {
        start: DateTime.fromISO('2026-06-22T10:00:00', { zone: 'Asia/Shanghai' }).toUTC().toJSDate(),
        end: DateTime.fromISO('2026-06-22T11:00:00', { zone: 'Asia/Shanghai' }).toUTC().toJSDate(),
        durationMinutes: 60,
      };

      const availability: AttendeeAvailability[] = attendees.map(a =>
        createAvailability(a, true, slot)
      );

      const weight = calculateWeight(availability, 3);

      expect(weight).toBe(80);
    });

    test('4人同时区全部在工作时间，包含高优先级成员', () => {
      const attendees: Attendee[] = [
        { ...createAttendee('Manager', 'Asia/Shanghai'), priority: 2 },
        createAttendee('Dev1', 'Asia/Shanghai'),
        createAttendee('Dev2', 'Asia/Shanghai'),
        createAttendee('Dev3', 'Asia/Shanghai'),
      ];

      const slot: TimeSlot = {
        start: DateTime.fromISO('2026-06-22T14:00:00', { zone: 'Asia/Shanghai' }).toUTC().toJSDate(),
        end: DateTime.fromISO('2026-06-22T15:00:00', { zone: 'Asia/Shanghai' }).toUTC().toJSDate(),
        durationMinutes: 60,
      };

      const availability: AttendeeAvailability[] = attendees.map(a =>
        createAvailability(a, true, slot)
      );

      const weight = calculateWeight(availability, 4);

      expect(weight).toBe(100);
    });

    test('2人在工作时间，2人不在，触发 50% 共识奖励', () => {
      const attendees: Attendee[] = [
        createAttendee('A', 'Asia/Shanghai'),
        createAttendee('B', 'Asia/Shanghai'),
        createAttendee('C', 'Asia/Shanghai'),
        createAttendee('D', 'Asia/Shanghai'),
      ];

      const slot: TimeSlot = {
        start: DateTime.fromISO('2026-06-22T10:00:00', { zone: 'UTC' }).toJSDate(),
        end: DateTime.fromISO('2026-06-22T11:00:00', { zone: 'UTC' }).toJSDate(),
        durationMinutes: 60,
      };

      const availability: AttendeeAvailability[] = [
        createAvailability(attendees[0], true, slot),
        createAvailability(attendees[1], true, slot),
        createAvailability(attendees[2], false, slot),
        createAvailability(attendees[3], false, slot),
      ];

      const weight = calculateWeight(availability, 4);

      expect(weight).toBe(40);
    });

    test('3/4 人在工作时间，触发 50% 共识奖励', () => {
      const attendees: Attendee[] = [
        createAttendee('A', 'Asia/Shanghai'),
        createAttendee('B', 'Asia/Shanghai'),
        createAttendee('C', 'Asia/Shanghai'),
        createAttendee('D', 'Asia/Shanghai'),
      ];

      const slot: TimeSlot = {
        start: new Date(),
        end: new Date(),
        durationMinutes: 60,
      };

      const availability: AttendeeAvailability[] = [
        createAvailability(attendees[0], true, slot),
        createAvailability(attendees[1], true, slot),
        createAvailability(attendees[2], true, slot),
        createAvailability(attendees[3], false, slot),
      ];

      const weight = calculateWeight(availability, 4);

      expect(weight).toBe(50);
    });

    test('4/4 人在工作时间，触发 80% 共识奖励', () => {
      const attendees: Attendee[] = [
        createAttendee('A', 'Asia/Shanghai'),
        createAttendee('B', 'Asia/Shanghai'),
        createAttendee('C', 'Asia/Shanghai'),
        createAttendee('D', 'Asia/Shanghai'),
      ];

      const slot: TimeSlot = {
        start: new Date(),
        end: new Date(),
        durationMinutes: 60,
      };

      const availability: AttendeeAvailability[] = attendees.map(a =>
        createAvailability(a, true, slot)
      );

      const weight = calculateWeight(availability, 4);

      expect(weight).toBe(90);
    });
  });

  describe('deduplicateSlots() - 连续相同权重时段去重', () => {
    const createSlot = (
      hour: number,
      minute: number,
      workingHoursCount: number,
      weight: number
    ): CandidateSlot => {
      const start = DateTime.utc(2026, 6, 22, hour, minute).toJSDate();
      return {
        start,
        end: DateTime.fromJSDate(start).plus({ minutes: 60 }).toJSDate(),
        durationMinutes: 60,
        weight,
        workingHoursCount,
        availability: [],
        conflicts: [],
      };
    };

    test('相同 UTC 日期和时间的重复 slot 被去重', () => {
      const slots: CandidateSlot[] = [
        createSlot(10, 0, 3, 55),
        createSlot(10, 0, 3, 55),
        createSlot(10, 15, 3, 55),
        createSlot(11, 0, 3, 55),
      ];

      const result = deduplicateSlots(slots, 60);

      expect(result.length).toBe(2);
      expect(result[0].start.getUTCHours()).toBe(10);
      expect(result[0].start.getUTCMinutes()).toBe(0);
      expect(result[1].start.getUTCHours()).toBe(11);
      expect(result[1].start.getUTCMinutes()).toBe(0);
    });

    test('连续相同权重且时间间隔小于时长的 slot 被去重', () => {
      const slots: CandidateSlot[] = [
        createSlot(10, 0, 3, 55),
        createSlot(10, 15, 3, 55),
        createSlot(10, 30, 3, 55),
        createSlot(11, 0, 3, 55),
      ];

      const result = deduplicateSlots(slots, 60);

      expect(result.length).toBeLessThan(slots.length);
    });

    test('不同权重的 slot 不被去重', () => {
      const slots: CandidateSlot[] = [
        createSlot(10, 0, 4, 80),
        createSlot(10, 0, 3, 55),
      ];

      const result = deduplicateSlots(slots, 60);

      expect(result.length).toBe(2);
    });

    test('不同 workingHoursCount 的 slot 不被去重', () => {
      const slots: CandidateSlot[] = [
        createSlot(10, 0, 4, 80),
        createSlot(10, 0, 3, 80),
      ];

      const result = deduplicateSlots(slots, 60);

      expect(result.length).toBe(2);
    });

    test('去重使用 UTC 时间，不受本地时区影响', () => {
      const utcTime = DateTime.utc(2026, 6, 22, 8, 30).toJSDate();
      const slot1: CandidateSlot = {
        start: utcTime,
        end: DateTime.fromJSDate(utcTime).plus({ minutes: 60 }).toJSDate(),
        durationMinutes: 60,
        weight: 55,
        workingHoursCount: 3,
        availability: [],
        conflicts: [],
      };

      const slot2: CandidateSlot = {
        ...slot1,
      };

      const result = deduplicateSlots([slot1, slot2], 60);

      expect(result.length).toBe(1);

      const utcHour = result[0].start.getUTCHours();
      const utcMinute = result[0].start.getUTCMinutes();
      expect(utcHour).toBe(8);
      expect(utcMinute).toBe(30);
    });

    test('不同日期的相同时间不被去重', () => {
      const slot1 = createSlot(10, 0, 3, 55);
      const slot2: CandidateSlot = {
        ...slot1,
        start: DateTime.utc(2026, 6, 23, 10, 0).toJSDate(),
        end: DateTime.utc(2026, 6, 23, 11, 0).toJSDate(),
      };

      const result = deduplicateSlots([slot1, slot2], 60);

      expect(result.length).toBe(2);
    });
  });

  describe('findMeetingSlots() - 集成测试', () => {
    test('同时区团队返回可用时段', () => {
      const attendees: Attendee[] = [
        {
          name: 'User1',
          email: 'user1@example.com',
          timezone: 'Asia/Shanghai',
          workingHours: { start: '09:00', end: '18:00' },
          nonWorkingDays: [0, 6],
          priority: 1,
        },
        {
          name: 'User2',
          email: 'user2@example.com',
          timezone: 'Asia/Shanghai',
          workingHours: { start: '09:00', end: '18:00' },
          nonWorkingDays: [0, 6],
          priority: 1,
        },
      ];

      const result = findMeetingSlots(attendees, {
        durationMinutes: 60,
        searchDays: 1,
      });

      expect(result.topCandidates.length).toBeGreaterThan(0);
      expect(result.totalAttendees).toBe(2);
      expect(result.topCandidates[0].workingHoursCount).toBe(2);
    });

    test('同时区团队返回的时段权重包含共识奖励', () => {
      const attendees: Attendee[] = [
        {
          name: 'A',
          email: 'a@example.com',
          timezone: 'Asia/Tokyo',
          workingHours: { start: '09:00', end: '18:00' },
          nonWorkingDays: [0, 6],
          priority: 1,
        },
        {
          name: 'B',
          email: 'b@example.com',
          timezone: 'Asia/Tokyo',
          workingHours: { start: '09:00', end: '18:00' },
          nonWorkingDays: [0, 6],
          priority: 1,
        },
        {
          name: 'C',
          email: 'c@example.com',
          timezone: 'Asia/Tokyo',
          workingHours: { start: '09:00', end: '18:00' },
          nonWorkingDays: [0, 6],
          priority: 1,
        },
      ];

      const result = findMeetingSlots(attendees, {
        durationMinutes: 60,
        searchDays: 2,
      });

      expect(result.topCandidates[0].weight).toBe(80);
    });
  });
});
