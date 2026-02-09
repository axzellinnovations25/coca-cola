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

  // Pagination
  const [page, setPage] = useState(1);
  const repsPerPage = 10;
  const totalPages = Math.ceil(filteredRepresentatives.length / repsPerPage) || 1;
  const paginatedReps = filteredRepresentatives.slice((page - 1) * repsPerPage, page * repsPerPage);

  useEffect(() => { setPage(1); }, [search, statusFilter, performanceFilter]);

  const exportData = () => {
    const csvData = [
      ['Name', 'Email', 'Contact', 'Shop Assignment', 'Order Performance', 'Total Revenue', 'Outstanding', 'Collected', 'Collection Rate', 'Performance'],
      ...filteredRepresentatives.map(rep => [
        `${rep.first_name} ${rep.last_name}`,
        rep.email,
        rep.phone_no || 'N/A',
        `${rep.shop_count ?? 0} shops assigned`,
        `${rep.order_count ?? 0} orders (Avg: $${(rep.avg_order_value ?? 0).toFixed(0)}/order)`,
        `$${(rep.total_revenue ?? 0).toFixed(0)}`,
        `$${(rep.outstanding_amount ?? 0).toFixed(0)}`,
        `$${(rep.collected_amount ?? 0).toFixed(0)}`,
        `${(rep.collection_rate ?? 0).toFixed(1)}%`,
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
    return <div className="text-gray-400 text-center py-8">Loading sales representatives...</div>;
  }

  if (error) {
    return <div className="text-red-500 text-center py-8">{error}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex items-center gap-3">
        <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
        </svg>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Sales Representatives</h1>
          <p className="text-gray-600 text-sm">Manage and monitor sales representative performance</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
          <div className="flex flex-col items-start">
            <span className="text-blue-600 text-sm font-medium mb-1">Sales Representatives</span>
            <span className="text-xl font-bold text-blue-800">{representatives.length}</span>
            <span className="text-xs text-gray-500 mt-1">Active sales reps</span>
          </div>
        </div>
        <div className="bg-orange-50 rounded-lg border border-orange-200 p-4">
          <div className="flex flex-col items-start">
            <span className="text-orange-700 text-sm font-medium mb-1">Total Orders</span>
            <span className="text-xl font-bold text-orange-800">
              {representatives.reduce((sum, rep) => sum + (rep.order_count ?? 0), 0)}
            </span>
            <span className="text-xs text-gray-500 mt-1">Across all reps</span>
          </div>
        </div>
        <div className="bg-purple-50 rounded-lg border border-purple-200 p-4">
          <div className="flex flex-col items-start">
            <span className="text-purple-700 text-sm font-medium mb-1">Total Revenue</span>
            <span className="text-xl font-bold text-purple-800">
              {representatives.reduce((sum, rep) => sum + (rep.total_revenue ?? 0), 0).toFixed(0)}.00 LKR
            </span>
            <span className="text-xs text-gray-500 mt-1">Generated</span>
          </div>
        </div>
        <div className="bg-green-50 rounded-lg border border-green-200 p-4">
          <div className="flex flex-col items-start">
            <span className="text-green-700 text-sm font-medium mb-1">Collection Rate</span>
            <span className="text-xl font-bold text-green-800">
              {representatives.length > 0 
                ? (representatives.reduce((sum, rep) => sum + (rep.collection_rate ?? 0), 0) / representatives.length).toFixed(1)
                : '0'
              }%
            </span>
            <span className="text-xs text-gray-500 mt-1">Average</span>
          </div>
        </div>
      </div>

      {/* Performance Report Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Sales Representative Performance Report</h2>
            <p className="text-gray-600 text-sm">Detailed performance metrics and shop assignments</p>
          </div>
          <button
            onClick={exportData}
            className="px-4 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg font-medium flex items-center gap-2 transition-colors"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export
          </button>
        </div>

        {/* Search and Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                placeholder="Search by name, email, or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300 text-sm text-gray-900 bg-white"
              />
            </div>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300 text-sm text-gray-900 bg-white"
          >
            <option>All Representatives</option>
            <option>Active</option>
            <option>Inactive</option>
          </select>
          <select
            value={performanceFilter}
            onChange={(e) => setPerformanceFilter(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300 text-sm text-gray-900 bg-white"
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
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300 text-sm text-gray-900 bg-white"
          >
            <option>Revenue</option>
            <option>Orders</option>
            <option>Collection Rate</option>
          </select>
        </div>

        {/* Performance Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-700 text-sm">Name</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 text-sm">Email</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 text-sm">Shops</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 text-sm">Orders</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 text-sm">Total Revenue</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 text-sm">Performance</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 text-sm">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedReps.map((rep) => (
                <tr 
                  key={rep.id} 
                  className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => handleViewDetails(rep)}
                >
                  <td className="py-4 px-4">
                    <div className="font-medium text-gray-900 text-sm">
                      {rep.first_name} {rep.last_name}
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="text-gray-900 text-sm">{rep.email}</div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="text-gray-900 text-sm">{rep.shop_count ?? 0}</div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="text-gray-900 text-sm">{rep.order_count ?? 0}</div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="text-gray-900 text-sm">{(rep.total_revenue ?? 0).toFixed(0)} LKR</div>
                  </td>
                  <td className="py-4 px-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPerformanceColor(rep.performance_rating ?? '')}`}>
                      {rep.performance_rating}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <span className="text-gray-400" title="Click row to view details">
                      👁️
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="flex justify-between items-center mt-6">
          <span className="text-sm text-gray-600">
            Showing {page * repsPerPage - repsPerPage + 1} to {Math.min(page * repsPerPage, filteredRepresentatives.length)} of {filteredRepresentatives.length} entries
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(prev => Math.max(1, prev - 1))}
              disabled={page === 1}
              className="px-3 py-1 bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              Previous
            </button>
            <span className="text-sm text-gray-700">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              Next
            </button>
          </div>
        </div>

        {filteredRepresentatives.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            No sales representatives found matching your criteria.
          </div>
        )}
      </div>

      {/* Detailed View Modal */}
      {showModal && selectedRep && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg border border-gray-200 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-gray-900">
                  {selectedRep.first_name} {selectedRep.last_name} - Details
                </h3>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-900 border-b border-gray-300 pb-2">Basic Information</h4>
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm font-medium text-gray-600">Full Name:</span>
                      <div className="font-semibold text-gray-900 mt-1 text-sm">{selectedRep.first_name} {selectedRep.last_name}</div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600">Email:</span>
                      <div className="font-semibold text-gray-900 mt-1 text-sm">{selectedRep.email}</div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600">Phone:</span>
                      <div className="font-semibold text-gray-900 mt-1 text-sm">{selectedRep.phone_no || 'N/A'}</div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600">NIC:</span>
                      <div className="font-semibold text-gray-900 mt-1 text-sm">{selectedRep.nic_no || 'N/A'}</div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600">Joined:</span>
                      <div className="font-semibold text-gray-900 mt-1 text-sm">{new Date(selectedRep.created_at).toLocaleDateString()}</div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600">Status:</span>
                      <div className="font-semibold text-gray-900 mt-1 text-sm">{selectedRep.status}</div>
                    </div>
                  </div>
                </div>

                {/* Performance Metrics */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-900 border-b border-gray-300 pb-2">Performance Metrics</h4>
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm font-medium text-gray-600">Shops Assigned:</span>
                      <div className="font-semibold text-gray-900 mt-1 text-sm">{selectedRep.shop_count ?? 0}</div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600">Total Orders:</span>
                      <div className="font-semibold text-gray-900 mt-1 text-sm">{selectedRep.order_count ?? 0}</div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600">Average Order Value:</span>
                      <div className="font-semibold text-blue-700 mt-1 text-sm">{(selectedRep.avg_order_value ?? 0).toFixed(0)} LKR</div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600">Total Revenue:</span>
                      <div className="font-semibold text-purple-700 mt-1 text-sm">{(selectedRep.total_revenue ?? 0).toFixed(0)} LKR</div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600">Outstanding Amount:</span>
                      <div className="font-semibold text-red-700 mt-1 text-sm">{(selectedRep.outstanding_amount ?? 0).toFixed(0)} LKR</div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600">Collected Amount:</span>
                      <div className="font-semibold text-green-700 mt-1 text-sm">{(selectedRep.collected_amount ?? 0).toFixed(0)} LKR</div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600">Collection Rate:</span>
                      <div className="font-semibold text-gray-900 mt-1 text-sm">{(selectedRep.collection_rate ?? 0).toFixed(1)}%</div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600">Performance Rating:</span>
                      <div className="mt-1">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPerformanceColor(selectedRep.performance_rating ?? '')}`}>
                          {selectedRep.performance_rating}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 