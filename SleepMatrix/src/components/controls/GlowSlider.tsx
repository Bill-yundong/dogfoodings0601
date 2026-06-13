interface Props {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  unit?: string
  color?: string
  onChange?: (value: number) => void
  disabled?: boolean
}

export default function GlowSlider(props: Props) {
  const percentage = () => {
    const min = props.min ?? 0
    const max = props.max ?? 100
    return ((props.value - min) / (max - min)) * 100
  }

  const handleInput = (e: Event) => {
    const target = e.target as HTMLInputElement
    props.onChange?.(parseFloat(target.value))
  }

  const color = props.color || '#6366F1'
  const trackStyle = `background: linear-gradient(90deg, ${color} 0%, ${color} ${percentage()}%, rgba(255,255,255,0.1) ${percentage()}%, rgba(255,255,255,0.1) 100%);`

  return (
    <div class="w-full">
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm text-slate-300">{props.label}</span>
        <span class="text-sm font-mono text-white">
          {props.value.toFixed(props.step && props.step < 1 ? 1 : 0)}
          {props.unit && <span class="text-slate-500 ml-1">{props.unit}</span>}
        </span>
      </div>
      <div class="relative h-2">
        <div
          class="absolute inset-0 h-2 rounded-full overflow-hidden"
          style={trackStyle}
        />
        <input
          type="range"
          min={props.min ?? 0}
          max={props.max ?? 100}
          step={props.step ?? 1}
          value={props.value}
          onInput={handleInput}
          disabled={props.disabled}
          class="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />
        <div
          class="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white pointer-events-none transition-all duration-150"
          style={`left: calc(${percentage()}% - 8px); box-shadow: 0 0 12px ${color};`}
        />
      </div>
    </div>
  )
}
