import { ref, computed } from 'vue';
import dayjs from 'dayjs';
import type { BiorhythmResult, BiorhythmDayData } from '../types/algorithm';
import { calculateBiorhythm, getBiorhythmSeries, getBiorhythmInfluence } from '../utils/biorhythm';

export function useBiorhythm() {
  const birthDate = ref<string>('');
  const targetDate = ref<string>(dayjs().toISOString());
  const result = ref<BiorhythmResult | null>(null);
  const series = ref<BiorhythmDayData[]>([]);
  const rangeDays = ref(30);

  const physicalStatus = computed(() => {
    if (!result.value) return 'normal';
    if (Math.abs(result.value.physical) < 10) return 'critical';
    if (result.value.physical > 50) return 'high';
    if (result.value.physical < -50) return 'low';
    return 'normal';
  });

  const emotionalStatus = computed(() => {
    if (!result.value) return 'normal';
    if (Math.abs(result.value.emotional) < 10) return 'critical';
    if (result.value.emotional > 50) return 'high';
    if (result.value.emotional < -50) return 'low';
    return 'normal';
  });

  const intellectualStatus = computed(() => {
    if (!result.value) return 'normal';
    if (Math.abs(result.value.intellectual) < 10) return 'critical';
    if (result.value.intellectual > 50) return 'high';
    if (result.value.intellectual < -50) return 'low';
    return 'normal';
  });

  const isCriticalDay = computed(() => result.value?.isCriticalDay ?? false);
  const criticalType = computed(() => result.value?.criticalType);

  const overallInfluence = computed(() => {
    if (!result.value) return 0;
    return getBiorhythmInfluence(result.value);
  });

  const upcomingCriticalDays = computed(() => 
    series.value.filter(d => d.isCritical && dayjs(d.date).isAfter(dayjs()))
  );

  const criticalDaysInRange = computed(() => 
    series.value.filter(d => d.isCritical).length
  );

  function calculate() {
    if (!birthDate.value) return;
    
    result.value = calculateBiorhythm(birthDate.value, targetDate.value);
    series.value = getBiorhythmSeries(
      birthDate.value,
      dayjs(targetDate.value).subtract(rangeDays.value / 2, 'day').toISOString(),
      rangeDays.value
    );
  }

  function setBirthDate(date: string) {
    birthDate.value = date;
    calculate();
  }

  function setTargetDate(date: string) {
    targetDate.value = date;
    calculate();
  }

  function setRangeDays(days: number) {
    rangeDays.value = days;
    calculate();
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'high': return '#22c55e';
      case 'low': return '#f97316';
      case 'critical': return '#ef4444';
      default: return '#3b82f6';
    }
  }

  function getStatusText(status: string): string {
    switch (status) {
      case 'high': return '高潮期';
      case 'low': return '低潮期';
      case 'critical': return '临界期';
      default: return '正常';
    }
  }

  const biorhythm = computed(() => result.value);
  const biorhythmSeries = computed(() => series.value);
  
  const physicalColor = computed(() => getStatusColor(physicalStatus.value));
  const emotionalColor = computed(() => getStatusColor(emotionalStatus.value));
  const intellectualColor = computed(() => getStatusColor(intellectualStatus.value));
  
  const overallStatus = computed(() => {
    if (!result.value) return '加载中';
    const avg = (result.value.physical + result.value.emotional + result.value.intellectual) / 3;
    if (avg > 50) return '状态极佳';
    if (avg > 0) return '状态良好';
    if (avg > -50) return '状态一般';
    return '状态较差';
  });

  async function loadBiorhythm(birth: string, target: string) {
    birthDate.value = birth;
    targetDate.value = target;
    calculate();
  }

  async function loadBiorhythmSeries(birth: string, start: string, days: number) {
    birthDate.value = birth;
    rangeDays.value = days;
    calculate();
  }

  function getCriticalDays(birth: string, days: number): string[] {
    const seriesData = getBiorhythmSeries(birth, dayjs().toISOString(), days);
    return seriesData.filter(d => d.isCritical).map(d => d.date);
  }

  return {
    birthDate,
    targetDate,
    result,
    series,
    rangeDays,
    physicalStatus,
    emotionalStatus,
    intellectualStatus,
    isCriticalDay,
    criticalType,
    overallInfluence,
    upcomingCriticalDays,
    criticalDaysInRange,
    biorhythm,
    biorhythmSeries,
    physicalColor,
    emotionalColor,
    intellectualColor,
    overallStatus,
    calculate,
    setBirthDate,
    setTargetDate,
    setRangeDays,
    loadBiorhythm,
    loadBiorhythmSeries,
    getCriticalDays,
    getStatusColor,
    getStatusText,
  };
}
