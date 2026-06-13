<script setup lang="ts">
import { onMounted } from 'vue';
import { RouterView } from 'vue-router';
import AppLayout from '../../components/layout/AppLayout.vue';
import { useMedicalStore } from '../../stores/medical';
import { checkAndInitializeData } from '../../utils/mock';

const medicalStore = useMedicalStore();

onMounted(async () => {
  await checkAndInitializeData();
  await medicalStore.loadCrew();
  await medicalStore.loadAlerts();
});
</script>

<template>
  <AppLayout>
    <RouterView />
  </AppLayout>
</template>
