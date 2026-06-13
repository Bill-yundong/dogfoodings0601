<script setup lang="ts">
import { onMounted } from 'vue';
import { checkAndInitializeData } from './utils/mock';

onMounted(async () => {
  document.documentElement.classList.add('dark');
  await checkAndInitializeData();
});
</script>

<template>
  <div class="dark bg-slate-900 min-h-screen">
    <router-view />
  </div>
</template>