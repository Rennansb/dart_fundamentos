import React from 'react';
import { cn } from '../../utils/cn';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'error' | 'info' | 'default';
}

export function Badge({ children, className, variant = 'default', ...props }: BadgeProps) {
  const variants = {
    success: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20',
    warning: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20',
    error: 'bg-rose-50 text-rose-600 dark:bg-rose-900/20',
    info: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20',
    default: 'bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  };

  return (
    <span 
      className={cn("inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider", variants[variant], className)} 
      {...props}
    >
      {children}
    </span>
  );
}
