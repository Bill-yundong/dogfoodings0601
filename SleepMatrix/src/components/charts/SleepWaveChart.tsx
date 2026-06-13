import { onMount, createEffect, onCleanup } from 'solid-js'
import type { SleepStageData, SleepStageType } from '@/types'

interface Props {
  data: SleepStageData[]
  height?: number
}

const stageColors: Record<SleepStageType, string> = {
  wake: '#F59E0B',
  light: '#6366F1',
  deep: '#06B6D4',
  rem: '#EC4899',
}

const stageLabels: Record<SleepStageType, string> = {
  wake: '清醒',
  light: '浅睡',
  deep: '深睡',
  rem: 'REM',
}

export default function SleepWaveChart(props: Props) {
  let canvasRef: HTMLCanvasElement | undefined

  const draw = () => {
    const canvas = canvasRef
    if (!canvas || props.data.length < 2) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const height = props.height || 200
    const width = canvas.clientWidth

    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)

    ctx.clearRect(0, 0, width, height)

    const padding = { top: 20, right: 16, bottom: 30, left: 16 }
    const chartWidth = width - padding.left - padding.right
    const chartHeight = height - padding.top - padding.bottom

    const points = props.data.map((d, i) => ({
      x: padding.left + (i / (props.data.length - 1)) * chartWidth,
      y: padding.top + chartHeight - d.depthLevel * chartHeight,
      stage: d.stage,
    }))

    const stageOrder: SleepStageType[] = ['wake', 'light', 'deep', 'rem']
    stageOrder.forEach((stage, idx) => {
      const y = padding.top + chartHeight - (idx / 3) * chartHeight
      ctx.beginPath()
      ctx.moveTo(padding.left, y)
      ctx.lineTo(width - padding.right, y)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'
      ctx.lineWidth = 1
      ctx.stroke()

      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
      ctx.font = '10px Sora, sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(stageLabels[stage], padding.left, y - 4)
    })

    let currentStage = points[0].stage
    let segmentStart = 0

    for (let i = 1; i <= points.length; i++) {
      if (i === points.length || points[i].stage !== currentStage) {
        const segment = points.slice(segmentStart, i)
        if (segment.length > 1) {
          const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartHeight)
          const color = stageColors[currentStage]
          gradient.addColorStop(0, color + '30')
          gradient.addColorStop(1, color + '00')

          ctx.beginPath()
          ctx.moveTo(segment[0].x, padding.top + chartHeight)
          for (let j = 0; j < segment.length - 1; j++) {
            const p0 = segment[j]
            const p1 = segment[j + 1]
            const cpx = (p0.x + p1.x) / 2
            ctx.quadraticCurveTo(p0.x, p0.y, cpx, (p0.y + p1.y) / 2)
          }
          ctx.lineTo(segment[segment.length - 1].x, padding.top + chartHeight)
          ctx.closePath()
          ctx.fillStyle = gradient
          ctx.fill()
        }
        if (i < points.length) {
          currentStage = points[i].stage
          segmentStart = i
        }
      }
    }

    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i]
      const p1 = points[i + 1]
      const cpx = (p0.x + p1.x) / 2
      ctx.quadraticCurveTo(p0.x, p0.y, cpx, (p0.y + p1.y) / 2)
    }
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y)

    const lineGradient = ctx.createLinearGradient(0, 0, width, 0)
    lineGradient.addColorStop(0, '#6366F1')
    lineGradient.addColorStop(0.5, '#06B6D4')
    lineGradient.addColorStop(1, '#6366F1')

    ctx.strokeStyle = lineGradient
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.shadowColor = '#6366F140'
    ctx.shadowBlur = 10
    ctx.stroke()
    ctx.shadowBlur = 0

    const lastPoint = points[points.length - 1]
    ctx.beginPath()
    ctx.arc(lastPoint.x, lastPoint.y, 6, 0, Math.PI * 2)
    ctx.fillStyle = stageColors[lastPoint.stage]
    ctx.shadowColor = stageColors[lastPoint.stage]
    ctx.shadowBlur = 15
    ctx.fill()
    ctx.shadowBlur = 0

    ctx.beginPath()
    ctx.arc(lastPoint.x, lastPoint.y, 3, 0, Math.PI * 2)
    ctx.fillStyle = '#fff'
    ctx.fill()

    const timeLabels = ['开始', '现在']
    const timeX = [padding.left, width - padding.right]
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.font = '11px Sora, sans-serif'
    ctx.textAlign = 'center'
    timeLabels.forEach((label, i) => {
      ctx.fillText(label, timeX[i], height - 10)
    })
  }

  onMount(() => {
    draw()
    const resizeObserver = new ResizeObserver(draw)
    if (canvasRef) resizeObserver.observe(canvasRef)
    onCleanup(() => resizeObserver.disconnect())
  })

  createEffect(() => {
    props.data
    requestAnimationFrame(draw)
  })

  return (
    <div class="w-full">
      <canvas ref={canvasRef} class="w-full" style={{ height: `${props.height || 200}px` }} />
    </div>
  )
}
