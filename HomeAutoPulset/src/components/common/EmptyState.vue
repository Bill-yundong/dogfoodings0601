<script setup lang="ts">
import { Inbox } from 'lucide-vue-next';

defineProps<{
  title?: string;
  description?: string;
  icon?: any;
}>();
</script>

<template>
  <div class="flex flex-col items-center justify-center py-12 px-4 text-center">
    <div class="w-16 h-16 rounded-2xl bg-midnight/50 flex items-center justify-center mb-4 border border-slate-mid/30">
      <component :is="icon || Inbox" class="w-8 h-8 text-slate-light" />
    </div>
    <h3 class="text-lg font-medium text-white mb-2">{{ title || '暂无数据' }}</h3>
    <p class="text-sm text-slate-light max-w-sm">{{ description || '当前没有可显示的数据内容' }}</p>
    <slot name="actions"></slot>
  </div>
</template>
