import React, { useEffect, useState, useRef } from 'react';
import { apiFetch } from '../../../utils/api';

interface Shop {
  id: string;
  name: string;
  address: string;
  owner_nic: string;
  email?: string;
  phone: string;
  sales_rep_id?: string;
  sales_rep_first_name?: string;
  sales_rep_last_name?: string;
  max_bill_amount: number;
  max_active_bills: number;
  created_at?: string;
  updated_at?: string;
}

interface ShopDetails {
  id: string;
  name: string;
  address: string;
  owner_nic: string;
  email?: string;
  phone: string;
  sales_rep_id?: string;
  sales_rep_first_name?: string;
  sales_rep_last_name?: string;
  max_bill_amount: number;
  max_active_bills: number;
  current_outstanding: number;
  active_bills: number;
  available_credit: number;
  pending_orders: Array<{
    id: string;
    created_at: string;
    total: number;
    notes?: string;
    item_count: number;
    sales_rep_first_name?: string;
    sales_rep_last_name?: string;
    sales_rep_email?: string;
  }>;
  active_bills_details: Array<{
    id: string;
    created_at: string;
    total: number;
    notes?: string;
    collected: number;
    outstanding: number;
    item_count: number;
    sales_rep_first_name?: string;
    sales_rep_last_name?: string;
  }>;
  recent_payments: Array<{
    id: string;
    amount: number;
    notes?: string;
    created_at: string;
    order_id: string;
    order_total: number;
    sales_rep_first_name?: string;
    sales_rep_last_name?: string;
  }>;
}

interface User {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
}

