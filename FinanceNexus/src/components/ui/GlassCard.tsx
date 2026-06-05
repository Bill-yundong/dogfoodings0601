import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  glow?: boolean;
  delay?: number;
}

export function GlassCard({ children, className, hover = false, glow = false, delay = 0 }: GlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className={cn(
        glow ? 'glow-border' : '',
        hover ? 'glass-card-hover' : 'glass-card',
        'rounded-2xl p-6',
        className
      )}
    >
      {children}
    </motion.div>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  trend?: number;
  delay?: number;
}

export function StatCard({ title, value, subtitle, icon, trend, delay = 0 }: StatCardProps) {
  const isPositive = trend && trend >= 0;

  return (
    <GlassCard hover delay={delay} className="relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 opacity-10">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-transparent rounded-full transform translate-x-16 -translate-y-16" />
      </div>
      
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div className="p-3 rounded-xl bg-primary-100/50">
            {icon}
          </div>
          {trend !== undefined && (
            <div className={cn(
              'flex items-center gap-1 text-sm font-medium px-2 py-1 rounded-lg',
              isPositive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
            )}>
              <span>{isPositive ? '↑' : '↓'}</span>
              <span>{Math.abs(trend).toFixed(1)}%</span>
            </div>
          )}
        </div>
        
        <h3 className="text-primary-400 text-sm font-medium mb-1">{title}</h3>
        <p className="text-2xl font-display font-bold text-white">{value}</p>
        {subtitle && (
          <p className="text-xs text-primary-400 mt-2">{subtitle}</p>
        )}
      </div>
    </GlassCard>
  );
}
