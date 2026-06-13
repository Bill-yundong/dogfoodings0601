<script setup lang="ts">
import { onMounted } from 'vue';
import { RouterView } from 'vue-router';
import AppLayout from '../../components/layout/AppLayout.vue';
import { useAlgorithmStore } from '../../stores/algorithm';
import { checkAndInitializeData } from '../../utils/mock';

const algorithmStore = useAlgorithmStore();

onMounted(async () => {
  await checkAndInitializeData();
  await algorithmStore.loadCrew();
});
</script>

<template>
  <AppLayout>
    <RouterView />
  </AppLayout>
</template>
