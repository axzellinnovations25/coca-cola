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

  // Sort indicator
  const SortIcon = ({ col }: { col: typeof sortBy }) => {
    if (sortBy !== col) return null;
    return (
      <svg className="w-3.5 h-3.5 inline-block ml-1 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {sortDir === 'asc'
          ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
          : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />}
      </svg>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              My Shops{shops.length ? ` (${shops.length})` : ''}
            </h1>
            <p className="text-sm text-gray-500">Manage your assigned shops and track their performance</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 bg-red-400 rounded-full"></div>
            <span className="text-xs text-gray-500 font-medium">Outstanding</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 bg-green-400 rounded-full"></div>
            <span className="text-xs text-gray-500 font-medium">Clear</span>
          </div>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Card Header: Search & Filter */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-wrap gap-3">
          <span className="text-sm font-semibold text-gray-900">Shop Management</span>
          <div className="flex flex-col sm:flex-row gap-2.5 w-full sm:w-auto">
            {/* Search */}
            <div className="relative flex-1 sm:flex-initial">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search by name, address, or phone..."
                className="pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 text-sm bg-white text-gray-900 w-full sm:w-64"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
              />
            </div>

            {/* Outstanding Filter */}
            <select
              className="px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 text-sm text-gray-900 bg-white"
              value={outstandingFilter}
              onChange={e => { setOutstandingFilter(e.target.value as any); setPage(1); }}
            >
              <option value="all">All Shops</option>
              <option value="outstanding">Outstanding Only</option>
              <option value="clear">No Outstanding</option>
            </select>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-900">Failed to load shops</p>
            <p className="text-sm text-gray-500">{error}</p>
          </div>
        ) : paginated.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-500">No shops found</p>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="lg:hidden divide-y divide-gray-100">
              {paginated.map(shop => (
                <div key={shop.id} className="p-4 hover:bg-violet-50/30 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-gray-900 truncate">{shop.name}</h4>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{shop.address}</p>
                    </div>
                    <div className="text-right ml-3 shrink-0">
                      <div className={`text-sm font-bold ${shop.current_outstanding > 0 ? 'text-red-500' : 'text-green-600'}`}>
                        {Number(shop.current_outstanding).toFixed(2)} LKR
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">{shop.phone}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-gray-50 rounded-lg p-2.5 border border-gray-100">
                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Active Bills</div>
                      <div className={`text-sm font-bold ${shop.active_bills > 0 ? 'text-orange-500' : 'text-green-600'}`}>
                        {shop.active_bills}
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2.5 border border-gray-100">
                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Max Bill</div>
                      <div className="text-sm font-bold text-gray-900">
                        {Number(shop.max_bill_amount).toFixed(2)} LKR
                      </div>
                    </div>
                  </div>

                  <button
                    className="w-full py-2 px-4 bg-violet-50 hover:bg-violet-100 text-violet-700 rounded-lg text-sm font-semibold transition-colors border border-violet-100"
                    onClick={() => setExpanded(expanded === shop.id ? null : shop.id)}
                  >
                    {expanded === shop.id ? 'Hide Details' : 'View Details'}
                  </button>

                  {expanded === shop.id && (
                    <div className="mt-3 bg-gray-50 rounded-xl p-4 border border-gray-200">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Shop Details</p>
                      <div className="space-y-2 text-sm">
                        {[
                          { label: 'Shop Name', value: shop.name },
                          { label: 'Address', value: shop.address },
                          { label: 'Phone', value: shop.phone },
                          { label: 'Active Bills', value: String(shop.active_bills) },
                          { label: 'Max Bill Amount', value: `${Number(shop.max_bill_amount).toFixed(2)} LKR` },
                        ].map(({ label, value }) => (
                          <div key={label} className="flex justify-between gap-3">
                            <span className="text-gray-500">{label}</span>
                            <span className="font-medium text-gray-900 text-right">{value}</span>
                          </div>
                        ))}
                        <div className="flex justify-between gap-3">
                          <span className="text-gray-500">Current Outstanding</span>
                          <span className={`font-semibold ${shop.current_outstanding > 0 ? 'text-red-500' : 'text-green-600'}`}>
                            {Number(shop.current_outstanding).toFixed(2)} LKR
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th
                      className="py-3 px-5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort('name')}
                    >
                      Shop Name <SortIcon col="name" />
                    </th>
                    <th className="py-3 px-5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left border-b border-gray-200">
                      Address
                    </th>
                    <th className="py-3 px-5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left border-b border-gray-200">
                      Phone
                    </th>
                    <th
                      className="py-3 px-5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort('current_outstanding')}
                    >
                      Outstanding <SortIcon col="current_outstanding" />
                    </th>
                    <th
                      className="py-3 px-5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort('active_bills')}
                    >
                      Active Bills <SortIcon col="active_bills" />
                    </th>
                    <th
                      className="py-3 px-5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort('max_bill_amount')}
                    >
                      Max Bill Amount <SortIcon col="max_bill_amount" />
                    </th>
                    <th className="py-3 px-5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left border-b border-gray-200">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map(shop => (
                    <tr key={shop.id} className="border-b border-gray-100 last:border-0 hover:bg-violet-50/30 transition-colors">
                      <td className="py-3.5 px-5 text-sm font-semibold text-gray-900">{shop.name}</td>
                      <td className="py-3.5 px-5 text-sm text-gray-600">{shop.address}</td>
                      <td className="py-3.5 px-5 text-sm text-gray-600">{shop.phone}</td>
                      <td className="py-3.5 px-5 text-sm">
                        <span className={`font-semibold ${shop.current_outstanding > 0 ? 'text-red-500' : 'text-green-600'}`}>
                          {Number(shop.current_outstanding).toFixed(2)} LKR
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-sm">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${shop.active_bills > 0 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                          {shop.active_bills}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-sm font-semibold text-gray-900">
                        {Number(shop.max_bill_amount).toFixed(2)} LKR
                      </td>
                      <td className="py-3.5 px-5 text-sm">
                        <button
                          className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg text-sm font-semibold transition-colors"
                          onClick={() => setExpanded(expanded === shop.id ? null : shop.id)}
                        >
                          {expanded === shop.id ? 'Hide' : 'View'} Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Expanded Shop Detail Panel */}
              {expanded && (() => {
                const shop = shops.find(s => s.id === expanded);
                if (!shop) return null;
                return (
                  <div className="mx-5 mb-5 mt-4 p-5 bg-gray-50 rounded-xl border border-gray-200">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-4">Shop Details</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {[
                        { label: 'Shop Name', value: shop.name, color: '' },
                        { label: 'Address', value: shop.address, color: '' },
                        { label: 'Phone', value: shop.phone, color: '' },
                        { label: 'Active Bills', value: String(shop.active_bills), color: '' },
                        { label: 'Max Bill Amount', value: `${Number(shop.max_bill_amount).toFixed(2)} LKR`, color: '' },
                      ].map(({ label, value }) => (
                        <div key={label} className="bg-white rounded-lg border border-gray-200 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">{label}</p>
                          <p className="text-sm font-semibold text-gray-900">{value}</p>
                        </div>
                      ))}
                      <div className="bg-white rounded-lg border border-gray-200 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Current Outstanding</p>
                        <p className={`text-sm font-semibold ${shop.current_outstanding > 0 ? 'text-red-500' : 'text-green-600'}`}>
                          {Number(shop.current_outstanding).toFixed(2)} LKR
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-100">
                <span className="text-sm text-gray-500">
                  Showing {(page - 1) * SHOPS_PER_PAGE + 1}–{Math.min(page * SHOPS_PER_PAGE, filtered.length)} of {filtered.length}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPage(prev => Math.max(1, prev - 1))}
                    disabled={page === 1}
                    className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const pageNum = i + 1;
                      return (
                        <button
                          key={pageNum}
                          className={`w-9 h-9 rounded-lg text-sm font-semibold transition-colors ${
                            page === pageNum
                              ? 'px-3 py-1 bg-violet-600 text-white'
                              : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
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
                    className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
  );
}
