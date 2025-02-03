import React, { forwardRef } from 'react';
import { twMerge } from 'tailwind-merge';
import logger from '@/services/client-logger';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
  helperText?: string;
  indeterminate?: boolean;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(({
  label,
  error,
  helperText,
  className,
  id,
  indeterminate = false,
  ...props
}, ref) => {
  const checkboxId = id || label?.toLowerCase().replace(/\s+/g, '-');

  React.useEffect(() => {
    if (ref && 'current' in ref && ref.current) {
      ref.current.indeterminate = indeterminate;
    }
  }, [ref, indeterminate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (props.onChange) {
        props.onChange(e);
      }
    } catch (error) {
      logger.error('Checkbox change error', error instanceof Error ? error : new Error(String(error)));
    }
  };

  return (
    <div className={twMerge('flex flex-col', className)}>
      <div className="flex items-start">
        <div className="flex items-center h-5">
          <input
            ref={ref}
            type="checkbox"
            id={checkboxId}
            className={twMerge(
              'h-4 w-4 rounded border-gray-300 text-blue-600',
              'focus:ring-blue-500 focus:outline-none',
              error ? 'border-red-300' : '',
              props.disabled ? 'bg-gray-100 cursor-not-allowed' : ''
            )}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={error ? `${checkboxId}-error` : helperText ? `${checkboxId}-description` : undefined}
            onChange={handleChange}
            {...props}
          />
        </div>
        {label && (
          <div className="ml-3 text-sm">
            <label
              htmlFor={checkboxId}
              className={twMerge(
                'font-medium',
                error ? 'text-red-900' : 'text-gray-700',
                props.disabled ? 'text-gray-500' : ''
              )}
            >
              {label}
            </label>
          </div>
        )}
      </div>
      {error && (
        <p className="mt-1 text-sm text-red-600" id={`${checkboxId}-error`}>
          {error}
        </p>
      )}
      {helperText && !error && (
        <p className="mt-1 text-sm text-gray-500" id={`${checkboxId}-description`}>
          {helperText}
        </p>
      )}
    </div>
  );
});

Checkbox.displayName = 'Checkbox';

export default Checkbox; 