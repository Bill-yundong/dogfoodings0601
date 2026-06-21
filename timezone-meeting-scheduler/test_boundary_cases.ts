#!/usr/bin/env ts-node

import { DateTime } from 'luxon';
import { isTimeInWorkingHours, getWorkingHoursInUTC } from './src/attendees';
import { Attendee } from './src/types';

console.log('========================================');
console.log('边界情况测试');
console.log('========================================\n');

function test(name: string, fn: () => boolean) {
  try {
    const result = fn();
    console.log(`${result ? '✅' : '❌'} ${name}`);
    return result;
  } catch (e) {
    console.log(`❌ ${name} - 异常: ${e}`);
    return false;
  }
}

let passed = 0;
let total = 0;

const attendeeShanghai: Attendee = {
  name: '测试用户',
  email: 'test@example.com',
  timezone: 'Asia/Shanghai',
  workingHours: { start: '09:00', end: '18:00' },
  lunchBreak: { start: '12:00', end: '13:00' },
  nonWorkingDays: [0, 6],
  priority: 1,
};

const attendeeLA: Attendee = {
  name: 'LA 用户',
  email: 'la@example.com',
  timezone: 'America/Los_Angeles',
  workingHours: { start: '09:00', end: '17:00' },
  nonWorkingDays: [0, 6],
  priority: 1,
};

const attendeeBerlin: Attendee = {
  name: 'Berlin 用户',
  email: 'berlin@example.com',
  timezone: 'Europe/Berlin',
  workingHours: { start: '08:00', end: '17:00' },
  nonWorkingDays: [0, 6],
  priority: 1,
};

const attendeeAuckland: Attendee = {
  name: 'Auckland 用户',
  email: 'auckland@example.com',
  timezone: 'Pacific/Auckland',
  workingHours: { start: '09:00', end: '17:00' },
  nonWorkingDays: [0, 6],
  priority: 1,
};

total++;
test('夏令时切换 - 柏林时区 3 月最后一个周日 (CET -> CEST)', () => {
  const dayBeforeDST = DateTime.fromISO('2026-03-27T07:00:00', { zone: 'UTC' });
  const dayAfterDST = DateTime.fromISO('2026-03-30T07:00:00', { zone: 'UTC' });

  const localBefore = dayBeforeDST.setZone('Europe/Berlin');
  const localAfter = dayAfterDST.setZone('Europe/Berlin');

  const beforeCheck = isTimeInWorkingHours(dayBeforeDST.toJSDate(), attendeeBerlin);
  const afterCheck = isTimeInWorkingHours(dayAfterDST.toJSDate(), attendeeBerlin);

  console.log(`  DST 前 (周五): UTC ${dayBeforeDST.toFormat('HH:mm')} = 柏林 ${localBefore.toFormat('HH:mm z')}`);
  console.log(`  DST 后 (周一): UTC ${dayAfterDST.toFormat('HH:mm')} = 柏林 ${localAfter.toFormat('HH:mm z')}`);
  console.log(`  注意: DST 切换后, 相同 UTC 时间对应本地时间晚了 1 小时`);

  return beforeCheck.isInWorkingHours && afterCheck.isInWorkingHours &&
         localBefore.hour === 8 && localAfter.hour === 9;
}) && passed++;

total++;
test('夏令时切换 - 柏林时区 10 月最后一个周日 (CEST -> CET)', () => {
  const dayBeforeDST = DateTime.fromISO('2026-10-23T07:00:00', { zone: 'UTC' });
  const dayAfterDST = DateTime.fromISO('2026-10-26T07:00:00', { zone: 'UTC' });

  const localBefore = dayBeforeDST.setZone('Europe/Berlin');
  const localAfter = dayAfterDST.setZone('Europe/Berlin');

  const beforeCheck = isTimeInWorkingHours(dayBeforeDST.toJSDate(), attendeeBerlin);
  const afterCheck = isTimeInWorkingHours(dayAfterDST.toJSDate(), attendeeBerlin);

  console.log(`  DST 前 (周五): UTC ${dayBeforeDST.toFormat('HH:mm')} = 柏林 ${localBefore.toFormat('HH:mm z')}`);
  console.log(`  DST 后 (周一): UTC ${dayAfterDST.toFormat('HH:mm')} = 柏林 ${localAfter.toFormat('HH:mm z')}`);
  console.log(`  注意: DST 切换后, 相同 UTC 时间对应本地时间早了 1 小时`);

  return beforeCheck.isInWorkingHours && afterCheck.isInWorkingHours &&
         localBefore.hour === 9 && localAfter.hour === 8;
}) && passed++;

