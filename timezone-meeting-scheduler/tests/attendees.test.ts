import { DateTime } from 'luxon';
import { isTimeInWorkingHours } from '../src/attendees';
import { Attendee } from '../src/types';

describe('Attendees Module', () => {
  describe('isTimeInWorkingHours() - 夏令时切换日判定', () => {
    const attendeeBerlin: Attendee = {
      name: 'Test User',
      email: 'test@example.com',
      timezone: 'Europe/Berlin',
      workingHours: { start: '09:00', end: '17:00' },
      nonWorkingDays: [0, 6],
      priority: 1,
    };

    test('DST 开始日（3月最后一个周日）上午工作时间判定正确', () => {
      const utcTime = DateTime.fromISO('2026-03-30T07:00:00', { zone: 'UTC' }).toJSDate();
      const result = isTimeInWorkingHours(utcTime, attendeeBerlin);

      const localTime = DateTime.fromJSDate(utcTime).setZone('Europe/Berlin');
      expect(localTime.hour).toBe(9);
      expect(result.isInWorkingHours).toBe(true);
    });

    test('DST 开始日（3月最后一个周日）下午工作时间判定正确', () => {
      const utcTime = DateTime.fromISO('2026-03-30T14:00:00', { zone: 'UTC' }).toJSDate();
      const result = isTimeInWorkingHours(utcTime, attendeeBerlin);

      const localTime = DateTime.fromJSDate(utcTime).setZone('Europe/Berlin');
      expect(localTime.hour).toBe(16);
      expect(result.isInWorkingHours).toBe(true);
    });

    test('DST 结束日（10月最后一个周日）上午工作时间判定正确', () => {
      const utcTime = DateTime.fromISO('2026-10-26T08:00:00', { zone: 'UTC' }).toJSDate();
      const result = isTimeInWorkingHours(utcTime, attendeeBerlin);

      const localTime = DateTime.fromJSDate(utcTime).setZone('Europe/Berlin');
      expect(localTime.hour).toBe(9);
      expect(result.isInWorkingHours).toBe(true);
    });

    test('DST 结束日（10月最后一个周日）下班后判定正确', () => {
      const utcTime = DateTime.fromISO('2026-10-26T17:00:00', { zone: 'UTC' }).toJSDate();
      const result = isTimeInWorkingHours(utcTime, attendeeBerlin);

      const localTime = DateTime.fromJSDate(utcTime).setZone('Europe/Berlin');
      expect(localTime.hour).toBe(18);
      expect(result.isInWorkingHours).toBe(false);
    });

    test('美国 PDT/PST 切换日工作时间判定正确', () => {
      const attendeeLA: Attendee = {
        ...attendeeBerlin,
        timezone: 'America/Los_Angeles',
      };

      const utcTime = DateTime.fromISO('2026-03-09T16:00:00', { zone: 'UTC' }).toJSDate();
      const result = isTimeInWorkingHours(utcTime, attendeeLA);

      const localTime = DateTime.fromJSDate(utcTime).setZone('America/Los_Angeles');
      expect(localTime.hour).toBe(9);
      expect(result.isInWorkingHours).toBe(true);
    });
  });

  describe('isTimeInWorkingHours() - 中东工作制 nonWorkingDays: [5, 6]', () => {
    const middleEastAttendee: Attendee = {
      name: 'Dubai User',
      email: 'dubai@example.com',
      timezone: 'Asia/Dubai',
      workingHours: { start: '09:00', end: '18:00' },
      nonWorkingDays: [5, 6],
      priority: 1,
    };

    test('周日（weekday 0）在中东工作制下是工作日', () => {
      const sunday = DateTime.fromISO('2026-06-21T10:00:00', { zone: 'Asia/Dubai' });
      expect(sunday.weekday % 7).toBe(0);

      const result = isTimeInWorkingHours(sunday.toUTC().toJSDate(), middleEastAttendee);
      expect(result.isInWorkingHours).toBe(true);
    });

    test('周一（weekday 1）在中东工作制下是工作日', () => {
      const monday = DateTime.fromISO('2026-06-22T10:00:00', { zone: 'Asia/Dubai' });
      expect(monday.weekday % 7).toBe(1);

      const result = isTimeInWorkingHours(monday.toUTC().toJSDate(), middleEastAttendee);
      expect(result.isInWorkingHours).toBe(true);
    });

    test('周四（weekday 4）在中东工作制下是工作日', () => {
      const thursday = DateTime.fromISO('2026-06-25T10:00:00', { zone: 'Asia/Dubai' });
      expect(thursday.weekday % 7).toBe(4);

      const result = isTimeInWorkingHours(thursday.toUTC().toJSDate(), middleEastAttendee);
      expect(result.isInWorkingHours).toBe(true);
    });

    test('周五（weekday 5）在中东工作制下是非工作日', () => {
      const friday = DateTime.fromISO('2026-06-26T10:00:00', { zone: 'Asia/Dubai' });
      expect(friday.weekday % 7).toBe(5);

      const result = isTimeInWorkingHours(friday.toUTC().toJSDate(), middleEastAttendee);
      expect(result.isInWorkingHours).toBe(false);
    });

    test('周六（weekday 6）在中东工作制下是非工作日', () => {
      const saturday = DateTime.fromISO('2026-06-27T10:00:00', { zone: 'Asia/Dubai' });
      expect(saturday.weekday % 7).toBe(6);

      const result = isTimeInWorkingHours(saturday.toUTC().toJSDate(), middleEastAttendee);
      expect(result.isInWorkingHours).toBe(false);
    });

    test('周五虽然在工作时间段内，但因是非工作日被排除', () => {
      const fridayWorkingHours = DateTime.fromISO('2026-06-26T14:00:00', { zone: 'Asia/Dubai' });
      expect(fridayWorkingHours.hour).toBe(14);
      expect(fridayWorkingHours.weekday % 7).toBe(5);

      const result = isTimeInWorkingHours(fridayWorkingHours.toUTC().toJSDate(), middleEastAttendee);
      expect(result.isInWorkingHours).toBe(false);
    });

    test('周日工作时间正确判定为可用', () => {
      const sunday10am = DateTime.fromISO('2026-06-21T10:00:00', { zone: 'Asia/Dubai' });
      const sunday6pm = DateTime.fromISO('2026-06-21T18:00:00', { zone: 'Asia/Dubai' });

      const result10am = isTimeInWorkingHours(sunday10am.toUTC().toJSDate(), middleEastAttendee);
      const result6pm = isTimeInWorkingHours(sunday6pm.toUTC().toJSDate(), middleEastAttendee);

      expect(result10am.isInWorkingHours).toBe(true);
      expect(result6pm.isInWorkingHours).toBe(false);
    });
  });
});
