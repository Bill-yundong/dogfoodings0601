import { createSignal } from 'solid-js'
import type { AnalysisResult, CorrelationMethod } from '@/types'
import { asyncCorrelationAnalysis, overallSleepScore, timeShiftAnalysis } from '@/utils/correlation'
import { getAnalysisBySnapshotId, saveAnalysisResult, getSleepSnapshot } from '@/db/snapshotStore'
import { generateId } from '@/utils/time'

const [analysisResult, setAnalysisResult] = createSignal<AnalysisResult | null>(null)
const [isAnalyzing, setIsAnalyzing] = createSignal(false)
const [correlationMethod, setCorrelationMethod] = createSignal<CorrelationMethod>('pearson')
const [timeShiftData, setTimeShiftData] = createSignal<
  { shift: number; correlation: number; factor: string }[]
>([])

async function runAnalysis(snapshotId: string): Promise<AnalysisResult | null> {
  setIsAnalyzing(true)

  try {
    const cached = await getAnalysisBySnapshotId(snapshotId)
    if (cached) {
      setAnalysisResult(cached)
      return cached
    }

    const snapshot = await getSleepSnapshot(snapshotId)
    if (!snapshot) {
      setIsAnalyzing(false)
      return null
    }

    const { correlation, weightAnalysis } = await asyncCorrelationAnalysis(
      snapshot.envData,
      snapshot.sleepStages,
      correlationMethod(),
      5000
    )

    const score = overallSleepScore(correlation, snapshot.envData)

    const result: AnalysisResult = {
      id: generateId(),
      snapshotId,
      timestamp: Date.now(),
      correlationMatrix: correlation,
      weightAnalysis,
      overallScore: score,
    }

    await saveAnalysisResult(result)
    setAnalysisResult(result)

    return result
  } finally {
    setIsAnalyzing(false)
  }
}

async function runTimeShiftAnalysis(snapshotId: string): Promise<void> {
  const snapshot = await getSleepSnapshot(snapshotId)
  if (!snapshot) return

  const results = timeShiftAnalysis(snapshot.envData, snapshot.sleepStages, 30, 5)
  setTimeShiftData(results)
}

function clearAnalysis(): void {
  setAnalysisResult(null)
  setTimeShiftData([])
}

export function useAnalysis() {
  return {
    analysisResult,
    isAnalyzing,
    correlationMethod,
    timeShiftData,
    runAnalysis,
    runTimeShiftAnalysis,
    setCorrelationMethod,
    clearAnalysis,
  }
}

export {
  analysisResult,
  isAnalyzing,
  correlationMethod,
  timeShiftData,
  runAnalysis,
  runTimeShiftAnalysis,
  setCorrelationMethod,
  clearAnalysis,
}
