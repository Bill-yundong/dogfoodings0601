<script setup lang="ts">
import { onMounted } from 'vue';
import { RouterView } from 'vue-router';
import AppLayout from '../../components/layout/AppLayout.vue';
import { useDashboardStore } from '../../stores/dashboard';
import { checkAndInitializeData } from '../../utils/mock';

const dashboardStore = useDashboardStore();

onMounted(async () => {
  await checkAndInitializeData();
  await dashboardStore.loadStats();
  await dashboardStore.loadAlerts();
  await dashboardStore.loadHeatmap(30);
});
</script>

<template>
  <AppLayout>
    <RouterView />
  </AppLayout>
</template>
