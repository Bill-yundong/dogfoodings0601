export interface CrewMember {
  id: string;
  name: string;
  role: '机长' | '副驾驶' | '乘务长' | '乘务员';
  gender: '男' | '女';
  birthDate: string;
  biorhythmBaseDate: string;
  employeeId: string;
  phone: string;
  email: string;
  qualifications: {
    typeRatings: string[];
    validUntil: string;
    medicalCertificate: string;
  };
  status: 'active' | 'rest' | 'medical_leave' | 'suspended';
  baseAirport: string;
  totalFlightHours: number;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

export type CrewRole = CrewMember['role'];
export type CrewStatus = CrewMember['status'];

export const CREW_ROLES: CrewRole[] = ['机长', '副驾驶', '乘务长', '乘务员'];
export const CREW_STATUSES: { value: CrewStatus; label: string; color: string }[] = [
  { value: 'active', label: '执勤中', color: 'bg-green-500' },
  { value: 'rest', label: '休息', color: 'bg-blue-500' },
  { value: 'medical_leave', label: '病假', color: 'bg-yellow-500' },
  { value: 'suspended', label: '停飞', color: 'bg-red-500' },
];
