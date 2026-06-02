/// <reference lib="webworker" />

import type { QuantumGateType, GateParams, FidelityResult, RabiParams, SyndromeSnapshot } from '@/types';

type Complex = [number, number];

function complexAdd(a: Complex, b: Complex): Complex {
  return [a[0] + b[0], a[1] + b[1]];
}

function complexMultiply(a: Complex, b: Complex): Complex {
  return [
    a[0] * b[0] - a[1] * b[1],
    a[0] * b[1] + a[1] * b[0],
  ];
}



function matrixMultiply(a: Complex[][], b: Complex[][]): Complex[][] {
  const rows = a.length;
  const cols = b[0].length;
  const inner = b.length;
  const result: Complex[][] = Array(rows)
    .fill(null)
    .map(() => Array(cols).fill([0, 0] as Complex));

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      for (let k = 0; k < inner; k++) {
        result[i][j] = complexAdd(result[i][j], complexMultiply(a[i][k], b[k][j]));
      }
    }
  }

  return result;
}

function conjugateTranspose(m: Complex[][]): Complex[][] {
  const rows = m.length;
  const cols = m[0].length;
  const result: Complex[][] = Array(cols)
    .fill(null)
    .map(() => Array(rows).fill([0, 0] as Complex));

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      result[j][i] = [m[i][j][0], -m[i][j][1]];
    }
  }

  return result;
}

function getGateMatrix(gateType: QuantumGateType, params: GateParams = {}): Complex[][] {
  const sqrt2 = Math.SQRT1_2;
  const theta = params.theta || 0;

  switch (gateType) {
    case 'X':
      return [
        [[0, 0], [1, 0]],
        [[1, 0], [0, 0]],
      ];
    case 'Y':
      return [
        [[0, 0], [0, -1]],
        [[0, 1], [0, 0]],
      ];
    case 'Z':
      return [
        [[1, 0], [0, 0]],
        [[0, 0], [-1, 0]],
      ];
    case 'H':
      return [
        [[sqrt2, 0], [sqrt2, 0]],
        [[sqrt2, 0], [-sqrt2, 0]],
      ];
    case 'Rx':
      return [
        [[Math.cos(theta / 2), 0], [0, -Math.sin(theta / 2)]],
        [[0, -Math.sin(theta / 2)], [Math.cos(theta / 2), 0]],
      ];
    case 'Ry':
      return [
        [[Math.cos(theta / 2), 0], [-Math.sin(theta / 2), 0]],
        [[Math.sin(theta / 2), 0], [Math.cos(theta / 2), 0]],
      ];
    case 'Rz':
      return [
        [[Math.cos(theta / 2), -Math.sin(theta / 2)], [0, 0]],
        [[0, 0], [Math.cos(theta / 2), Math.sin(theta / 2)]],
      ];
    case 'T':
      return [
        [[1, 0], [0, 0]],
        [[0, 0], [sqrt2, sqrt2]],
      ];
    case 'S':
      return [
        [[1, 0], [0, 0]],
        [[0, 0], [0, 1]],
      ];
    case 'CNOT':
      return [
        [[1, 0], [0, 0], [0, 0], [0, 0]],
        [[0, 0], [1, 0], [0, 0], [0, 0]],
        [[0, 0], [0, 0], [0, 0], [1, 0]],
        [[0, 0], [0, 0], [1, 0], [0, 0]],
      ];
    default:
      return [
        [[1, 0], [0, 0]],
        [[0, 0], [1, 0]],
      ];
  }
}

function applyNoise(matrix: Complex[][], noiseLevel: number): Complex[][] {
  return matrix.map((row) =>
    row.map((c) => [
      c[0] + (Math.random() - 0.5) * noiseLevel,
      c[1] + (Math.random() - 0.5) * noiseLevel,
    ])
  );
}

function applyDecoherence(matrix: Complex[][], rate: number): Complex[][] {
  const factor = Math.exp(-rate);
  return matrix.map((row) => row.map((c) => [c[0] * factor, c[1] * factor]));
}

function calculateFidelity(ideal: Complex[][], actual: Complex[][]): number {
  const product = matrixMultiply(ideal, conjugateTranspose(actual));
  let trace = 0;
  for (let i = 0; i < product.length; i++) {
    trace += product[i][i][0];
  }
  return Math.abs(trace) / product.length;
}

