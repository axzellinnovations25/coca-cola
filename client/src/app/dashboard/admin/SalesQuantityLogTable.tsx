import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../../utils/api';

interface SalesQuantityLog {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  product_description?: string;
  sales_rep_id: string;
  sales_rep_first_name: string;
  sales_rep_last_name: string;
  sales_rep_email: string;
  shop_id: string;
  shop_name: string;
  quantity_sold: number;
  unit_price: number;
  total_amount: number;
  previous_stock_quantity: number;
  new_stock_quantity: number;
  created_at: string;
  order_total: number;
  order_status: string;
  log_details?: any;
}

export default function SalesQuantityLogTable() {
  const [logs, setLogs] = useState<SalesQuantityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<SalesQuantityLog | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const LOGS_PER_PAGE = 10;

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const data = await apiFetch('/api/marudham/sales-quantity/logs');
      setLogs(data.logs || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Filter logs
  const filteredLogs = logs.filter(log => {
    const q = search.toLowerCase();
    return (
      log.product_name?.toLowerCase().includes(q) ||
      log.shop_name?.toLowerCase().includes(q) ||
      log.sales_rep_first_name?.toLowerCase().includes(q) ||
      log.sales_rep_last_name?.toLowerCase().includes(q) ||
      log.sales_rep_email?.toLowerCase().includes(q) ||
      String(log.quantity_sold).includes(q) ||
      String(log.total_amount).includes(q)
    );
  });

  // Pagination
  const totalPages = Math.ceil(filteredLogs.length / LOGS_PER_PAGE) || 1;
  const paginatedLogs = filteredLogs.slice((page - 1) * LOGS_PER_PAGE, page * LOGS_PER_PAGE);

  useEffect(() => { setPage(1); }, [search]);

  const exportData = () => {
    const csvData = [
      ['Date', 'Product', 'Shop', 'Sales Representative', 'Quantity Sold', 'Unit Price', 'Total Amount', 'Previous Inventory', 'New Inventory', 'Order Status'],
      ...filteredLogs.map(log => [
        new Date(log.created_at).toLocaleString(),
        log.product_name || 'N/A',
        log.shop_name || 'N/A',
        `${log.sales_rep_first_name || ''} ${log.sales_rep_last_name || ''}`.trim() || log.sales_rep_email || 'N/A',
        log.quantity_sold,
        `${Number(log.unit_price).toFixed(2)} LKR`,
        `${Number(log.total_amount).toFixed(2)} LKR`,
        log.previous_stock_quantity,
        log.new_stock_quantity,
        log.order_status || 'N/A'
      ])
    ];
    
    const csv = csvData.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sales_quantity_logs.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleViewDetails = (log: SalesQuantityLog) => {
    setSelectedLog(log);
    setShowDetails(true);
  };

  if (loading) {
    return <div className="text-gray-500 text-center py-8 font-medium">Loading sales quantity logs...</div>;
  }

  if (error) {
    return <div className="text-red-600 text-center py-8 font-medium">{error}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex items-center gap-3">
        <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Sales Quantity Logs</h1>
          <p className="text-gray-600 mt-1">Track inventory changes from approved orders</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-600 text-sm font-medium mb-1">Total Sales Records</p>
              <p className="text-2xl font-bold text-blue-800">{logs.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-green-50 rounded-xl border border-green-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-700 text-sm font-medium mb-1">Total Quantity Sold</p>
              <p className="text-2xl font-bold text-green-800">
                {logs.reduce((sum, log) => sum + (log.quantity_sold || 0), 0)}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-purple-50 rounded-xl border border-purple-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-700 text-sm font-medium mb-1">Total Revenue</p>
              <p className="text-2xl font-bold text-purple-800">
                {logs.reduce((sum, log) => sum + Number(log.total_amount || 0), 0).toFixed(0)} LKR
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-orange-50 rounded-xl border border-orange-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-700 text-sm font-medium mb-1">Unique Products</p>
              <p className="text-2xl font-bold text-orange-800">
                {new Set(logs.map(log => log.product_id)).size}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-xl shadow border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-1">Sales Quantity History</h2>
            <p className="text-gray-600">Detailed log of all inventory changes from approved orders</p>
          </div>
          <button
            onClick={exportData}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export CSV
          </button>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by product, shop, or representative..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300"
            />
          </div>
        </div>

        {/* Logs Table */}
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 font-semibold text-gray-700">Date</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Product</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Shop</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Sales Rep</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Quantity</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Total</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Inventory Change</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedLogs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="text-gray-900 font-medium">{new Date(log.created_at).toLocaleDateString()}</div>
                    <div className="text-gray-500 text-sm">{new Date(log.created_at).toLocaleTimeString()}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{log.product_name || 'N/A'}</div>
                    {log.product_description && (
                      <div className="text-sm text-gray-500">{log.product_description}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{log.shop_name || 'N/A'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-gray-900 font-medium">
                      {log.sales_rep_first_name ? `${log.sales_rep_first_name} ${log.sales_rep_last_name}` : log.sales_rep_email}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">
                      {log.quantity_sold}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-bold text-gray-900">{Number(log.total_amount).toFixed(2)} LKR</div>
                    <div className="text-sm text-gray-500">{Number(log.unit_price).toFixed(2)} LKR each</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm">
                      <div className="text-gray-600">Before: <span className="font-medium">{log.previous_stock_quantity}</span></div>
                      <div className="text-gray-600">After: <span className="font-medium">{log.new_stock_quantity}</span></div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleViewDetails(log)}
                      className="px-3 py-1 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded text-sm font-medium transition-colors"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center mt-6 p-4 bg-gray-50 rounded-lg">
            <span className="text-sm text-gray-600">
              Showing {page * LOGS_PER_PAGE - LOGS_PER_PAGE + 1} to {Math.min(page * LOGS_PER_PAGE, filteredLogs.length)} of {filteredLogs.length} entries
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(prev => Math.max(1, prev - 1))}
                disabled={page === 1}
                className="px-3 py-1 bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="text-sm text-gray-700">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {filteredLogs.length === 0 && (
          <div className="text-center py-8">
            <div className="text-4xl mb-2">📭</div>
            <div className="text-gray-400 font-medium">No sales quantity logs found.</div>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {showDetails && selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto relative">
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl font-bold"
              onClick={() => setShowDetails(false)}
              aria-label="Close"
            >
              &times;
            </button>
            
            <h3 className="text-xl font-bold mb-4 text-gray-900">Sales Quantity Details</h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Product Information</h4>
                  <div className="space-y-2 text-sm text-gray-700">
                    <div><span className="font-medium">Name:</span> {selectedLog.product_name || 'N/A'}</div>
                    <div><span className="font-medium">Description:</span> {selectedLog.product_description || 'N/A'}</div>
                    <div><span className="font-medium">Unit Price:</span> {Number(selectedLog.unit_price).toFixed(2)} LKR</div>
                  </div>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Transaction Details</h4>
                  <div className="space-y-2 text-sm text-gray-700">
                    <div><span className="font-medium">Quantity Sold:</span> {selectedLog.quantity_sold}</div>
                    <div><span className="font-medium">Total Amount:</span> {Number(selectedLog.total_amount).toFixed(2)} LKR</div>
                    <div><span className="font-medium">Order Status:</span> {selectedLog.order_status || 'N/A'}</div>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Shop & Representative</h4>
                  <div className="space-y-2 text-sm text-gray-700">
                    <div><span className="font-medium">Shop:</span> {selectedLog.shop_name || 'N/A'}</div>
                    <div><span className="font-medium">Sales Rep:</span> {selectedLog.sales_rep_first_name ? `${selectedLog.sales_rep_first_name} ${selectedLog.sales_rep_last_name}` : selectedLog.sales_rep_email}</div>
                    <div><span className="font-medium">Email:</span> {selectedLog.sales_rep_email}</div>
                  </div>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Inventory Change</h4>
                  <div className="space-y-2 text-sm text-gray-700">
                    <div><span className="font-medium">Previous:</span> {selectedLog.previous_stock_quantity}</div>
                    <div><span className="font-medium">New:</span> {selectedLog.new_stock_quantity}</div>
                    <div><span className="font-medium">Change:</span> <span className="text-red-600">-{selectedLog.quantity_sold}</span></div>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-2">Additional Information</h4>
                <div className="space-y-2 text-sm text-gray-700">
                  <div><span className="font-medium">Order ID:</span> {selectedLog.order_id.slice(0, 8)}...</div>
                  <div><span className="font-medium">Transaction Date:</span> {new Date(selectedLog.created_at).toLocaleString()}</div>
                  {selectedLog.log_details && (
                    <div><span className="font-medium">Log Details:</span> <pre className="text-xs mt-1 bg-white p-2 rounded border">{JSON.stringify(selectedLog.log_details, null, 2)}</pre></div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex justify-end mt-6 pt-4 border-t border-gray-200">
              <button
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-medium transition-colors"
                onClick={() => setShowDetails(false)}
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