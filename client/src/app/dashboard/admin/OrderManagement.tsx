import React, { useState, useEffect } from 'react';
import { apiFetch, clearCache } from '../../../utils/api';

// Add CSS for slide-in animation
const slideInAnimation = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  .animate-slide-in {
    animation: slideIn 0.3s ease-out;
  }
`;

interface Order {
  id: string;
  shop_name: string;
  created_at: string;
  total: number;
  status: string;
  notes?: string;
  sales_rep_first_name?: string;
  sales_rep_last_name?: string;
  sales_rep_email?: string;
  item_count: number;
}

interface OrderDetails {
  id: string;
  shop_id: string;
  sales_rep_id: string;
  total: number;
  status: string;
  notes?: string;
  created_at: string;
  collected: number;
  outstanding: number;
  shop: {
    name: string;
    address: string;
    phone: string;
  };
  sales_rep: {
    first_name: string;
    last_name: string;
    email: string;
  };
  items: Array<{
    product_id: string;
    name: string;
    quantity: number;
    unit_price: number;
    total: number;
  }>;
}

interface Payment {
  id: string;
  amount: number;
  notes?: string;
  created_at: string;
}

interface Product {
  id: string;
  name: string;
  unit_price: number;
}

export default function OrderManagement() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [approvingOrder, setApprovingOrder] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderDetails | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [orderToApprove, setOrderToApprove] = useState<Order | null>(null);
  const [loadingOrderDetails, setLoadingOrderDetails] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [smsStatus, setSmsStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });
  const [lastApprovedOrderId, setLastApprovedOrderId] = useState<string | null>(null);
  const [sendingSMS, setSendingSMS] = useState(false);
  const [showSuccessNotification, setShowSuccessNotification] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  // Reject order state variables
  const [rejectingOrder, setRejectingOrder] = useState<string | null>(null);
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [orderToReject, setOrderToReject] = useState<Order | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [lastRejectedOrderId, setLastRejectedOrderId] = useState<string | null>(null);
  
  // Date filter state variables
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showDateFilter, setShowDateFilter] = useState(false);

  // Edit order state
  const [editOrder, setEditOrder] = useState<OrderDetails | null>(null);
  const [editItems, setEditItems] = useState<OrderDetails['items']>([]);
  const [editNotes, setEditNotes] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [newProductId, setNewProductId] = useState('');
  const [newProductQty, setNewProductQty] = useState(1);
  
  const ORDERS_PER_PAGE = 10;

  useEffect(() => {
    fetchOrders();
  }, [refreshTrigger]);

  // Auto-refresh after approval or rejection
  useEffect(() => {
    if (showSuccessNotification && (successMessage.includes('Order approved successfully') || successMessage.includes('Order rejected successfully'))) {
      // Refresh the orders list after a short delay to show updated status
      const timer = setTimeout(() => {
        triggerRefresh();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [showSuccessNotification, successMessage]);

  const fetchOrders = async () => {
    try {
      clearCache('/api/marudham/orders');
      clearCache('/api/marudham/orders/all');
      setLoading(true);
      const data = await apiFetch('/api/marudham/orders/all');
      setOrders(data.orders || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    if (products.length > 0) return products;
    const response = await apiFetch('/api/marudham/products');
    const loaded = (response.products || []).map((product: any) => ({
      id: product.id,
      name: product.name,
      unit_price: Number(product.unit_price)
    }));
    setProducts(loaded);
    return loaded;
  };

  const handleEditOrder = async (orderId: string) => {
    setEditLoading(true);
    setEditError('');
    try {
      const [orderData] = await Promise.all([
        apiFetch(`/api/marudham/orders/${orderId}`),
        loadProducts()
      ]);
      const details = orderData.order as OrderDetails | undefined;
      if (!details) {
        setEditError('Unable to load order details.');
        return;
      }
      setEditOrder(details);
      setEditNotes(details.notes || '');
      setEditItems(details.items ? details.items.map(item => ({ ...item })) : []);
    } catch (err: any) {
      setEditError(err.message || 'Failed to load order for editing.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editOrder) return;
    if (editItems.length === 0) {
      setEditError('Please add at least one item.');
      return;
    }
    if (editItems.some(item => !item.quantity || item.quantity <= 0)) {
      setEditError('All items must have a quantity greater than 0.');
      return;
    }

    setEditLoading(true);
    setEditError('');
    try {
      await apiFetch(`/api/marudham/orders/${editOrder.id}/admin`, {
        method: 'PUT',
        body: JSON.stringify({
          notes: editNotes,
          items: editItems.map(item => ({
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price
          }))
        })
      });

      clearCache('/api/marudham/orders');
      clearCache('/api/marudham/orders/all');
      clearCache(`/api/marudham/orders/${editOrder.id}`);

      setEditOrder(null);
      setEditItems([]);
      setEditNotes('');
      triggerRefresh();
    } catch (err: any) {
      setEditError(err.message || 'Failed to update order.');
    } finally {
      setEditLoading(false);
    }
  };

  const addEditItem = () => {
    if (!newProductId || newProductQty <= 0) return;
    const product = products.find(p => p.id === newProductId);
    if (!product) return;

    setEditItems(prev => {
      const existing = prev.find(item => item.product_id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product_id === product.id
            ? {
                ...item,
                quantity: item.quantity + newProductQty,
                total: (item.quantity + newProductQty) * item.unit_price
              }
            : item
        );
      }
      return [
        ...prev,
        {
          product_id: product.id,
          name: product.name,
          unit_price: product.unit_price,
          quantity: newProductQty,
          total: product.unit_price * newProductQty
        }
      ];
    });
    setNewProductId('');
    setNewProductQty(1);
  };

  const triggerRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleApproveOrder = async (orderId: string) => {
    try {
      setApprovingOrder(orderId);
      setSmsStatus({ type: null, message: '' });
      
      const response = await apiFetch(`/api/marudham/orders/${orderId}/approve`, {
        method: 'PUT'
      });
      
      // Handle SMS status
      if (response.sms_sent) {
        setSmsStatus({ 
          type: 'success', 
          message: 'Order approved and SMS sent successfully to shop owner!' 
        });
        // Show success notification
        setSuccessMessage('Order approved successfully! SMS notification sent to shop owner.');
        setShowSuccessNotification(true);
      } else if (response.sms_error) {
        setSmsStatus({ 
          type: 'error', 
          message: `Order approved but SMS failed: ${response.sms_error}` 
        });
        // Show success notification for approval but with SMS warning
        setSuccessMessage('Order approved successfully! However, SMS notification failed to send.');
        setShowSuccessNotification(true);
      } else {
        setSmsStatus({ 
          type: 'error', 
          message: 'Order approved but SMS could not be sent - shop phone number not available' 
        });
        // Show success notification for approval but with SMS warning
        setSuccessMessage('Order approved successfully! However, SMS notification could not be sent (no phone number).');
        setShowSuccessNotification(true);
      }
      
      // Trigger refresh after approval
      triggerRefresh();
      setShowApprovalModal(false);
      setOrderToApprove(null);
      setLastApprovedOrderId(orderId); // Store the ID of the last approved order
      
      // Auto-hide success notification after 5 seconds
      setTimeout(() => {
        setShowSuccessNotification(false);
        setSuccessMessage('');
      }, 5000);
      
    } catch (err: any) {
      alert(err.message);
    } finally {
      setApprovingOrder(null);
    }
  };

  const handleRejectOrder = async (orderId: string, rejectionReason: string) => {
    try {
      setRejectingOrder(orderId);
      setSmsStatus({ type: null, message: '' });
      
      const response = await apiFetch(`/api/marudham/orders/${orderId}/reject`, {
        method: 'PUT',
        body: JSON.stringify({ rejection_reason: rejectionReason })
      });
      
      // Handle SMS status
      if (response.sms_sent) {
        setSmsStatus({ 
          type: 'success', 
          message: 'Order rejected and SMS sent successfully to shop owner!' 
        });
        // Show success notification
        setSuccessMessage('Order rejected successfully! SMS notification sent to shop owner.');
        setShowSuccessNotification(true);
      } else if (response.sms_error) {
        setSmsStatus({ 
          type: 'error', 
          message: `Order rejected but SMS failed: ${response.sms_error}` 
        });
        // Show success notification for rejection but with SMS warning
        setSuccessMessage('Order rejected successfully! However, SMS notification failed to send.');
        setShowSuccessNotification(true);
      } else {
        setSmsStatus({ 
          type: 'error', 
          message: 'Order rejected but SMS could not be sent - shop phone number not available' 
        });
        // Show success notification for rejection but with SMS warning
        setSuccessMessage('Order rejected successfully! However, SMS notification could not be sent (no phone number).');
        setShowSuccessNotification(true);
      }
      
      // Clear cache so the latest status is fetched
      clearCache('/api/marudham/orders');
      clearCache('/api/marudham/orders/all');

      // Trigger refresh after rejection
      setOrders(prev =>
        prev.map(o =>
          o.id === orderId ? { ...o, status: 'rejected', notes: rejectionReason } : o
        )
      );
      // Update selected order view if it's open for the same order
      setSelectedOrder(prev =>
        prev && prev.id === orderId ? { ...prev, status: 'rejected', notes: rejectionReason } : prev
      );
      // Force a fresh fetch so the list reflects the new status without manual refresh
      await fetchOrders();
      setShowRejectionModal(false);
      setOrderToReject(null);
      setRejectionReason('');
      setLastRejectedOrderId(orderId); // Store the ID of the last rejected order
      
      // Auto-hide success notification after 5 seconds
      setTimeout(() => {
        setShowSuccessNotification(false);
        setSuccessMessage('');
      }, 5000);
      
    } catch (err: any) {
      alert(err.message);
    } finally {
      setRejectingOrder(null);
    }
  };

  const handleViewOrderDetails = async (orderId: string) => {
    try {
      setLoadingOrderDetails(true);
      setLoadingPayments(true);
      
      // Fetch order details first
      const orderData = await apiFetch(`/api/marudham/orders/${orderId}`);
      setSelectedOrder(orderData.order);
      setShowOrderModal(true);
      
      // Try to fetch payments (optional)
      try {
        const paymentsData = await apiFetch(`/api/marudham/orders/${orderId}/payments`);
        setPayments(paymentsData.payments || []);
      } catch (paymentError) {
        console.warn('Payment history not available:', paymentError);
        setPayments([]);
      }
    } catch (err: any) {
      console.error('Error fetching order details:', err);
      alert('Failed to load order details: ' + err.message);
      // Reset state on error
      setSelectedOrder(null);
      setPayments([]);
      setShowOrderModal(false);
    } finally {
      setLoadingOrderDetails(false);
      setLoadingPayments(false);
    }
  };

  const handleSendApprovalSMS = async () => {
    if (!lastApprovedOrderId) return;
    
    setSendingSMS(true);
    setSmsStatus({ type: null, message: '' });
    
    try {
      const response = await apiFetch(`/api/marudham/orders/${lastApprovedOrderId}/approval/send-sms`, {
        method: 'POST'
      });
      
      if (response.success) {
        setSmsStatus({ 
          type: 'success', 
          message: 'Order approval SMS sent successfully to shop owner!' 
        });
        // Show success notification
        setSuccessMessage('SMS notification sent successfully to shop owner!');
        setShowSuccessNotification(true);
      } else {
        setSmsStatus({ 
          type: 'error', 
          message: response.error || 'Failed to send order approval SMS' 
        });
      }
    } catch (error: any) {
      setSmsStatus({ 
        type: 'error', 
        message: error.message || 'Failed to send order approval SMS' 
      });
    } finally {
      setSendingSMS(false);
      // Auto-hide success notification after 5 seconds
      setTimeout(() => {
        setShowSuccessNotification(false);
        setSuccessMessage('');
      }, 5000);
    }
  };

  const handleApproveClick = (order: Order) => {
    setOrderToApprove(order);
    setShowApprovalModal(true);
    setSmsStatus({ type: null, message: '' }); // Clear previous SMS status
  };

  const handleRejectClick = (order: Order) => {
    setOrderToReject(order);
    setShowRejectionModal(true);
    setRejectionReason('');
    setSmsStatus({ type: null, message: '' }); // Clear previous SMS status
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-700';
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'rejected': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved': return 'Approved';
      case 'pending': return 'Pending';
      case 'rejected': return 'Rejected';
      default: return status;
    }
  };

  // Filter orders
  const filteredOrders = (orders || []).filter(order => {
    const q = search.toLowerCase();
    const matchesSearch = 
      order.shop_name.toLowerCase().includes(q) ||
      (order.sales_rep_first_name || '').toLowerCase().includes(q) ||
      (order.sales_rep_last_name || '').toLowerCase().includes(q) ||
      (order.sales_rep_email || '').toLowerCase().includes(q) ||
      String(order.total).includes(q);
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    
    // Date range filtering
    let matchesDate = true;
    if (startDate || endDate) {
      const orderDate = new Date(order.created_at);
      const orderDateOnly = new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate());
      
      if (startDate) {
        const startDateObj = new Date(startDate);
        if (orderDateOnly < startDateObj) {
          matchesDate = false;
        }
      }
      
      if (endDate) {
        const endDateObj = new Date(endDate);
        if (orderDateOnly > endDateObj) {
          matchesDate = false;
        }
      }
    }
    
    return matchesSearch && matchesStatus && matchesDate;
  });

  // Pagination
  const totalPages = Math.ceil(filteredOrders.length / ORDERS_PER_PAGE) || 1;
  const paginatedOrders = filteredOrders.slice((page - 1) * ORDERS_PER_PAGE, page * ORDERS_PER_PAGE);
  const editTotal = editItems.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);

  useEffect(() => { setPage(1); }, [search, statusFilter, startDate, endDate]);

  const exportData = () => {
    const csvData = [
      ['Date', 'Shop', 'Sales Representative', 'Total', 'Status', 'Notes'],
      ...(filteredOrders || []).map(order => [
        new Date(order.created_at).toLocaleDateString(),
        order.shop_name,
        `${order.sales_rep_first_name || ''} ${order.sales_rep_last_name || ''}`.trim() || order.sales_rep_email || 'N/A',
        `${Number(order.total).toFixed(2)} LKR`,
        getStatusText(order.status),
        order.notes || ''
      ])
    ];
    
    const csv = csvData.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'orders_management_report.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const clearDateFilters = () => {
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-gray-500">
          <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">Loading orders...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-red-600 font-medium text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <style dangerouslySetInnerHTML={{ __html: slideInAnimation }} />

      {/* Toast Notification */}
      {showSuccessNotification && (
        <div className="fixed top-5 right-5 z-50 flex items-start gap-3 bg-white border border-green-200 shadow-lg rounded-xl px-4 py-3 max-w-sm animate-slide-in">
          <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">Success</p>
            <p className="text-xs text-gray-500 mt-0.5">{successMessage}</p>
          </div>
          <button onClick={() => { setShowSuccessNotification(false); setSuccessMessage(''); }} className="text-gray-300 hover:text-gray-500 flex-shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Order Management</h1>
            <p className="text-sm text-gray-500">Review and approve orders from sales representatives</p>
          </div>
        </div>
        <button
          onClick={exportData}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-medium transition-colors shadow-sm"
        >
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export CSV
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          {
            label: startDate || endDate ? 'Filtered Orders' : 'Total Orders',
            value: filteredOrders?.length || 0,
            sub: (startDate || endDate) ? `of ${orders?.length || 0} total` : null,
            color: 'blue',
          },
          {
            label: 'Pending',
            value: filteredOrders?.filter(o => o.status === 'pending').length || 0,
            color: 'amber',
          },
          {
            label: 'Approved',
            value: filteredOrders?.filter(o => o.status === 'approved').length || 0,
            color: 'green',
          },
          {
            label: 'Rejected',
            value: filteredOrders?.filter(o => o.status === 'rejected').length || 0,
            color: 'red',
          },
          {
            label: startDate || endDate ? 'Filtered Value' : 'Total Value',
            value: `${(filteredOrders || []).reduce((s, o) => s + Number(o.total || 0), 0).toFixed(0)} LKR`,
            sub: (startDate || endDate) ? `of ${(orders || []).reduce((s, o) => s + Number(o.total || 0), 0).toFixed(0)} LKR` : null,
            color: 'violet',
          },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className={`bg-${color}-50 border border-${color}-100 rounded-xl p-4`}>
            <p className={`text-xs font-semibold text-${color}-600 uppercase tracking-wide mb-1`}>{label}</p>
            <p className={`text-2xl font-bold text-${color}-800 leading-tight`}>{value}</p>
            {sub && <p className={`text-xs text-${color}-500 mt-0.5`}>{sub}</p>}
          </div>
        ))}
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        {/* Toolbar */}
        <div className="flex flex-col lg:flex-row gap-3 p-5 border-b border-gray-100">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search shop, rep, or amount…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-transparent"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-violet-300"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <button
            onClick={() => setShowDateFilter(!showDateFilter)}
            className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
              showDateFilter || startDate || endDate
                ? 'bg-violet-50 text-violet-700 border-violet-200'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Date Filter
            {(startDate || endDate) && <span className="w-1.5 h-1.5 bg-violet-500 rounded-full" />}
          </button>
        </div>

        {/* Date Filter Panel */}
        {showDateFilter && (
          <div className="px-5 py-4 bg-gray-50 border-b border-gray-100">
            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">From</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} max={endDate || undefined}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-300" />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">To</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} min={startDate || undefined}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-300" />
              </div>
              <div className="flex gap-2">
                <button onClick={clearDateFilters} className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Clear</button>
                <button onClick={() => setShowDateFilter(false)} className="px-3 py-2 text-sm font-medium text-violet-700 bg-violet-50 border border-violet-200 rounded-lg hover:bg-violet-100 transition-colors">Apply</button>
              </div>
            </div>
            {(startDate || endDate) && (
              <p className="text-xs text-gray-500 mt-2">
                {startDate && `From ${new Date(startDate).toLocaleDateString()}`}
                {startDate && endDate && ' · '}
                {endDate && `To ${new Date(endDate).toLocaleDateString()}`}
                {' · '}<span className="font-semibold text-violet-600">{filteredOrders.length} orders</span>
              </p>
            )}
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                <th className="text-left py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Shop</th>
                <th className="text-left py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Sales Rep</th>
                <th className="text-left py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                <th className="text-left py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(paginatedOrders || []).map((order, orderIndex) => (
                <tr key={`${order.id}-${orderIndex}`} className={`group transition-colors ${
                  lastApprovedOrderId === order.id && order.status === 'approved'
                    ? 'bg-green-50'
                    : lastRejectedOrderId === order.id && order.status === 'rejected'
                    ? 'bg-red-50'
                    : 'hover:bg-gray-50/70'
                }`}>
                  <td className="py-3.5 px-5">
                    <p className="text-sm font-medium text-gray-900">{new Date(order.created_at).toLocaleDateString()}</p>
                    <p className="text-xs text-gray-400">{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </td>
                  <td className="py-3.5 px-5">
                    <p className="text-sm font-semibold text-gray-900">{order.shop_name}</p>
                  </td>
                  <td className="py-3.5 px-5">
                    <p className="text-sm text-gray-800">
                      {order.sales_rep_first_name ? `${order.sales_rep_first_name} ${order.sales_rep_last_name}` : order.sales_rep_email}
                    </p>
                    <p className="text-xs text-gray-400">{order.item_count} items</p>
                  </td>
                  <td className="py-3.5 px-5">
                    <p className="text-sm font-bold text-gray-900">{Number(order.total).toFixed(2)} LKR</p>
                    {lastApprovedOrderId === order.id && order.status === 'approved' && (
                      <p className="text-xs text-green-600 font-medium">Recently approved</p>
                    )}
                    {lastRejectedOrderId === order.id && order.status === 'rejected' && (
                      <p className="text-xs text-red-600 font-medium">Recently rejected</p>
                    )}
                  </td>
                  <td className="py-3.5 px-5">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(order.status)}`}>
                      {getStatusText(order.status)}
                    </span>
                  </td>
                  <td className="py-3.5 px-5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button onClick={() => handleViewOrderDetails(order.id)} disabled={loadingOrderDetails}
                        className="px-2.5 py-1.5 text-xs font-medium bg-violet-50 text-violet-700 hover:bg-violet-100 rounded-lg transition-colors disabled:opacity-50">
                        View
                      </button>
                      <button onClick={() => handleEditOrder(order.id)}
                        className="px-2.5 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors">
                        Edit
                      </button>
                      {order.status === 'pending' && (
                        <>
                          <button onClick={() => handleApproveClick(order)}
                            className="px-2.5 py-1.5 text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 rounded-lg transition-colors">
                            Approve
                          </button>
                          <button onClick={() => handleRejectClick(order)}
                            className="px-2.5 py-1.5 text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 rounded-lg transition-colors">
                            Reject
                          </button>
                        </>
                      )}
                      {order.status === 'approved' && (
                        <span className="px-2.5 py-1 text-xs font-semibold bg-green-100 text-green-700 rounded-lg">Approved</span>
                      )}
                      {order.status === 'rejected' && (
                        <span className="px-2.5 py-1 text-xs font-semibold bg-red-100 text-red-700 rounded-lg">Rejected</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {(filteredOrders || []).length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <p className="text-gray-500 font-medium text-sm">No orders found</p>
            <p className="text-gray-400 text-xs mt-1">Try adjusting your search or filter criteria</p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center px-5 py-4 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Showing <span className="font-semibold text-gray-700">{page * ORDERS_PER_PAGE - ORDERS_PER_PAGE + 1}–{Math.min(page * ORDERS_PER_PAGE, (filteredOrders || []).length)}</span> of <span className="font-semibold text-gray-700">{(filteredOrders || []).length}</span> orders
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                Previous
              </button>
              <span className="px-3 py-1.5 text-xs font-semibold text-violet-700 bg-violet-50 rounded-lg">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Edit Order Modal ── */}
      {editOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-base font-bold text-gray-900">Edit Order</h3>
                <p className="text-xs text-gray-500 mt-0.5">{editOrder.shop.name} · #{editOrder.id.slice(0, 8)}</p>
              </div>
              <button onClick={() => { setEditOrder(null); setEditItems([]); setEditNotes(''); setEditError(''); }}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Notes</label>
                <textarea rows={3} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Add notes for this order…"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Order Items</label>
                  <span className="text-sm font-bold text-violet-700">{editTotal.toFixed(2)} LKR</span>
                </div>
                <div className="space-y-2">
                  {editItems.map((item, idx) => (
                    <div key={`${item.product_id}-${idx}`} className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-lg px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
                        <p className="text-xs text-gray-500">{item.unit_price.toFixed(2)} LKR each</p>
                      </div>
                      <input type="number" min={1} value={item.quantity}
                        onChange={(e) => { const qty = Number(e.target.value); setEditItems(prev => prev.map(i => i.product_id === item.product_id ? { ...i, quantity: qty, total: i.unit_price * qty } : i)); }}
                        className="w-20 px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-center text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-300" />
                      <button onClick={() => setEditItems(prev => prev.filter(i => i.product_id !== item.product_id))}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border border-dashed border-gray-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Add Product</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <select value={newProductId} onChange={(e) => setNewProductId(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-violet-300">
                    <option value="">Select product…</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name} — {Number(p.unit_price).toFixed(2)} LKR</option>)}
                  </select>
                  <input type="number" min={1} value={newProductQty} onChange={(e) => setNewProductQty(Number(e.target.value))}
                    className="w-24 px-3 py-2 border border-gray-200 rounded-lg text-sm text-center text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-300" />
                  <button onClick={addEditItem}
                    className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-semibold transition-colors">
                    Add
                  </button>
                </div>
              </div>

              {editError && (
                <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {editError}
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end px-6 py-4 border-t border-gray-100">
              <button onClick={() => { setEditOrder(null); setEditItems([]); setEditNotes(''); setEditError(''); }} disabled={editLoading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleSaveEdit} disabled={editLoading}
                className="px-4 py-2 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors disabled:opacity-60">
                {editLoading ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Order Details Modal ── */}
      {showOrderModal && selectedOrder && selectedOrder.id && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <h3 className="text-base font-bold text-gray-900">Order Details</h3>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(selectedOrder.status)}`}>
                  {getStatusText(selectedOrder.status)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400 font-mono">#{selectedOrder.id.slice(0, 8)}</span>
                <button onClick={() => setShowOrderModal(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {loadingOrderDetails ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="px-6 py-5 space-y-6">
                {/* Info Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Shop</p>
                    <p className="text-sm font-bold text-gray-900">{selectedOrder.shop?.name || '—'}</p>
                    <p className="text-xs text-gray-500">{selectedOrder.shop?.address || '—'}</p>
                    <p className="text-xs text-gray-500">{selectedOrder.shop?.phone || '—'}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sales Representative</p>
                    <p className="text-sm font-bold text-gray-900">{selectedOrder.sales_rep?.first_name} {selectedOrder.sales_rep?.last_name}</p>
                    <p className="text-xs text-gray-500">{selectedOrder.sales_rep?.email || '—'}</p>
                    <p className="text-xs text-gray-500">{new Date(selectedOrder.created_at).toLocaleString()}</p>
                  </div>
                </div>

                {/* Items Table */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Order Items</p>
                  <div className="rounded-xl border border-gray-200 overflow-hidden">
                    <table className="min-w-full">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Product</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Unit Price</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Qty</th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {selectedOrder.items && selectedOrder.items.map((item, idx) => (
                          <tr key={`${item.product_id}-${idx}`} className="hover:bg-gray-50/60">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.name}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{Number(item.unit_price).toFixed(2)} LKR</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{item.quantity}</td>
                            <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">{Number(item.total).toFixed(2)} LKR</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-center">
                    <p className="text-xs font-semibold text-blue-600 mb-1">Order Total</p>
                    <p className="text-lg font-bold text-blue-800">{Number(selectedOrder.total || 0).toFixed(2)} LKR</p>
                  </div>
                  <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-center">
                    <p className="text-xs font-semibold text-green-600 mb-1">Total Paid</p>
                    <p className="text-lg font-bold text-green-800">{Number(selectedOrder.collected || 0).toFixed(2)} LKR</p>
                  </div>
                  <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-center">
                    <p className="text-xs font-semibold text-red-600 mb-1">Outstanding</p>
                    <p className="text-lg font-bold text-red-800">{Number(selectedOrder.outstanding || 0).toFixed(2)} LKR</p>
                  </div>
                </div>

                {/* Payment History */}
                {payments && payments.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Payment History</p>
                    <div className="rounded-xl border border-gray-200 overflow-hidden">
                      <table className="min-w-full">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {payments.map((p, idx) => (
                            <tr key={`${p.id}-${idx}`} className="hover:bg-gray-50/60">
                              <td className="px-4 py-3 text-sm text-gray-700">{new Date(p.created_at).toLocaleDateString()}</td>
                              <td className="px-4 py-3 text-sm font-semibold text-gray-900">{Number(p.amount).toFixed(2)} LKR</td>
                              <td className="px-4 py-3 text-sm text-gray-500">{p.notes || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Notes */}
                {selectedOrder.notes && (
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                    <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Order Notes</p>
                    <p className="text-sm text-amber-900">{selectedOrder.notes}</p>
                  </div>
                )}

                {/* Footer Buttons */}
                <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                  <button onClick={() => setShowOrderModal(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    Close
                  </button>
                  {selectedOrder.status === 'pending' && (
                    <button onClick={() => { setShowOrderModal(false); setOrderToApprove(selectedOrder as any); setShowApprovalModal(true); }}
                      className="px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors">
                      Approve Order
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Approval Modal ── */}
      {showApprovalModal && orderToApprove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
              <div className="w-9 h-9 bg-green-100 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Confirm Approval</h3>
                <p className="text-xs text-gray-500">This will notify the shop via SMS</p>
              </div>
              <button onClick={() => setShowApprovalModal(false)}
                className="ml-auto w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Shop</span><span className="font-semibold text-gray-900">{orderToApprove.shop_name}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Total</span><span className="font-bold text-gray-900">{Number(orderToApprove.total).toFixed(2)} LKR</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Items</span><span className="text-gray-900">{orderToApprove.item_count}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Date</span><span className="text-gray-900">{new Date(orderToApprove.created_at).toLocaleDateString()}</span></div>
              </div>

              {approvingOrder === orderToApprove.id && (
                <div className="flex items-center gap-2 text-sm text-blue-600">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  Approving and sending SMS…
                </div>
              )}

              {smsStatus.type && (
                <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${smsStatus.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {smsStatus.type === 'success'
                      ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />}
                  </svg>
                  {smsStatus.message}
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowApprovalModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              {lastApprovedOrderId && smsStatus.type === 'error' && (
                <button onClick={handleSendApprovalSMS} disabled={sendingSMS}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors">
                  {sendingSMS ? <><div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />Sending…</> : 'Resend SMS'}
                </button>
              )}
              <button onClick={() => handleApproveOrder(orderToApprove.id)} disabled={approvingOrder === orderToApprove.id}
                className="px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-60">
                {approvingOrder === orderToApprove.id ? 'Approving…' : 'Approve Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Rejection Modal ── */}
      {showRejectionModal && orderToReject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
              <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Reject Order</h3>
                <p className="text-xs text-gray-500">Provide a reason before rejecting</p>
              </div>
              <button onClick={() => setShowRejectionModal(false)}
                className="ml-auto w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Shop</span><span className="font-semibold text-gray-900">{orderToReject.shop_name}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Total</span><span className="font-bold text-gray-900">{Number(orderToReject.total).toFixed(2)} LKR</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Items</span><span className="text-gray-900">{orderToReject.item_count}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Date</span><span className="text-gray-900">{new Date(orderToReject.created_at).toLocaleDateString()}</span></div>
              </div>

              <div>
                <label htmlFor="rejection-reason" className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <textarea id="rejection-reason" value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} rows={3}
                  placeholder="Please explain why this order is being rejected…"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-transparent resize-none" />
                {rejectionReason.trim().length === 0 && (
                  <p className="text-xs text-red-500 mt-1">A rejection reason is required</p>
                )}
              </div>

              {rejectingOrder === orderToReject.id && (
                <div className="flex items-center gap-2 text-sm text-red-600">
                  <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                  Rejecting and sending SMS…
                </div>
              )}

              {smsStatus.type && (
                <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${smsStatus.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {smsStatus.type === 'success'
                      ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />}
                  </svg>
                  {smsStatus.message}
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowRejectionModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={() => handleRejectOrder(orderToReject.id, rejectionReason)}
                disabled={rejectingOrder === orderToReject.id || rejectionReason.trim().length === 0}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {rejectingOrder === orderToReject.id ? 'Rejecting…' : 'Reject Order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 
