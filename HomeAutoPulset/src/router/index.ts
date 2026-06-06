import { createRouter, createWebHistory } from 'vue-router';
import Dashboard from '@/pages/Dashboard.vue';
import ConflictCenter from '@/pages/ConflictCenter.vue';
import ConflictDetail from '@/pages/ConflictDetail.vue';
import SemanticAlignment from '@/pages/SemanticAlignment.vue';
import SnapshotManager from '@/pages/SnapshotManager.vue';
import RuleEngine from '@/pages/RuleEngine.vue';
import DeviceList from '@/pages/DeviceList.vue';
import SystemSettings from '@/pages/SystemSettings.vue';

const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: Dashboard,
    meta: { title: '监控仪表盘', icon: 'LayoutDashboard' },
  },
  {
    path: '/conflicts',
    name: 'ConflictCenter',
    component: ConflictCenter,
    meta: { title: '冲突解析中心', icon: 'AlertTriangle' },
  },
  {
    path: '/conflicts/:id',
    name: 'ConflictDetail',
    component: ConflictDetail,
    meta: { title: '冲突详情', hidden: true },
  },
  {
    path: '/semantic',
    name: 'SemanticAlignment',
    component: SemanticAlignment,
    meta: { title: '语义对齐配置', icon: 'GitMerge' },
  },
  {
    path: '/snapshots',
    name: 'SnapshotManager',
    component: SnapshotManager,
    meta: { title: '设备快照管理', icon: 'Database' },
  },
  {
    path: '/rules',
    name: 'RuleEngine',
    component: RuleEngine,
    meta: { title: '规则引擎配置', icon: 'Settings2' },
  },
  {
    path: '/devices',
    name: 'DeviceList',
    component: DeviceList,
    meta: { title: '设备列表', icon: 'Cpu' },
  },
  {
    path: '/settings',
    name: 'SystemSettings',
    component: SystemSettings,
    meta: { title: '系统设置', icon: 'Settings' },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, _from, next) => {
  document.title = `${to.meta.title || '家庭自动化冲突监控'} - HomeAutoPulse`;
  next();
});

export default router;
