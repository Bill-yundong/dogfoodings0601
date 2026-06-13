import dayjs from 'dayjs';
import type { CrewMember, CrewRole, CrewStatus } from '../types/crew';
import type { PhysiologicalData, HealthRecord, MedicalAlert } from '../types/medical';
import type { FlightDuty, SchedulePlan, ScheduleConflict, Airport } from '../types/schedule';
import { MAJOR_AIRPORTS } from '../types/schedule';
import type { FatigueAssessment, SyncLog } from '../types/algorithm';
import { assessFatigue, simulateFatigueEvolution } from './fatigueAlgorithm';
import { bulkAddCrewMembers } from '../database/stores/crewStore';
import { bulkAddPhysiologicalData } from '../database/stores/physiologicalStore';
import { bulkAddHealthRecords, bulkAddMedicalAlerts } from '../database/stores/medicalStore';
import { addSchedulePlan, bulkAddFlightDuties, addScheduleConflict } from '../database/stores/scheduleStore';
import { bulkAddFatigueAssessments } from '../database/stores/fatigueStore';
import { bulkAddSyncLogs } from '../database/stores/syncStore';

const CREW_NAMES = [
  '张伟', '李明', '王芳', '刘洋', '陈静', '杨帆', '赵磊', '黄丽',
  '周涛', '吴敏', '徐强', '孙燕', '马超', '朱琳', '胡军', '郭娜',
  '何峰', '罗雪', '梁波', '宋倩',
];

const CREW_ROLES: CrewRole[] = ['机长', '副驾驶', '乘务长', '乘务员'];
const CREW_STATUSES: CrewStatus[] = ['active', 'active', 'active', 'rest', 'active', 'active'];
const AIRCRAFT_TYPES = ['B737', 'B787', 'A320', 'A350', 'B777', 'A380'];

const AIRPORTS: Airport[] = MAJOR_AIRPORTS;

