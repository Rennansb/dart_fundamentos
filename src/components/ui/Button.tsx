import React from 'react';
import { cn } from '../../utils/cn';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({ 
  children, 
  className, 
  variant = 'primary', 
  size = 'md', 
  ...props 
}: ButtonProps) {
  const baseStyle = "inline-flex items-center justify-center font-bold transition-all rounded-2xl";
  
  const variants = {
    primary: "bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none hover:bg-indigo-700",
    secondary: "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700",
    danger: "bg-rose-50 text-rose-600 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/40",
    ghost: "text-gray-500 hover:text-gray-900 dark:hover:text-white bg-transparent hover:bg-gray-50 dark:hover:bg-gray-800"
  };

  const sizes = {
    sm: "px-4 py-2 text-xs",
    md: "px-6 py-3 text-sm",
    lg: "px-8 py-4 text-base"
  };

  return (
    <button 
      className={cn(baseStyle, variants[variant], sizes[size], className)} 
      {...props}
    >
      {children}
    </button>
  );
}