function runFidelityCalculation(
  gateType: QuantumGateType,
  params: GateParams,
  iterations: number
): FidelityResult {
  const startTime = performance.now();
  const idealMatrix = getGateMatrix(gateType, params);
  let totalFidelity = 0;
  const noiseLevel = params.noiseLevel || 0.01;
  const decoherenceRate = params.decoherenceRate || 0.001;

  for (let i = 0; i < iterations; i++) {
    let actualMatrix = getGateMatrix(gateType, params);
    actualMatrix = applyNoise(actualMatrix, noiseLevel);
    actualMatrix = applyDecoherence(actualMatrix, decoherenceRate);
    totalFidelity += calculateFidelity(idealMatrix, actualMatrix);

    if (i % Math.floor(iterations / 10) === 0) {
      self.postMessage({
        type: 'progress',
        progress: (i / iterations) * 100,
      });
    }
  }

  const avgFidelity = totalFidelity / iterations;
  const computeTime = performance.now() - startTime;

  return {
    gateType,
    fidelity: avgFidelity,
    errorRate: 1 - avgFidelity,
    parameters: params,
    computeTime,
    timestamp: Date.now(),
    iterations,
  };
}

function simulateRabiOscillation(params: RabiParams): { time: number; probability: number }[] {
  const { omega, delta, gamma, duration, samples } = params;
  const results: { time: number; probability: number }[] = [];
  const dt = duration / samples;

  for (let i = 0; i <= samples; i++) {
    const t = i * dt;
    const omegaEff = Math.sqrt(omega * omega + delta * delta);
    const decay = Math.exp(-gamma * t);
    const probability = decay * (omega * omega / (omegaEff * omegaEff)) * Math.pow(Math.sin(omegaEff * t / 2), 2);
    results.push({ time: t, probability });

    if (i % Math.floor(samples / 10) === 0) {
      self.postMessage({
        type: 'progress',
        progress: (i / samples) * 100,
      });
    }
  }

  return results;
}

function generateSyndromeSnapshot(cycleNumber: number): SyndromeSnapshot {
  const size = 5;
  const syndromeData: number[][] = [];

  for (let i = 0; i < size; i++) {
    syndromeData[i] = [];
    for (let j = 0; j < size; j++) {
      syndromeData[i][j] = Math.random() > 0.85 ? 1 : 0;
    }
  }

  const errorCount = syndromeData.flat().filter((v) => v === 1).length;
  const errorProbability = errorCount / (size * size);

  let correctionResult: 'success' | 'failed' | 'partial' = 'success';
  if (errorCount > 5) correctionResult = 'failed';
  else if (errorCount > 2) correctionResult = 'partial';

  return {
    cycleNumber,
    syndromeData,
    errorProbability,
    timestamp: Date.now(),
    correctionResult,
    qubitStates: Array(8).fill(0).map(() => Math.random() > 0.5 ? 1 : 0),
  };
}

self.onmessage = (event: MessageEvent) => {
  const { taskId, taskType, payload } = event.data;

  try {
    switch (taskType) {
      case 'fidelity': {
        const { gateType, params, iterations } = payload as {
          gateType: QuantumGateType;
          params: GateParams;
          iterations: number;
        };
        const result = runFidelityCalculation(gateType, params, iterations);
        self.postMessage({
          type: 'complete',
          taskId,
          result,
        });
        break;
      }
      case 'rabi': {
        const params = payload as RabiParams;
        const result = simulateRabiOscillation(params);
        self.postMessage({
          type: 'complete',
          taskId,
          result,
        });
        break;
      }
      case 'syndrome': {
        const { cycles } = payload as { cycles: number };
        const snapshots: SyndromeSnapshot[] = [];
        for (let i = 0; i < cycles; i++) {
          snapshots.push(generateSyndromeSnapshot(i));
          if (i % Math.floor(cycles / 10) === 0) {
            self.postMessage({
              type: 'progress',
              progress: (i / cycles) * 100,
            });
          }
        }
        self.postMessage({
          type: 'complete',
          taskId,
          result: snapshots,
        });
        break;
      }
      default:
        throw new Error(`Unknown task type: ${taskType}`);
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      taskId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
