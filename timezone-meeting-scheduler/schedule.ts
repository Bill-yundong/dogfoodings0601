#!/usr/bin/env ts-node

import { Command } from 'commander';
import { DateTime } from 'luxon';
import { loadAttendeesFromJson } from './src/attendees';
import { findMeetingSlots, formatDuration } from './src/solver';
import {
  loadCalendarsFromDirectory,
  detectConflictsForAll,
  buildAttendeeNameMap,
} from './src/conflicts';
import { Attendee, CandidateSlot } from './src/types';

const program = new Command();

program
  .name('timezone-meeting-scheduler')
  .description('跨时区会议时间协调与冲突检测工具')
  .version('1.0.0')
  .requiredOption('--attendees <path>', '参会者配置 JSON 文件路径')
  .requiredOption('--calendars <path>', '日历文件目录路径')
  .requiredOption('--duration <minutes>', '会议时长（分钟）', '60')
  .option('--search-days <days>', '搜索未来天数', '14')
  .option('--output <format>', '输出格式: text|json', 'text');

program.parse();

const options = program.opts();

async function main() {
  try {
    const durationMinutes = parseInt(options.duration, 10);
    const searchDays = parseInt(options.searchDays, 10);

    if (isNaN(durationMinutes) || durationMinutes <= 0) {
      throw new Error('会议时长必须是正整数');
    }
    if (isNaN(searchDays) || searchDays <= 0) {
      throw new Error('搜索天数必须是正整数');
    }

    console.log('========================================');
    console.log('跨时区会议时间协调工具');
    console.log('========================================\n');

    console.log(`[1/4] 加载参会者配置: ${options.attendees}`);
    const attendees = loadAttendeesFromJson(options.attendees);
    console.log(`  已加载 ${attendees.length} 位参会者:\n`);
    attendees.forEach(a => {
      console.log(`  • ${a.name} (${a.timezone})`);
      console.log(`    工作时间: ${a.workingHours.start} - ${a.workingHours.end}`);
      if (a.lunchBreak) {
        console.log(`    午休: ${a.lunchBreak.start} - ${a.lunchBreak.end}`);
      }
    });
    console.log('');

    console.log(`[2/4] 加载日历文件: ${options.calendars}`);
    const attendeeNameMap = buildAttendeeNameMap(attendees);
    const attendeeCalendars = loadCalendarsFromDirectory(options.calendars, attendeeNameMap);
    let totalEvents = 0;
    attendeeCalendars.forEach((events, name) => {
      totalEvents += events.length;
      console.log(`  • ${name}: ${events.length} 个日程`);
    });
    console.log(`  共加载 ${totalEvents} 个日程\n`);

    console.log(`[3/4] 搜索可用时段 (未来 ${searchDays} 天, 会议时长 ${formatDuration(durationMinutes)})`);
    const result = findMeetingSlots(attendees, { durationMinutes, searchDays });
    console.log(`  搜索范围: ${formatDate(result.searchRange.start)} - ${formatDate(result.searchRange.end)}`);
    console.log(`  找到 ${result.topCandidates.length} 个候选时段\n`);

    console.log(`[4/4] 检测日程冲突`);
    const candidatesWithConflicts = detectConflictsForAll(result.topCandidates, attendeeCalendars);
    const totalConflicts = candidatesWithConflicts.reduce(
      (sum, c) => sum + c.conflicts.length,
      0
    );
    console.log(`  检测到 ${totalConflicts} 个冲突\n`);

    if (options.output === 'json') {
      outputJson(candidatesWithConflicts, attendees);
    } else {
      outputText(candidatesWithConflicts, attendees, durationMinutes);
    }

    printTimezoneNotes(attendees);

  } catch (error: unknown) {
    console.error('错误:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function formatDate(date: Date): string {
  return DateTime.fromJSDate(date)
    .toUTC()
    .toFormat('yyyy-MM-dd HH:mm \'UTC\'');
}

function formatLocalDate(date: Date, timezone: string): string {
  return DateTime.fromJSDate(date)
    .setZone(timezone)
    .toFormat('yyyy-MM-dd HH:mm ZZZZ');
}

function outputText(candidates: CandidateSlot[], attendees: Attendee[], durationMinutes: number) {
  console.log('========================================');
  console.log('推荐会议时段 TOP 3');
  console.log('========================================\n');

  if (candidates.length === 0) {
    console.log('未找到合适的会议时段。请尝试扩大搜索范围或调整参会者工作时间。');
    return;
  }

  candidates.forEach((candidate, index) => {
    const rank = index + 1;
    const scorePercent = ((candidate.workingHoursCount / attendees.length) * 100).toFixed(0);

    console.log(`--- 第 ${rank} 名 ---`);
    console.log(`  UTC 时间: ${formatDate(candidate.start)} - ${formatDate(candidate.end,)}`);
    console.log(`  匹配度: ${candidate.workingHoursCount}/${attendees.length} 人在工作时间 (${scorePercent}%)`);
    console.log(`  权重分数: ${candidate.weight}`);
    console.log('');

    console.log('  各参会者本地时间:');
    candidate.availability.forEach(avail => {
      const statusIcon = avail.isInWorkingHours ? '✅' : avail.isDuringLunch ? '🍴' : '❌';
      const statusText = avail.isInWorkingHours ? '工作时间' : avail.isDuringLunch ? '午休时间' : '非工作时间';
      console.log(`    ${statusIcon} ${avail.attendee.name} (${avail.attendee.timezone}):`);
      console.log(`       ${avail.localStartTime} - ${avail.localEndTime.split(' ').slice(1).join(' ')} [${statusText}]`);
    });
    console.log('');

    if (candidate.conflicts.length > 0) {
      console.log(`  ⚠️  冲突检测 (${candidate.conflicts.length} 个冲突):`);
      candidate.conflicts.forEach(conflict => {
        console.log(`    • ${conflict.attendeeName}:`);
        console.log(`      "${conflict.eventSummary}"`);
        console.log(`      ${formatDate(conflict.eventStart)} - ${formatDate(conflict.eventEnd)}`);
        console.log(`      重叠: ${conflict.overlapMinutes} 分钟`);
      });
    } else {
      console.log('  ✅ 无日程冲突');
    }
    console.log('');
  });
}

function outputJson(candidates: CandidateSlot[], attendees: Attendee[]) {
  const output = {
    generatedAt: new Date().toISOString(),
    totalAttendees: attendees.length,
    attendees: attendees.map(a => ({
      name: a.name,
      email: a.email,
      timezone: a.timezone,
    })),
    recommendations: candidates.map((c, index) => ({
      rank: index + 1,
      utcStart: c.start.toISOString(),
      utcEnd: c.end.toISOString(),
      durationMinutes: c.durationMinutes,
      weight: c.weight,
      workingHoursCount: c.workingHoursCount,
      workingHoursPercent: (c.workingHoursCount / attendees.length) * 100,
      availability: c.availability.map(avail => ({
        attendee: avail.attendee.name,
        timezone: avail.attendee.timezone,
        localStartTime: avail.localStartTime,
        localEndTime: avail.localEndTime,
        isInWorkingHours: avail.isInWorkingHours,
        isDuringLunch: avail.isDuringLunch,
      })),
      conflicts: c.conflicts.map(conflict => ({
        attendeeName: conflict.attendeeName,
        eventSummary: conflict.eventSummary,
        eventStart: conflict.eventStart.toISOString(),
        eventEnd: conflict.eventEnd.toISOString(),
        overlapMinutes: conflict.overlapMinutes,
      })),
    })),
  };

  console.log(JSON.stringify(output, null, 2));
}

function printTimezoneNotes(attendees: Attendee[]) {
  console.log('========================================');
  console.log('时区说明');
  console.log('========================================');
  console.log('');
  console.log('• 夏令时 (DST) 切换已自动处理');
  console.log('• 跨日期线情况已考虑 (如: 美国 vs 中国, 日期可能相差一天)');
  console.log('• 所有内部计算基于 UTC 时间');
  console.log('');

  const hasDST = attendees.some(a => {
    const now = DateTime.now().setZone(a.timezone);
    const winter = now.set({ month: 1 });
    const summer = now.set({ month: 7 });
    return winter.offset !== summer.offset;
  });

  if (hasDST) {
    console.log('⚠️  注意: 以下参会者所在时区有夏令时切换:');
    attendees.forEach(a => {
      const now = DateTime.now().setZone(a.timezone);
      const winter = now.set({ month: 1 });
      const summer = now.set({ month: 7 });
      if (winter.offset !== summer.offset) {
        console.log(`  • ${a.name} (${a.timezone})`);
      }
    });
    console.log('');
  }

  const offsets = attendees.map(a => DateTime.now().setZone(a.timezone).offset);
  const maxOffsetDiff = Math.max(...offsets) - Math.min(...offsets);

  if (maxOffsetDiff >= 720) {
    console.log('🌐 提示: 团队跨时区较大, 建议注意以下情况:');
    console.log('  • 部分会议时段可能跨越国际日期变更线');
    console.log('  • 参会者本地日期可能与 UTC 日期不同');
    console.log('  • 建议在发送会议邀请时注明各参会者的本地时间');
    console.log('');
  }
}

main();
