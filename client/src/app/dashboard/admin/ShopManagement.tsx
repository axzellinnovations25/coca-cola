import React, { useEffect, useState, useRef } from 'react';
import { apiFetch, clearCache } from '../../../utils/api';

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
      clearCache('/api/marudham/shops');
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
      await triggerRefresh();
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
      await triggerRefresh();
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
      await triggerRefresh();
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

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Shop Management</h1>
            <p className="text-sm text-gray-500">Manage shops and assign sales representatives</p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-blue-100 shadow-sm p-5">
          <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center mb-3">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
            </svg>
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Total Shops</p>
          <p className="text-2xl font-bold text-gray-900">{shops.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-green-100 shadow-sm p-5">
          <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center mb-3">
            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Assigned</p>
          <p className="text-2xl font-bold text-gray-900">{shops.filter(shop => shop.sales_rep_id).length}</p>
        </div>
        <div className="bg-white rounded-xl border border-violet-100 shadow-sm p-5">
          <div className="w-9 h-9 bg-violet-50 rounded-lg flex items-center justify-center mb-3">
            <svg className="w-4 h-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Unassigned</p>
          <p className="text-2xl font-bold text-gray-900">{shops.filter(shop => !shop.sales_rep_id).length}</p>
        </div>
        <div className="bg-white rounded-xl border border-orange-100 shadow-sm p-5">
          <div className="w-9 h-9 bg-orange-50 rounded-lg flex items-center justify-center mb-3">
            <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Avg Bill Limit</p>
          <p className="text-2xl font-bold text-gray-900">
            {shops.length > 0
              ? (shops.reduce((sum, shop) => sum + Number(shop.max_bill_amount || 0), 0) / shops.length).toFixed(0)
              : '0'
            }
          </p>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between p-4 border-b border-gray-100">
          <div className="relative w-full sm:w-72">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by name, address, phone, or sales rep..."
              className="pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 text-sm bg-white text-gray-900 w-full"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg text-sm font-semibold transition-colors"
              onClick={exportCSV}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export
            </button>
            <button
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
              onClick={openAddModal}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add Shop
            </button>
          </div>
        </div>

        {/* Refreshing banner */}
        {isRefreshing && (
          <div className="flex items-center justify-center gap-2 py-2 bg-violet-50 border-b border-violet-100 text-violet-600 text-sm">
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Refreshing data...
          </div>
        )}

        {/* Table body states */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm text-red-600 font-medium">{error}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="py-3 px-5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('name')}>
                      <div className="flex items-center gap-1">
                        Name
                        {isRefreshing && (
                          <svg className="animate-spin h-3 w-3 text-violet-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        )}
                        {sortBy === 'name' && <span className="text-violet-500">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                      </div>
                    </th>
                    <th className="py-3 px-5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('address')}>
                      <div className="flex items-center gap-1">
                        Address
                        {sortBy === 'address' && <span className="text-violet-500">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                      </div>
                    </th>
                    <th className="py-3 px-5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('phone')}>
                      <div className="flex items-center gap-1">
                        Phone
                        {sortBy === 'phone' && <span className="text-violet-500">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                      </div>
                    </th>
                    <th className="py-3 px-5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('sales_rep')}>
                      <div className="flex items-center gap-1">
                        Sales Rep
                        {sortBy === 'sales_rep' && <span className="text-violet-500">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                      </div>
                    </th>
                    <th className="py-3 px-5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('max_bill_amount')}>
                      <div className="flex items-center gap-1">
                        Max Bill
                        {sortBy === 'max_bill_amount' && <span className="text-violet-500">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                      </div>
                    </th>
                    <th className="py-3 px-5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('max_active_bills')}>
                      <div className="flex items-center gap-1">
                        Max Bills
                        {sortBy === 'max_active_bills' && <span className="text-violet-500">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                      </div>
                    </th>
                    <th className="py-3 px-5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedShops.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                          <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
                            </svg>
                          </div>
                          <p className="text-sm font-bold text-gray-700">No shops found</p>
                          <p className="text-sm text-gray-400">Try adjusting your search or add a new shop.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedShops.map(shop => (
                      <tr key={shop.id} className="border-b border-gray-100 last:border-0 hover:bg-violet-50/30 transition-colors">
                        <td className="py-3.5 px-5 text-sm">
                          <span className="font-semibold text-gray-900">{shop.name}</span>
                        </td>
                        <td className="py-3.5 px-5 text-sm text-gray-600">{shop.address}</td>
                        <td className="py-3.5 px-5 text-sm text-gray-600">{formatPhoneForDisplay(shop.phone)}</td>
                        <td className="py-3.5 px-5 text-sm">
                          {shop.sales_rep_first_name ? (
                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                              {shop.sales_rep_first_name} {shop.sales_rep_last_name}
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                              Unassigned
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-5 text-sm font-semibold text-violet-600">
                          {typeof shop.max_bill_amount === 'number' ? shop.max_bill_amount.toFixed(2) : Number(shop.max_bill_amount).toFixed(2)} LKR
                        </td>
                        <td className="py-3.5 px-5 text-sm font-semibold text-gray-900">{shop.max_active_bills}</td>
                        <td className="py-3.5 px-5 text-sm">
                          <div className="flex items-center gap-1.5">
                            <button
                              className="px-2.5 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-600 text-xs font-medium transition-colors"
                              title="View Details"
                              onClick={() => handleViewShopDetails(shop.id)}
                            >
                              View
                            </button>
                            <button
                              className="px-2.5 py-1.5 rounded-lg bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-medium transition-colors"
                              onClick={() => openEditModal(shop)}
                              title="Edit"
                            >
                              Edit
                            </button>
                            <button
                              className="px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs font-medium transition-colors"
                              onClick={() => handleDeleteShop(shop.id)}
                              title="Delete"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-100 bg-white">
              <p className="text-sm text-gray-500">
                {filteredShops.length === 0
                  ? 'No results'
                  : `Showing ${(page - 1) * SHOPS_PER_PAGE + 1}–${Math.min(page * SHOPS_PER_PAGE, filteredShops.length)} of ${filteredShops.length}`
                }
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
                  {page}
                </span>
                <span className="text-sm text-gray-400">of {totalPages}</span>
                <button
                  onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Add Shop Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto">
            <button
              className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
              onClick={() => setShowAddModal(false)}
              aria-label="Close"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-9 h-9 bg-violet-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900">Add Shop</h3>
            </div>
            <form className="flex flex-col gap-4" onSubmit={handleAddShop}>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Shop Name</label>
                <input
                  ref={firstInputRef}
                  type="text"
                  placeholder="e.g. Perera General Store"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 text-sm bg-white text-gray-900"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Address</label>
                <input
                  type="text"
                  placeholder="Street, City"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 text-sm bg-white text-gray-900"
                  value={form.address}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Owner NIC</label>
                <input
                  type="text"
                  placeholder="e.g. 123456789V"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 text-sm bg-white text-gray-900"
                  value={form.owner_nic}
                  onChange={e => setForm(f => ({ ...f, owner_nic: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Email <span className="normal-case font-normal text-gray-400">(optional)</span></label>
                <input
                  type="email"
                  placeholder="owner@email.com"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 text-sm bg-white text-gray-900"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Phone</label>
                <input
                  type="text"
                  placeholder="+94XXXXXXXXX"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 text-sm bg-white text-gray-900"
                  value={form.phone}
                  onChange={e => handlePhoneChange(e.target.value)}
                  required
                />
                <p className="text-xs text-gray-400 mt-1">Format: +94 followed by 9 digits (e.g., +94712345678)</p>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Sales Rep <span className="normal-case font-normal text-gray-400">(optional)</span></label>
                <select
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 text-sm bg-white text-gray-900"
                  value={form.sales_rep_id}
                  onChange={e => setForm(f => ({ ...f, sales_rep_id: e.target.value }))}
                >
                  <option value="">Select a sales rep...</option>
                  {salesReps.map(rep => (
                    <option key={rep.id} value={rep.id}>{rep.first_name} {rep.last_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Max Bill Amount (LKR)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 text-sm bg-white text-gray-900"
                  value={form.max_bill_amount}
                  onChange={e => setForm(f => ({ ...f, max_bill_amount: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Max Active Bills</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 text-sm bg-white text-gray-900"
                  value={form.max_active_bills}
                  onChange={e => setForm(f => ({ ...f, max_active_bills: e.target.value }))}
                  required
                />
              </div>
              {formError && <p className="text-red-500 text-sm text-center">{formError}</p>}
              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-semibold transition-colors mt-2 disabled:opacity-60"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto">
            <button
              className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
              onClick={() => setShowEditModal(false)}
              aria-label="Close"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-9 h-9 bg-violet-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900">Edit Shop</h3>
            </div>
            <form className="flex flex-col gap-4" onSubmit={handleEditShop}>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Shop Name</label>
                <input
                  ref={firstInputRef}
                  type="text"
                  placeholder="e.g. Perera General Store"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 text-sm bg-white text-gray-900"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Address</label>
                <input
                  type="text"
                  placeholder="Street, City"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 text-sm bg-white text-gray-900"
                  value={form.address}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Owner NIC</label>
                <input
                  type="text"
                  placeholder="e.g. 123456789V"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 text-sm bg-white text-gray-900"
                  value={form.owner_nic}
                  onChange={e => setForm(f => ({ ...f, owner_nic: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Email <span className="normal-case font-normal text-gray-400">(optional)</span></label>
                <input
                  type="email"
                  placeholder="owner@email.com"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 text-sm bg-white text-gray-900"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Phone</label>
                <input
                  type="text"
                  placeholder="+94XXXXXXXXX"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 text-sm bg-white text-gray-900"
                  value={form.phone}
                  onChange={e => handlePhoneChange(e.target.value)}
                  required
                />
                <p className="text-xs text-gray-400 mt-1">Format: +94 followed by 9 digits (e.g., +94712345678)</p>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Sales Rep <span className="normal-case font-normal text-gray-400">(optional)</span></label>
                <select
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 text-sm bg-white text-gray-900"
                  value={form.sales_rep_id}
                  onChange={e => setForm(f => ({ ...f, sales_rep_id: e.target.value }))}
                >
                  <option value="">Select a sales rep...</option>
                  {salesReps.map(rep => (
                    <option key={rep.id} value={rep.id}>{rep.first_name} {rep.last_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Max Bill Amount (LKR)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 text-sm bg-white text-gray-900"
                  value={form.max_bill_amount}
                  onChange={e => setForm(f => ({ ...f, max_bill_amount: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Max Active Bills</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 text-sm bg-white text-gray-900"
                  value={form.max_active_bills}
                  onChange={e => setForm(f => ({ ...f, max_active_bills: e.target.value }))}
                  required
                />
              </div>
              {formError && <p className="text-red-500 text-sm text-center">{formError}</p>}
              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-semibold transition-colors mt-2 disabled:opacity-60"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto p-6 relative">
            <button
              className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
              onClick={() => setShowDetailsModal(false)}
              aria-label="Close"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {loadingShopDetails ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
              </div>
            ) : shopDetailsError ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-sm text-red-600 font-medium">{shopDetailsError}</p>
              </div>
            ) : selectedShopDetails ? (
              <div className="space-y-6">
                {/* Modal Header */}
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-violet-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{selectedShopDetails.name}</h3>
                    <p className="text-sm text-gray-500">Shop Details</p>
                  </div>
                </div>

                {/* Detail Summary Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white rounded-xl border border-red-100 shadow-sm p-4">
                    <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center mb-2">
                      <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Outstanding</p>
                    <p className={`text-xl font-bold ${selectedShopDetails.current_outstanding > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {selectedShopDetails.current_outstanding.toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-white rounded-xl border border-green-100 shadow-sm p-4">
                    <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center mb-2">
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Available Credit</p>
                    <p className="text-xl font-bold text-green-700">{selectedShopDetails.available_credit.toFixed(2)}</p>
                  </div>
                  <div className="bg-white rounded-xl border border-orange-100 shadow-sm p-4">
                    <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center mb-2">
                      <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Active Bills</p>
                    <p className="text-xl font-bold text-gray-900">{selectedShopDetails.active_bills}</p>
                  </div>
                  <div className="bg-white rounded-xl border border-violet-100 shadow-sm p-4">
                    <div className="w-8 h-8 bg-violet-50 rounded-lg flex items-center justify-center mb-2">
                      <svg className="w-4 h-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Pending Orders</p>
                    <p className="text-xl font-bold text-gray-900">{selectedShopDetails.pending_orders.length}</p>
                  </div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h4 className="text-sm font-bold text-gray-700 mb-3">Shop Information</h4>
                    <dl className="space-y-2 text-sm">
                      <div className="flex gap-2"><dt className="font-semibold text-gray-500 w-24 flex-shrink-0">Name</dt><dd className="text-gray-900">{selectedShopDetails.name}</dd></div>
                      <div className="flex gap-2"><dt className="font-semibold text-gray-500 w-24 flex-shrink-0">Address</dt><dd className="text-gray-900">{selectedShopDetails.address}</dd></div>
                      <div className="flex gap-2"><dt className="font-semibold text-gray-500 w-24 flex-shrink-0">Phone</dt><dd className="text-gray-900">{selectedShopDetails.phone}</dd></div>
                      <div className="flex gap-2"><dt className="font-semibold text-gray-500 w-24 flex-shrink-0">Email</dt><dd className="text-gray-900">{selectedShopDetails.email || 'N/A'}</dd></div>
                      <div className="flex gap-2"><dt className="font-semibold text-gray-500 w-24 flex-shrink-0">Owner NIC</dt><dd className="text-gray-900">{selectedShopDetails.owner_nic}</dd></div>
                    </dl>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h4 className="text-sm font-bold text-gray-700 mb-3">Sales Representative</h4>
                    <dl className="space-y-2 text-sm">
                      <div className="flex gap-2"><dt className="font-semibold text-gray-500 w-32 flex-shrink-0">Name</dt><dd className="text-gray-900">{selectedShopDetails.sales_rep_first_name ? `${selectedShopDetails.sales_rep_first_name} ${selectedShopDetails.sales_rep_last_name}` : 'Unassigned'}</dd></div>
                      <div className="flex gap-2"><dt className="font-semibold text-gray-500 w-32 flex-shrink-0">Max Bill</dt><dd className="text-gray-900">{Number(selectedShopDetails.max_bill_amount).toFixed(2)} LKR</dd></div>
                      <div className="flex gap-2"><dt className="font-semibold text-gray-500 w-32 flex-shrink-0">Max Active</dt><dd className="text-gray-900">{selectedShopDetails.max_active_bills}</dd></div>
                    </dl>
                  </div>
                </div>

                {/* Pending Orders */}
                {selectedShopDetails.pending_orders.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold text-gray-700 mb-3">Pending Orders</h4>
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                      <table className="min-w-full">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left">Date</th>
                            <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left">Sales Rep</th>
                            <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left">Total</th>
                            <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left">Items</th>
                            <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left">Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedShopDetails.pending_orders.map((order) => (
                            <tr key={order.id} className="border-b border-gray-100 last:border-0 hover:bg-violet-50/30 transition-colors">
                              <td className="py-3 px-4 text-sm text-gray-600">{new Date(order.created_at).toLocaleDateString()}</td>
                              <td className="py-3 px-4 text-sm text-gray-600">{order.sales_rep_first_name ? `${order.sales_rep_first_name} ${order.sales_rep_last_name}` : 'N/A'}</td>
                              <td className="py-3 px-4 text-sm font-semibold text-violet-600">{order.total.toFixed(2)} LKR</td>
                              <td className="py-3 px-4 text-sm text-gray-600">{order.item_count}</td>
                              <td className="py-3 px-4 text-sm text-gray-500">{order.notes || '-'}</td>
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
                    <h4 className="text-sm font-bold text-gray-700 mb-3">Active Bills</h4>
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                      <table className="min-w-full">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left">Date</th>
                            <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left">Sales Rep</th>
                            <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left">Total</th>
                            <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left">Collected</th>
                            <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left">Outstanding</th>
                            <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left">Items</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedShopDetails.active_bills_details.map((bill) => (
                            <tr key={bill.id} className="border-b border-gray-100 last:border-0 hover:bg-violet-50/30 transition-colors">
                              <td className="py-3 px-4 text-sm text-gray-600">{new Date(bill.created_at).toLocaleDateString()}</td>
                              <td className="py-3 px-4 text-sm text-gray-600">{bill.sales_rep_first_name ? `${bill.sales_rep_first_name} ${bill.sales_rep_last_name}` : 'N/A'}</td>
                              <td className="py-3 px-4 text-sm font-semibold text-gray-900">{bill.total.toFixed(2)} LKR</td>
                              <td className="py-3 px-4 text-sm text-green-600 font-medium">{bill.collected.toFixed(2)} LKR</td>
                              <td className="py-3 px-4 text-sm text-red-600 font-semibold">{bill.outstanding.toFixed(2)} LKR</td>
                              <td className="py-3 px-4 text-sm text-gray-600">{bill.item_count}</td>
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
                    <h4 className="text-sm font-bold text-gray-700 mb-3">Recent Payments</h4>
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                      <table className="min-w-full">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left">Date</th>
                            <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left">Sales Rep</th>
                            <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left">Amount</th>
                            <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left">Order Total</th>
                            <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left">Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedShopDetails.recent_payments.map((payment) => (
                            <tr key={payment.id} className="border-b border-gray-100 last:border-0 hover:bg-violet-50/30 transition-colors">
                              <td className="py-3 px-4 text-sm text-gray-600">{new Date(payment.created_at).toLocaleDateString()}</td>
                              <td className="py-3 px-4 text-sm text-gray-600">{payment.sales_rep_first_name ? `${payment.sales_rep_first_name} ${payment.sales_rep_last_name}` : 'N/A'}</td>
                              <td className="py-3 px-4 text-sm font-semibold text-green-600">{payment.amount.toFixed(2)} LKR</td>
                              <td className="py-3 px-4 text-sm text-gray-600">{payment.order_total.toFixed(2)} LKR</td>
                              <td className="py-3 px-4 text-sm text-gray-500">{payment.notes || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Footer Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                  <button
                    className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg text-sm font-semibold transition-colors"
                    onClick={() => setShowDetailsModal(false)}
                  >
                    Close
                  </button>
                  <button
                    className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
                    onClick={() => {
                      setShowDetailsModal(false);
                      openEditModal(selectedShopDetails as any);
                    }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
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
        <div className="fixed top-4 right-4 z-50">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 flex items-start gap-3 min-w-[280px]">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${toast.type === 'success' ? 'bg-green-100' : 'bg-red-100'}`}>
              {toast.type === 'success' ? (
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">{toast.message}</p>
            </div>
            <button
              onClick={() => setToast(null)}
              className="w-6 h-6 rounded-md hover:bg-gray-100 flex items-center justify-center flex-shrink-0 transition-colors"
            >
              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 
