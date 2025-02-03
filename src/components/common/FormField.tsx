import React from 'react';
import { twMerge } from 'tailwind-merge';

export interface FormFieldProps {
  name: string;
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  fullWidth?: boolean;
  className?: string;
  children: React.ReactElement<{
    id?: string;
    name?: string;
    'aria-invalid'?: boolean;
    'aria-describedby'?: string;
    required?: boolean;
    error?: boolean;
    fullWidth?: boolean;
  }>;
}

export const FormField: React.FC<FormFieldProps> = ({
  name,
  label,
  error,
  helperText,
  required,
  fullWidth = false,
  className,
  children
}) => {
  const fieldId = name;
  const isInvalid = Boolean(error);

  // Clone the child element to pass down props
  const field = React.cloneElement(children, {
    id: fieldId,
    name,
    'aria-invalid': isInvalid,
    'aria-describedby': isInvalid ? `${fieldId}-error` : helperText ? `${fieldId}-description` : undefined,
    required,
    error: isInvalid,
    fullWidth,
    ...children.props
  });

  return (
    <div className={twMerge('flex flex-col', fullWidth ? 'w-full' : '', className)}>
      {label && (
        <label
          htmlFor={fieldId}
          className={twMerge(
            'block text-sm font-medium mb-1',
            isInvalid ? 'text-red-700' : 'text-gray-700'
          )}
        >
          {label}
          {required && (
            <span className="text-red-500 ml-1" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      {field}
      {error && (
        <p className="mt-1 text-sm text-red-600" id={`${fieldId}-error`} role="alert">
          {error}
        </p>
      )}
      {helperText && !error && (
        <p className="mt-1 text-sm text-gray-500" id={`${fieldId}-description`}>
          {helperText}
        </p>
      )}
    </div>
  );
};

export default FormField; 