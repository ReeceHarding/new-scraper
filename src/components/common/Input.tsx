import React, { forwardRef } from 'react';
import { twMerge } from 'tailwind-merge';
import logger from '@/services/client-logger';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  fullWidth?: boolean;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  fullWidth = false,
  helperText,
  className,
  id,
  ...props
}, ref) => {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (props.onChange) {
        props.onChange(e);
      }
    } catch (error) {
      logger.error('Input change error', error instanceof Error ? error : new Error(String(error)));
    }
  };

  return (
    <div className={twMerge('flex flex-col', fullWidth ? 'w-full' : '', className)}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={twMerge(
          'appearance-none block px-3 py-2 border rounded-md shadow-sm',
          'placeholder-gray-400 focus:outline-none sm:text-sm',
          error
            ? 'border-red-300 text-red-900 focus:ring-red-500 focus:border-red-500'
            : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500',
          fullWidth ? 'w-full' : '',
          props.disabled ? 'bg-gray-100 cursor-not-allowed' : ''
        )}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-description` : undefined}
        onChange={handleChange}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-red-600" id={`${inputId}-error`}>
          {error}
        </p>
      )}
      {helperText && !error && (
        <p className="mt-1 text-sm text-gray-500" id={`${inputId}-description`}>
          {helperText}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input; 