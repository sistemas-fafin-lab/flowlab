import React from 'react';

// Skeleton base components
const SkeletonPulse: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${className}`} />
);

// Card Skeleton for stats/summary cards
export const SkeletonCard: React.FC = () => (
  <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm animate-pulse">
    <div className="flex items-center gap-3">
      <div className="w-11 h-11 bg-gray-200 dark:bg-gray-700 rounded-xl" />
      <div className="flex-1 space-y-2">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-12" />
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20" />
      </div>
    </div>
  </div>
);

// List item skeleton for request/product cards
export const SkeletonListItem: React.FC = () => (
  <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-6 animate-pulse">
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
      <div className="flex items-center">
        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-200 dark:bg-gray-700 rounded-xl mr-3" />
        <div className="space-y-2">
          <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-28" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-full w-16" />
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-full w-20" />
      </div>
    </div>
    <div className="space-y-3">
      <div className="flex gap-4">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32" />
      </div>
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
    </div>
    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
      <div className="flex gap-2">
        <div className="h-9 bg-gray-200 dark:bg-gray-700 rounded-lg w-24" />
        <div className="h-9 bg-gray-200 dark:bg-gray-700 rounded-lg w-24" />
      </div>
    </div>
  </div>
);

// Table row skeleton
export const SkeletonTableRow: React.FC<{ columns?: number }> = ({ columns = 6 }) => (
  <tr className="animate-pulse">
    {Array.from({ length: columns }).map((_, i) => (
      <td key={i} className="px-4 py-3">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full max-w-[120px]" />
      </td>
    ))}
  </tr>
);

// Filter bar skeleton
export const SkeletonFilters: React.FC = () => (
  <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 animate-pulse">
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-xl" />
      <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-xl" />
      <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-xl" />
      <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-xl" />
    </div>
  </div>
);

// Full page loading skeleton for request management
export const RequestManagementSkeleton: React.FC = () => (
  <div className="space-y-6 animate-fade-in">
    {/* Header */}
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div className="space-y-2">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64 animate-pulse" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-80 animate-pulse" />
      </div>
      <div className="flex gap-3">
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-xl w-28 animate-pulse" />
        <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-xl w-40 animate-pulse" />
      </div>
    </div>

    {/* Stats Cards */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>

    {/* Filters */}
    <SkeletonFilters />

    {/* List Items */}
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <SkeletonListItem key={i} />
      ))}
    </div>
  </div>
);

// Full page loading skeleton for product list
export const ProductListSkeleton: React.FC = () => (
  <div className="space-y-6 animate-fade-in">
    {/* Header */}
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div className="space-y-2">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48 animate-pulse" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-64 animate-pulse" />
      </div>
      <div className="flex gap-3">
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-xl w-32 animate-pulse" />
      </div>
    </div>

    {/* Filters */}
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 animate-pulse">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 h-10 bg-gray-200 dark:bg-gray-700 rounded-xl" />
        <div className="w-32 h-10 bg-gray-200 dark:bg-gray-700 rounded-xl" />
        <div className="w-32 h-10 bg-gray-200 dark:bg-gray-700 rounded-xl" />
      </div>
    </div>

    {/* Product Grid */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 animate-pulse">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-xl" />
              <div className="space-y-2">
                <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-32" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20" />
              </div>
            </div>
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-full w-16" />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-12" />
            </div>
            <div className="flex justify-between">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16" />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex gap-2">
            <div className="h-9 bg-gray-200 dark:bg-gray-700 rounded-lg flex-1" />
            <div className="h-9 bg-gray-200 dark:bg-gray-700 rounded-lg w-9" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

// Full page loading skeleton for movement history
export const MovementHistorySkeleton: React.FC = () => (
  <div className="space-y-6 animate-fade-in">
    {/* Header */}
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div className="space-y-2">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-56 animate-pulse" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-72 animate-pulse" />
      </div>
    </div>

    {/* Stats Cards */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>

    {/* Filters */}
    <SkeletonFilters />

    {/* Table */}
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900/50">
              {['Data', 'Produto', 'Quantidade', 'Motivo', 'Responsável', 'Observações'].map((_, i) => (
                <th key={i} className="px-4 py-3 text-left">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20 animate-pulse" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {[...Array(5)].map((_, i) => (
              <SkeletonTableRow key={i} columns={6} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

// Full page loading skeleton for payment requests
export const PaymentRequestSkeleton: React.FC = () => (
  <div className="space-y-6 animate-fade-in">
    {/* Header */}
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div className="space-y-2">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64 animate-pulse" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-80 animate-pulse" />
      </div>
      <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-xl w-44 animate-pulse" />
    </div>

    {/* Stats Cards */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>

    {/* Filters */}
    <SkeletonFilters />

    {/* List Items */}
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <SkeletonListItem key={i} />
      ))}
    </div>
  </div>
);

// Generic loading spinner overlay
export const LoadingSpinner: React.FC<{ message?: string }> = ({ message = 'Carregando...' }) => (
  <div className="flex flex-col items-center justify-center py-12">
    <div className="relative">
      <div className="w-12 h-12 rounded-full border-4 border-gray-200 dark:border-gray-700" />
      <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-transparent border-t-blue-500 animate-spin" />
    </div>
    <p className="mt-4 text-gray-500 dark:text-gray-400 text-sm font-medium">{message}</p>
  </div>
);

// Supplier card skeleton
export const SkeletonSupplierCard: React.FC = () => (
  <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 animate-pulse">
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-xl" />
        <div className="space-y-2">
          <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-36" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-28" />
        </div>
      </div>
      <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-full w-16" />
    </div>
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-40" />
      </div>
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32" />
      </div>
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-44" />
      </div>
    </div>
    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex gap-2">
      <div className="h-9 bg-gray-200 dark:bg-gray-700 rounded-lg flex-1" />
      <div className="h-9 bg-gray-200 dark:bg-gray-700 rounded-lg w-9" />
    </div>
  </div>
);

// Full page loading skeleton for supplier management
export const SupplierManagementSkeleton: React.FC = () => (
  <div className="space-y-6 animate-fade-in">
    {/* Header */}
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div className="space-y-2">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-56 animate-pulse" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-64 animate-pulse" />
      </div>
      <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-xl w-44 animate-pulse" />
    </div>

    {/* Supplier Grid */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[...Array(6)].map((_, i) => (
        <SkeletonSupplierCard key={i} />
      ))}
    </div>
  </div>
);

// Full page loading skeleton for expiration monitor
export const ExpirationMonitorSkeleton: React.FC = () => (
  <div className="space-y-6 animate-fade-in">
    {/* Header */}
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div className="space-y-2">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64 animate-pulse" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-80 animate-pulse" />
      </div>
    </div>

    {/* Stats Cards */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>

    {/* Filters */}
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 animate-pulse">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="w-40 h-10 bg-gray-200 dark:bg-gray-700 rounded-xl" />
        <div className="w-40 h-10 bg-gray-200 dark:bg-gray-700 rounded-xl" />
      </div>
    </div>

    {/* Products List */}
    <div className="space-y-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-xl" />
              <div className="space-y-2">
                <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-40" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24" />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-full w-24" />
              <div className="h-9 bg-gray-200 dark:bg-gray-700 rounded-lg w-24" />
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// Default export with all variants
const PageLoadingSkeleton = {
  RequestManagement: RequestManagementSkeleton,
  ProductList: ProductListSkeleton,
  MovementHistory: MovementHistorySkeleton,
  PaymentRequest: PaymentRequestSkeleton,
  SupplierManagement: SupplierManagementSkeleton,
  ExpirationMonitor: ExpirationMonitorSkeleton,
  Card: SkeletonCard,
  ListItem: SkeletonListItem,
  TableRow: SkeletonTableRow,
  Filters: SkeletonFilters,
  Spinner: LoadingSpinner
};

export default PageLoadingSkeleton;
