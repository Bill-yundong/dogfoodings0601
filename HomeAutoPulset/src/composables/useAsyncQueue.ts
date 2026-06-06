import { ref, computed } from 'vue';
import type { AsyncTask } from '@/types/conflict';

export function useAsyncQueue<T extends { id: string; priority: number }>(maxWorkers: number = 3) {
  const queue = ref<AsyncTask[]>([]);
  const processing = ref<AsyncTask[]>([]);
  const completed = ref<AsyncTask[]>([]);
  const failed = ref<AsyncTask[]>([]);
  const activeWorkers = ref(0);
  const isPaused = ref(false);

  const pendingCount = computed(() => queue.value.length);
  const processingCount = computed(() => processing.value.length);
  const completedCount = computed(() => completed.value.length);
  const failedCount = computed(() => failed.value.length);
  const totalCount = computed(() => queue.value.length + processing.value.length + completed.value.length + failed.value.length);

  const isBusy = computed(() => activeWorkers.value >= maxWorkers);
  const hasPendingTasks = computed(() => queue.value.length > 0);

  const enqueue = (task: Omit<AsyncTask, 'id' | 'status' | 'createdAt' | 'progress' | 'retryCount'> & { conflictId: string; priority: number }): AsyncTask => {
    const newTask: AsyncTask = {
      ...task,
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'queued',
      createdAt: Date.now(),
      progress: 0,
      retryCount: 0,
    };
    insertSorted(newTask);
    processNext();
    return newTask;
  };

  const insertSorted = (task: AsyncTask) => {
    const index = queue.value.findIndex(t => t.priority < task.priority);
    if (index === -1) {
      queue.value.push(task);
    } else {
      queue.value.splice(index, 0, task);
    }
  };

  const processNext = async () => {
    if (isPaused.value || activeWorkers.value >= maxWorkers || queue.value.length === 0) {
      return;
    }

    const task = queue.value.shift();
    if (!task) return;

    activeWorkers.value++;
    task.status = 'processing';
    task.startedAt = Date.now();
    task.currentStep = '初始化解析...';
    processing.value.push(task);

    try {
      await executeTask(task);
      task.status = 'completed';
      task.progress = 100;
      task.completedAt = Date.now();
      completed.value.push(task);
    } catch (error) {
      task.retryCount++;
      if (task.retryCount < 3) {
        task.status = 'queued';
        task.progress = 0;
        task.error = error instanceof Error ? error.message : '未知错误';
        task.currentStep = `重试中 (${task.retryCount}/3)...`;
        insertSorted(task);
      } else {
        task.status = 'failed';
        task.error = error instanceof Error ? error.message : '任务执行失败，已达最大重试次数';
        task.completedAt = Date.now();
        failed.value.push(task);
      }
    } finally {
      processing.value = processing.value.filter(t => t.id !== task.id);
      activeWorkers.value--;
      processNext();
    }
  };

  const executeTask = async (task: AsyncTask): Promise<void> => {
    const steps = [
      '分析冲突上下文...',
      '评估冲突严重程度...',
      '检索相关设备状态...',
      '匹配解析策略...',
      '验证解决方案...',
      '执行解析动作...',
      '确认设备响应...',
      '记录解析结果...',
    ];

    for (let i = 0; i < steps.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
      task.progress = Math.round(((i + 1) / steps.length) * 100);
      task.currentStep = steps[i];
    }
  };

  const cancelTask = (taskId: string): boolean => {
    const queueIndex = queue.value.findIndex(t => t.id === taskId);
    if (queueIndex !== -1) {
      queue.value.splice(queueIndex, 1);
      return true;
    }
    return false;
  };

  const retryTask = (taskId: string): boolean => {
    const task = failed.value.find(t => t.id === taskId);
    if (task) {
      failed.value = failed.value.filter(t => t.id !== taskId);
      task.status = 'queued';
      task.retryCount = 0;
      task.error = undefined;
      task.progress = 0;
      delete task.startedAt;
      delete task.completedAt;
      insertSorted(task);
      processNext();
      return true;
    }
    return false;
  };

  const pause = () => {
    isPaused.value = true;
  };

  const resume = () => {
    isPaused.value = false;
    for (let i = 0; i < maxWorkers - activeWorkers.value; i++) {
      processNext();
    }
  };

  const clearCompleted = () => {
    completed.value = [];
    failed.value = [];
  };

  const clearAll = () => {
    queue.value = [];
    processing.value = [];
    completed.value = [];
    failed.value = [];
    activeWorkers.value = 0;
  };

  const getTaskById = (taskId: string): AsyncTask | undefined => {
    return [...queue.value, ...processing.value, ...completed.value, ...failed.value].find(t => t.id === taskId);
  };

  const getTasksByConflictId = (conflictId: string): AsyncTask[] => {
    return [...queue.value, ...processing.value, ...completed.value, ...failed.value].filter(t => t.conflictId === conflictId);
  };

  return {
    queue,
    processing,
    completed,
    failed,
    activeWorkers,
    isPaused,
    pendingCount,
    processingCount,
    completedCount,
    failedCount,
    totalCount,
    isBusy,
    hasPendingTasks,
    maxWorkers,
    enqueue,
    cancelTask,
    retryTask,
    pause,
    resume,
    clearCompleted,
    clearAll,
    getTaskById,
    getTasksByConflictId,
  };
}
