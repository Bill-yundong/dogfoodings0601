import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';
import Dashboard from '../views/Dashboard/Dashboard.vue';
import DashboardOverview from '../views/Dashboard/Overview.vue';
import DashboardTrends from '../views/Dashboard/Trends.vue';
import Medical from '../views/Medical/Medical.vue';
import MedicalMonitoring from '../views/Medical/Monitoring.vue';
import MedicalRecords from '../views/Medical/Records.vue';
import AOC from '../views/AOC/AOC.vue';
import AOCSchedule from '../views/AOC/Schedule.vue';
import AOCNetwork from '../views/AOC/Network.vue';
import Algorithm from '../views/Algorithm/Algorithm.vue';
import AlgorithmBiorhythm from '../views/Algorithm/Biorhythm.vue';
import AlgorithmFatigue from '../views/Algorithm/Fatigue.vue';
import Database from '../views/Database/Database.vue';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/dashboard',
  },
  {
    path: '/dashboard',
    component: Dashboard,
    children: [
      { path: '', redirect: '/dashboard/overview' },
      { path: 'overview', component: DashboardOverview, name: 'DashboardOverview' },
      { path: 'trends', component: DashboardTrends, name: 'DashboardTrends' },
    ],
  },
  {
    path: '/medical',
    component: Medical,
    children: [
      { path: '', redirect: '/medical/monitoring' },
      { path: 'monitoring', component: MedicalMonitoring, name: 'MedicalMonitoring' },
      { path: 'records', component: MedicalRecords, name: 'MedicalRecords' },
    ],
  },
  {
    path: '/aoc',
    component: AOC,
    children: [
      { path: '', redirect: '/aoc/schedule' },
      { path: 'schedule', component: AOCSchedule, name: 'AOCSchedule' },
      { path: 'network', component: AOCNetwork, name: 'AOCNetwork' },
    ],
  },
  {
    path: '/algorithm',
    component: Algorithm,
    children: [
      { path: '', redirect: '/algorithm/biorhythm' },
      { path: 'biorhythm', component: AlgorithmBiorhythm, name: 'AlgorithmBiorhythm' },
      { path: 'fatigue', component: AlgorithmFatigue, name: 'AlgorithmFatigue' },
    ],
  },
  {
    path: '/database',
    component: Database,
    name: 'Database',
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
