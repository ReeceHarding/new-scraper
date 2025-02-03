import React from 'react';
import { twMerge } from 'tailwind-merge';

export interface LoadingProps {
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
  text?: string;
  className?: string;
}

const sizeStyles = {
  sm: 'h-4 w-4',
  md: 'h-8 w-8',
  lg: 'h-12 w-12'
};

const textSizeStyles = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg'
};

export const Loading: React.FC<LoadingProps> = ({
  size = 'md',
  fullScreen = false,
  text,
  className
}) => {
  const content = (
    <div className="flex flex-col items-center justify-center">
      <div
        className={twMerge(
          'animate-spin rounded-full border-b-2 border-current',
          sizeStyles[size],
          className
        )}
      />
      {text && (
        <p className={twMerge('mt-2 text-gray-600', textSizeStyles[size])}>
          {text}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white bg-opacity-90">
        {content}
      </div>
    );
  }

  return content;
};

export default Loading; 