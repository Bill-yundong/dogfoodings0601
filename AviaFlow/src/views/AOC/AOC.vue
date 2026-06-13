<script setup lang="ts">
import { onMounted } from 'vue';
import { RouterView } from 'vue-router';
import AppLayout from '../../components/layout/AppLayout.vue';
import { useAocStore } from '../../stores/aoc';
import { checkAndInitializeData } from '../../utils/mock';

const aocStore = useAocStore();

onMounted(async () => {
  await checkAndInitializeData();
  await aocStore.loadDuties();
  await aocStore.loadSchedules();
  await aocStore.loadConflicts();
});
</script>

<template>
  <AppLayout>
    <RouterView />
  </AppLayout>
</template>
