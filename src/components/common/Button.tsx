import React from 'react';
import { twMerge } from 'tailwind-merge';
import logger from '@/services/client-logger';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
}

const variantStyles = {
  primary: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500',
  secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-900 focus:ring-gray-500',
  danger: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500'
};

const sizeStyles = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-lg'
};

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled,
  className,
  onClick,
  ...props
}) => {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    try {
      if (!loading && !disabled && onClick) {
        onClick(e);
      }
    } catch (error) {
      logger.error('Button click error', error instanceof Error ? error : new Error(String(error)));
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading || disabled}
      className={twMerge(
        'relative inline-flex items-center justify-center font-medium rounded-md',
        'focus:outline-none focus:ring-2 focus:ring-offset-2',
        'transition-colors duration-200 ease-in-out',
        variantStyles[variant],
        sizeStyles[size],
        fullWidth ? 'w-full' : '',
        (loading || disabled) ? 'opacity-50 cursor-not-allowed' : '',
        className
      )}
      {...props}
    >
      {loading ? (
        <>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current" />
          </div>
          <span className="opacity-0">{children}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
};

export default Button; 