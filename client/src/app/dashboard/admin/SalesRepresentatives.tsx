import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../../utils/api';

interface SalesRep {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_no?: string;
  nic_no?: string;
  role: string;
  created_at: string;
  status?: string;
  shop_count?: number;
  order_count?: number;
  avg_order_value?: number;
  total_revenue?: number;
  outstanding_amount?: number;
  collected_amount?: number;
  collection_rate?: number;
  performance_rating?: string;
  pending_order_count?: number;
  pending_order_value?: number;
  rejected_order_count?: number;
  return_count?: number;
  last_order_date?: string | null;
  last_collection_date?: string | null;
}

export default function SalesRepresentatives() {
  const [representatives, setRepresentatives] = useState<SalesRep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Representatives');
  const [revenueFilter, setRevenueFilter] = useState('Revenue');
  const [selectedRep, setSelectedRep] = useState<SalesRep | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const triggerRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  useEffect(() => {
    fetchRepresentatives();
  }, [refreshTrigger]);

  const handleViewDetails = (rep: SalesRep) => {
    setSelectedRep(rep);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedRep(null);
  };

  const fetchRepresentatives = async () => {
    try {
      setLoading(true);
      const data = await apiFetch('/api/marudham/sales-representatives/stats');
      setRepresentatives(data.representatives || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getPerformanceColor = (rating: string) => {
    switch (rating) {
      case 'Excellent': return 'bg-green-100 text-green-700';
      case 'Good': return 'bg-blue-100 text-blue-700';
      case 'Average': return 'bg-yellow-100 text-yellow-700';
      case 'Poor': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  // Add performance rating filter
  const [performanceFilter, setPerformanceFilter] = useState('All');

  const filteredRepresentatives = representatives.filter(rep => {
    const matchesSearch =
      rep.first_name.toLowerCase().includes(search.toLowerCase()) ||
      rep.last_name.toLowerCase().includes(search.toLowerCase()) ||
      rep.email.toLowerCase().includes(search.toLowerCase()) ||
      (rep.phone_no || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'All Representatives' || rep.status === statusFilter;
    const matchesPerformance = performanceFilter === 'All' || rep.performance_rating === performanceFilter;
    return matchesSearch && matchesStatus && matchesPerformance;
  });

  // Sort filtered representatives based on revenueFilter
  const sortedRepresentatives = [...filteredRepresentatives].sort((a, b) => {
    if (revenueFilter === 'Orders') return (b.order_count ?? 0) - (a.order_count ?? 0);
    if (revenueFilter === 'Collection Rate') return (b.collection_rate ?? 0) - (a.collection_rate ?? 0);
    return (b.total_revenue ?? 0) - (a.total_revenue ?? 0); // Default: Revenue
  });

  // Pagination
  const [page, setPage] = useState(1);
  const repsPerPage = 10;
  const totalPages = Math.ceil(sortedRepresentatives.length / repsPerPage) || 1;
  const paginatedReps = sortedRepresentatives.slice((page - 1) * repsPerPage, page * repsPerPage);

  useEffect(() => { setPage(1); }, [search, statusFilter, performanceFilter, revenueFilter]);

  const exportData = () => {
    const csvData = [
      ['Name', 'Email', 'Contact', 'Shops', 'Approved Orders', 'Pending Orders', 'Pending Value', 'Rejected Orders', 'Returns', 'Total Revenue', 'Outstanding', 'Collected', 'Collection Rate', 'Last Order', 'Last Collection', 'Performance'],
      ...filteredRepresentatives.map(rep => [
        `${rep.first_name} ${rep.last_name}`,
        rep.email,
        rep.phone_no || 'N/A',
        rep.shop_count ?? 0,
        rep.order_count ?? 0,
        rep.pending_order_count ?? 0,
        `${(rep.pending_order_value ?? 0).toFixed(0)} LKR`,
        rep.rejected_order_count ?? 0,
        rep.return_count ?? 0,
        `${(rep.total_revenue ?? 0).toFixed(0)} LKR`,
        `${(rep.outstanding_amount ?? 0).toFixed(0)} LKR`,
        `${(rep.collected_amount ?? 0).toFixed(0)} LKR`,
        `${(rep.collection_rate ?? 0).toFixed(1)}%`,
        rep.last_order_date ? new Date(rep.last_order_date).toLocaleDateString() : 'Never',
        rep.last_collection_date ? new Date(rep.last_collection_date).toLocaleDateString() : 'Never',
        rep.performance_rating ?? ''
      ])
    ];

    const csv = csvData.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sales_representatives_report.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center mx-auto mb-3">
          <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-gray-900 mb-1">Failed to load</p>
        <p className="text-sm text-gray-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Sales Representatives</h1>
            <p className="text-sm text-gray-500">Manage and monitor sales representative performance</p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-blue-100 shadow-sm p-5">
          <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center mb-3">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Sales Reps</p>
          <p className="text-2xl font-bold text-gray-900">{representatives.length}</p>
        </div>

        <div className="bg-white rounded-xl border border-orange-100 shadow-sm p-5">
          <div className="w-9 h-9 bg-orange-50 rounded-lg flex items-center justify-center mb-3">
            <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Total Orders</p>
          <p className="text-2xl font-bold text-gray-900">
            {representatives.reduce((sum, rep) => sum + (rep.order_count ?? 0), 0)}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-violet-100 shadow-sm p-5">
          <div className="w-9 h-9 bg-violet-50 rounded-lg flex items-center justify-center mb-3">
            <svg className="w-4 h-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Total Revenue</p>
          <p className="text-2xl font-bold text-gray-900">
            {representatives.reduce((sum, rep) => sum + (rep.total_revenue ?? 0), 0).toFixed(0)}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-green-100 shadow-sm p-5">
          <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center mb-3">
            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Collection Rate</p>
          <p className="text-2xl font-bold text-gray-900">
            {representatives.length > 0
              ? (representatives.reduce((sum, rep) => sum + (rep.collection_rate ?? 0), 0) / representatives.length).toFixed(1)
              : '0'}%
          </p>
        </div>
      </div>

      {/* Performance Report Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between p-4 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-1">
            {/* Search */}
            <div className="relative w-full sm:w-64">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search by name, email, or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 text-sm bg-white text-gray-900 w-full"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 text-sm text-gray-900 bg-white"
            >
              <option>All Representatives</option>
              <option>Active</option>
              <option>Inactive</option>
            </select>

            <select
              value={performanceFilter}
              onChange={(e) => setPerformanceFilter(e.target.value)}
              className="px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 text-sm text-gray-900 bg-white"
            >
              <option value="All">All Performance</option>
              <option value="Excellent">Excellent</option>
              <option value="Good">Good</option>
              <option value="Average">Average</option>
              <option value="Poor">Poor</option>
            </select>

            <select
              value={revenueFilter}
              onChange={(e) => setRevenueFilter(e.target.value)}
              className="px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 text-sm text-gray-900 bg-white"
            >
              <option>Revenue</option>
              <option>Orders</option>
              <option>Collection Rate</option>
            </select>
          </div>

          <button
            onClick={exportData}
            className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg text-sm font-semibold transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="py-3 px-5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left">Name</th>
                <th className="py-3 px-5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left">Shops</th>
                <th className="py-3 px-5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left">Orders</th>
                <th className="py-3 px-5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left">Pending</th>
                <th className="py-3 px-5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left">Revenue</th>
                <th className="py-3 px-5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left">Outstanding</th>
                <th className="py-3 px-5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left">Collection</th>
                <th className="py-3 px-5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left">Last Active</th>
                <th className="py-3 px-5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left">Performance</th>
                <th className="py-3 px-5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedReps.length === 0 ? (
                <tr>
                  <td colSpan={10}>
                    <div className="flex flex-col items-center justify-center py-16">
                      <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <p className="text-sm font-bold text-gray-900 mb-1">No representatives found</p>
                      <p className="text-sm text-gray-500">Try adjusting your search or filter criteria.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedReps.map((rep) => (
                  <tr
                    key={rep.id}
                    className="border-b border-gray-100 last:border-0 hover:bg-violet-50/30 transition-colors"
                  >
                    <td className="py-3.5 px-5 text-sm">
                      <p className="font-semibold text-gray-900">{rep.first_name} {rep.last_name}</p>
                      <p className="text-xs text-gray-400">{rep.email}</p>
                    </td>
                    <td className="py-3.5 px-5 text-sm text-gray-700">{rep.shop_count ?? 0}</td>
                    <td className="py-3.5 px-5 text-sm text-gray-700">
                      <span>{rep.order_count ?? 0}</span>
                      {(rep.rejected_order_count ?? 0) > 0 && (
                        <span className="ml-1.5 text-xs text-red-500" title={`${rep.rejected_order_count} rejected`}>
                          ({rep.rejected_order_count} rej)
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-5 text-sm">
                      {(rep.pending_order_count ?? 0) > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                          {rep.pending_order_count}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-5 text-sm font-semibold text-green-700">
                      {(rep.total_revenue ?? 0).toFixed(0)} LKR
                    </td>
                    <td className="py-3.5 px-5 text-sm font-semibold text-red-600">
                      {(rep.outstanding_amount ?? 0).toFixed(0)} LKR
                    </td>
                    <td className="py-3.5 px-5 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-gray-100 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${(rep.collection_rate ?? 0) >= 75 ? 'bg-green-500' : (rep.collection_rate ?? 0) >= 50 ? 'bg-blue-500' : (rep.collection_rate ?? 0) >= 25 ? 'bg-yellow-500' : 'bg-red-400'}`}
                            style={{ width: `${Math.min(100, rep.collection_rate ?? 0)}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-600">{(rep.collection_rate ?? 0).toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-5 text-sm text-gray-500">
                      {rep.last_order_date
                        ? new Date(rep.last_order_date).toLocaleDateString()
                        : <span className="text-gray-300">Never</span>}
                    </td>
                    <td className="py-3.5 px-5 text-sm">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getPerformanceColor(rep.performance_rating ?? '')}`}>
                        {rep.performance_rating ?? 'N/A'}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-sm">
                      <button
                        onClick={() => handleViewDetails(rep)}
                        className="px-2.5 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-medium transition-colors border border-gray-200"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {sortedRepresentatives.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-100 bg-white">
            <p className="text-sm text-gray-500">
              Showing {(page - 1) * repsPerPage + 1}–{Math.min(page * repsPerPage, sortedRepresentatives.length)} of {sortedRepresentatives.length} entries
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(prev => Math.max(1, prev - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="px-3 py-1 bg-violet-600 text-white text-sm rounded-lg font-semibold">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showModal && selectedRep && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto">
            {/* Close button */}
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Modal Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">{selectedRep.first_name} {selectedRep.last_name}</h3>
                <p className="text-xs text-gray-500">Representative Details</p>
              </div>
            </div>

            {/* Basic Information */}
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Basic Information</p>
            <div className="mb-5">
              <div className="flex items-center justify-between py-2 border-b border-gray-50">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Full Name</span>
                <span className="text-sm font-medium text-gray-900">{selectedRep.first_name} {selectedRep.last_name}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-50">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Email</span>
                <span className="text-sm font-medium text-gray-900">{selectedRep.email}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-50">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Phone</span>
                <span className="text-sm font-medium text-gray-900">{selectedRep.phone_no || 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-50">
                <span className="text-xs text-gray-500 uppercase tracking-wide">NIC</span>
                <span className="text-sm font-medium text-gray-900">{selectedRep.nic_no || 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-50">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Joined</span>
                <span className="text-sm font-medium text-gray-900">{new Date(selectedRep.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-50">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Status</span>
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">{selectedRep.status}</span>
              </div>
            </div>

            {/* Performance Metrics */}
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Performance Metrics</p>
            <div className="mb-6">
              <div className="flex items-center justify-between py-2 border-b border-gray-50">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Shops Assigned</span>
                <span className="text-sm font-medium text-gray-900">{selectedRep.shop_count ?? 0}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-50">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Total Orders</span>
                <span className="text-sm font-medium text-gray-900">{selectedRep.order_count ?? 0}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-50">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Avg Order Value</span>
                <span className="text-sm font-semibold text-green-700">{(selectedRep.avg_order_value ?? 0).toFixed(0)} LKR</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-50">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Total Revenue</span>
                <span className="text-sm font-semibold text-green-700">{(selectedRep.total_revenue ?? 0).toFixed(0)} LKR</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-50">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Outstanding Amount</span>
                <span className="text-sm font-semibold text-red-600">{(selectedRep.outstanding_amount ?? 0).toFixed(0)} LKR</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-50">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Collected Amount</span>
                <span className="text-sm font-semibold text-green-700">{(selectedRep.collected_amount ?? 0).toFixed(0)} LKR</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-50">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Collection Rate</span>
                <span className="text-sm font-medium text-gray-900">{(selectedRep.collection_rate ?? 0).toFixed(1)}%</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-50">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Performance Rating</span>
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getPerformanceColor(selectedRep.performance_rating ?? '')}`}>
                  {selectedRep.performance_rating ?? 'N/A'}
                </span>
              </div>
            </div>

            {/* Activity */}
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Activity</p>
            <div className="mb-6">
              <div className="flex items-center justify-between py-2 border-b border-gray-50">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Pending Orders</span>
                <span className="text-sm font-medium text-amber-700">
                  {selectedRep.pending_order_count ?? 0} order{(selectedRep.pending_order_count ?? 0) !== 1 ? 's' : ''}
                  {(selectedRep.pending_order_count ?? 0) > 0 && (
                    <span className="ml-1 text-gray-500">({(selectedRep.pending_order_value ?? 0).toFixed(0)} LKR)</span>
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-50">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Rejected Orders</span>
                <span className={`text-sm font-medium ${(selectedRep.rejected_order_count ?? 0) > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                  {selectedRep.rejected_order_count ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-50">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Returns Made</span>
                <span className={`text-sm font-medium ${(selectedRep.return_count ?? 0) > 0 ? 'text-orange-600' : 'text-gray-900'}`}>
                  {selectedRep.return_count ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-50">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Last Order</span>
                <span className="text-sm font-medium text-gray-900">
                  {selectedRep.last_order_date
                    ? new Date(selectedRep.last_order_date).toLocaleDateString()
                    : 'Never'}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-50">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Last Collection</span>
                <span className="text-sm font-medium text-gray-900">
                  {selectedRep.last_collection_date
                    ? new Date(selectedRep.last_collection_date).toLocaleDateString()
                    : 'Never'}
                </span>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={closeModal}
                className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg text-sm font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
