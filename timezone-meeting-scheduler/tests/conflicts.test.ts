import { DateTime } from 'luxon';
import { parseICalContent } from '../src/conflicts';

describe('Conflicts Module', () => {
  describe('iCal 全天事件解析', () => {
    test('正确解析 VALUE=DATE 格式的全天事件', () => {
      const icalContent = `BEGIN:VCALENDAR
VERSION:2.0
TZID:Asia/Shanghai
BEGIN:VEVENT
UID:allday-test@example.com
SUMMARY:全天会议
DTSTART;VALUE=DATE:20260622
DTEND;VALUE=DATE:20260623
END:VEVENT
END:VCALENDAR`;

      const events = parseICalContent(icalContent);
      expect(events.length).toBe(1);

      const event = events[0];
      expect(event.summary).toBe('全天会议');
      expect(event.uid).toBe('allday-test@example.com');

      const startLocal = DateTime.fromJSDate(event.start).setZone('Asia/Shanghai');
      const endLocal = DateTime.fromJSDate(event.end).setZone('Asia/Shanghai');

      expect(startLocal.year).toBe(2026);
      expect(startLocal.month).toBe(6);
      expect(startLocal.day).toBe(22);
      expect(startLocal.hour).toBe(0);
      expect(startLocal.minute).toBe(0);

      expect(endLocal.year).toBe(2026);
      expect(endLocal.month).toBe(6);
      expect(endLocal.day).toBe(23);
    });

    test('正确解析带时区的普通事件', () => {
      const icalContent = `BEGIN:VCALENDAR
VERSION:2.0
TZID:America/New_York
BEGIN:VEVENT
UID:meeting-test@example.com
SUMMARY:Team Meeting
DTSTART;TZID=America/New_York:20260622T140000
DTEND;TZID=America/New_York:20260622T150000
END:VEVENT
END:VCALENDAR`;

      const events = parseICalContent(icalContent);
      expect(events.length).toBe(1);

      const event = events[0];
      const localStart = DateTime.fromJSDate(event.start).setZone('America/New_York');

      expect(localStart.month).toBe(6);
      expect(localStart.day).toBe(22);
      expect(localStart.hour).toBe(14);
      expect(localStart.minute).toBe(0);
    });

    test('正确解析 UTC 时间（带 Z 后缀）', () => {
      const icalContent = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:utc-test@example.com
SUMMARY:UTC Event
DTSTART:20260622T120000Z
DTEND:20260622T130000Z
END:VEVENT
END:VCALENDAR`;

      const events = parseICalContent(icalContent);
      expect(events.length).toBe(1);

      const event = events[0];
      const utcStart = DateTime.fromJSDate(event.start).toUTC();

      expect(utcStart.year).toBe(2026);
      expect(utcStart.month).toBe(6);
      expect(utcStart.day).toBe(22);
      expect(utcStart.hour).toBe(12);
      expect(utcStart.minute).toBe(0);
    });

    test('月份解析正确（不再往前错一个月）', () => {
      const icalContent = `BEGIN:VCALENDAR
VERSION:2.0
TZID:Asia/Shanghai
BEGIN:VEVENT
UID:month-test@example.com
SUMMARY:June Event
DTSTART;TZID=Asia/Shanghai:20260615T100000
DTEND;TZID=Asia/Shanghai:20260615T110000
END:VEVENT
END:VCALENDAR`;

      const events = parseICalContent(icalContent);
      const event = events[0];
      const localStart = DateTime.fromJSDate(event.start).setZone('Asia/Shanghai');

      expect(localStart.month).toBe(6);
      expect(localStart.day).toBe(15);
    });
  });

  describe('RRULE 循环展开数量', () => {
    test('每日循环事件正确展开', () => {
      const icalContent = `BEGIN:VCALENDAR
VERSION:2.0
TZID:Europe/Berlin
BEGIN:VEVENT
UID:daily-test@example.com
SUMMARY:Daily Standup
DTSTART;TZID=Europe/Berlin:20260622T090000
DTEND;TZID=Europe/Berlin:20260622T093000
RRULE:FREQ=DAILY;COUNT=10
END:VEVENT
END:VCALENDAR`;

      const events = parseICalContent(icalContent);
      expect(events.length).toBe(10);

      const firstEvent = events[0];
      const lastEvent = events[9];

      const firstLocal = DateTime.fromJSDate(firstEvent.start).setZone('Europe/Berlin');
      const lastLocal = DateTime.fromJSDate(lastEvent.start).setZone('Europe/Berlin');

      expect(firstLocal.day).toBe(22);
      expect(lastLocal.day).toBe(1);
      expect(lastLocal.month).toBe(7);
      expect(firstLocal.hour).toBe(9);
      expect(lastLocal.hour).toBe(9);
    });

    test('每周循环（仅工作日）正确展开', () => {
      const icalContent = `BEGIN:VCALENDAR
VERSION:2.0
TZID:Asia/Shanghai
BEGIN:VEVENT
UID:weekly-test@example.com
SUMMARY:Weekly Meeting
DTSTART;TZID=Asia/Shanghai:20260622T140000
DTEND;TZID=Asia/Shanghai:20260622T150000
RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=6
END:VEVENT
END:VCALENDAR`;

      const events = parseICalContent(icalContent);
      expect(events.length).toBe(6);

      const daysOfWeek = events.map(e => {
        const local = DateTime.fromJSDate(e.start).setZone('Asia/Shanghai');
        return local.weekday;
      });

      expect(daysOfWeek[0]).toBe(1);
      expect(daysOfWeek[1]).toBe(3);
      expect(daysOfWeek[2]).toBe(5);
      expect(daysOfWeek[3]).toBe(1);
    });

    test('无 COUNT 限制的循环事件最多展开 100 个', () => {
      const icalContent = `BEGIN:VCALENDAR
VERSION:2.0
TZID:UTC
BEGIN:VEVENT
UID:infinite-test@example.com
SUMMARY:Infinite Daily
DTSTART:20260622T100000Z
DTEND:20260622T110000Z
RRULE:FREQ=DAILY
END:VEVENT
END:VCALENDAR`;

      const events = parseICalContent(icalContent);
      expect(events.length).toBeLessThanOrEqual(100);
    });
  });

  describe('EXDATE 排除是否生效', () => {
    test('EXDATE 正确排除指定日期', () => {
      const icalContent = `BEGIN:VCALENDAR
VERSION:2.0
TZID:America/Los_Angeles
BEGIN:VEVENT
UID:exdate-test@example.com
SUMMARY:Daily with Exceptions
DTSTART;TZID=America/Los_Angeles:20260622T100000
DTEND;TZID=America/Los_Angeles:20260622T110000
RRULE:FREQ=DAILY;COUNT=5
EXDATE;TZID=America/Los_Angeles:20260624T100000
END:VEVENT
END:VCALENDAR`;

      const events = parseICalContent(icalContent);

      const eventDays = events.map(e => {
        const local = DateTime.fromJSDate(e.start).setZone('America/Los_Angeles');
        return local.day;
      });

      expect(eventDays).not.toContain(24);
      expect(eventDays).toContain(22);
      expect(eventDays).toContain(23);
      expect(eventDays).toContain(25);
      expect(eventDays).toContain(26);
    });

    test('多个 EXDATE 正确排除', () => {
      const icalContent = `BEGIN:VCALENDAR
VERSION:2.0
TZID:UTC
BEGIN:VEVENT
UID:exdate-multi@example.com
SUMMARY:Multi Exdates
DTSTART:20260622T090000Z
DTEND:20260622T100000Z
RRULE:FREQ=DAILY;COUNT=7
EXDATE:20260623T090000Z,20260625T090000Z,20260627T090000Z
END:VEVENT
END:VCALENDAR`;

      const events = parseICalContent(icalContent);
      expect(events.length).toBe(4);

      const eventDays = events.map(e => {
        const utc = DateTime.fromJSDate(e.start).toUTC();
        return utc.day;
      });

      expect(eventDays).toContain(22);
      expect(eventDays).not.toContain(23);
      expect(eventDays).toContain(24);
      expect(eventDays).not.toContain(25);
      expect(eventDays).toContain(26);
      expect(eventDays).not.toContain(27);
      expect(eventDays).toContain(28);
    });

    test('EXDATE 不影响其他日期', () => {
      const icalContent = `BEGIN:VCALENDAR
VERSION:2.0
TZID:Europe/London
BEGIN:VEVENT
UID:exdate-verify@example.com
SUMMARY:Verify Exdate
DTSTART;TZID=Europe/London:20260622T140000
DTEND;TZID=Europe/London:20260622T150000
RRULE:FREQ=DAILY;COUNT=3
EXDATE;TZID=Europe/London:20260623T140000
END:VEVENT
END:VCALENDAR`;

      const events = parseICalContent(icalContent);
      expect(events.length).toBe(2);

      const hours = events.map(e => {
        const local = DateTime.fromJSDate(e.start).setZone('Europe/London');
        return local.hour;
      });

      expect(hours.every(h => h === 14)).toBe(true);
    });
  });
});
