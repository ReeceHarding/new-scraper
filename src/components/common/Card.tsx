import React from 'react';
import { twMerge } from 'tailwind-merge';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  footer?: React.ReactNode;
  noPadding?: boolean;
  variant?: 'default' | 'outlined' | 'elevated';
}

const variantStyles = {
  default: 'bg-white',
  outlined: 'bg-white border border-gray-200',
  elevated: 'bg-white shadow-md'
};

export const Card: React.FC<CardProps> = ({
  children,
  title,
  subtitle,
  footer,
  noPadding = false,
  variant = 'default',
  className,
  ...props
}) => {
  return (
    <div
      className={twMerge(
        'rounded-lg overflow-hidden',
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {(title || subtitle) && (
        <div className="px-6 py-4 border-b border-gray-200">
          {title && (
            <h3 className="text-lg font-medium leading-6 text-gray-900">
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="mt-1 text-sm text-gray-500">
              {subtitle}
            </p>
          )}
        </div>
      )}
      <div className={noPadding ? '' : 'p-6'}>
        {children}
      </div>
      {footer && (
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          {footer}
        </div>
      )}
    </div>
  );
};

export default Card; 