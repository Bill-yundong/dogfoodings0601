export interface Airport {
  code: string;
  name: string;
  city: string;
  country: string;
  timezone: number;
  latitude: number;
  longitude: number;
}

export interface FlightDuty {
  id: string;
  crewId: string;
  scheduleId: string;
  flightNumber: string;
  departure: string;
  arrival: string;
  departureAirport: Airport;
  arrivalAirport: Airport;
  departureTime: string;
  arrivalTime: string;
  timezoneDiff: number;
  flightHours: number;
  dutyHours: number;
  dutyType: 'passenger' | 'cargo' | 'training' | 'positioning';
  aircraftType: string;
  status: 'scheduled' | 'delayed' | 'cancelled' | 'completed' | 'in_progress';
  crew: string[];
  crewIds: string[];
  dutyDate: string;
  actualDepartureTime?: string;
  actualArrivalTime?: string;
  delayReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SchedulePlan {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'draft' | 'published' | 'approved' | 'archived';
  createdBy: string;
  description: string;
  totalCrew: number;
  totalFlights: number;
  totalFlightHours: number;
  conflictCount: number;
  fatigueRiskCount: number;
  syncedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleConflict {
  id: string;
  scheduleId: string;
  type: 'rest_violation' | 'flight_time_limit' | 'qualification_mismatch' | 'timezone_overload' | 'fatigue_risk' | 'fatigue' | 'rest';
  severity: 'warning' | 'error';
  description: string;
  affectedCrew?: string[];
  affectedDuty?: string;
  flightDutyIds?: string[];
  resolved: boolean;
  resolution?: string;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
}

export const DUTY_STATUS_COLORS = {
  scheduled: 'bg-blue-500',
  delayed: 'bg-yellow-500',
  cancelled: 'bg-red-500',
  completed: 'bg-green-500',
  in_progress: 'bg-purple-500',
} as const;

export const SCHEDULE_STATUS_LABELS = {
  draft: '草稿',
  published: '已发布',
  approved: '已批准',
  archived: '已归档',
} as const;

export const MAJOR_AIRPORTS: Airport[] = [
  { code: 'PEK', name: '北京首都国际机场', city: '北京', country: '中国', timezone: 8, latitude: 40.0799, longitude: 116.6031 },
  { code: 'PVG', name: '上海浦东国际机场', city: '上海', country: '中国', timezone: 8, latitude: 31.1433, longitude: 121.8058 },
  { code: 'CAN', name: '广州白云国际机场', city: '广州', country: '中国', timezone: 8, latitude: 23.3924, longitude: 113.2988 },
  { code: 'LAX', name: '洛杉矶国际机场', city: '洛杉矶', country: '美国', timezone: -8, latitude: 33.9416, longitude: -118.4085 },
  { code: 'JFK', name: '纽约肯尼迪国际机场', city: '纽约', country: '美国', timezone: -5, latitude: 40.6413, longitude: -73.7781 },
  { code: 'LHR', name: '伦敦希思罗机场', city: '伦敦', country: '英国', timezone: 0, latitude: 51.4700, longitude: -0.4543 },
  { code: 'CDG', name: '巴黎戴高乐机场', city: '巴黎', country: '法国', timezone: 1, latitude: 49.0097, longitude: 2.5479 },
  { code: 'NRT', name: '东京成田国际机场', city: '东京', country: '日本', timezone: 9, latitude: 35.7647, longitude: 140.3864 },
  { code: 'SYD', name: '悉尼金斯福德史密斯机场', city: '悉尼', country: '澳大利亚', timezone: 10, latitude: -33.9399, longitude: 151.1753 },
  { code: 'DXB', name: '迪拜国际机场', city: '迪拜', country: '阿联酋', timezone: 4, latitude: 25.2532, longitude: 55.3657 },
  { code: 'SIN', name: '新加坡樟宜机场', city: '新加坡', country: '新加坡', timezone: 8, latitude: 1.3644, longitude: 103.9915 },
  { code: 'FRA', name: '法兰克福机场', city: '法兰克福', country: '德国', timezone: 1, latitude: 50.0379, longitude: 8.5622 },
];
