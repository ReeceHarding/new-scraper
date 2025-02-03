import React from 'react';
import { twMerge } from 'tailwind-merge';
import logger from '@/services/client-logger';

export interface FormChildrenProps {
  values: Record<string, any>;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  isSubmitting: boolean;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  handleBlur: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  setFieldValue: (name: string, value: any) => void;
  setFieldError: (name: string, error: string) => void;
}

type FormPropsWithoutChildren = Omit<React.FormHTMLAttributes<HTMLFormElement>, 'children' | 'onSubmit'> & {
  onSubmit: (data: Record<string, any>) => void | Promise<void>;
  onError?: (errors: Record<string, string>) => void;
  validate?: (data: Record<string, any>) => Record<string, string> | Promise<Record<string, string>>;
  defaultValues?: Record<string, any>;
};

export interface FormProps extends FormPropsWithoutChildren {
  children: React.ReactNode | ((props: FormChildrenProps) => React.ReactNode);
}

export const Form: React.FC<FormProps> = ({
  onSubmit,
  onError,
  validate,
  defaultValues = {},
  children,
  className,
  ...props
}) => {
  const [values, setValues] = React.useState<Record<string, any>>(defaultValues);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [touched, setTouched] = React.useState<Record<string, boolean>>({});

  const handleChange = React.useCallback((
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, type, value } = e.target;
    let newValue: any = value;

    if (type === 'checkbox') {
      newValue = (e.target as HTMLInputElement).checked;
    } else if (type === 'number') {
      newValue = value === '' ? '' : Number(value);
    }

    setValues((prev) => ({ ...prev, [name]: newValue }));
  }, []);

  const handleBlur = React.useCallback((
    e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
  }, []);

  const setFieldValue = React.useCallback((name: string, value: any) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  const setFieldError = React.useCallback((name: string, error: string) => {
    setErrors((prev) => ({ ...prev, [name]: error }));
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      let validationErrors: Record<string, string> = {};
      
      if (validate) {
        validationErrors = await validate(values);
      }

      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        onError?.(validationErrors);
        return;
      }

      await onSubmit(values);
      setErrors({});
    } catch (error) {
      logger.error('Form submission error', error instanceof Error ? error : new Error(String(error)));
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      setErrors({ submit: errorMessage });
      onError?.({ submit: errorMessage });
    } finally {
      setIsSubmitting(false);
    }
  };

  const childrenProps: FormChildrenProps = {
    values,
    errors,
    touched,
    isSubmitting,
    handleChange,
    handleBlur,
    setFieldValue,
    setFieldError,
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={twMerge('space-y-4', className)}
      noValidate
      {...props}
    >
      {typeof children === 'function' ? children(childrenProps) : children}
      {errors.submit && (
        <div className="text-sm text-red-600 mt-2" role="alert">
          {errors.submit}
        </div>
      )}
    </form>
  );
};

export default Form; 