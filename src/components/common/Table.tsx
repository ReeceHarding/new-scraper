import React, { useState } from 'react';
import { twMerge } from 'tailwind-merge';
import logger from '@/services/client-logger';

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
}

export interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string | number;
  onSort?: (key: string, direction: 'asc' | 'desc') => void;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
  rowClassName?: string;
  onRowClick?: (item: T) => void;
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  onSort,
  sortColumn,
  sortDirection,
  loading = false,
  emptyMessage = 'No data available',
  className,
  rowClassName,
  onRowClick
}: TableProps<T>) {
  const [hoveredRow, setHoveredRow] = useState<string | number | null>(null);

  const handleSort = (column: Column<T>) => {
    try {
      if (column.sortable && onSort) {
        const newDirection = sortColumn === column.key && sortDirection === 'asc' ? 'desc' : 'asc';
        onSort(column.key, newDirection);
      }
    } catch (error) {
      logger.error('Table sort error', error instanceof Error ? error : new Error(String(error)));
    }
  };

  const handleRowClick = (item: T) => {
    try {
      if (onRowClick) {
        onRowClick(item);
      }
    } catch (error) {
      logger.error('Table row click error', error instanceof Error ? error : new Error(String(error)));
    }
  };

  return (
    <div className={twMerge('overflow-x-auto', className)}>
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={twMerge(
                  'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider',
                  column.sortable ? 'cursor-pointer hover:text-gray-700' : '',
                  column.width
                )}
                onClick={() => column.sortable && handleSort(column)}
              >
                <div className="flex items-center space-x-1">
                  <span>{column.header}</span>
                  {column.sortable && sortColumn === column.key && (
                    <span className="ml-2">
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {loading ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center"
              >
                <div className="flex justify-center items-center space-x-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900" />
                  <span>Loading...</span>
                </div>
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((item) => {
              const key = keyExtractor(item);
              return (
                <tr
                  key={key}
                  className={twMerge(
                    'transition-colors duration-150',
                    hoveredRow === key ? 'bg-gray-50' : '',
                    onRowClick ? 'cursor-pointer hover:bg-gray-50' : '',
                    rowClassName
                  )}
                  onMouseEnter={() => setHoveredRow(key)}
                  onMouseLeave={() => setHoveredRow(null)}
                  onClick={() => handleRowClick(item)}
                >
                  {columns.map((column) => (
                    <td
                      key={`${key}-${column.key}`}
                      className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                    >
                      {column.render ? column.render(item) : (item as any)[column.key]}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

export default Table; 