export default function ShopManagement() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [salesReps, setSalesReps] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editShop, setEditShop] = useState<Shop | null>(null);
  const [form, setForm] = useState({
    name: '', address: '', owner_nic: '', email: '', phone: '', sales_rep_id: '', max_bill_amount: '', max_active_bills: ''
  });
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Detailed shop view state
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedShopDetails, setSelectedShopDetails] = useState<ShopDetails | null>(null);
  const [loadingShopDetails, setLoadingShopDetails] = useState(false);
  const [shopDetailsError, setShopDetailsError] = useState('');

  // Function to show toast notification
  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    // Clear any existing timeout
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    // Auto-dismiss toast after 4 seconds
    const timeout = setTimeout(() => setToast(null), 4000);
    toastTimeoutRef.current = timeout;
  };

  // Function to trigger refresh
  const triggerRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Small delay to ensure server operation completes
      await new Promise(resolve => setTimeout(resolve, 200));
      // Fetch fresh data directly
      const data = await apiFetch('/api/marudham/shops');
      setShops(data.shops);
      setError('');
      // Reset to first page to show updated data
      setPage(1);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Phone number validation function
  const validatePhoneNumber = (phone: string) => {
    // Remove all non-digit characters except +
    const cleaned = phone.replace(/[^\d+]/g, '');
    
    // If it doesn't start with +94, add it
    if (!cleaned.startsWith('+94')) {
      return '+94' + cleaned.replace(/^\+/, '');
    }
    
    // Ensure it's exactly +94 followed by 9 digits
    const match = cleaned.match(/^\+94(\d{9})$/);
    if (match) {
      return cleaned;
    }
    
    // If it has more than 9 digits after +94, truncate
    if (cleaned.startsWith('+94') && cleaned.length > 13) {
      return cleaned.substring(0, 13);
    }
    
    return cleaned;
  };

  const handlePhoneChange = (value: string) => {
    const validated = validatePhoneNumber(value);
    setForm(f => ({ ...f, phone: validated }));
  };

  // Helper function to format phone number for display
  const formatPhoneForDisplay = (phone: string) => {
    if (!phone) return '-';
    // If it's already in the correct format, return as is
    if (phone.match(/^\+94\d{9}$/)) {
      return phone;
    }
    // If it's a 9-digit number without +94, add it
    if (phone.match(/^\d{9}$/)) {
      return '+94' + phone;
    }
    // If it's a 10-digit number starting with 0, replace with +94
    if (phone.match(/^0\d{9}$/)) {
      return '+94' + phone.substring(1);
    }
    return phone;
  };

  // Search/filter, sorting, and pagination state
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<'name' | 'address' | 'phone' | 'sales_rep' | 'max_bill_amount' | 'max_active_bills'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const SHOPS_PER_PAGE = 10;
  // Filtered shops
  const filteredShops = shops.filter(shop => {
    const q = search.toLowerCase();
    return (
      shop.name.toLowerCase().includes(q) ||
      shop.address.toLowerCase().includes(q) ||
      shop.phone.toLowerCase().includes(q) ||
      ((shop.sales_rep_first_name || '') + ' ' + (shop.sales_rep_last_name || '')).toLowerCase().includes(q)
    );
  });
  // Sorting
  function handleSort(col: typeof sortBy) {
    if (sortBy === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
    setPage(1);
  }
  const sortedShops = [...filteredShops].sort((a, b) => {
    let aVal: any, bVal: any;
    if (sortBy === 'sales_rep') {
      aVal = (a.sales_rep_first_name || '') + ' ' + (a.sales_rep_last_name || '');
      bVal = (b.sales_rep_first_name || '') + ' ' + (b.sales_rep_last_name || '');
    } else {
      aVal = a[sortBy];
      bVal = b[sortBy];
    }
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    }
    return 0;
  });
  const totalPages = Math.ceil(sortedShops.length / SHOPS_PER_PAGE) || 1;
  const paginatedShops = sortedShops.slice((page - 1) * SHOPS_PER_PAGE, page * SHOPS_PER_PAGE);
  // Export CSV
  function exportCSV() {
    const rows = [
      ['Name', 'Address', 'Phone', 'Sales Rep', 'Max Bill Amount', 'Max Active Bills'],
      ...sortedShops.map(s => [
        s.name,
        s.address,
        s.phone,
        s.sales_rep_first_name ? `${s.sales_rep_first_name} ${s.sales_rep_last_name}` : '-',
        s.max_bill_amount,
        s.max_active_bills
      ]),
    ];
    const csv = rows.map(row => row.map(String).map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'shops.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const fetchShops = () => {
    setLoading(true);
    setError('');
    apiFetch('/api/marudham/shops')
      .then(data => setShops(data.shops))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  const fetchSalesReps = () => {
    apiFetch('/api/marudham/users')
      .then(data => setSalesReps(data.users.filter((u: User) => u.role === 'representative')))
      .catch(() => setSalesReps([]));
  };

  useEffect(() => {
    fetchShops();
    fetchSalesReps();
  }, []);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const openAddModal = () => {
    setForm({ name: '', address: '', owner_nic: '', email: '', phone: '', sales_rep_id: '', max_bill_amount: '', max_active_bills: '' });
    setFormError('');
    setShowAddModal(true);
    setTimeout(() => firstInputRef.current?.focus(), 100);
  };

  const openEditModal = (shop: Shop) => {
    setEditShop(shop);
    setForm({
      name: shop.name,
      address: shop.address,
      owner_nic: shop.owner_nic,
      email: shop.email || '',
      phone: shop.phone,
      sales_rep_id: shop.sales_rep_id || '',
      max_bill_amount: shop.max_bill_amount.toString(),
      max_active_bills: shop.max_active_bills.toString(),
    });
    setFormError('');
    setShowEditModal(true);
    setTimeout(() => firstInputRef.current?.focus(), 100);
  };

  const handleAddShop = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    try {
      await apiFetch('/api/marudham/shops', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          address: form.address,
          owner_nic: form.owner_nic,
          email: form.email,
          phone: form.phone,
          sales_rep_id: form.sales_rep_id || null,
          max_bill_amount: parseFloat(form.max_bill_amount),
          max_active_bills: parseInt(form.max_active_bills, 10),
        }),
      });
      setShowAddModal(false);
      triggerRefresh();
      showToast('success', 'Shop added successfully!');
    } catch (err: any) {
      setFormError(err.message);
      showToast('error', err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleEditShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editShop) return;
    setFormLoading(true);
    setFormError('');
    try {
      await apiFetch(`/api/marudham/shops/${editShop.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: form.name,
          address: form.address,
          owner_nic: form.owner_nic,
          email: form.email,
          phone: form.phone,
          sales_rep_id: form.sales_rep_id || null,
          max_bill_amount: parseFloat(form.max_bill_amount),
          max_active_bills: parseInt(form.max_active_bills, 10),
        }),
      });
      setShowEditModal(false);
      setEditShop(null);
      triggerRefresh();
      showToast('success', 'Shop updated successfully!');
    } catch (err: any) {
      setFormError(err.message);
      showToast('error', err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteShop = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this shop?')) return;
    setFormLoading(true);
    try {
      await apiFetch(`/api/marudham/shops/${id}`, { method: 'DELETE' });
      triggerRefresh();
      showToast('success', 'Shop deleted successfully!');
    } catch (err: any) {
      alert(err.message);
      showToast('error', err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleViewShopDetails = async (shopId: string) => {
    setLoadingShopDetails(true);
    setShopDetailsError('');
    setSelectedShopDetails(null);
    setShowDetailsModal(true);
    
    try {
      const data = await apiFetch(`/api/marudham/shops/${shopId}/details`);
      setSelectedShopDetails(data.shop);
    } catch (err: any) {
      setShopDetailsError(err.message);
      showToast('error', err.message);
    } finally {
      setLoadingShopDetails(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex items-center gap-3">
        <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Shop Management</h1>
          <p className="text-gray-600 text-sm">Manage shops and assign sales representatives</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
          <div className="flex flex-col items-start">
            <span className="text-blue-600 text-sm font-medium mb-1">Total Shops</span>
            <span className="text-xl font-bold text-blue-800">{shops.length}</span>
            <span className="text-xs text-gray-500 mt-1">Registered shops</span>
          </div>
        </div>
        <div className="bg-green-50 rounded-lg border border-green-200 p-4">
          <div className="flex flex-col items-start">
            <span className="text-green-700 text-sm font-medium mb-1">Assigned Shops</span>
            <span className="text-xl font-bold text-green-800">
              {shops.filter(shop => shop.sales_rep_id).length}
            </span>
            <span className="text-xs text-gray-500 mt-1">With sales reps</span>
          </div>
        </div>
        <div className="bg-purple-50 rounded-lg border border-purple-200 p-4">
          <div className="flex flex-col items-start">
            <span className="text-purple-700 text-sm font-medium mb-1">Unassigned Shops</span>
            <span className="text-xl font-bold text-purple-800">
              {shops.filter(shop => !shop.sales_rep_id).length}
            </span>
            <span className="text-xs text-gray-500 mt-1">Need assignment</span>
          </div>
        </div>
        <div className="bg-orange-50 rounded-lg border border-orange-200 p-4">
          <div className="flex flex-col items-start">
            <span className="text-orange-700 text-sm font-medium mb-1">Avg Bill Limit</span>
            <span className="text-xl font-bold text-orange-800">
              {shops.length > 0 
                ? (shops.reduce((sum, shop) => sum + Number(shop.max_bill_amount || 0), 0) / shops.length).toFixed(0)
                : '0'
              } LKR
            </span>
            <span className="text-xs text-gray-500 mt-1">Per shop</span>
          </div>
        </div>
      </div>

      {/* Shop Management Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Shop Directory</h2>
            <p className="text-gray-600 text-sm">Manage shops and assign sales representatives</p>
          </div>
          <div className="flex gap-2 items-center">
            <button
              className="px-4 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg font-medium flex items-center gap-2 transition-colors"
              onClick={openAddModal}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add Shop
            </button>
            <button
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium flex items-center gap-2 transition-colors"
              onClick={exportCSV}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by name, address, phone, or sales rep..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300 text-sm text-gray-900 bg-white"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
        </div>

        {loading ? (
          <div className="text-gray-400 text-center py-8">Loading shops...</div>
        ) : error ? (
          <div className="text-red-500 text-center py-8">{error}</div>
        ) : (
          <div className="overflow-x-auto">
            {isRefreshing && (
              <div className="text-center py-2 bg-blue-50 border-b border-blue-200">
                <div className="flex items-center justify-center text-blue-600 text-sm">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Refreshing data...
                </div>
              </div>
            )}
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-700 text-sm cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('name')}>
                    <div className="flex items-center">
                      Name
                      {(loading || isRefreshing) && (
                        <svg className="animate-spin ml-2 h-3 w-3 text-purple-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      )}
                      {sortBy === 'name' && (sortDir === 'asc' ? '▲' : '▼')}
                    </div>
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700 text-sm cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('address')}>
                    Address {sortBy === 'address' && (sortDir === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700 text-sm cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('phone')}>
                    Phone {sortBy === 'phone' && (sortDir === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700 text-sm cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('sales_rep')}>
                    Sales Rep {sortBy === 'sales_rep' && (sortDir === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700 text-sm cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('max_bill_amount')}>
                    Max Bill Amount {sortBy === 'max_bill_amount' && (sortDir === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700 text-sm cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('max_active_bills')}>
                    Max Active Bills {sortBy === 'max_active_bills' && (sortDir === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700 text-sm">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedShops.map(shop => (
                  <tr key={shop.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-4">
                      <div className="font-medium text-gray-900 text-sm">{shop.name}</div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-gray-700 text-sm">{shop.address}</div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-gray-700 text-sm">{formatPhoneForDisplay(shop.phone)}</div>
                    </td>
                    <td className="py-4 px-4">
                      <div className={`font-medium text-sm ${shop.sales_rep_first_name ? 'text-green-600' : 'text-gray-400'}`}>
                        {shop.sales_rep_first_name ? `${shop.sales_rep_first_name} ${shop.sales_rep_last_name}` : 'Unassigned'}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-semibold text-purple-600 text-sm">
                        {typeof shop.max_bill_amount === 'number' ? shop.max_bill_amount.toFixed(2) : Number(shop.max_bill_amount).toFixed(2)} LKR
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-semibold text-gray-900 text-sm">{shop.max_active_bills}</div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <button
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                          title="View"
                          onClick={() => handleViewShopDetails(shop.id)}
                        >
                          👁️
                        </button>
                        <button
                          className="text-purple-600 hover:text-purple-700 transition-colors"
                          onClick={() => openEditModal(shop)}
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          className="text-red-500 hover:text-red-700 transition-colors"
                          onClick={() => handleDeleteShop(shop.id)}
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center mt-6">
            <span className="text-sm text-gray-600">
              Showing {page * SHOPS_PER_PAGE - SHOPS_PER_PAGE + 1} to {Math.min(page * SHOPS_PER_PAGE, filteredShops.length)} of {filteredShops.length} entries
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
        )}

        {filteredShops.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            No shops found matching your criteria.
          </div>
        )}
      </div>
      {/* Add Shop Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-lg border border-gray-200 w-full max-w-md p-6 relative">
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl font-bold"
              onClick={() => setShowAddModal(false)}
              aria-label="Close"
            >
              &times;
            </button>
            <h3 className="text-lg font-semibold text-gray-900 mb-6 text-center">Add Shop</h3>
            <form className="flex flex-col gap-4" onSubmit={handleAddShop}>
              <input
                ref={firstInputRef}
                type="text"
                placeholder="Shop Name"
                className="px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-300 text-sm text-gray-900 bg-white"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
              />
              <input
                type="text"
                placeholder="Address"
                className="px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-300 text-sm text-gray-900 bg-white"
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                required
              />
              <input
                type="text"
                placeholder="Owner's NIC"
                className="px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-300 text-sm text-gray-900 bg-white"
                value={form.owner_nic}
                onChange={e => setForm(f => ({ ...f, owner_nic: e.target.value }))}
                required
              />
              <input
                type="email"
                placeholder="Email (optional)"
                className="px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-300 text-sm text-gray-900 bg-white"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              />
              <input
                type="text"
                placeholder="Phone No (+94XXXXXXXXX)"
                className="px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-300 text-sm text-gray-900 bg-white"
                value={form.phone}
                onChange={e => handlePhoneChange(e.target.value)}
                required
              />
              <div className="text-xs text-gray-500 -mt-2">
                Format: +94 followed by 9 digits (e.g., +94712345678)
              </div>
              <select
                className="px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-300 text-sm text-gray-900 bg-white"
                value={form.sales_rep_id}
                onChange={e => setForm(f => ({ ...f, sales_rep_id: e.target.value }))}
              >
                <option value="">Assign Sales Rep (optional)</option>
                {salesReps.map(rep => (
                  <option key={rep.id} value={rep.id}>{rep.first_name} {rep.last_name}</option>
                ))}
              </select>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Max Bill Amount"
                className="px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-300 text-sm text-gray-900 bg-white"
                value={form.max_bill_amount}
                onChange={e => setForm(f => ({ ...f, max_bill_amount: e.target.value }))}
                required
              />
              <input
                type="number"
                min="0"
                step="1"
                placeholder="Max Active Bills"
                className="px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-300 text-sm text-gray-900 bg-white"
                value={form.max_active_bills}
                onChange={e => setForm(f => ({ ...f, max_active_bills: e.target.value }))}
                required
              />
              {formError && <div className="text-red-500 text-sm text-center">{formError}</div>}
              <button
                type="submit"
                className="w-full py-2 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-700 font-medium transition-colors mt-2 disabled:opacity-60"
                disabled={formLoading}
              >
                {formLoading ? 'Adding...' : 'Add Shop'}
              </button>
            </form>
          </div>
        </div>
      )}
      {/* Edit Shop Modal */}
      {showEditModal && editShop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-lg border border-gray-200 w-full max-w-md p-6 relative">
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl font-bold"
              onClick={() => setShowEditModal(false)}
              aria-label="Close"
            >
              &times;
            </button>
            <h3 className="text-lg font-semibold text-gray-900 mb-6 text-center">Edit Shop</h3>
            <form className="flex flex-col gap-4" onSubmit={handleEditShop}>
              <input
                ref={firstInputRef}
                type="text"
                placeholder="Shop Name"
                className="px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-300 text-sm text-gray-900 bg-white"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
              />
              <input
                type="text"
                placeholder="Address"
                className="px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-300 text-sm text-gray-900 bg-white"
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                required
              />
              <input
                type="text"
                placeholder="Owner's NIC"
                className="px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-300 text-sm text-gray-900 bg-white"
                value={form.owner_nic}
                onChange={e => setForm(f => ({ ...f, owner_nic: e.target.value }))}
                required
              />
              <input
                type="email"
                placeholder="Email (optional)"
                className="px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-300 text-sm text-gray-900 bg-white"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              />
              <input
                type="text"
                placeholder="Phone No (+94XXXXXXXXX)"
                className="px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-300 text-sm text-gray-900 bg-white"
                value={form.phone}
                onChange={e => handlePhoneChange(e.target.value)}
                required
              />
              <div className="text-xs text-gray-500 -mt-2">
                Format: +94 followed by 9 digits (e.g., +94712345678)
              </div>
              <select
                className="px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-300 text-sm text-gray-900 bg-white"
                value={form.sales_rep_id}
                onChange={e => setForm(f => ({ ...f, sales_rep_id: e.target.value }))}
              >
                <option value="">Assign Sales Rep (optional)</option>
                {salesReps.map(rep => (
                  <option key={rep.id} value={rep.id}>{rep.first_name} {rep.last_name}</option>
                ))}
              </select>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Max Bill Amount"
                className="px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-300 text-sm text-gray-900 bg-white"
                value={form.max_bill_amount}
                onChange={e => setForm(f => ({ ...f, max_bill_amount: e.target.value }))}
                required
              />
              <input
                type="number"
                min="0"
                step="1"
                placeholder="Max Active Bills"
                className="px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-300 text-sm text-gray-900 bg-white"
                value={form.max_active_bills}
                onChange={e => setForm(f => ({ ...f, max_active_bills: e.target.value }))}
                required
              />
              {formError && <div className="text-red-500 text-sm text-center">{formError}</div>}
              <button
                type="submit"
                className="w-full py-2 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-700 font-medium transition-colors mt-2 disabled:opacity-60"
                disabled={formLoading}
              >
                {formLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>
      )}
      
      {/* Shop Details Modal */}
      {showDetailsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-lg border border-gray-200 w-full max-w-6xl max-h-[90vh] overflow-y-auto p-6 relative">
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl font-bold"
              onClick={() => setShowDetailsModal(false)}
              aria-label="Close"
            >
              &times;
            </button>
            
            {loadingShopDetails ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-gray-600 font-medium">Loading shop details...</span>
                </div>
              </div>
            ) : shopDetailsError ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-red-600 font-medium">{shopDetailsError}</p>
              </div>
            ) : selectedShopDetails ? (
              <div className="space-y-6">
                {/* Header */}
                <div className="border-b border-gray-200 pb-4">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Shop Details</h3>
                  <p className="text-gray-600 text-sm">{selectedShopDetails.name}</p>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
                    <div className="text-blue-600 text-sm font-medium mb-1">Current Outstanding</div>
                    <div className={`text-xl font-bold ${selectedShopDetails.current_outstanding > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {selectedShopDetails.current_outstanding.toFixed(2)} LKR
                    </div>
                  </div>
                  <div className="bg-green-50 rounded-lg border border-green-200 p-4">
                    <div className="text-green-600 text-sm font-medium mb-1">Available Credit</div>
                    <div className="text-xl font-bold text-green-700">
                      {selectedShopDetails.available_credit.toFixed(2)} LKR
                    </div>
                  </div>
                  <div className="bg-orange-50 rounded-lg border border-orange-200 p-4">
                    <div className="text-orange-600 text-sm font-medium mb-1">Active Bills</div>
                    <div className="text-xl font-bold text-orange-700">
                      {selectedShopDetails.active_bills}
                    </div>
                  </div>
                  <div className="bg-purple-50 rounded-lg border border-purple-200 p-4">
                    <div className="text-purple-600 text-sm font-medium mb-1">Pending Orders</div>
                    <div className="text-xl font-bold text-purple-700">
                      {selectedShopDetails.pending_orders.length}
                    </div>
                  </div>
                </div>

                {/* Shop Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gray-50 rounded-lg p-4 text-gray-900">
                    <h4 className="font-semibold text-gray-900 mb-3">Shop Information</h4>
                    <div className="space-y-2 text-sm">
                      <div><span className="font-medium">Name:</span> {selectedShopDetails.name}</div>
                      <div><span className="font-medium">Address:</span> {selectedShopDetails.address}</div>
                      <div><span className="font-medium">Phone:</span> {selectedShopDetails.phone}</div>
                      <div><span className="font-medium">Email:</span> {selectedShopDetails.email || 'N/A'}</div>
                      <div><span className="font-medium">Owner NIC:</span> {selectedShopDetails.owner_nic}</div>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4 text-gray-900">
                    <h4 className="font-semibold text-gray-900 mb-3">Sales Representative</h4>
                    <div className="space-y-2 text-sm">
                      <div><span className="font-medium">Name:</span> {selectedShopDetails.sales_rep_first_name ? `${selectedShopDetails.sales_rep_first_name} ${selectedShopDetails.sales_rep_last_name}` : 'Unassigned'}</div>
                      <div><span className="font-medium">Max Bill Amount:</span> {Number(selectedShopDetails.max_bill_amount).toFixed(2)} LKR</div>
                      <div><span className="font-medium">Max Active Bills:</span> {selectedShopDetails.max_active_bills}</div>
                    </div>
                  </div>
                </div>

                {/* Pending Orders */}
                {selectedShopDetails.pending_orders.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">Pending Orders</h4>
                    <div className="overflow-hidden rounded-lg border border-gray-200">
                      <table className="min-w-full">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="px-4 py-2 text-left font-medium text-gray-700 text-sm">Date</th>
                            <th className="px-4 py-2 text-left font-medium text-gray-700 text-sm">Sales Rep</th>
                            <th className="px-4 py-2 text-left font-medium text-gray-700 text-sm">Total</th>
                            <th className="px-4 py-2 text-left font-medium text-gray-700 text-sm">Items</th>
                            <th className="px-4 py-2 text-left font-medium text-gray-700 text-sm">Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {selectedShopDetails.pending_orders.map((order) => (
                            <tr key={order.id} className="hover:bg-gray-50">
                              <td className="px-4 py-2 text-sm">{new Date(order.created_at).toLocaleDateString()}</td>
                              <td className="px-4 py-2 text-sm">
                                {order.sales_rep_first_name ? `${order.sales_rep_first_name} ${order.sales_rep_last_name}` : 'N/A'}
                              </td>
                              <td className="px-4 py-2 font-semibold text-sm">{order.total.toFixed(2)} LKR</td>
                              <td className="px-4 py-2 text-sm">{order.item_count}</td>
                              <td className="px-4 py-2 text-sm text-gray-600">{order.notes || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Active Bills */}
                {selectedShopDetails.active_bills_details.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">Active Bills</h4>
                    <div className="overflow-hidden rounded-lg border border-gray-200">
                      <table className="min-w-full">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="px-4 py-2 text-left font-medium text-gray-700 text-sm">Date</th>
                            <th className="px-4 py-2 text-left font-medium text-gray-700 text-sm">Sales Rep</th>
                            <th className="px-4 py-2 text-left font-medium text-gray-700 text-sm">Total</th>
                            <th className="px-4 py-2 text-left font-medium text-gray-700 text-sm">Collected</th>
                            <th className="px-4 py-2 text-left font-medium text-gray-700 text-sm">Outstanding</th>
                            <th className="px-4 py-2 text-left font-medium text-gray-700 text-sm">Items</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {selectedShopDetails.active_bills_details.map((bill) => (
                            <tr key={bill.id} className="hover:bg-gray-50">
                              <td className="px-4 py-2 text-sm">{new Date(bill.created_at).toLocaleDateString()}</td>
                              <td className="px-4 py-2 text-sm">
                                {bill.sales_rep_first_name ? `${bill.sales_rep_first_name} ${bill.sales_rep_last_name}` : 'N/A'}
                              </td>
                              <td className="px-4 py-2 font-semibold text-sm">{bill.total.toFixed(2)} LKR</td>
                              <td className="px-4 py-2 text-sm text-green-600">{bill.collected.toFixed(2)} LKR</td>
                              <td className="px-4 py-2 text-sm text-red-600 font-semibold">{bill.outstanding.toFixed(2)} LKR</td>
                              <td className="px-4 py-2 text-sm">{bill.item_count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Recent Payments */}
                {selectedShopDetails.recent_payments.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">Recent Payments</h4>
                    <div className="overflow-hidden rounded-lg border border-gray-200">
                      <table className="min-w-full">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="px-4 py-2 text-left font-medium text-gray-700 text-sm">Date</th>
                            <th className="px-4 py-2 text-left font-medium text-gray-700 text-sm">Sales Rep</th>
                            <th className="px-4 py-2 text-left font-medium text-gray-700 text-sm">Amount</th>
                            <th className="px-4 py-2 text-left font-medium text-gray-700 text-sm">Order Total</th>
                            <th className="px-4 py-2 text-left font-medium text-gray-700 text-sm">Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {selectedShopDetails.recent_payments.map((payment) => (
                            <tr key={payment.id} className="hover:bg-gray-50">
                              <td className="px-4 py-2 text-sm">{new Date(payment.created_at).toLocaleDateString()}</td>
                              <td className="px-4 py-2 text-sm">
                                {payment.sales_rep_first_name ? `${payment.sales_rep_first_name} ${payment.sales_rep_last_name}` : 'N/A'}
                              </td>
                              <td className="px-4 py-2 font-semibold text-sm text-green-600">{payment.amount.toFixed(2)} LKR</td>
                              <td className="px-4 py-2 text-sm">{payment.order_total.toFixed(2)} LKR</td>
                              <td className="px-4 py-2 text-sm text-gray-600">{payment.notes || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-medium transition-colors"
                    onClick={() => setShowDetailsModal(false)}
                  >
                    Close
                  </button>
                  <button
                    className="px-4 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded font-medium transition-colors"
                    onClick={() => {
                      setShowDetailsModal(false);
                      openEditModal(selectedShopDetails as any);
                    }}
                  >
                    Edit Shop
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
      
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-fadeIn">
          <div className={`rounded-lg p-4 shadow-lg border ${
            toast.type === 'success' 
              ? 'bg-green-50 border-green-200 text-green-800' 
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <div className="flex items-center">
              {toast.type === 'success' ? (
                <svg className="w-5 h-5 text-green-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              )}
              <span className="font-medium">{toast.message}</span>
              <button
                onClick={() => setToast(null)}
                className="ml-3 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 
