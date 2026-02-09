import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../../utils/api';

interface Shop {
  id: string;
  name: string;
  address: string;
  phone: string;
  max_bill_amount: number;
  current_outstanding: number;
  active_bills: number;
}

interface MyShopsProps {
  refreshKey?: number;
}

export default function MyShops({ refreshKey }: MyShopsProps) {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [outstandingFilter, setOutstandingFilter] = useState<'all' | 'outstanding' | 'clear'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'current_outstanding' | 'active_bills' | 'max_bill_amount'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const SHOPS_PER_PAGE = 10;

  const triggerRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  useEffect(() => {
    setLoading(true);
    setError('');
    apiFetch('/api/marudham/shops/assigned')
      .then(data => setShops(data.shops || []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [refreshTrigger, refreshKey]);

  // Filter and sort
  const filtered = shops.filter(shop => {
    const q = search.toLowerCase();
    const matchesSearch =
      shop.name.toLowerCase().includes(q) ||
      shop.address.toLowerCase().includes(q) ||
      shop.phone.toLowerCase().includes(q);
    const matchesOutstanding =
      outstandingFilter === 'all' ||
      (outstandingFilter === 'outstanding' && shop.current_outstanding > 0) ||
      (outstandingFilter === 'clear' && shop.current_outstanding === 0);
    return matchesSearch && matchesOutstanding;
  });
  const sorted = [...filtered].sort((a, b) => {
    let aVal: any = a[sortBy];
    let bVal: any = b[sortBy];
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    }
    return 0;
  });
  const totalPages = Math.ceil(sorted.length / SHOPS_PER_PAGE) || 1;
  const paginated = sorted.slice((page - 1) * SHOPS_PER_PAGE, page * SHOPS_PER_PAGE);

  function handleSort(col: typeof sortBy) {
    if (sortBy === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
    setPage(1);
  }

  return (
    <div className="space-y-6">
      {/* Enhanced Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">My Shops{shops.length ? ` (${shops.length})` : ''}</h2>
          <p className="text-gray-600 text-sm">Manage your assigned shops and track their performance</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-2 text-sm text-gray-500">
            <div className="w-3 h-3 bg-red-400 rounded-full"></div>
            <span>Outstanding</span>
            <div className="w-3 h-3 bg-green-400 rounded-full ml-4"></div>
            <span>Clear</span>
          </div>
        </div>
      </div>
      
      {/* Enhanced Main Content */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {/* Header Section */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Shop Management</h3>
              <p className="text-gray-600 text-sm">View and manage your assigned shops efficiently</p>
            </div>
            
            {/* Enhanced Search and Filter */}
            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              <div className="relative flex-1 sm:flex-initial">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search by name, address, or phone..."
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-transparent text-sm text-gray-900 bg-white focus:bg-white transition-colors"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                />
              </div>
              
              <select
                className="px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-transparent text-sm text-gray-900 bg-white focus:bg-white transition-colors"
                value={outstandingFilter}
                onChange={e => { setOutstandingFilter(e.target.value as any); setPage(1); }}
              >
                <option value="all" className="text-gray-900">All Shops</option>
                <option value="outstanding" className="text-gray-900">Outstanding Only</option>
                <option value="clear" className="text-gray-900">No Outstanding</option>
              </select>
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-gray-600 font-medium">Loading shops...</span>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-red-600 font-medium">{error}</p>
              </div>
            </div>
          ) : paginated.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <p className="text-gray-500 font-medium">No shops found</p>
              </div>
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="lg:hidden space-y-4">
                {paginated.map(shop => (
                  <div key={shop.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:bg-gray-100 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 truncate">{shop.name}</h4>
                        <p className="text-sm text-gray-600 truncate">{shop.address}</p>
                      </div>
                      <div className="text-right">
                        <div className={`font-semibold ${
                          shop.current_outstanding > 0 ? 'text-red-500' : 'text-green-500'
                        }`}>
                          {Number(shop.current_outstanding).toFixed(2)} LKR
                        </div>
                        <div className="text-sm text-gray-600">{shop.phone}</div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="bg-white rounded-lg p-3">
                        <div className="text-xs text-gray-500 mb-1">Active Bills</div>
                        <div className={`font-semibold ${
                          shop.active_bills > 0 ? 'text-orange-500' : 'text-green-500'
                        }`}>
                          {shop.active_bills}
                        </div>
                      </div>
                      <div className="bg-white rounded-lg p-3">
                        <div className="text-xs text-gray-500 mb-1">Max Bill</div>
                        <div className="font-semibold text-gray-900">
                          {Number(shop.max_bill_amount).toFixed(2)} LKR
                        </div>
                      </div>
                    </div>
                    
                    <button
                      className="w-full py-2 px-4 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg text-sm font-medium transition-colors"
                      onClick={() => setExpanded(expanded === shop.id ? null : shop.id)}
                    >
                      {expanded === shop.id ? 'Hide Details' : 'View Details'}
                    </button>
                    
                    {expanded === shop.id && (
                      <div className="mt-4 bg-white rounded-lg p-4 border border-gray-200">
                        <h5 className="font-medium text-gray-900 mb-3">Shop Details</h5>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Shop Name:</span>
                            <span className="font-medium">{shop.name}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Address:</span>
                            <span className="font-medium">{shop.address}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Phone:</span>
                            <span className="font-medium">{shop.phone}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Current Outstanding:</span>
                            <span className={`font-medium ${
                              shop.current_outstanding > 0 ? 'text-red-500' : 'text-green-500'
                            }`}>
                              {Number(shop.current_outstanding).toFixed(2)} LKR
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Active Bills:</span>
                            <span className="font-medium">{shop.active_bills}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Max Bill Amount:</span>
                            <span className="font-medium">{Number(shop.max_bill_amount).toFixed(2)} LKR</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden lg:block">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-6 py-3 font-medium text-gray-700 text-left cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('name')}>
                          <div className="flex items-center gap-2">
                            Shop Name
                            {sortBy === 'name' && (sortDir === 'asc' ? '▲' : '▼')}
                          </div>
                        </th>
                        <th className="px-6 py-3 font-medium text-gray-700 text-left">Address</th>
                        <th className="px-6 py-3 font-medium text-gray-700 text-left">Phone</th>
                        <th className="px-6 py-3 font-medium text-gray-700 text-left cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('current_outstanding')}>
                          <div className="flex items-center gap-2">
                            Outstanding
                            {sortBy === 'current_outstanding' && (sortDir === 'asc' ? '▲' : '▼')}
                          </div>
                        </th>
                        <th className="px-6 py-3 font-medium text-gray-700 text-left cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('active_bills')}>
                          <div className="flex items-center gap-2">
                            Active Bills
                            {sortBy === 'active_bills' && (sortDir === 'asc' ? '▲' : '▼')}
                          </div>
                        </th>
                        <th className="px-6 py-3 font-medium text-gray-700 text-left cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('max_bill_amount')}>
                          <div className="flex items-center gap-2">
                            Max Bill Amount
                            {sortBy === 'max_bill_amount' && (sortDir === 'asc' ? '▲' : '▼')}
                          </div>
                        </th>
                        <th className="px-6 py-3 font-medium text-gray-700 text-left">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {paginated.map(shop => (
                        <tr key={shop.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-3 font-medium text-gray-900">{shop.name}</td>
                          <td className="px-6 py-3 text-gray-700">{shop.address}</td>
                          <td className="px-6 py-3 text-gray-700">{shop.phone}</td>
                          <td className="px-6 py-3">
                            <span className={`font-semibold ${
                              shop.current_outstanding > 0 ? 'text-red-500' : 'text-green-500'
                            }`}>
                              {Number(shop.current_outstanding).toFixed(2)} LKR
                            </span>
                          </td>
                          <td className="px-6 py-3">
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                              shop.active_bills > 0 ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'
                            }`}>
                              {shop.active_bills}
                            </span>
                          </td>
                          <td className="px-6 py-3 font-semibold text-gray-900">{Number(shop.max_bill_amount).toFixed(2)} LKR</td>
                          <td className="px-6 py-3">
                            <button
                              className="px-4 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg text-sm font-medium transition-colors"
                              onClick={() => setExpanded(expanded === shop.id ? null : shop.id)}
                            >
                              {expanded === shop.id ? 'Hide' : 'View'} Details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Enhanced Expanded Details */}
                {expanded && (
                  <div className="mt-6 p-6 bg-gray-50 rounded-lg border border-gray-200">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Shop Details</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="bg-white p-4 rounded-lg border border-gray-200">
                        <div className="text-sm text-gray-600 mb-1">Shop Name</div>
                        <div className="font-medium text-gray-900">{shops.find(s => s.id === expanded)?.name}</div>
                      </div>
                      <div className="bg-white p-4 rounded-lg border border-gray-200">
                        <div className="text-sm text-gray-600 mb-1">Address</div>
                        <div className="font-medium text-gray-900">{shops.find(s => s.id === expanded)?.address}</div>
                      </div>
                      <div className="bg-white p-4 rounded-lg border border-gray-200">
                        <div className="text-sm text-gray-600 mb-1">Phone</div>
                        <div className="font-medium text-gray-900">{shops.find(s => s.id === expanded)?.phone}</div>
                      </div>
                      <div className="bg-white p-4 rounded-lg border border-gray-200">
                        <div className="text-sm text-gray-600 mb-1">Current Outstanding</div>
                        <div className={`font-medium ${
                          shops.find(s => s.id === expanded)?.current_outstanding && shops.find(s => s.id === expanded)!.current_outstanding > 0 ? 'text-red-500' : 'text-green-500'
                        }`}>
                          {Number(shops.find(s => s.id === expanded)?.current_outstanding || 0).toFixed(2)} LKR
                        </div>
                      </div>
                      <div className="bg-white p-4 rounded-lg border border-gray-200">
                        <div className="text-sm text-gray-600 mb-1">Active Bills</div>
                        <div className="font-medium text-gray-900">{shops.find(s => s.id === expanded)?.active_bills}</div>
                      </div>
                      <div className="bg-white p-4 rounded-lg border border-gray-200">
                        <div className="text-sm text-gray-600 mb-1">Max Bill Amount</div>
                        <div className="font-medium text-gray-900">{Number(shops.find(s => s.id === expanded)?.max_bill_amount || 0).toFixed(2)} LKR</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Enhanced Pagination */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-8 pt-6 border-t border-gray-200">
                  <span className="text-sm text-gray-600">
                    Showing {page * SHOPS_PER_PAGE - SHOPS_PER_PAGE + 1} to {Math.min(page * SHOPS_PER_PAGE, filtered.length)} of {filtered.length} entries
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage(prev => Math.max(1, prev - 1))}
                      disabled={page === 1}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-colors"
                    >
                      Previous
                    </button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const pageNum = i + 1;
                        return (
                          <button
                            key={pageNum}
                            className={`w-10 h-10 rounded-lg font-medium transition-colors ${
                              page === pageNum
                                ? 'bg-purple-500 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                            onClick={() => setPage(pageNum)}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={page === totalPages}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
} 