function generateId(prefix: string): string {
  return `${prefix}_${dayjs().valueOf()}_${Math.random().toString(36).substr(2, 9)}`;
}

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomInt(min: number, max: number): number {
  return Math.floor(randomBetween(min, max + 1));
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateCrewMembers(count: number = 20): CrewMember[] {
  const crew: CrewMember[] = [];
  
  for (let i = 0; i < count; i++) {
    const birthDate = dayjs().subtract(randomInt(25, 55), 'year').subtract(randomInt(0, 365), 'day');
    const baseDate = birthDate.add(randomInt(5000, 15000), 'day');
    
    crew.push({
      id: generateId('crew'),
      name: CREW_NAMES[i % CREW_NAMES.length],
      role: CREW_ROLES[i % CREW_ROLES.length],
      gender: i % 2 === 0 ? '男' : '女',
      birthDate: birthDate.format('YYYY-MM-DD'),
      biorhythmBaseDate: baseDate.format('YYYY-MM-DD'),
      employeeId: `CA${String(10000 + i).padStart(5, '0')}`,
      phone: `138${String(randomInt(10000000, 99999999))}`,
      email: `crew${i + 1}@aviaflow.com`,
      qualifications: {
        typeRatings: randomChoice([['B737'], ['A320'], ['B787', 'B777'], ['A350', 'A380']]),
        validUntil: dayjs().add(randomInt(6, 24), 'month').format('YYYY-MM-DD'),
        medicalCertificate: `体检证字第${String(randomInt(10000, 99999))}号`,
      },
      status: CREW_STATUSES[i % CREW_STATUSES.length],
      baseAirport: randomChoice(['PEK', 'PVG', 'CAN']),
      totalFlightHours: randomInt(1000, 15000),
      createdAt: dayjs().subtract(randomInt(30, 365), 'day').toISOString(),
      updatedAt: dayjs().subtract(randomInt(0, 30), 'day').toISOString(),
    });
  }
  
  return crew;
}

export function generatePhysiologicalData(
  crewIds: string[],
  days: number = 90
): PhysiologicalData[] {
  const data: PhysiologicalData[] = [];
  const endDate = dayjs();
  const startDate = endDate.subtract(days, 'day');
  
  for (const crewId of crewIds) {
    for (let d = 0; d < days; d++) {
      const date = startDate.add(d, 'day');
      const hasFlight = Math.random() > 0.6;
      const measurementsPerDay = hasFlight ? randomInt(3, 6) : randomInt(1, 3);
      
      for (let m = 0; m < measurementsPerDay; m++) {
        const timestamp = date.add(randomInt(0, 23), 'hour').add(randomInt(0, 59), 'minute');
        
        const baseHr = randomInt(60, 85);
        const baseHrv = randomInt(30, 70);
        const baseSleepQuality = randomInt(60, 95);
        const baseSleepDuration = randomBetween(5.5, 8.5);
        const baseReactionTime = randomInt(220, 320);
        const baseCortisol = randomBetween(8, 20);
        const baseStress = randomInt(20, 60);
        
        const flightMultiplier = hasFlight ? 1.15 : 1.0;
        
        data.push({
          id: generateId('physio'),
          crewId,
          timestamp: timestamp.toISOString(),
          heartRate: Math.round(baseHr * flightMultiplier + randomBetween(-5, 5)),
          hrv: Math.round(baseHrv / flightMultiplier + randomBetween(-5, 5)),
          sleepQuality: Math.round(Math.min(100, baseSleepQuality / flightMultiplier)),
          sleepDuration: Math.round(baseSleepDuration * 10) / 10,
          reactionTime: Math.round(baseReactionTime * flightMultiplier + randomBetween(-10, 10)),
          cortisol: Math.round(baseCortisol * flightMultiplier * 10) / 10,
          bloodPressure: {
            systolic: randomInt(110, 135),
            diastolic: randomInt(70, 85),
          },
          bodyTemperature: Math.round(randomBetween(36.2, 37.3) * 10) / 10,
          oxygenSaturation: randomInt(96, 100),
          stressLevel: Math.round(Math.min(100, baseStress * flightMultiplier)),
          source: randomChoice(['wearable', 'wearable', 'test']),
          createdAt: timestamp.toISOString(),
        });
      }
    }
  }
  
  return data;
}

export function generateFlightDuties(
  crewIds: string[],
  scheduleId: string,
  days: number = 30
): FlightDuty[] {
  const duties: FlightDuty[] = [];
  const startDate = dayjs();
  const endDate = startDate.add(days, 'day');
  
  for (const crewId of crewIds) {
    let currentDate = startDate.clone();
    let consecutiveDays = 0;
    
    while (currentDate.isBefore(endDate)) {
      if (consecutiveDays >= randomInt(3, 5)) {
        currentDate = currentDate.add(randomInt(2, 4), 'day');
        consecutiveDays = 0;
        continue;
      }
      
      if (Math.random() > 0.7) {
        currentDate = currentDate.add(1, 'day');
        continue;
      }
      
      const departureAirport = randomChoice(AIRPORTS);
      let arrivalAirport = randomChoice(AIRPORTS.filter(a => a.code !== departureAirport.code));
      
      const timezoneDiff = arrivalAirport.timezone - departureAirport.timezone;
      const flightHours = Math.max(1, Math.abs(timezoneDiff) * 1.2 + randomBetween(1, 3));
      
      const departureTime = currentDate.hour(randomInt(6, 22)).minute(randomInt(0, 59));
      const arrivalTime = departureTime.clone()
        .add(Math.floor(flightHours), 'hour')
        .add(Math.floor((flightHours % 1) * 60), 'minute');
      
      const aircraftType = randomChoice(AIRCRAFT_TYPES);
      const flightNumber = `CA${randomInt(100, 9999)}`;
      
      duties.push({
        id: generateId('duty'),
        crewId,
        scheduleId,
        flightNumber,
        departure: departureAirport.code,
        arrival: arrivalAirport.code,
        departureAirport,
        arrivalAirport,
        departureTime: departureTime.toISOString(),
        arrivalTime: arrivalTime.toISOString(),
        timezoneDiff,
        flightHours: Math.round(flightHours * 10) / 10,
        dutyHours: Math.round((flightHours + 2) * 10) / 10,
        dutyType: randomChoice(['passenger', 'passenger', 'passenger', 'cargo']),
        aircraftType,
        status: randomChoice(['scheduled', 'scheduled', 'scheduled', 'delayed']),
        crew: [crewId],
        crewIds: [crewId],
        dutyDate: currentDate.format('YYYY-MM-DD'),
        createdAt: dayjs().toISOString(),
        updatedAt: dayjs().toISOString(),
      });
      
      consecutiveDays++;
      currentDate = currentDate.add(1, 'day');
    }
  }
  
  return duties.sort((a, b) => dayjs(a.departureTime).valueOf() - dayjs(b.departureTime).valueOf());
}

export function generateHealthRecords(crewIds: string[]): HealthRecord[] {
  const records: HealthRecord[] = [];
  const recordTypes: HealthRecord['recordType'][] = ['体检', '疲劳评估', '疾病记录', '疫苗接种'];
  
  for (const crewId of crewIds) {
    const recordCount = randomInt(2, 6);
    
    for (let i = 0; i < recordCount; i++) {
      const date = dayjs().subtract(randomInt(0, 365), 'day');
      const type = randomChoice(recordTypes);
      
      records.push({
        id: generateId('health'),
        crewId,
        recordType: type,
        title: type === '体检' ? '年度体检' : type === '疲劳评估' ? '月度疲劳评估' : type === '疾病记录' ? '感冒就诊' : '疫苗接种',
        description: `${type}记录，各项指标${randomChoice(['正常', '良好', '基本正常'])}`,
        date: date.format('YYYY-MM-DD'),
        doctor: randomChoice(['王医生', '李医生', '张医生', '刘医生']),
        hospital: randomChoice(['民航总医院', '首都国际机场医院', '上海民航医院']),
        findings: '各项生理指标在正常范围内，飞行合格',
        recommendations: type === '疲劳评估' ? '建议合理安排休息，注意跨时区飞行后的恢复' : '定期复查，保持健康生活方式',
        createdAt: date.toISOString(),
      });
    }
  }
  
  return records;
}

export function generateMedicalAlerts(crewList: CrewMember[]): MedicalAlert[] {
  const alerts: MedicalAlert[] = [];
  
  for (const crew of crewList) {
    if (Math.random() > 0.3) continue;
    
    const alertCount = randomInt(1, 3);
    
    for (let i = 0; i < alertCount; i++) {
      const severities: MedicalAlert['severity'][] = ['low', 'medium', 'high', 'critical'];
      const types: MedicalAlert['type'][] = ['fatigue_high', 'abnormal_vital', 'sleep_deprivation'];
      
      const severity = randomChoice(severities);
      const type = randomChoice(types);
      const acknowledged = Math.random() > 0.5;
      
      let title = '';
      let message = '';
      switch (type) {
        case 'fatigue_high':
          title = '高疲劳风险预警';
          message = '机组人员疲劳指数偏高，建议调整排班';
          break;
        case 'abnormal_vital':
          title = '生理指标异常';
          message = '生理指标异常，需要进一步检查';
          break;
        case 'sleep_deprivation':
          title = '睡眠不足预警';
          message = '连续睡眠不足，请确保休息质量';
          break;
        default:
          title = '健康预警';
          message = '健康预警';
      }
      
      const triggeredAt = dayjs().subtract(randomInt(0, 7), 'day').toISOString();
      
      alerts.push({
        id: generateId('alert'),
        crewId: crew.id,
        crewName: crew.name,
        type,
        severity,
        title,
        message,
        triggeredAt,
        timestamp: triggeredAt,
        acknowledged,
        acknowledgedBy: acknowledged ? '系统管理员' : undefined,
        acknowledgedAt: acknowledged ? dayjs().subtract(randomInt(0, 7), 'day').toISOString() : undefined,
      });
    }
  }
  
  return alerts;
}

export function generateFatigueAssessments(
  crewList: CrewMember[],
  physiologicalData: PhysiologicalData[],
  duties: FlightDuty[]
): FatigueAssessment[] {
  const assessments: FatigueAssessment[] = [];
  
  for (const crew of crewList) {
    const crewPhysio = physiologicalData.filter(p => p.crewId === crew.id);
    const crewDuties = duties.filter(d => d.crewId === crew.id);
    
    const evolutionPoints = simulateFatigueEvolution(
      crew.id,
      crew.birthDate,
      crewPhysio,
      crewDuties,
      dayjs().subtract(30, 'day').toISOString(),
      30
    );
    
    for (let i = 0; i < 30; i++) {
      const point = evolutionPoints[i];
      const dayPhysio = crewPhysio.filter(p => 
        dayjs(p.timestamp).format('YYYY-MM-DD') === dayjs(point.timestamp).format('YYYY-MM-DD')
      );
      const dayDuties = crewDuties.filter(d =>
        dayjs(d.departureTime).format('YYYY-MM-DD') === dayjs(point.timestamp).format('YYYY-MM-DD')
      );
      
      const assessment = assessFatigue(
        crew.id,
        crew.birthDate,
        dayPhysio,
        dayDuties,
        assessments.filter(a => a.crewId === crew.id)
      );
      
      assessment.id = generateId('fatigue');
      assessment.assessmentTime = point.timestamp;
      assessment.fatigueScore = point.fatigueScore;
      assessment.riskLevel = point.riskLevel;
      assessment.timeWindow = {
        start: point.timestamp,
        end: dayjs(point.timestamp).add(24, 'hour').toISOString(),
      };
      
      assessments.push(assessment);
    }
  }
  
  return assessments;
}

export function generateSchedulePlan(crewCount: number, totalFlights: number): SchedulePlan {
  return {
    id: generateId('schedule'),
    name: `${dayjs().format('YYYY年MM月')}国际航班排班计划`,
    startDate: dayjs().format('YYYY-MM-DD'),
    endDate: dayjs().add(30, 'day').format('YYYY-MM-DD'),
    status: 'published',
    createdBy: 'AOC调度中心',
    description: '月度国际航班排班计划，包含北美、欧洲、澳洲及东南亚航线',
    totalCrew: crewCount,
    totalFlights,
    totalFlightHours: Math.round(totalFlights * 8.5 * 10) / 10,
    conflictCount: 0,
    fatigueRiskCount: 0,
    createdAt: dayjs().toISOString(),
    updatedAt: dayjs().toISOString(),
  };
}

export function generateScheduleConflicts(
  scheduleId: string,
  duties: FlightDuty[]
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];
  
  for (const duty of duties) {
    if (duty.timezoneDiff > 8) {
      conflicts.push({
        id: generateId('conflict'),
        scheduleId,
        type: 'timezone_overload',
        severity: duty.timezoneDiff > 10 ? 'error' : 'warning',
        description: `跨时区飞行时差过大(${duty.timezoneDiff > 0 ? '+' : ''}${duty.timezoneDiff}小时)，可能导致严重疲劳`,
        affectedCrew: duty.crew,
        affectedDuty: duty.id,
        resolved: false,
      });
    }
    
    if (duty.flightHours > 12) {
      conflicts.push({
        id: generateId('conflict'),
        scheduleId,
        type: 'flight_time_limit',
        severity: 'error',
        description: `单次飞行时长(${duty.flightHours}小时)超过建议限制`,
        affectedCrew: duty.crew,
        affectedDuty: duty.id,
        resolved: false,
      });
    }
    
    if (Math.random() > 0.85) {
      conflicts.push({
        id: generateId('conflict'),
        scheduleId,
        type: 'fatigue_risk',
        severity: 'warning',
        description: '排班密度过高，存在累积疲劳风险',
        affectedCrew: duty.crew,
        affectedDuty: duty.id,
        resolved: false,
      });
    }
  }
  
  return conflicts.slice(0, Math.min(conflicts.length, 15));
}

