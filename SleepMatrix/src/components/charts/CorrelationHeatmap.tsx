import { onMount, createEffect } from 'solid-js'
import type { CorrelationResult } from '@/types'

interface Props {
  data: CorrelationResult
  size?: number
}

const labels = ['光照', '温度', '噪音', '湿度']

export default function CorrelationHeatmap(props: Props) {
  let canvasRef: HTMLCanvasElement | undefined

  const getCorrelation = (row: number, col: number): number => {
    if (row === col) return 1

    const depthCorrelations = [
      props.data.lightVsDepth,
      props.data.tempVsDepth,
      props.data.noiseVsDepth,
      props.data.humidityVsDepth,
    ]
    const envCorrelations: Record<string, number> = {
      '0-1': props.data.lightTemp,
      '0-2': props.data.lightNoise,
      '1-2': props.data.tempNoise,
    }

    if (row === 3 || col === 3) {
      return col === 3 ? depthCorrelations[row] : depthCorrelations[col]
    }

    const key = `${Math.min(row, col)}-${Math.max(row, col)}`
    return envCorrelations[key] || 0
  }

  const colorForValue = (value: number): string => {
    if (value >= 0) {
      const alpha = Math.min(1, Math.abs(value))
      return `rgba(239, 68, 68, ${0.2 + alpha * 0.7})`
    } else {
      const alpha = Math.min(1, Math.abs(value))
      return `rgba(6, 182, 212, ${0.2 + alpha * 0.7})`
    }
  }

  const draw = () => {
    const canvas = canvasRef
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const size = props.size || 280

    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)

    ctx.clearRect(0, 0, size, size)

    const padding = 50
    const cellSize = (size - padding * 2) / 4
    const gap = 2

    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        const x = padding + j * (cellSize + gap)
        const y = padding + i * (cellSize + gap)

        const value = getCorrelation(i, j)

        let color: string
        if (i === j) {
          color = 'rgba(99, 102, 241, 0.8)'
        } else {
          color = colorForValue(value)
        }

        const radius = 6
        ctx.beginPath()
        ctx.roundRect(x, y, cellSize, cellSize, radius)
        ctx.fillStyle = color
        ctx.fill()

        if (i === j) {
          ctx.fillStyle = '#fff'
          ctx.font = '11px Sora, sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(labels[i], x + cellSize / 2, y + cellSize / 2)
        } else {
          ctx.fillStyle = '#fff'
          ctx.font = 'bold 12px JetBrains Mono, monospace'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(value.toFixed(2), x + cellSize / 2, y + cellSize / 2)
        }
      }
    }

    for (let i = 0; i < 4; i++) {
      const x = padding + i * (cellSize + gap) + cellSize / 2
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
      ctx.font = '10px Sora, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(labels[i], x, padding - 10)
    }

    for (let i = 0; i < 4; i++) {
      const y = padding + i * (cellSize + gap) + cellSize / 2
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
      ctx.font = '10px Sora, sans-serif'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ctx.fillText(labels[i], padding - 10, y)
    }

    const legendY = size - 16
    const legendWidth = 100
    const legendHeight = 6
    const legendX = (size - legendWidth) / 2

    const gradient = ctx.createLinearGradient(legendX, 0, legendX + legendWidth, 0)
    gradient.addColorStop(0, 'rgba(6, 182, 212, 0.9)')
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.2)')
    gradient.addColorStop(1, 'rgba(239, 68, 68, 0.9)')

    ctx.beginPath()
    ctx.roundRect(legendX, legendY, legendWidth, legendHeight, 3)
    ctx.fillStyle = gradient
    ctx.fill()

    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.font = '9px Sora, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('-1', legendX - 14, legendY + 5)
    ctx.textAlign = 'right'
    ctx.fillText('+1', legendX + legendWidth + 14, legendY + 5)
  }

  onMount(() => {
    draw()
    const resizeObserver = new ResizeObserver(draw)
    if (canvasRef) resizeObserver.observe(canvasRef)
  })

  createEffect(() => {
    props.data
    requestAnimationFrame(draw)
  })

  return (
    <div class="w-full flex justify-center">
      <canvas ref={canvasRef} style={{ width: `${props.size || 280}px`, height: `${props.size || 280}px` }} />
    </div>
  )
}
