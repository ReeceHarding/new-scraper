import React, { forwardRef } from 'react';
import { twMerge } from 'tailwind-merge';
import logger from '@/services/client-logger';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'value'> {
  label?: string;
  error?: string;
  fullWidth?: boolean;
  helperText?: string;
  options: SelectOption[];
  value?: string | string[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({
  label,
  error,
  fullWidth = false,
  helperText,
  options,
  className,
  id,
  value,
  placeholder,
  multiple,
  ...props
}, ref) => {
  const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    try {
      if (props.onChange) {
        props.onChange(e);
      }
    } catch (error) {
      logger.error('Select change error', error instanceof Error ? error : new Error(String(error)));
    }
  };

  return (
    <div className={twMerge('flex flex-col', fullWidth ? 'w-full' : '', className)}>
      {label && (
        <label
          htmlFor={selectId}
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={selectId}
        className={twMerge(
          'block w-full px-3 py-2 border rounded-md shadow-sm',
          'focus:outline-none sm:text-sm appearance-none',
          error
            ? 'border-red-300 text-red-900 focus:ring-red-500 focus:border-red-500'
            : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500',
          fullWidth ? 'w-full' : '',
          props.disabled ? 'bg-gray-100 cursor-not-allowed' : ''
        )}
        value={value}
        multiple={multiple}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${selectId}-error` : helperText ? `${selectId}-description` : undefined}
        onChange={handleChange}
        {...props}
      >
        {placeholder && !multiple && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="mt-1 text-sm text-red-600" id={`${selectId}-error`}>
          {error}
        </p>
      )}
      {helperText && !error && (
        <p className="mt-1 text-sm text-gray-500" id={`${selectId}-description`}>
          {helperText}
        </p>
      )}
      {multiple && (
        <p className="mt-1 text-xs text-gray-500">
          Hold Ctrl (Windows) or Command (Mac) to select multiple options
        </p>
      )}
    </div>
  );
});

Select.displayName = 'Select';

export default Select; 