total++;
test('跨日期线 - 上海 vs 洛杉矶 同一天 UTC 时间对应不同本地日期', () => {
  const utcTime = DateTime.fromISO('2026-06-22T16:00:00', { zone: 'UTC' });

  const shanghaiTime = utcTime.setZone('Asia/Shanghai');
  const laTime = utcTime.setZone('America/Los_Angeles');

  console.log(`  UTC: ${utcTime.toFormat('yyyy-MM-dd HH:mm')}`);
  console.log(`  上海: ${shanghaiTime.toFormat('yyyy-MM-dd HH:mm')}`);
  console.log(`  洛杉矶: ${laTime.toFormat('yyyy-MM-dd HH:mm')}`);

  return shanghaiTime.day !== laTime.day;
}) && passed++;

total++;
test('跨日期线 - 奥克兰 vs 夏威夷 (UTC+12 vs UTC-10)', () => {
  const attendeeHawaii: Attendee = {
    ...attendeeShanghai,
    name: 'Hawaii 用户',
    timezone: 'Pacific/Honolulu',
  };

  const utcTime = DateTime.fromISO('2026-06-22T12:00:00', { zone: 'UTC' });

  const aucklandTime = utcTime.setZone('Pacific/Auckland');
  const hawaiiTime = utcTime.setZone('Pacific/Honolulu');

  console.log(`  UTC: ${utcTime.toFormat('yyyy-MM-dd HH:mm')}`);
  console.log(`  奥克兰: ${aucklandTime.toFormat('yyyy-MM-dd HH:mm ZZZZ')}`);
  console.log(`  夏威夷: ${hawaiiTime.toFormat('yyyy-MM-dd HH:mm ZZZZ')}`);

  const dayDiff = aucklandTime.day - hawaiiTime.day;
  return dayDiff === 1 || dayDiff === -29;
}) && passed++;

total++;
test('非工作日 - 周六周日应该被排除', () => {
  const saturday = DateTime.fromISO('2026-06-20T10:00:00', { zone: 'Asia/Shanghai' });
  const sunday = DateTime.fromISO('2026-06-21T10:00:00', { zone: 'Asia/Shanghai' });
  const monday = DateTime.fromISO('2026-06-22T10:00:00', { zone: 'Asia/Shanghai' });

  const saturdayCheck = isTimeInWorkingHours(saturday.toUTC().toJSDate(), attendeeShanghai);
  const sundayCheck = isTimeInWorkingHours(sunday.toUTC().toJSDate(), attendeeShanghai);
  const mondayCheck = isTimeInWorkingHours(monday.toUTC().toJSDate(), attendeeShanghai);

  console.log(`  周六 (10:00): ${saturdayCheck.isInWorkingHours ? '❌' : '✅'} 正确排除`);
  console.log(`  周日 (10:00): ${sundayCheck.isInWorkingHours ? '❌' : '✅'} 正确排除`);
  console.log(`  周一 (10:00): ${mondayCheck.isInWorkingHours ? '✅' : '❌'} 正确包含`);

  return !saturdayCheck.isInWorkingHours && !sundayCheck.isInWorkingHours && mondayCheck.isInWorkingHours;
}) && passed++;

total++;
test('午休时间 - 午休时段应该被排除', () => {
  const beforeLunch = DateTime.fromISO('2026-06-22T11:30:00', { zone: 'Asia/Shanghai' });
  const duringLunch = DateTime.fromISO('2026-06-22T12:30:00', { zone: 'Asia/Shanghai' });
  const afterLunch = DateTime.fromISO('2026-06-22T13:30:00', { zone: 'Asia/Shanghai' });

  const beforeCheck = isTimeInWorkingHours(beforeLunch.toUTC().toJSDate(), attendeeShanghai);
  const duringCheck = isTimeInWorkingHours(duringLunch.toUTC().toJSDate(), attendeeShanghai);
  const afterCheck = isTimeInWorkingHours(afterLunch.toUTC().toJSDate(), attendeeShanghai);

  console.log(`  11:30 (午休前): ${beforeCheck.isInWorkingHours ? '✅' : '❌'} 可用`);
  console.log(`  12:30 (午休中): ${duringCheck.isInWorkingHours ? '❌' : '✅'} 正确排除 (午休: ${duringCheck.isDuringLunch})`);
  console.log(`  13:30 (午休后): ${afterCheck.isInWorkingHours ? '✅' : '❌'} 可用`);

  return beforeCheck.isInWorkingHours && !duringCheck.isInWorkingHours && duringCheck.isDuringLunch && afterCheck.isInWorkingHours;
}) && passed++;

