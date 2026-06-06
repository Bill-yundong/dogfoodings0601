<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue';
import { getHealthScoreColor, getHealthScoreBgColor } from '@/utils/conflictUtils';

const props = defineProps<{
  score: number;
  size?: number;
}>();

const displayScore = ref(0);
const size = computed(() => props.size || 180);
const strokeWidth = 12;
const radius = computed(() => (size.value - strokeWidth) / 2);
const circumference = computed(() => 2 * Math.PI * radius.value);
const offset = computed(() => circumference.value - (displayScore.value / 100) * circumference.value);

const scoreColor = computed(() => getHealthScoreColor(displayScore.value));
const scoreBgClass = computed(() => getHealthScoreBgColor(displayScore.value));

const scoreLabel = computed(() => {
  if (displayScore.value >= 90) return '优秀';
  if (displayScore.value >= 70) return '良好';
  if (displayScore.value >= 50) return '一般';
  return '较差';
});

watch(() => props.score, (newScore) => {
  const start = displayScore.value;
  const diff = newScore - start;
  const duration = 1000;
  const startTime = Date.now();

  const animate = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeProgress = 1 - Math.pow(1 - progress, 3);
    displayScore.value = Math.round(start + diff * easeProgress);

    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  };

  requestAnimationFrame(animate);
}, { immediate: true });

onMounted(() => {
  displayScore.value = props.score;
});
</script>

<template>
  <div class="relative flex flex-col items-center justify-center">
    <div
      :class="[
        'absolute inset-0 rounded-full opacity-30 blur-xl',
        'bg-gradient-to-br',
        scoreBgClass
      ]"
      :style="{ width: size + 'px', height: size + 'px' }"
    ></div>

    <svg
      :width="size"
      :height="size"
      class="transform -rotate-90"
    >
      <circle
        :cx="size / 2"
        :cy="size / 2"
        :r="radius"
        fill="none"
        stroke="currentColor"
        stroke-opacity="0.1"
        :stroke-width="strokeWidth"
        class="text-slate-mid"
      />

      <defs>
        <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" :style="{ stopColor: scoreColor === 'text-success-green' ? '#00C853' : scoreColor === 'text-warning-amber' ? '#FFD740' : scoreColor === 'text-alert-orange' ? '#FF6B35' : '#FF5252' }" />
          <stop offset="100%" style="stopColor: #7C4DFF" />
        </linearGradient>
      </defs>

      <circle
        :cx="size / 2"
        :cy="size / 2"
        :r="radius"
        fill="none"
        stroke="url(#scoreGradient)"
        :stroke-width="strokeWidth"
        stroke-linecap="round"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="offset"
        class="transition-all duration-1000 ease-out"
        :style="{ filter: `drop-shadow(0 0 8px ${scoreColor === 'text-success-green' ? '#00C853' : scoreColor === 'text-warning-amber' ? '#FFD740' : scoreColor === 'text-alert-orange' ? '#FF6B35' : '#FF5252'}40)` }"
      />
    </svg>

    <div class="absolute inset-0 flex flex-col items-center justify-center">
      <span :class="['font-display text-4xl font-bold', scoreColor]">{{ displayScore }}</span>
      <span class="text-sm text-slate-light mt-1">{{ scoreLabel }}</span>
      <span class="text-xs text-slate-mid mt-0.5">系统健康度</span>
    </div>
  </div>
</template>
