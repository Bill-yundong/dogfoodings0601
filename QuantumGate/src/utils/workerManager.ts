import type { QuantumGateType, GateParams, RabiParams, FidelityResult, SyndromeSnapshot, WorkerTask } from '@/types';
import { actions } from '@/store/appStore';
import { saveFidelityResult, saveSyndromeSnapshot } from './db';

type TaskCallback = (result: unknown) => void;
type ProgressCallback = (progress: number) => void;

class WorkerManager {
  private worker: Worker | null = null;
  private taskCallbacks: Map<string, { resolve: TaskCallback; reject: (error: string) => void; onProgress?: ProgressCallback }> = new Map();

  private initWorker(): Worker {
    if (this.worker) return this.worker;

    this.worker = new Worker(new URL('@/workers/fidelity.worker.ts', import.meta.url), {
      type: 'module',
    });

    this.worker.onmessage = (event: MessageEvent) => {
      const { type, taskId, result, progress, error } = event.data;

      if (type === 'progress') {
        const callbacks = this.taskCallbacks.get(taskId);
        if (callbacks?.onProgress) {
          callbacks.onProgress(progress);
        }
        actions.updateWorkerTask(taskId, { progress });
        return;
      }

      const callbacks = this.taskCallbacks.get(taskId);
      if (!callbacks) return;

      if (type === 'complete') {
        callbacks.resolve(result);
        actions.updateWorkerTask(taskId, { 
          status: 'completed', 
          progress: 100,
          result 
        });
      } else if (type === 'error') {
        callbacks.reject(error || 'Unknown error');
        actions.updateWorkerTask(taskId, { 
          status: 'failed',
          error 
        });
      }

      this.taskCallbacks.delete(taskId);
    };

    this.worker.onerror = (error) => {
      console.error('Worker error:', error);
    };

    return this.worker;
  }

  async calculateFidelity(
    gateType: QuantumGateType,
    params: GateParams,
    iterations: number = 1000,
    onProgress?: ProgressCallback
  ): Promise<FidelityResult> {
    const worker = this.initWorker();
    const taskId = `fidelity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const task: WorkerTask = {
      id: taskId,
      type: 'fidelity',
      payload: { gateType, params, iterations },
      status: 'running',
      progress: 0,
    };
    actions.addWorkerTask(task);

    return new Promise((resolve, reject) => {
      this.taskCallbacks.set(taskId, { 
        resolve: (result) => {
          const fidelityResult = result as FidelityResult;
          saveFidelityResult(fidelityResult).catch(console.error);
          resolve(fidelityResult);
        }, 
        reject,
        onProgress 
      });
      worker.postMessage({ taskId, taskType: 'fidelity', payload: { gateType, params, iterations } });
    });
  }

  async simulateRabi(
    params: RabiParams,
    onProgress?: ProgressCallback
  ): Promise<{ time: number; probability: number }[]> {
    const worker = this.initWorker();
    const taskId = `rabi-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const task: WorkerTask = {
      id: taskId,
      type: 'rabi',
      payload: params,
      status: 'running',
      progress: 0,
    };
    actions.addWorkerTask(task);

    return new Promise((resolve, reject) => {
      this.taskCallbacks.set(taskId, { resolve: resolve as TaskCallback, reject, onProgress });
      worker.postMessage({ taskId, taskType: 'rabi', payload: params });
    });
  }

  async generateSyndromeSnapshots(
    cycles: number,
    onProgress?: ProgressCallback
  ): Promise<SyndromeSnapshot[]> {
    const worker = this.initWorker();
    const taskId = `syndrome-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const task: WorkerTask = {
      id: taskId,
      type: 'syndrome',
      payload: { cycles },
      status: 'running',
      progress: 0,
    };
    actions.addWorkerTask(task);

    return new Promise((resolve, reject) => {
      this.taskCallbacks.set(taskId, { 
        resolve: (result) => {
          const snapshots = result as SyndromeSnapshot[];
          snapshots.forEach(s => saveSyndromeSnapshot(s).catch(console.error));
          resolve(snapshots);
        }, 
        reject,
        onProgress 
      });
      worker.postMessage({ taskId, taskType: 'syndrome', payload: { cycles } });
    });
  }

  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.taskCallbacks.clear();
  }

  getActiveTaskCount(): number {
    return this.taskCallbacks.size;
  }
}

export const workerManager = new WorkerManager();
