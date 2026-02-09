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
      triggerRefresh();
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
    return <div className="text-gray-400 text-center py-8">Loading orders...</div>;
  }

  if (error) {
    return <div className="text-red-500 text-center py-8">{error}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Inject CSS for animations */}
      <style dangerouslySetInnerHTML={{ __html: slideInAnimation }} />
      
      {/* Success Notification */}
      {showSuccessNotification && (
        <div className="fixed top-4 right-4 z-50 bg-green-50 border border-green-200 rounded-lg p-4 shadow-lg max-w-md animate-slide-in">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-green-800">{successMessage}</p>
            </div>
            <button
              onClick={() => {
                setShowSuccessNotification(false);
                setSuccessMessage('');
              }}
              className="flex-shrink-0 text-green-400 hover:text-green-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Page Title */}
      <div className="flex items-center gap-3">
        <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Order Management</h1>
          <p className="text-gray-600 text-sm">Review and approve orders from sales representatives</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-600 text-sm font-medium mb-1">
                {startDate || endDate ? 'Filtered Orders' : 'Total Orders'}
              </p>
              <p className="text-xl font-bold text-blue-800">{filteredOrders?.length || 0}</p>
              {(startDate || endDate) && (
                <p className="text-xs text-blue-600 mt-1">
                  of {orders?.length || 0} total
                </p>
              )}
            </div>
          </div>
        </div>
        
        <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-700 text-sm font-medium mb-1">Pending Orders</p>
              <p className="text-xl font-bold text-yellow-800">
                {filteredOrders?.filter(order => order.status === 'pending').length || 0}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-green-50 rounded-lg border border-green-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-700 text-sm font-medium mb-1">Approved Orders</p>
              <p className="text-xl font-bold text-green-800">
                {filteredOrders?.filter(order => order.status === 'approved').length || 0}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-red-50 rounded-lg border border-red-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-700 text-sm font-medium mb-1">Rejected Orders</p>
              <p className="text-xl font-bold text-red-800">
                {filteredOrders?.filter(order => order.status === 'rejected').length || 0}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-purple-50 rounded-lg border border-purple-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-700 text-sm font-medium mb-1">
                {startDate || endDate ? 'Filtered Value' : 'Total Value'}
              </p>
              <p className="text-xl font-bold text-purple-800">
                {(filteredOrders || []).reduce((sum, order) => sum + Number(order.total || 0), 0).toFixed(0)} LKR
              </p>
              {(startDate || endDate) && (
                <p className="text-xs text-purple-600 mt-1">
                  of {(orders || []).reduce((sum, order) => sum + Number(order.total || 0), 0).toFixed(0)} LKR total
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Order Management Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Order Approval System</h2>
            <p className="text-gray-600 text-sm">Review and approve pending orders from sales representatives</p>
          </div>
          <button
            onClick={exportData}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            Export CSV
          </button>
        </div>

        {/* Search and Filter Bar */}
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search by shop, representative, or amount..."
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
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          
          {/* Date Filter Toggle Button */}
          <button
            onClick={() => setShowDateFilter(!showDateFilter)}
            className={`px-4 py-2 border rounded-lg font-medium transition-colors flex items-center gap-2 text-sm ${
              showDateFilter || startDate || endDate
                ? 'bg-purple-100 text-purple-700 border-purple-300'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Date Filter
            {(startDate || endDate) && (
              <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
            )}
          </button>
        </div>

        {/* Date Filter Section */}
        {showDateFilter && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-200">
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300 text-sm"
                  max={endDate || undefined}
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300 text-sm"
                  min={startDate || undefined}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={clearDateFilters}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors text-sm"
                >
                  Clear
                </button>
                <button
                  onClick={() => setShowDateFilter(false)}
                  className="px-4 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg font-medium transition-colors text-sm"
                >
                  Apply
                </button>
              </div>
            </div>
            {(startDate || endDate) && (
              <div className="mt-3 text-sm text-gray-600">
                <span className="font-medium">Filtering by:</span>
                {startDate && <span className="ml-2">From {new Date(startDate).toLocaleDateString()}</span>}
                {endDate && <span className="ml-2">To {new Date(endDate).toLocaleDateString()}</span>}
                <span className="ml-2">({filteredOrders.length} orders found)</span>
              </div>
            )}
          </div>
        )}

        {/* Orders Table */}
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left py-3 px-4 font-medium text-gray-700 text-sm">Date</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 text-sm">Shop</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 text-sm">Sales Representative</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 text-sm">Total</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 text-sm">Status</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 text-sm">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {(paginatedOrders || []).map((order, orderIndex) => (
                <tr key={`${order.id}-${orderIndex}`} className={`hover:bg-gray-50 transition-colors ${
                  lastApprovedOrderId === order.id && order.status === 'approved' 
                    ? 'bg-green-50 border-l-4 border-l-green-500' 
                    : lastRejectedOrderId === order.id && order.status === 'rejected'
                    ? 'bg-red-50 border-l-4 border-l-red-500'
                    : ''
                }`}>
                  <td className="py-4 px-4">
                    <div className="text-gray-900 font-medium text-sm">{new Date(order.created_at).toLocaleDateString()}</div>
                    <div className="text-gray-500 text-xs">{new Date(order.created_at).toLocaleTimeString()}</div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="font-medium text-gray-900 text-sm">{order.shop_name}</div>
                  </td>
                  <td className="py-4 px-4">
                    <div>
                      <div className="text-gray-900 font-medium text-sm">
                        {order.sales_rep_first_name ? `${order.sales_rep_first_name} ${order.sales_rep_last_name}` : order.sales_rep_email}
                      </div>
                      <div className="text-sm text-gray-500 text-xs">{order.item_count} items</div>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="font-bold text-gray-900 text-sm">{Number(order.total).toFixed(2)} LKR</div>
                    {lastApprovedOrderId === order.id && order.status === 'approved' && (
                      <div className="text-xs text-green-600 font-medium mt-1">✓ Recently Approved</div>
                    )}
                    {lastRejectedOrderId === order.id && order.status === 'rejected' && (
                      <div className="text-xs text-red-600 font-medium mt-1">✗ Recently Rejected</div>
                    )}
                  </td>
                  <td className="py-4 px-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                      {getStatusText(order.status)}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleViewOrderDetails(order.id)}
                        disabled={loadingOrderDetails}
                        className="px-3 py-1 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded text-sm font-medium transition-colors disabled:opacity-50"
                        title="View Order Details"
                      >
                        {loadingOrderDetails ? 'Loading...' : 'View'}
                      </button>
                      <button
                        onClick={() => handleEditOrder(order.id)}
                        className="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded text-sm font-medium transition-colors"
                        title="Edit Order"
                      >
                        Edit
                      </button>
                      {order.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleApproveClick(order)}
                            className="px-3 py-1 bg-yellow-100 text-yellow-700 hover:bg-green-200 hover:text-green-700 rounded text-sm font-medium transition-colors"
                            title="Approve Order"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleRejectClick(order)}
                            className="px-3 py-1 bg-red-100 text-red-700 hover:bg-red-200 rounded text-sm font-medium transition-colors"
                            title="Reject Order"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {order.status === 'approved' && (
                        <span className="px-3 py-1 bg-green-100 text-green-700 rounded text-sm font-medium">
                          APPROVED
                        </span>
                      )}
                      {order.status === 'rejected' && (
                        <span className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm font-medium">
                          REJECTED
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center mt-6 p-4 bg-gray-50 rounded-lg">
            <span className="text-sm text-gray-600">
              Showing {page * ORDERS_PER_PAGE - ORDERS_PER_PAGE + 1} to {Math.min(page * ORDERS_PER_PAGE, (filteredOrders || []).length)} of {(filteredOrders || []).length} entries
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(prev => Math.max(1, prev - 1))}
                disabled={page === 1}
                className="px-3 py-1 bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
              >
                Previous
              </button>
              <span className="text-sm text-gray-700">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {(filteredOrders || []).length === 0 && (
          <div className="text-center py-8">
            <div className="text-4xl mb-2">📭</div>
            <div className="text-gray-400 font-medium">No orders found matching your criteria.</div>
          </div>
        )}
      </div>

      {/* Edit Order Modal */}
      {editOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-lg border border-gray-200 p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto relative">
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl font-bold"
              onClick={() => {
                setEditOrder(null);
                setEditItems([]);
                setEditNotes('');
                setEditError('');
              }}
              aria-label="Close"
            >
              &times;
            </button>

            <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Order</h3>

            <div className="space-y-4">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div className="text-sm text-gray-600">Order</div>
                <div className="font-semibold text-gray-900">
                  {editOrder.shop.name} • {editOrder.id.slice(0, 8)}... • {editOrder.status}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <textarea
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
                  placeholder="Add notes for this order"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Order Items</label>
                  <span className="text-sm text-gray-500">Total: {editTotal.toFixed(2)} LKR</span>
                </div>
                <div className="space-y-3">
                  {editItems.map((item, itemIndex) => (
                    <div key={`${item.product_id}-${itemIndex}`} className="flex flex-col sm:flex-row sm:items-center gap-3 border border-gray-200 rounded-lg p-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900">{item.name}</div>
                        <div className="text-sm text-gray-500">{item.unit_price.toFixed(2)} LKR</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => {
                            const qty = Number(e.target.value);
                            setEditItems(prev => prev.map(i => i.product_id === item.product_id ? {
                              ...i,
                              quantity: qty,
                              total: i.unit_price * qty
                            } : i));
                          }}
                          className="w-24 px-2 py-1 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300 text-black"
                        />
                        <button
                          className="px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm font-medium transition-colors"
                          onClick={() => setEditItems(prev => prev.filter(i => i.product_id !== item.product_id))}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <div className="text-sm font-medium text-gray-700 mb-2">Add Item</div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <select
                    value={newProductId}
                    onChange={(e) => setNewProductId(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white text-gray-900"
                  >
                    <option value="">Select product</option>
                    {products.map(product => (
                      <option key={product.id} value={product.id}>
                        {product.name} - {Number(product.unit_price).toFixed(2)} LKR
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={newProductQty}
                    onChange={(e) => setNewProductQty(Number(e.target.value))}
                    className="w-32 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300 text-black"
                  />
                  <button
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
                    onClick={addEditItem}
                  >
                    Add
                  </button>
                </div>
              </div>

              {editError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                  {editError}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-end mt-6 pt-4 border-t border-gray-200">
              <button
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                onClick={() => {
                  setEditOrder(null);
                  setEditItems([]);
                  setEditNotes('');
                  setEditError('');
                }}
                disabled={editLoading}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-60"
                onClick={handleSaveEdit}
                disabled={editLoading}
              >
                {editLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Details Modal */}
      {showOrderModal && selectedOrder && selectedOrder.id && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-lg border border-gray-200 p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto relative">
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl font-bold"
              onClick={() => setShowOrderModal(false)}
              aria-label="Close"
            >
              &times;
            </button>
            
            {loadingOrderDetails ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-gray-600 font-medium">Loading order details...</span>
                </div>
              </div>
            ) : (
              <>
                {/* Order Header */}
                <div className="mb-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Order Details</h3>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedOrder.status)}`}>
                      {getStatusText(selectedOrder.status)}
                    </span>
                    <span className="text-gray-500 text-sm">Order ID: {selectedOrder.id.slice(0, 8)}...</span>
                  </div>
                </div>

                {/* Order Information Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  {/* Shop Information */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-3">Shop Information</h4>
                    <div className="space-y-2 text-sm text-gray-900">
                      <div><span className="font-medium text-gray-900">Name:</span> {selectedOrder.shop?.name || 'N/A'}</div>
                      <div><span className="font-medium text-gray-900">Address:</span> {selectedOrder.shop?.address || 'N/A'}</div>
                      <div><span className="font-medium text-gray-900">Phone:</span> {selectedOrder.shop?.phone || 'N/A'}</div>
                    </div>
                  </div>

                  {/* Sales Representative Information */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-3">Sales Representative</h4>
                    <div className="space-y-2 text-sm text-gray-900">
                      <div><span className="font-medium text-gray-900">Name:</span> {selectedOrder.sales_rep?.first_name || ''} {selectedOrder.sales_rep?.last_name || ''}</div>
                      <div><span className="font-medium text-gray-900">Email:</span> {selectedOrder.sales_rep?.email || 'N/A'}</div>
                      <div><span className="font-medium text-gray-900">Order Date:</span> {new Date(selectedOrder.created_at).toLocaleString()}</div>
                    </div>
                  </div>
                </div>

                {/* Order Items */}
                <div className="mb-6">
                  <h4 className="font-semibold text-gray-900 mb-3">Order Items</h4>
                  <div className="overflow-hidden rounded-lg border border-gray-200">
                    <table className="min-w-full text-gray-900">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-4 py-2 text-left font-medium text-gray-800 text-sm">Product</th>
                          <th className="px-4 py-2 text-left font-medium text-gray-800 text-sm">Unit Price</th>
                          <th className="px-4 py-2 text-left font-medium text-gray-800 text-sm">Quantity</th>
                          <th className="px-4 py-2 text-left font-medium text-gray-800 text-sm">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 text-gray-900">
                        {selectedOrder.items && selectedOrder.items.map((item, itemIndex) => (
                          <tr key={`${item.product_id}-${itemIndex}`} className="hover:bg-gray-50">
                            <td className="px-4 py-2">
                              <div className="font-medium text-gray-900 text-sm">{item.name}</div>
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">{Number(item.unit_price).toFixed(2)} LKR</td>
                            <td className="px-4 py-2 text-sm text-gray-900">{item.quantity}</td>
                            <td className="px-4 py-2 font-semibold text-sm text-gray-900">{Number(item.total).toFixed(2)} LKR</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-blue-50 rounded-lg p-4 text-center">
                    <div className="text-sm text-blue-600 font-medium mb-1">Order Total</div>
                    <div className="text-lg font-bold text-blue-800">{Number(selectedOrder.total || 0).toFixed(2)} LKR</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4 text-center">
                    <div className="text-sm text-green-600 font-medium mb-1">Total Paid</div>
                    <div className="text-lg font-bold text-green-800">{Number(selectedOrder.collected || 0).toFixed(2)} LKR</div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-4 text-center">
                    <div className="text-sm text-red-600 font-medium mb-1">Outstanding</div>
                    <div className="text-lg font-bold text-red-800">{Number(selectedOrder.outstanding || 0).toFixed(2)} LKR</div>
                  </div>
                </div>

                {/* Payment History */}
                {payments && payments.length > 0 && (
                  <div className="mb-6">
                    <h4 className="font-semibold text-black mb-3">Payment History</h4>
                    <div className="overflow-hidden rounded-lg border border-gray-200">
                      <table className="min-w-full">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="px-4 py-2 text-left font-medium text-gray-700 text-sm">Date</th>
                            <th className="px-4 py-2 text-left font-medium text-gray-700 text-sm">Amount</th>
                            <th className="px-4 py-2 text-left font-medium text-gray-700 text-sm">Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {payments.map((payment, paymentIndex) => (
                            <tr key={`${payment.id}-${paymentIndex}`} className="hover:bg-gray-50">
                              <td className="px-4 py-2 text-sm text-black">{new Date(payment.created_at).toLocaleDateString()}</td>
                              <td className="px-4 py-2 font-semibold text-sm text-black">{Number(payment.amount).toFixed(2)} LKR</td>
                              <td className="px-4 py-2 text-sm text-gray-700">{payment.notes || 'No notes'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Notes */}
                {selectedOrder.notes && (
                  <div className="mb-6">
                    <h4 className="font-semibold text-gray-900 mb-2">Order Notes</h4>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-gray-700 text-sm">{selectedOrder.notes}</p>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-medium transition-colors"
                    onClick={() => setShowOrderModal(false)}
                  >
                    Close
                  </button>
                  {selectedOrder.status === 'pending' && (
                    <button
                      className="px-4 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded font-medium transition-colors"
                      onClick={() => {
                        setShowOrderModal(false);
                        setOrderToApprove(selectedOrder as any);
                        setShowApprovalModal(true);
                      }}
                    >
                      Approve Order
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Approval Confirmation Modal */}
      {showApprovalModal && orderToApprove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-lg border border-gray-200 p-6 max-w-md w-full relative">
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl font-bold"
              onClick={() => setShowApprovalModal(false)}
              aria-label="Close"
            >
              &times;
            </button>
            
            <div className="text-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Confirm Order Approval</h3>
              <p className="text-gray-600 text-sm">Are you sure you want to approve this order?</p>
              {approvingOrder === orderToApprove.id && (
                <div className="mt-4 flex items-center justify-center gap-2 text-blue-600">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm font-medium">Approving order and sending SMS...</span>
                </div>
              )}
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <h4 className="font-semibold text-yellow-800 mb-2">Order Summary</h4>
              <div className="space-y-2 text-sm">
                <div><span className="font-medium">Shop:</span> {orderToApprove.shop_name}</div>
                <div><span className="font-medium">Total:</span> {Number(orderToApprove.total).toFixed(2)} LKR</div>
                <div><span className="font-medium">Items:</span> {orderToApprove.item_count}</div>
                <div><span className="font-medium">Date:</span> {new Date(orderToApprove.created_at).toLocaleDateString()}</div>
              </div>
            </div>

            {/* SMS Status Display */}
            {smsStatus.type && (
              <div className={`mb-6 p-3 rounded-lg text-sm ${
                smsStatus.type === 'success' 
                  ? 'bg-green-50 border border-green-200 text-green-700' 
                  : 'bg-red-50 border border-red-200 text-red-700'
              }`}>
                <div className="flex items-center gap-2">
                  {smsStatus.type === 'success' ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  <span>{smsStatus.message}</span>
                </div>
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-medium transition-colors"
                onClick={() => setShowApprovalModal(false)}
              >
                Cancel
              </button>
              
              {/* Manual SMS Button */}
              {lastApprovedOrderId && smsStatus.type === 'error' && (
                <button
                  className="px-4 py-2 bg-blue-100 hover:bg-blue-200 disabled:bg-blue-50 disabled:cursor-not-allowed text-blue-700 rounded font-medium transition-colors flex items-center gap-2"
                  onClick={handleSendApprovalSMS}
                  disabled={sendingSMS}
                >
                  {sendingSMS ? (
                    <>
                      <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      Sending...
                    </>
                  ) : (
                    <>
                      <span>📱</span> Send SMS
                    </>
                  )}
                </button>
              )}
              
              <button
                className="px-4 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded font-medium transition-colors"
                onClick={() => handleApproveOrder(orderToApprove.id)}
                disabled={approvingOrder === orderToApprove.id}
              >
                {approvingOrder === orderToApprove.id ? 'Approving...' : 'Yes, Approve Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Confirmation Modal */}
      {showRejectionModal && orderToReject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-lg border border-gray-200 p-6 max-w-md w-full relative">
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl font-bold"
              onClick={() => setShowRejectionModal(false)}
              aria-label="Close"
            >
              &times;
            </button>
            
            <div className="text-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Confirm Order Rejection</h3>
              <p className="text-gray-600 text-sm">Are you sure you want to reject this order?</p>
              {rejectingOrder === orderToReject.id && (
                <div className="mt-4 flex items-center justify-center gap-2 text-red-600">
                  <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm font-medium">Rejecting order and sending SMS...</span>
                </div>
              )}
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <h4 className="font-semibold text-red-800 mb-2">Order Summary</h4>
              <div className="space-y-2 text-sm text-gray-900">
                <div><span className="font-medium text-gray-900">Shop:</span> {orderToReject.shop_name}</div>
                <div><span className="font-medium text-gray-900">Total:</span> {Number(orderToReject.total).toFixed(2)} LKR</div>
                <div><span className="font-medium text-gray-900">Items:</span> {orderToReject.item_count}</div>
                <div><span className="font-medium text-gray-900">Date:</span> {new Date(orderToReject.created_at).toLocaleDateString()}</div>
              </div>
            </div>

            {/* Rejection Reason Input */}
            <div className="mb-6">
              <label htmlFor="rejection-reason" className="block text-sm font-medium text-gray-700 mb-2">
                Rejection Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                id="rejection-reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Please provide a reason for rejecting this order..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-500 text-sm text-gray-900"
                rows={3}
                required
              />
              {rejectionReason.trim().length === 0 && (
                <p className="text-red-500 text-xs mt-1">Rejection reason is required</p>
              )}
            </div>

            {/* SMS Status Display */}
            {smsStatus.type && (
              <div className={`mb-6 p-3 rounded-lg text-sm ${
                smsStatus.type === 'success' 
                  ? 'bg-green-50 border border-green-200 text-green-700' 
                  : 'bg-red-50 border border-red-200 text-red-700'
              }`}>
                <div className="flex items-center gap-2">
                  {smsStatus.type === 'success' ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  <span>{smsStatus.message}</span>
                </div>
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-medium transition-colors"
                onClick={() => setShowRejectionModal(false)}
              >
                Cancel
              </button>
              
              <button
                className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => handleRejectOrder(orderToReject.id, rejectionReason)}
                disabled={rejectingOrder === orderToReject.id || rejectionReason.trim().length === 0}
              >
                {rejectingOrder === orderToReject.id ? 'Rejecting...' : 'Yes, Reject Order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 
