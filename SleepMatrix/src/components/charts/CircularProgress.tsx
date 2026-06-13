import { onMount, createEffect } from 'solid-js'

interface Props {
  value: number
  max?: number
  size?: number
  strokeWidth?: number
  color?: string
  label?: string
  sublabel?: string
}

export default function CircularProgress(props: Props) {
  let canvasRef: HTMLCanvasElement | undefined

  const draw = () => {
    const canvas = canvasRef
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const size = props.size || 120

    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)

    ctx.clearRect(0, 0, size, size)

    const centerX = size / 2
    const centerY = size / 2
    const radius = size / 2 - (props.strokeWidth || 8)
    const strokeWidth = props.strokeWidth || 8

    const max = props.max || 100
    const percentage = Math.min(1, Math.max(0, props.value / max))

    ctx.beginPath()
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
    ctx.lineWidth = strokeWidth
    ctx.stroke()

    const gradient = ctx.createLinearGradient(0, 0, size, size)
    const color = props.color || '#6366F1'
    gradient.addColorStop(0, color)
    gradient.addColorStop(1, '#06B6D4')

    ctx.beginPath()
    ctx.arc(
      centerX,
      centerY,
      radius,
      -Math.PI / 2,
      -Math.PI / 2 + percentage * Math.PI * 2
    )
    ctx.strokeStyle = gradient
    ctx.lineWidth = strokeWidth
    ctx.lineCap = 'round'
    ctx.shadowColor = color + '40'
    ctx.shadowBlur = 15
    ctx.stroke()
    ctx.shadowBlur = 0

    ctx.fillStyle = '#fff'
    ctx.font = 'bold 20px JetBrains Mono, monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(props.value.toFixed(0), centerX, centerY - 6)

    if (props.label) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
      ctx.font = '10px Sora, sans-serif'
      ctx.fillText(props.label, centerX, centerY + 12)
    }

    if (props.sublabel) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
      ctx.font = '9px Sora, sans-serif'
      ctx.fillText(props.sublabel, centerX, centerY + 26)
    }
  }

  onMount(() => {
    draw()
  })

  createEffect(() => {
    props.value
    requestAnimationFrame(draw)
  })

  return (
    <canvas
      ref={canvasRef}
      style={{ width: `${props.size || 120}px`, height: `${props.size || 120}px` }}
    />
  )
}
