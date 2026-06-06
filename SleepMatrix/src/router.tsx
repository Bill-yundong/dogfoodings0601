import { Component, lazy } from 'solid-js';
import { Route } from '@solidjs/router';

const Dashboard = lazy(() => import('@/pages/dashboard/Dashboard'));
const Analysis = lazy(() => import('@/pages/analysis/Analysis'));
const Visualize = lazy(() => import('@/pages/visualize/Visualize'));
const Archive = lazy(() => import('@/pages/archive/Archive'));
const Devices = lazy(() => import('@/pages/devices/Devices'));
const Settings = lazy(() => import('@/pages/settings/Settings'));

export const routes = [
  { path: '/', component: Dashboard },
  { path: '/analysis', component: Analysis },
  { path: '/visualize', component: Visualize },
  { path: '/archive', component: Archive },
  { path: '/devices', component: Devices },
  { path: '/settings', component: Settings },
  { path: '/*', component: Dashboard },
];

export default routes;
