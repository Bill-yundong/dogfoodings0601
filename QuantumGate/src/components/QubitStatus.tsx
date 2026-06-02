import { Component } from 'solid-js';
import type { QubitState } from '@/types';

interface QubitStatusProps {
  qubit: QubitState;
  selected?: boolean;
  onClick?: () => void;
}

export const QubitStatus: Component<QubitStatusProps> = (props) => {
  const stateColors: Record<QubitState['state'], string> = {
    '|0⟩': 'bg-quantum-cyan',
    '|1⟩': 'bg-quantum-orange',
    '|+⟩': 'bg-quantum-green',
    '|-⟩': 'bg-quantum-purple',
    'superposition': 'bg-gradient-to-r from-quantum-cyan to-quantum-purple',
  };

  return (
    <div
      class={`
        relative p-3 rounded-lg cursor-pointer transition-all duration-300
        ${props.selected 
          ? 'bg-quantum-cyan/20 border border-quantum-cyan/50' 
          : 'bg-white/5 border border-white/10 hover:border-white/20'
        }
      `}
      onClick={props.onClick}
    >
      <div class="flex items-center justify-between mb-2">
        <span class="text-xs font-mono text-white/70">Qubit #{props.qubit.id}</span>
        <div class={`w-2 h-2 rounded-full ${stateColors[props.qubit.state]} ${props.qubit.coherence > 0.9 ? 'animate-pulse' : ''}`} />
      </div>
      
      <div class="text-2xl font-display font-bold text-white mb-2 text-center">
        {props.qubit.state}
      </div>

      <div class="space-y-2">
        <div class="flex justify-between text-xs font-mono">
          <span class="text-white/50">|0⟩</span>
          <span class="text-quantum-cyan">{(props.qubit.probability0 * 100).toFixed(1)}%</span>
        </div>
        <div class="h-1 bg-white/10 rounded-full overflow-hidden">
          <div 
            class="h-full bg-quantum-cyan transition-all duration-500"
            style={{ width: `${props.qubit.probability0 * 100}%` }}
          />
        </div>

        <div class="flex justify-between text-xs font-mono">
          <span class="text-white/50">|1⟩</span>
          <span class="text-quantum-orange">{(props.qubit.probability1 * 100).toFixed(1)}%</span>
        </div>
        <div class="h-1 bg-white/10 rounded-full overflow-hidden">
          <div 
            class="h-full bg-quantum-orange transition-all duration-500"
            style={{ width: `${props.qubit.probability1 * 100}%` }}
          />
        </div>
      </div>

      <div class="mt-3 pt-2 border-t border-white/10">
        <div class="flex justify-between text-xs font-mono">
          <span class="text-white/50">相干性</span>
          <span class={props.qubit.coherence > 0.9 ? 'text-quantum-green' : 'text-quantum-orange'}>
            {(props.qubit.coherence * 100).toFixed(1)}%
          </span>
        </div>
        <div class="flex justify-between text-xs font-mono mt-1">
          <span class="text-white/50">温度</span>
          <span class="text-white/70">{(props.qubit.temperature * 1000).toFixed(2)} mK</span>
        </div>
      </div>
    </div>
  );
};
