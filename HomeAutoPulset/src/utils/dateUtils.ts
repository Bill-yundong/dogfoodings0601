import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

export const formatDateTime = (timestamp: number): string => {
  return dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss');
};

export const formatDate = (timestamp: number): string => {
  return dayjs(timestamp).format('YYYY-MM-DD');
};

export const formatTime = (timestamp: number): string => {
  return dayjs(timestamp).format('HH:mm:ss');
};

export const formatRelativeTime = (timestamp: number): string => {
  return dayjs(timestamp).fromNow();
};

export const formatDuration = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}天${hours % 24}小时`;
  } else if (hours > 0) {
    return `${hours}小时${minutes % 60}分钟`;
  } else if (minutes > 0) {
    return `${minutes}分钟${seconds % 60}秒`;
  } else {
    return `${seconds}秒`;
  }
};

export const getTimeAgo = (timestamp: number): { text: string; color: string } => {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) {
    return { text: '刚刚', color: 'text-success-green' };
  } else if (minutes < 5) {
    return { text: `${minutes}分钟前`, color: 'text-success-green' };
  } else if (minutes < 30) {
    return { text: `${minutes}分钟前`, color: 'text-info-blue' };
  } else if (hours < 1) {
    return { text: `${minutes}分钟前`, color: 'text-warning-amber' };
  } else if (hours < 24) {
    return { text: `${hours}小时前`, color: 'text-warning-amber' };
  } else if (days < 7) {
    return { text: `${days}天前`, color: 'text-slate-light' };
  } else {
    return { text: formatDate(timestamp), color: 'text-slate-light' };
  }
};

export const generateTimeSeries = (hours: number = 24, intervalMinutes: number = 15): number[] => {
  const now = Date.now();
  const points: number[] = [];
  const intervalMs = intervalMinutes * 60 * 1000;
  const totalPoints = (hours * 60) / intervalMinutes;

  for (let i = totalPoints - 1; i >= 0; i--) {
    points.push(now - i * intervalMs);
  }

  return points;
};

export const isToday = (timestamp: number): boolean => {
  return dayjs(timestamp).isSame(dayjs(), 'day');
};

export const isThisWeek = (timestamp: number): boolean => {
  return dayjs(timestamp).isSame(dayjs(), 'week');
};

export const getStartOfDay = (timestamp: number): number => {
  return dayjs(timestamp).startOf('day').valueOf();
};

export const getEndOfDay = (timestamp: number): number => {
  return dayjs(timestamp).endOf('day').valueOf();
};
