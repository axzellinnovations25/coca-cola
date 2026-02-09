import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'purple' | 'gray' | 'white';
  text?: string;
  className?: string;
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
};

const colorClasses = {
  purple: 'border-purple-500 border-t-transparent',
  gray: 'border-gray-500 border-t-transparent',
  white: 'border-white border-t-transparent',
};

export default function LoadingSpinner({ 
  size = 'md', 
  color = 'purple', 
  text,
  className = '' 
}: LoadingSpinnerProps) {
  return (
    <div className={`flex items-center justify-center gap-3 ${className}`}>
      <div 
        className={`${sizeClasses[size]} border-2 rounded-full animate-spin ${colorClasses[color]}`}
        role="status"
        aria-label="Loading"
      />
      {text && (
        <span className="text-gray-600 font-medium">{text}</span>
      )}
    </div>
  );
}

// Optimized skeleton loader for better perceived performance
export function SkeletonLoader({ 
  lines = 3, 
  className = '' 
}: { 
  lines?: number; 
  className?: string; 
}) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div 
          key={i}
          className="h-4 bg-gray-200 rounded animate-pulse"
          style={{ 
            width: `${Math.max(60, 100 - (i * 10))}%` 
          }}
        />
      ))}
    </div>
  );
}

// Optimized table skeleton
export function TableSkeleton({ 
  rows = 5, 
  columns = 4 
}: { 
  rows?: number; 
  columns?: number; 
}) {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <div 
            key={i}
            className="h-6 bg-gray-200 rounded animate-pulse"
            style={{ width: `${100 / columns}%` }}
          />
        ))}
      </div>
      
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div 
              key={colIndex}
              className="h-4 bg-gray-100 rounded animate-pulse"
              style={{ width: `${100 / columns}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
} 