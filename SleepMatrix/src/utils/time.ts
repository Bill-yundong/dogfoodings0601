import { format, formatDuration, intervalToDuration } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export function formatTimestamp(timestamp: number, pattern: string = 'yyyy-MM-dd HH:mm:ss'): string {
  return format(timestamp, pattern, { locale: zhCN });
}

export function formatTime(timestamp: number): string {
  return format(timestamp, 'HH:mm', { locale: zhCN });
}

export function formatDate(timestamp: number): string {
  return format(timestamp, 'yyyy-MM-dd', { locale: zhCN });
}

export function formatDurationMs(ms: number): string {
  if (ms < 60000) {
    return `${Math.round(ms / 1000)} 秒`;
  }

  const duration = intervalToDuration({ start: 0, end: ms });
  return formatDuration(duration, {
    locale: zhCN,
    format: ['hours', 'minutes'],
    zero: false,
  });
}

export function formatDurationMinutes(minutes: number): string {
  return formatDurationMs(minutes * 60 * 1000);
}

export function getStartOfDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function getEndOfDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(23, 59, 59, 999);
  return date.getTime();
}

export function getStartOfWeek(timestamp: number): number {
  const date = new Date(timestamp);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function getEndOfWeek(timestamp: number): number {
  const start = getStartOfWeek(timestamp);
  return start + 7 * 24 * 60 * 60 * 1000 - 1;
}

export function getStartOfMonth(timestamp: number): number {
  const date = new Date(timestamp);
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function getEndOfMonth(timestamp: number): number {
  const date = new Date(timestamp);
  date.setMonth(date.getMonth() + 1);
  date.setDate(0);
  date.setHours(23, 59, 59, 999);
  return date.getTime();
}

export function generateTimeAxis(startTime: number, endTime: number, intervalMs: number): number[] {
  const timestamps: number[] = [];
  let current = startTime;

  while (current <= endTime) {
    timestamps.push(current);
    current += intervalMs;
  }

  return timestamps;
}

export function roundToInterval(timestamp: number, intervalMs: number): number {
  return Math.floor(timestamp / intervalMs) * intervalMs;
}

export function alignTimestamp(timestamp: number, baseTimestamp: number, intervalMs: number): number {
  const diff = timestamp - baseTimestamp;
  const roundedDiff = Math.round(diff / intervalMs) * intervalMs;
  return baseTimestamp + roundedDiff;
}

export function getCalendarDays(year: number, month: number): Array<{ date: number; inMonth: boolean }> {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const days: Array<{ date: number; inMonth: boolean }> = [];

  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const date = new Date(year, month - 1, prevMonthLastDay - i);
    days.push({ date: date.getTime(), inMonth: false });
  }

  for (let i = 1; i <= daysInMonth; i++) {
    const date = new Date(year, month, i);
    days.push({ date: date.getTime(), inMonth: true });
  }

  const remainingDays = 42 - days.length;
  for (let i = 1; i <= remainingDays; i++) {
    const date = new Date(year, month + 1, i);
    days.push({ date: date.getTime(), inMonth: false });
  }

  return days;
}

export function getRelativeTimeLabel(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;

  return formatDate(timestamp);
}

export function parseTimeString(timeStr: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return { hours, minutes };
}

export function isNightTime(timestamp: number): boolean {
  const hour = new Date(timestamp).getHours();
  return hour >= 22 || hour < 6;
}

export function getSleepPeriodLabel(startTime: number, endTime: number): string {
  const startHour = new Date(startTime).getHours();
  const endHour = new Date(endTime).getHours();

  if (startHour >= 21 && endHour <= 9) return '夜间睡眠';
  if (startHour >= 12 && startHour <= 15 && (endTime - startTime) < 3600000 * 3) return '午休';
  if ((endTime - startTime) < 3600000) return '小憩';
  return '睡眠周期';
}
