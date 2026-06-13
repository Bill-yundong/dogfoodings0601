import { onMount, createEffect, onCleanup } from 'solid-js'
import type { EnvironmentData } from '@/types'

interface Props {
  data: EnvironmentData[]
  type: 'light' | 'temperature' | 'noise' | 'humidity'
  height?: number
  color?: string
}

const colorMap: Record<string, string> = {
  light: '#F59E0B',
  temperature: '#EF4444',
  noise: '#8B5CF6',
  humidity: '#06B6D4',
}

const labelMap: Record<string, { label: string; unit: string }> = {
  light: { label: '光照', unit: 'lux' },
  temperature: { label: '温度', unit: '°C' },
  noise: { label: '噪音', unit: 'dB' },
  humidity: { label: '湿度', unit: '%' },
}

export default function MiniLineChart(props: Props) {
  let canvasRef: HTMLCanvasElement | undefined

  const getValue = (d: EnvironmentData) => {
    switch (props.type) {
      case 'light': return d.lightLevel
      case 'temperature': return d.temperature
      case 'noise': return d.noiseLevel
      case 'humidity': return d.humidity
    }
  }

  const draw = () => {
    const canvas = canvasRef
    if (!canvas || props.data.length < 2) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const height = props.height || 60
    const width = canvas.clientWidth

    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)

    ctx.clearRect(0, 0, width, height)

    const values = props.data.map(getValue)
    const minVal = Math.min(...values) * 0.9
    const maxVal = Math.max(...values) * 1.1
    const range = maxVal - minVal || 1

    const padding = 4
    const chartWidth = width - padding * 2
    const chartHeight = height - padding * 2

    const color = props.color || colorMap[props.type]

    const points = props.data.map((d, i) => {
      const x = padding + (i / (props.data.length - 1)) * chartWidth
      const y = padding + chartHeight - ((getValue(d) - minVal) / range) * chartHeight
      return { x, y }
    })

    const gradient = ctx.createLinearGradient(0, padding, 0, height - padding)
    gradient.addColorStop(0, color + '40')
    gradient.addColorStop(1, color + '00')

    ctx.beginPath()
    ctx.moveTo(points[0].x, height - padding)
    for (const p of points) {
      ctx.lineTo(p.x, p.y)
    }
    ctx.lineTo(points[points.length - 1].x, height - padding)
    ctx.closePath()
    ctx.fillStyle = gradient
    ctx.fill()

    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length; i++) {
      const p0 = points[i - 1]
      const p1 = points[i]
      const cpx = (p0.x + p1.x) / 2
      ctx.quadraticCurveTo(p0.x, p0.y, cpx, (p0.y + p1.y) / 2)
    }
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.stroke()

    const lastPoint = points[points.length - 1]
    ctx.beginPath()
    ctx.arc(lastPoint.x, lastPoint.y, 4, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
    ctx.shadowColor = color
    ctx.shadowBlur = 10
    ctx.fill()
    ctx.shadowBlur = 0
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
      <div class="flex items-center justify-between mb-1">
        <span class="text-xs text-slate-400">{labelMap[props.type].label}</span>
        <span class="text-xs font-mono text-white">
          {props.data.length > 0 ? getValue(props.data[props.data.length - 1]).toFixed(1) : '--'}
          <span class="text-slate-500 ml-1">{labelMap[props.type].unit}</span>
        </span>
      </div>
      <canvas ref={canvasRef} class="w-full" style={{ height: `${props.height || 60}px` }} />
    </div>
  )
}
