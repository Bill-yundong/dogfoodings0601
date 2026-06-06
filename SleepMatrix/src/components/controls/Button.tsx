import { Component, ParentProps, JSX } from 'solid-js';
import { cn } from '@/lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ParentProps<JSX.ButtonHTMLAttributes<HTMLButtonElement>> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: Component<{ class?: string }>;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-moon-500 hover:bg-moon-600 text-white shadow-lg shadow-moon-500/25',
  secondary: 'bg-midnight-700 hover:bg-midnight-600 text-white border border-midnight-600',
  success: 'bg-mint-500 hover:bg-mint-600 text-white shadow-lg shadow-mint-500/25',
  danger: 'bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/25',
  ghost: 'bg-transparent hover:bg-midnight-700/50 text-midnight-300 hover:text-white',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2.5 text-sm gap-2',
  lg: 'px-6 py-3.5 text-base gap-2.5',
};

export const Button: Component<ButtonProps> = (props) => {
  const { variant = 'primary', size = 'md', loading, icon: Icon, class: className, children, ...rest } = props;

  return (
    <button
      class={cn(
        'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-moon-500/50 focus:ring-offset-2 focus:ring-offset-midnight-900',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none',
        'hover:scale-[1.02] active:scale-[0.98]',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading && (
        <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      {!loading && Icon && <Icon class="w-4 h-4" />}
      {children}
    </button>
  );
};
