import type { RabiParams, RabiOscillationRecord } from '@/types';

export function calculateRabiProbability(
  t: number,
  omega: number,
  delta: number,
  gamma: number = 0
): number {
  const omegaEff = Math.sqrt(omega * omega + delta * delta);
  const decay = Math.exp(-gamma * t);
  return decay * (omega * omega / (omegaEff * omegaEff)) * Math.pow(Math.sin(omegaEff * t / 2), 2);
}

export function simulateRabiSequence(
  params: RabiParams,
  qubitId: number = 0
): RabiOscillationRecord[] {
  const { omega, delta, gamma, duration, samples } = params;
  const records: RabiOscillationRecord[] = [];
  const dt = duration / samples;
  const baseTime = Date.now();

  for (let i = 0; i <= samples; i++) {
    const t = i * dt;
    const probability = calculateRabiProbability(t, omega, delta, gamma);
    
    records.push({
      timestamp: baseTime + t * 1000,
      probability,
      omega,
      delta,
      qubitId,
      time: t,
    });
  }

  return records;
}

export function calculateFourierTransform(
  data: { time: number; probability: number }[]
): { frequency: number; amplitude: number }[] {
  const n = data.length;
  const results: { frequency: number; amplitude: number }[] = [];
  
  const timeStep = data[1]?.time - data[0]?.time || 0.01;
  const sampleRate = 1 / timeStep;

  for (let k = 0; k < n / 2; k++) {
    let real = 0;
    let imag = 0;
    
    for (let t = 0; t < n; t++) {
      const angle = (2 * Math.PI * k * t) / n;
      real += data[t].probability * Math.cos(angle);
      imag -= data[t].probability * Math.sin(angle);
    }
    
    const amplitude = Math.sqrt(real * real + imag * imag) / n;
    const frequency = (k * sampleRate) / n;
    
    results.push({ frequency, amplitude });
  }

  return results;
}

export function estimateOmegaFromData(
  data: { time: number; probability: number }[]
): number {
  let peakCount = 0;
  let prevValue = data[0]?.probability || 0;
  let totalTime = data[data.length - 1]?.time || 1;
  
  for (let i = 1; i < data.length; i++) {
    const current = data[i].probability;
    if (current < prevValue && prevValue > 0.5) {
      peakCount++;
    }
    prevValue = current;
  }
  
  if (peakCount === 0) return Math.PI;
  return (peakCount * Math.PI * 2) / totalTime;
}

export function generatePulseSequence(
  pulseWidth: number,
  interval: number,
  totalDuration: number,
  amplitude: number = 1
): { time: number; amplitude: number }[] {
  const samples = Math.ceil(totalDuration / 0.001);
  const result: { time: number; amplitude: number }[] = [];
  
  for (let i = 0; i < samples; i++) {
    const t = i * 0.001;
    const pulsePhase = t % interval;
    const inPulse = pulsePhase < pulseWidth;
    result.push({
      time: t,
      amplitude: inPulse ? amplitude : 0,
    });
  }
  
  return result;
}
