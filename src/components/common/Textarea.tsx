import React, { forwardRef } from 'react';
import { twMerge } from 'tailwind-merge';
import logger from '@/services/client-logger';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  fullWidth?: boolean;
  helperText?: string;
  rows?: number;
  maxLength?: number;
  showCharacterCount?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({
  label,
  error,
  fullWidth = false,
  helperText,
  className,
  id,
  rows = 4,
  maxLength,
  showCharacterCount = false,
  value = '',
  ...props
}, ref) => {
  const textareaId = id || label?.toLowerCase().replace(/\s+/g, '-');
  const characterCount = String(value).length;

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    try {
      if (props.onChange) {
        props.onChange(e);
      }
    } catch (error) {
      logger.error('Textarea change error', error instanceof Error ? error : new Error(String(error)));
    }
  };

  return (
    <div className={twMerge('flex flex-col', fullWidth ? 'w-full' : '', className)}>
      <div className="flex justify-between items-center mb-1">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-sm font-medium text-gray-700"
          >
            {label}
          </label>
        )}
        {showCharacterCount && maxLength && (
          <span className="text-sm text-gray-500">
            {characterCount}/{maxLength}
          </span>
        )}
      </div>
      <textarea
        ref={ref}
        id={textareaId}
        rows={rows}
        maxLength={maxLength}
        value={value}
        className={twMerge(
          'block w-full px-3 py-2 border rounded-md shadow-sm resize-y',
          'placeholder-gray-400 focus:outline-none sm:text-sm',
          error
            ? 'border-red-300 text-red-900 focus:ring-red-500 focus:border-red-500'
            : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500',
          fullWidth ? 'w-full' : '',
          props.disabled ? 'bg-gray-100 cursor-not-allowed' : ''
        )}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${textareaId}-error` : helperText ? `${textareaId}-description` : undefined}
        onChange={handleChange}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-red-600" id={`${textareaId}-error`}>
          {error}
        </p>
      )}
      {helperText && !error && (
        <p className="mt-1 text-sm text-gray-500" id={`${textareaId}-description`}>
          {helperText}
        </p>
      )}
    </div>
  );
});

Textarea.displayName = 'Textarea';

export default Textarea; 