total++;
test('工作时间边界 - 18:00 整点应该被排除', () => {
  const at1759 = DateTime.fromISO('2026-06-22T17:59:59', { zone: 'Asia/Shanghai' });
  const at1800 = DateTime.fromISO('2026-06-22T18:00:00', { zone: 'Asia/Shanghai' });

  const check1759 = isTimeInWorkingHours(at1759.toUTC().toJSDate(), attendeeShanghai);
  const check1800 = isTimeInWorkingHours(at1800.toUTC().toJSDate(), attendeeShanghai);

  console.log(`  17:59:59: ${check1759.isInWorkingHours ? '✅' : '❌'} 可用`);
  console.log(`  18:00:00: ${check1800.isInWorkingHours ? '❌' : '✅'} 正确排除`);

  return check1759.isInWorkingHours && !check1800.isInWorkingHours;
}) && passed++;

total++;
test('getWorkingHoursInUTC - 跨时区正确转换', () => {
  const date = DateTime.fromISO('2026-06-22T00:00:00', { zone: 'UTC' }).toJSDate();

  const shanghaiHours = getWorkingHoursInUTC(date, attendeeShanghai);
  const laHours = getWorkingHoursInUTC(date, attendeeLA);

  const shanghaiStartLocal = DateTime.fromJSDate(shanghaiHours.start).setZone('Asia/Shanghai');
  const laStartLocal = DateTime.fromJSDate(laHours.start).setZone('America/Los_Angeles');

  console.log(`  上海工作时间 UTC: ${DateTime.fromJSDate(shanghaiHours.start).toFormat('HH:mm')} - ${DateTime.fromJSDate(shanghaiHours.end).toFormat('HH:mm')}`);
  console.log(`  上海本地时间: ${shanghaiStartLocal.toFormat('HH:mm')} (应该是 09:00)`);
  console.log(`  洛杉矶工作时间 UTC: ${DateTime.fromJSDate(laHours.start).toFormat('HH:mm')} - ${DateTime.fromJSDate(laHours.end).toFormat('HH:mm')}`);
  console.log(`  洛杉矶本地时间: ${laStartLocal.toFormat('HH:mm')} (应该是 09:00)`);

  return shanghaiStartLocal.hour === 9 && shanghaiStartLocal.minute === 0 &&
         laStartLocal.hour === 9 && laStartLocal.minute === 0;
}) && passed++;

total++;
test('印度时区 (UTC+5:30) - 半小时偏移正确处理', () => {
  const attendeeIndia: Attendee = {
    ...attendeeShanghai,
    name: 'India 用户',
    timezone: 'Asia/Kolkata',
    workingHours: { start: '10:00', end: '19:00' },
  };

  const utcTime = DateTime.fromISO('2026-06-22T04:30:00', { zone: 'UTC' });
  const localTime = utcTime.setZone('Asia/Kolkata');

  console.log(`  UTC 04:30 = 印度 ${localTime.toFormat('HH:mm z')} (应该是 10:00)`);

  const check = isTimeInWorkingHours(utcTime.toJSDate(), attendeeIndia);
  return localTime.hour === 10 && localTime.minute === 0 && check.isInWorkingHours;
}) && passed++;

total++;
test('跨日期线的周几计算 - 同一天 UTC 对应不同周几', () => {
  const attendeeSydney: Attendee = {
    ...attendeeShanghai,
    name: 'Sydney 用户',
    timezone: 'Australia/Sydney',
  };

  const utcSaturday = DateTime.fromISO('2026-06-20T23:00:00', { zone: 'UTC' });

  const sydneyTime = utcSaturday.setZone('Australia/Sydney');

  console.log(`  UTC 周六 23:00 = 悉尼 ${sydneyTime.toFormat('cccc HH:mm')}`);

  const utcCheck = isTimeInWorkingHours(utcSaturday.toJSDate(), attendeeLA);
  const sydneyCheck = isTimeInWorkingHours(utcSaturday.toJSDate(), attendeeSydney);

  return !utcCheck.isInWorkingHours || !sydneyCheck.isInWorkingHours;
}) && passed++;

console.log('');
console.log('========================================');
console.log(`测试结果: ${passed}/${total} 通过`);
console.log('========================================');

if (passed < total) {
  process.exit(1);
}
