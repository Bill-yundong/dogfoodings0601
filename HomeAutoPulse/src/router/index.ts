import { createRouter, createWebHistory } from 'vue-router'

const DashboardPage = () => import('@/pages/DashboardPage.vue')
const ConflictPage = () => import('@/pages/ConflictPage.vue')
const SnapshotPage = () => import('@/pages/SnapshotPage.vue')
const RulesPage = () => import('@/pages/RulesPage.vue')

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/dashboard' },
    { path: '/dashboard', name: 'dashboard', component: DashboardPage },
    { path: '/conflict', name: 'conflict', component: ConflictPage },
    { path: '/snapshot', name: 'snapshot', component: SnapshotPage },
    { path: '/rules', name: 'rules', component: RulesPage },
  ],
})

export default router