export function generateSyncLogs(count: number = 50): SyncLog[] {
  const logs: SyncLog[] = [];
  const sources: SyncLog['source'][] = ['medical', 'aoc', 'algorithm', 'system'];
  const targets: SyncLog['target'][] = ['medical', 'aoc', 'all'];
  const statuses: SyncLog['status'][] = ['success', 'success', 'success', 'pending'];
  
  for (let i = 0; i < count; i++) {
    const source = randomChoice(sources);
    const target = randomChoice(targets);
    const status = randomChoice(statuses);
    
    logs.push({
      id: generateId('synclog'),
      source,
      target,
      recordId: generateId(source),
      recordType: randomChoice(['crew_update', 'physio_data', 'schedule_change', 'fatigue_assessment']),
      syncTime: dayjs().subtract(i * randomInt(10, 120), 'minute').toISOString(),
      status,
      errorMessage: status === 'failed' ? '网络连接超时' : undefined,
    });
  }
  
  return logs;
}

export async function initializeMockData(): Promise<void> {
  console.log('开始初始化模拟数据...');
  
  const crew = generateCrewMembers(20);
  await bulkAddCrewMembers(crew);
  console.log(`已生成 ${crew.length} 名机组人员数据`);
  
  const crewIds = crew.map(c => c.id);
  const physiologicalData = generatePhysiologicalData(crewIds, 90);
  await bulkAddPhysiologicalData(physiologicalData);
  console.log(`已生成 ${physiologicalData.length} 条生理指标数据`);
  
  const healthRecords = generateHealthRecords(crewIds);
  await bulkAddHealthRecords(healthRecords);
  console.log(`已生成 ${healthRecords.length} 条健康档案`);
  
  const medicalAlerts = generateMedicalAlerts(crew);
  await bulkAddMedicalAlerts(medicalAlerts);
  console.log(`已生成 ${medicalAlerts.length} 条医疗预警`);
  
  const schedulePlan = generateSchedulePlan(crew.length, Math.floor(crew.length * 8));
  const scheduleId = await addSchedulePlan(schedulePlan);
  console.log(`已创建排班计划: ${schedulePlan.name}`);
  
  const duties = generateFlightDuties(crewIds, scheduleId, 30);
  await bulkAddFlightDuties(duties);
  console.log(`已生成 ${duties.length} 条航班任务`);
  
  const conflicts = generateScheduleConflicts(scheduleId, duties);
  for (const conflict of conflicts) {
    await addScheduleConflict(conflict);
  }
  console.log(`已检测到 ${conflicts.length} 个排班冲突`);
  
  const fatigueAssessments = generateFatigueAssessments(crew, physiologicalData, duties);
  await bulkAddFatigueAssessments(fatigueAssessments);
  console.log(`已生成 ${fatigueAssessments.length} 条疲劳评估记录`);
  
  const syncLogs = generateSyncLogs(50);
  await bulkAddSyncLogs(syncLogs);
  console.log(`已生成 ${syncLogs.length} 条同步日志`);
  
  console.log('模拟数据初始化完成！');
}

export async function checkAndInitializeData(): Promise<boolean> {
  const { getDB } = await import('../database/schema');
  const db = await getDB();
  
  const crewCount = await db.count('crewMembers');
  
  if (crewCount === 0) {
    await initializeMockData();
    return true;
  }
  
  console.log(`数据库已存在 ${crewCount} 条机组数据，跳过初始化`);
  return false;
}
