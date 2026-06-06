import { Component } from 'solid-js';
import { cn } from '@/lib/utils';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  class?: string;
}

export const Toggle: Component<ToggleProps> = (props) => {
  return (
    <label class={cn(
      'inline-flex items-center gap-3 cursor-pointer',
      props.disabled && 'opacity-50 cursor-not-allowed',
      props.class
    )}>
      <div class="relative">
        <input
          type="checkbox"
          class="sr-only peer"
          checked={props.checked}
          onChange={(e) => !props.disabled && props.onChange(e.target.checked)}
          disabled={props.disabled}
        />
        <div class={cn(
          'w-11 h-6 rounded-full transition-all duration-300',
          'bg-midnight-700 peer-checked:bg-moon-500',
          'peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-moon-500/50'
        )} />
        <div class={cn(
          'absolute left-0.5 top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-300',
          'peer-checked:translate-x-5',
          'flex items-center justify-center'
        )}>
          <div class={cn(
            'w-2 h-2 rounded-full transition-colors duration-300',
            props.checked ? 'bg-moon-500' : 'bg-midnight-400'
          )} />
        </div>
      </div>
      {props.label && (
        <span class="text-sm text-midnight-200 select-none">{props.label}</span>
      )}
    </label>
  );
};
