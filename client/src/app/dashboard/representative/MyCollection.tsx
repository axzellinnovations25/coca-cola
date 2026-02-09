import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../../utils/api';

interface Collection {
  payment_id: string;
  payment_amount: number;
  payment_notes?: string;
  payment_date: string;
  order_id: string;
  order_total: number;
  order_notes?: string;
  order_date: string;
  order_status: string;
  shop: {
    id: string;
    name: string;
    address: string;
    phone: string;
  };
  sales_rep: {
    first_name: string;
    last_name: string;
    email: string;
  };
  outstanding_before_payment: number;
  outstanding_after_payment: number;
  collection_percentage: string;
}

interface CollectionStats {
  total_collections: number;
  total_amount_collected: number;
  unique_shops: number;
  unique_orders: number;
  average_collection_amount: number;
  first_collection_date: string;
  last_collection_date: string;
  today: {
    collections: number;
    amount: number;
  };
  this_month: {
    collections: number;
    amount: number;
  };
}

export default function MyCollection() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [stats, setStats] = useState<CollectionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [showFilters, setShowFilters] = useState(false);
  const COLLECTIONS_PER_PAGE = 10;

  useEffect(() => {
    fetchCollections();
  }, [refreshTrigger]);

  const fetchCollections = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Fetch collections and stats in parallel
      const [collectionsData, statsData] = await Promise.all([
        apiFetch('/api/marudham/collections/representative'),
        apiFetch('/api/marudham/collections/representative/stats')
      ]);
      
      setCollections(collectionsData.collections || []);
      setStats(statsData.stats);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const triggerRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  // Filter collections
  const filteredCollections = collections.filter(collection => {
    const q = search.toLowerCase();
    const matchesSearch = 
      collection.shop.name.toLowerCase().includes(q) ||
      collection.shop.address.toLowerCase().includes(q) ||
      collection.payment_notes?.toLowerCase().includes(q) ||
      collection.order_id.toLowerCase().includes(q) ||
      String(collection.payment_amount).includes(q);
    
    const matchesDateFilter = (() => {
      if (dateFilter === 'all') return true;
      if (dateFilter === 'today') {
        const today = new Date().toDateString();
        return new Date(collection.payment_date).toDateString() === today;
      }
      if (dateFilter === 'this_month') {
        const now = new Date();
        const paymentDate = new Date(collection.payment_date);
        return now.getMonth() === paymentDate.getMonth() && 
               now.getFullYear() === paymentDate.getFullYear();
      }
      if (dateFilter === 'this_week') {
        const now = new Date();
        const paymentDate = new Date(collection.payment_date);
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return paymentDate >= weekAgo;
      }
      return true;
    })();
    
    return matchesSearch && matchesDateFilter;
  });

  // Pagination
  const totalPages = Math.ceil(filteredCollections.length / COLLECTIONS_PER_PAGE) || 1;
  const paginatedCollections = filteredCollections.slice((page - 1) * COLLECTIONS_PER_PAGE, page * COLLECTIONS_PER_PAGE);

  useEffect(() => { setPage(1); }, [search, dateFilter]);

  const exportCollections = () => {
    const csvData = [
      ['Date', 'Shop', 'Order ID', 'Payment Amount', 'Order Total', 'Outstanding Before', 'Outstanding After', 'Collection %', 'Notes'],
      ...filteredCollections.map(collection => [
        new Date(collection.payment_date).toLocaleDateString(),
        collection.shop.name,
        collection.order_id.slice(0, 8) + '...',
        `${collection.payment_amount.toFixed(2)} LKR`,
        `${collection.order_total.toFixed(2)} LKR`,
        `${collection.outstanding_before_payment.toFixed(2)} LKR`,
        `${collection.outstanding_after_payment.toFixed(2)} LKR`,
        `${collection.collection_percentage}%`,
        collection.payment_notes || ''
      ])
    ];
    
    const csv = csvData.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'my_collections_report.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getStatusColor = (percentage: string) => {
    const num = parseFloat(percentage);
    if (num >= 80) return 'bg-green-500';
    if (num >= 60) return 'bg-yellow-500';
    if (num >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getStatusText = (percentage: string) => {
    const num = parseFloat(percentage);
    if (num >= 80) return 'Excellent';
    if (num >= 60) return 'Good';
    if (num >= 40) return 'Fair';
    return 'Poor';
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
          </div>
          <p className="text-gray-600 font-medium">Loading your collections...</p>
          <p className="text-gray-400 text-sm mt-1">Gathering payment data</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Oops! Something went wrong</h3>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchCollections}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 overflow-x-hidden">
      {/* Hero Header */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Collections</h1>
            <p className="text-gray-600">Track all your payment collections</p>
          </div>
        </div>
        
        {/* Quick Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <div className="text-2xl font-bold text-gray-900">{stats.total_collections}</div>
              <div className="text-gray-600 text-sm">Total Collections</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <div className="text-2xl font-bold text-gray-900">{stats.total_amount_collected.toFixed(0)}</div>
              <div className="text-gray-600 text-sm">LKR Collected</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <div className="text-2xl font-bold text-gray-900">{stats.this_month.amount.toFixed(0)}</div>
              <div className="text-gray-600 text-sm">This Month</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <div className="text-2xl font-bold text-gray-900">{stats.today.amount.toFixed(0)}</div>
              <div className="text-gray-600 text-sm">Today</div>
            </div>
          </div>
        )}
      </div>

      {/* Controls Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col gap-4">
          {/* Search Bar */}
          <div className="w-full">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search collections..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-transparent bg-gray-50"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Toggle for Mobile */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors flex items-center gap-2 active:scale-95"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.207A1 1 0 013 6.5V4z" />
              </svg>
              Filters
            </button>

            {/* View Mode Toggle */}
            <div className="flex bg-gray-100 rounded-xl p-1">
              <button
                onClick={() => setViewMode('cards')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all active:scale-95 ${
                  viewMode === 'cards' 
                    ? 'bg-white text-purple-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all active:scale-95 ${
                  viewMode === 'table' 
                    ? 'bg-white text-purple-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </button>
            </div>

            {/* Export Button */}
          </div>
        </div>

        {/* Mobile Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-300 bg-gray-50"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
            </select>
          </div>
        )}

        {/* Desktop Filters */}
        <div className="hidden lg:flex items-center gap-4 mt-4 pt-4 border-t border-gray-200">
          <span className="text-gray-600 font-medium">Filter by:</span>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300 bg-gray-50"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="this_week">This Week</option>
            <option value="this_month">This Month</option>
          </select>
        </div>
      </div>

      {/* Collections Display */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Results Header */}
        <div className="px-4 lg:px-6 py-4 border-b border-gray-100 bg-gray-50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Collection History</h2>
              <p className="text-gray-600 text-sm">
                {filteredCollections.length} collection{filteredCollections.length !== 1 ? 's' : ''} found
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-green-600">
                {filteredCollections.reduce((sum, c) => sum + c.payment_amount, 0).toFixed(0)}
              </div>
              <div className="text-gray-500 text-sm">Total LKR</div>
            </div>
          </div>
        </div>

        {/* Collections Content */}
        {viewMode === 'cards' ? (
          <div className="p-4 lg:p-6 overflow-x-hidden">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {paginatedCollections.map((collection) => (
                <div key={collection.payment_id} className="bg-gradient-to-br from-white to-gray-50 rounded-2xl border border-gray-200 p-4 lg:p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0 mr-3">
                      <h3 className="font-bold text-gray-900 text-base lg:text-lg truncate">{collection.shop.name}</h3>
                      <p className="text-gray-500 text-sm truncate mt-1">{collection.shop.address}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xl lg:text-2xl font-bold text-green-600">{collection.payment_amount.toFixed(0)}</div>
                      <div className="text-gray-500 text-xs">LKR</div>
                    </div>
                  </div>

                  {/* Payment Details */}
                  <div className="space-y-3 mb-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 text-sm">Order ID:</span>
                      <span className="font-mono text-gray-900 text-sm">{collection.order_id.slice(0, 8)}...</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 text-sm">Order Total:</span>
                      <span className="font-semibold text-gray-900">{collection.order_total.toFixed(2)} LKR</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 text-sm">Outstanding:</span>
                      <span className="text-red-600 font-semibold">{collection.outstanding_after_payment.toFixed(2)} LKR</span>
                    </div>
                  </div>

                  {/* Collection Progress */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-600 text-sm">Collection Rate</span>
                      <span className="text-sm font-semibold text-gray-900">{collection.collection_percentage}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div 
                        className={`h-3 rounded-full transition-all duration-500 ${getStatusColor(collection.collection_percentage)}`}
                        style={{ width: `${Math.min(100, parseFloat(collection.collection_percentage))}%` }}
                      ></div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{getStatusText(collection.collection_percentage)}</div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <div className="text-gray-500 text-sm">
                      {new Date(collection.payment_date).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-xs text-gray-500">Collected</span>
                    </div>
                  </div>

                  {/* Notes (if any) */}
                  {collection.payment_notes && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                      <div className="text-xs text-blue-800 font-medium mb-1">Notes:</div>
                      <div className="text-xs text-blue-700">{collection.payment_notes}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Enhanced Table View - Mobile Responsive */
          <div className="overflow-x-auto">
            {/* Mobile Table View */}
            <div className="lg:hidden">
              <div className="divide-y divide-gray-200">
                {paginatedCollections.map((collection) => (
                  <div key={collection.payment_id} className="p-4 hover:bg-gray-50 transition-colors">
                    {/* Header Row */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0 mr-3">
                        <h3 className="font-bold text-gray-900 text-base truncate">{collection.shop.name}</h3>
                        <p className="text-gray-500 text-sm truncate mt-1">{collection.shop.address}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-xl font-bold text-green-600">{collection.payment_amount.toFixed(2)} LKR</div>
                        <div className="text-gray-500 text-xs">{new Date(collection.payment_date).toLocaleDateString()}</div>
                      </div>
                    </div>

                    {/* Details Row */}
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <span className="text-gray-600 text-xs">Order ID:</span>
                        <div className="font-mono text-gray-900 text-sm">{collection.order_id.slice(0, 8)}...</div>
                      </div>
                      <div>
                        <span className="text-gray-600 text-xs">Order Total:</span>
                        <div className="font-semibold text-gray-900">{collection.order_total.toFixed(2)} LKR</div>
                      </div>
                      <div>
                        <span className="text-gray-600 text-xs">Outstanding:</span>
                        <div className="text-red-600 font-semibold">{collection.outstanding_after_payment.toFixed(2)} LKR</div>
                      </div>
                      <div>
                        <span className="text-gray-600 text-xs">Collection %:</span>
                        <div className="font-semibold text-gray-900">{collection.collection_percentage}%</div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-3">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-500 ${getStatusColor(collection.collection_percentage)}`}
                          style={{ width: `${Math.min(100, parseFloat(collection.collection_percentage))}%` }}
                        ></div>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{getStatusText(collection.collection_percentage)}</div>
                    </div>

                    {/* Notes */}
                    {collection.payment_notes && (
                      <div className="p-2 bg-blue-50 rounded-lg mb-3">
                        <div className="text-xs text-blue-800 font-medium mb-1">Notes:</div>
                        <div className="text-xs text-blue-700">{collection.payment_notes}</div>
                      </div>
                    )}

                    {/* Status Indicator */}
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-xs text-gray-500">Collected</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Desktop Table View */}
            <table className="w-full hidden lg:table">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left py-4 px-6 font-semibold text-gray-700">Date</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-700">Shop</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-700">Order ID</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-700">Payment</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-700">Collection %</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-700">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginatedCollections.map((collection) => (
                  <tr key={collection.payment_id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="text-gray-900 font-medium">{new Date(collection.payment_date).toLocaleDateString()}</div>
                      <div className="text-gray-500 text-sm">{new Date(collection.payment_date).toLocaleTimeString()}</div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-semibold text-gray-900">{collection.shop.name}</div>
                      <div className="text-gray-500 text-sm">{collection.shop.address}</div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-mono text-gray-900">{collection.order_id.slice(0, 8)}...</div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-bold text-green-600 text-lg">{collection.payment_amount.toFixed(2)} LKR</div>
                      <div className="text-gray-500 text-sm">Total: {collection.order_total.toFixed(2)} LKR</div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full transition-all duration-500 ${getStatusColor(collection.collection_percentage)}`}
                            style={{ width: `${Math.min(100, parseFloat(collection.collection_percentage))}%` }}
                          ></div>
                        </div>
                        <span className="font-semibold text-gray-700">{collection.collection_percentage}%</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-gray-700 max-w-xs truncate" title={collection.payment_notes}>
                        {collection.payment_notes || '-'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Enhanced Mobile-Friendly Pagination */}
        {totalPages > 1 && (
          <div className="px-4 lg:px-6 py-4 border-t border-gray-100 bg-gray-50">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="text-sm text-gray-600 text-center sm:text-left">
                Showing {page * COLLECTIONS_PER_PAGE - COLLECTIONS_PER_PAGE + 1} to {Math.min(page * COLLECTIONS_PER_PAGE, filteredCollections.length)} of {filteredCollections.length} entries
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(prev => Math.max(1, prev - 1))}
                  disabled={page === 1}
                  className="px-4 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors active:scale-95"
                >
                  Previous
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pageNum = i + 1;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors active:scale-95 ${
                          page === pageNum
                            ? 'bg-purple-600 text-white'
                            : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors active:scale-95"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Empty State */}
        {filteredCollections.length === 0 && (
          <div className="text-center py-16 px-4 lg:px-6">
            <div className="w-20 h-20 lg:w-24 lg:h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 lg:w-12 lg:h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No collections found</h3>
            <p className="text-gray-600 mb-6">Try adjusting your search or filter criteria</p>
            <button
              onClick={() => {
                setSearch('');
                setDateFilter('all');
              }}
              className="px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors active:scale-95"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 