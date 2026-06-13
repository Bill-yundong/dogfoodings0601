import dayjs from 'dayjs';
import type { BiorhythmResult, BiorhythmDayData } from '../types/algorithm';

const CYCLES = {
  physical: 23,
  emotional: 28,
  intellectual: 33,
} as const;

export function calculateBiorhythm(birthDate: string, targetDate: string): BiorhythmResult {
  const birth = dayjs(birthDate);
  const target = dayjs(targetDate);
  const daysAlive = target.diff(birth, 'day');
  
  const physical = Math.sin((2 * Math.PI * daysAlive) / CYCLES.physical) * 100;
  const emotional = Math.sin((2 * Math.PI * daysAlive) / CYCLES.emotional) * 100;
  const intellectual = Math.sin((2 * Math.PI * daysAlive) / CYCLES.intellectual) * 100;
  
  const physicalPhase = (daysAlive % CYCLES.physical) / CYCLES.physical;
  const emotionalPhase = (daysAlive % CYCLES.emotional) / CYCLES.emotional;
  const intellectualPhase = (daysAlive % CYCLES.intellectual) / CYCLES.intellectual;
  
  const isPhysicalCritical = Math.abs(physical) < 10 || Math.abs(physicalPhase - 0.5) < 0.02;
  const isEmotionalCritical = Math.abs(emotional) < 10 || Math.abs(emotionalPhase - 0.5) < 0.02;
  const isIntellectualCritical = Math.abs(intellectual) < 10 || Math.abs(intellectualPhase - 0.5) < 0.02;
  
  const isCriticalDay = isPhysicalCritical || isEmotionalCritical || isIntellectualCritical;
  
  let criticalType: BiorhythmResult['criticalType'];
  if (isPhysicalCritical && isEmotionalCritical && isIntellectualCritical) {
    criticalType = 'combined';
  } else if (isPhysicalCritical) {
    criticalType = 'physical';
  } else if (isEmotionalCritical) {
    criticalType = 'emotional';
  } else if (isIntellectualCritical) {
    criticalType = 'intellectual';
  }
  
  return {
    physical: Math.round(physical * 100) / 100,
    emotional: Math.round(emotional * 100) / 100,
    intellectual: Math.round(intellectual * 100) / 100,
    isCriticalDay,
    criticalType,
  };
}

export function getBiorhythmSeries(
  birthDate: string,
  startDate: string,
  days: number
): BiorhythmDayData[] {
  const series: BiorhythmDayData[] = [];
  const start = dayjs(startDate);
  
  for (let i = 0; i < days; i++) {
    const date = start.add(i, 'day').toISOString();
    const result = calculateBiorhythm(birthDate, date);
    series.push({
      date: dayjs(date).format('YYYY-MM-DD'),
      physical: result.physical,
      emotional: result.emotional,
      intellectual: result.intellectual,
      isCritical: result.isCriticalDay,
    });
  }
  
  return series;
}

export function getBiorhythmInfluence(biorhythm: BiorhythmResult): number {
  const weights = {
    physical: 0.4,
    emotional: 0.3,
    intellectual: 0.3,
  };
  
  const physicalFactor = (100 - Math.abs(biorhythm.physical)) / 100;
  const emotionalFactor = (100 - Math.abs(biorhythm.emotional)) / 100;
  const intellectualFactor = (100 - Math.abs(biorhythm.intellectual)) / 100;
  
  let influence = 
    physicalFactor * weights.physical +
    emotionalFactor * weights.emotional +
    intellectualFactor * weights.intellectual;
  
  if (biorhythm.isCriticalDay) {
    influence += 0.15;
  }
  
  return Math.min(Math.max(influence, 0), 1);
}
