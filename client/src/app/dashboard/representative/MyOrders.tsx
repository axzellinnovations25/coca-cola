import React, { useEffect, useState } from 'react';
import { apiFetch, clearCache } from '../../../utils/api';

interface Order {
  id: string;
  shop_name: string;
  created_at: string;
  total: number;
  item_count: number;
  status: string;
}

interface OrderItem {
  product_id: string;
  name: string;
  unit_price: number;
  quantity: number;
  total: number;
}

interface Product {
  id: string;
  name: string;
  unit_price: number;
}

interface DetailedOrder extends Order {
  items?: OrderItem[];
  shop?: {
    name: string;
    address: string;
    phone: string;
  };
  sales_rep?: {
    first_name: string;
    last_name: string;
    email: string;
  };
  collected?: number;
  outstanding?: number;
  notes?: string;
}

interface MyOrdersProps {
  refreshKey?: number;
}

export default function MyOrders({ refreshKey }: MyOrdersProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewOrder, setViewOrder] = useState<Order | null>(null);
  const [printReceipt, setPrintReceipt] = useState<DetailedOrder | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'created_at' | 'shop_name' | 'total' | 'status'>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [showPendingOrders, setShowPendingOrders] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [sendingSMS, setSendingSMS] = useState(false);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const [messageStatus, setMessageStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });
  const [smsSent, setSmsSent] = useState(false);
  const [editOrder, setEditOrder] = useState<DetailedOrder | null>(null);
  const [editItems, setEditItems] = useState<OrderItem[]>([]);
  const [editNotes, setEditNotes] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [newProductId, setNewProductId] = useState('');
  const [newProductQty, setNewProductQty] = useState(1);
  const ORDERS_PER_PAGE = 10;
  const parseOrderDate = (value?: string | Date | null) => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value !== 'string') {
      const fallback = new Date(value as any);
      return Number.isNaN(fallback.getTime()) ? null : fallback;
    }
    let normalized = value.trim();
    if (!normalized) return null;
    if (normalized.includes(' ') && !normalized.includes('T')) {
      normalized = normalized.replace(' ', 'T');
    }
    if (/[+-]\d{2}$/.test(normalized)) {
      normalized = `${normalized}:00`;
    } else if (/[+-]\d{4}$/.test(normalized)) {
      normalized = normalized.replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
    }
    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) return parsed;
    const hasTimezone = normalized.endsWith('Z') || /[+-]\d{2}(:?\d{2})?$/.test(normalized);
    if (!hasTimezone) {
      const withTimezone = new Date(`${normalized}Z`);
      return Number.isNaN(withTimezone.getTime()) ? null : withTimezone;
    }
    return null;
  };
  const formatOrderDate = (value?: string, options?: Intl.DateTimeFormatOptions, locale?: string) => {
    const date = parseOrderDate(value);
    return date ? date.toLocaleDateString(locale, options) : 'N/A';
  };
  const formatOrderTime = (value?: string, options?: Intl.DateTimeFormatOptions, locale?: string) => {
    const date = parseOrderDate(value);
    return date ? date.toLocaleTimeString(locale, options) : 'N/A';
  };
  const formatOrderDateTime = (value?: string) => {
    const date = parseOrderDate(value);
    return date ? date.toLocaleString() : 'N/A';
  };

  const triggerRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  useEffect(() => {
    setLoading(true);
    setError('');
    Promise.all([
      apiFetch('/api/marudham/orders'),
      apiFetch('/api/marudham/orders/pending')
    ])
      .then(([ordersData, pendingData]) => {
        setOrders(ordersData.orders || []);
        setPendingOrders(pendingData.orders || []);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [refreshKey, refreshTrigger]);

  // Filter and sort
  const filtered = orders.filter(order => {
    const q = search.toLowerCase();
    const matchesSearch =
      order.shop_name.toLowerCase().includes(q) ||
      order.status.toLowerCase().includes(q) ||
      String(order.total).includes(q);
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });
  const sorted = [...filtered].sort((a, b) => {
    let aVal: any = a[sortBy];
    let bVal: any = b[sortBy];
    if (sortBy === 'created_at') {
      const aTime = parseOrderDate(aVal)?.getTime() ?? 0;
      const bTime = parseOrderDate(bVal)?.getTime() ?? 0;
      return sortDir === 'asc' ? aTime - bTime : bTime - aTime;
    }
    if (sortBy === 'total') {
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    }
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return 0;
  });
  const totalPages = Math.ceil(sorted.length / ORDERS_PER_PAGE) || 1;
  const paginated = sorted.slice((page - 1) * ORDERS_PER_PAGE, page * ORDERS_PER_PAGE);
  const editTotal = editItems.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);

  function handleSort(col: typeof sortBy) {
    if (sortBy === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
    setPage(1);
  }

  const uniqueStatuses = Array.from(new Set(orders.map(o => o.status)));

  // Function to fetch detailed order information
  const fetchOrderDetails = async (orderId: string): Promise<DetailedOrder | null> => {
    try {
      const response = await apiFetch(`/api/marudham/orders/${orderId}/details`);
      return response.order || null;
    } catch (error) {
      console.error('Error fetching order details:', error);
      return null;
    }
  };

  const loadProducts = async () => {
    if (products.length > 0) return products;
    const response = await apiFetch('/api/marudham/order-products');
    const loaded = response.products || [];
    setProducts(loaded);
    return loaded;
  };

  const handleEditPendingOrder = async (order: Order) => {
    setEditLoading(true);
    setEditError('');
    try {
      const [details] = await Promise.all([
        fetchOrderDetails(order.id),
        loadProducts()
      ]);
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

  const handleSaveEditedOrder = async () => {
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
      await apiFetch(`/api/marudham/orders/${editOrder.id}`, {
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
      clearCache('/api/marudham/orders/pending');
      clearCache(`/api/marudham/orders/${editOrder.id}/details`);
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

  // Function to handle print receipt - shows modal first
  const handlePrintReceipt = async (order: Order) => {
    try {
      const detailedOrder = await fetchOrderDetails(order.id);

      // Set the receipt in state for the modal view
      setPrintReceipt(detailedOrder || {
        ...order,
        items: [],
        total: order.total,
        item_count: order.item_count,
        created_at: order.created_at,
        status: order.status,
        shop_name: order.shop_name
      });
      setSmsSent(false);
      setMessageStatus({ type: null, message: '' });

    } catch (error) {
      console.error('Error handling print receipt:', error);
      // Fallback to basic order info in modal
      const basicOrder = {
        ...order,
        items: [],
        total: order.total,
        item_count: order.item_count,
        created_at: order.created_at,
        status: order.status,
        shop_name: order.shop_name
      };
      setPrintReceipt(basicOrder);
      setSmsSent(false);
      setMessageStatus({ type: 'error', message: 'Error generating receipt. Showing basic order info.' });
    }
  };

  // Function to actually print the receipt
  const handleActualPrint = () => {
    if (!printReceipt) return;

    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Could not open print window. Please allow popups for this site.');
      return;
    }

    // Create print content for 79mm thermal printer
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt - ${printReceipt.id.slice(0, 8)}</title>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
        <style>
          @page {
            size: 79mm auto;
            margin: 0;
            padding: 0;
          }
          body {
            font-family: monospace, 'Courier New', Courier;
            font-size: 10px;
            width: 79mm;
            min-height: 100%;
            margin: 0;
            padding: 5px 8px;
            color: #000;
            line-height: 1.2;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            height: auto !important;
          }
          .receipt-header {
            text-align: center;
            margin-bottom: 8px;
            padding-bottom: 5px;
            border-bottom: 1px dashed #000;
          }
          .receipt-title {
            font-size: 12px;
            font-weight: bold;
            margin: 2px 0;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .receipt-subtitle {
            font-size: 10px;
            margin: 2px 0 4px;
            font-weight: bold;
          }
          .status-badge {
            display: inline-block;
            padding: 1px 5px;
            border: 1px solid #000;
            font-weight: bold;
            margin: 3px 0;
            font-size: 9px;
            white-space: nowrap;
          }
          .receipt-details {
            margin: 8px 0;
            font-size: 9px;
          }
          .detail-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 2px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .detail-label {
            font-weight: bold;
            margin-right: 5px;
            white-space: nowrap;
          }
          .detail-value {
            text-align: right;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 60%;
          }
          .divider {
            border-top: 1px dashed #000;
            margin: 5px 0;
            height: 1px;
            width: 100%;
          }
          .items-header {
            font-weight: bold;
            margin: 6px 0 3px;
            border-bottom: 1px solid #000;
            padding-bottom: 2px;
            font-size: 9px;
            text-transform: uppercase;
          }
          .item-row {
            margin-bottom: 4px;
            font-size: 9px;
            page-break-inside: avoid;
          }
          .item-name {
            font-weight: bold;
            white-space: normal;
            word-break: break-word;
          }
          .item-details {
            display: flex;
            justify-content: space-between;
            font-size: 8px;
            margin-top: 1px;
            white-space: nowrap;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            font-weight: bold;
            font-size: 10px;
            margin: 8px 0;
            padding-top: 3px;
            border-top: 1px solid #000;
          }
          .receipt-footer {
            text-align: center;
            margin-top: 10px;
            font-size: 8px;
            border-top: 1px dashed #000;
            padding-top: 5px;
            line-height: 1.1;
          }
          @media print {
            body {
              padding: 0 8px;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .no-print {
              display: none !important;
            }
            @page {
              size: 79mm auto;
              margin: 0;
              padding: 0;
            }
            html, body {
              height: auto !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="receipt-header">
          <div class="receipt-title">S.B Distribution</div>
          <div class="receipt-subtitle">SALES ORDER RECEIPT</div>
          <div class="status-badge">${printReceipt.status.toUpperCase()}</div>
        </div>

        <div class="receipt-details">
          <div class="detail-row">
            <span class="detail-label">ORDER #:</span>
            <span class="detail-value">${printReceipt.id.slice(0, 8).toUpperCase()}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">SHOP:</span>
            <span class="detail-value">${(printReceipt.shop?.name || printReceipt.shop_name || 'N/A').toUpperCase()}</span>
          </div>
          ${printReceipt.shop?.address ? `
          <div class="detail-row">
            <span class="detail-label">ADDRESS:</span>
            <span class="detail-value">${printReceipt.shop.address.toUpperCase()}</span>
          </div>
          ` : ''}
          ${printReceipt.shop?.phone ? `
          <div class="detail-row">
            <span class="detail-label">PHONE:</span>
            <span class="detail-value">${printReceipt.shop.phone}</span>
          </div>
          ` : ''}
          <div class="detail-row">
            <span class="detail-label">DATE:</span>
            <span class="detail-value">${formatOrderDate(printReceipt.created_at, { year: 'numeric', month: 'short', day: '2-digit' }, 'en-US').toUpperCase()}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">TIME:</span>
            <span class="detail-value">${formatOrderTime(printReceipt.created_at, { hour: '2-digit', minute: '2-digit', hour12: true }, 'en-US').toUpperCase()}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">ITEMS:</span>
            <span class="detail-value">${printReceipt.item_count}</span>
          </div>
        </div>

        <div class="divider"></div>

        <div class="items-section">
          <div class="items-header">ORDER ITEMS</div>
          ${printReceipt.items && printReceipt.items.length ?
            printReceipt.items.map((item, index) => `
              <div class="item-row">
                <div class="item-name">${index + 1}. ${item.name.toUpperCase()}</div>
                <div class="item-details">
                  <span>${item.quantity} × ${item.unit_price.toFixed(2)} LKR</span>
                  <span>${item.total.toFixed(2)} LKR</span>
                </div>
              </div>
            `).join('') :
            '<div class="item-row">Item details not available</div>'
          }
        </div>

        <div class="divider"></div>

        <div class="total-row">
          <span>TOTAL AMOUNT:</span>
          <span>${Number(printReceipt.total).toFixed(2)} LKR</span>
        </div>

        <div class="receipt-footer">
          <div>THANK YOU FOR YOUR BUSINESS!</div>
          <div>${new Date().toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          }).toUpperCase()}</div>
          <div style="margin-top: 20px; font-size: 10px; color: #000;">
            <div> © axzell innovations</div>
            <div>Innovative Solutions</div>
            <div style="border-top: 1px solid #000; margin-top: 30px; margin-bottom: 50px;"></div>
          </div>
        </div>

        <script>
          // Calculate content height and set page size
          function setDynamicPageSize() {
            const contentHeight = Math.ceil(document.body.scrollHeight * 0.264583); // Convert px to mm
            const height = Math.max(contentHeight, 50);
            const style = document.createElement('style');
            style.textContent = [
              '@page {',
              '  size: 79mm ' + height + 'mm;',
              '  margin: 0;',
              '  padding: 0;',
              '}',
              'html, body {',
              '  height: auto !important;',
              '}'
            ].join('\n');
            document.head.appendChild(style);
          }

          // Auto-print when the window loads
          window.onload = function() {
            setDynamicPageSize();

            // Wait for any potential layout recalculations
            setTimeout(function() {
              setDynamicPageSize(); // Update size after content is fully loaded

              // Print the receipt
              window.print();

              // Close the window after printing
              setTimeout(function() {
                window.close();
              }, 500);
            }, 100);
          };
        </script>
      </body>
      </html>
    `;

    // Write the content to the new window
    printWindow.document.open();
    printWindow.document.write(printContent);
    printWindow.document.close();
  };

  // Function to send SMS
  const handleSendSMS = async () => {
    if (!printReceipt) return;

    setSendingSMS(true);
    setMessageStatus({ type: null, message: '' });

    try {
      const response = await apiFetch(`/api/marudham/orders/${printReceipt.id}/send-sms`, {
        method: 'POST'
      });

      if (response.success) {
        setSmsSent(true);
        setMessageStatus({
          type: 'success',
          message: 'SMS sent successfully to shop owner!'
        });
      } else {
        setMessageStatus({
          type: 'error',
          message: response.error || 'Failed to send SMS'
        });
      }
    } catch (error: any) {
      setMessageStatus({
        type: 'error',
        message: error.message || 'Failed to send SMS'
      });
    } finally {
      setSendingSMS(false);
    }
  };

  // Function to send WhatsApp
  const handleSendWhatsApp = async () => {
    if (!printReceipt) return;

    setSendingWhatsApp(true);
    setMessageStatus({ type: null, message: '' });

    try {
      const response = await apiFetch(`/api/marudham/orders/${printReceipt.id}/send-whatsapp`, {
        method: 'POST'
      });

      if (response.success) {
        setMessageStatus({
          type: 'success',
          message: 'WhatsApp message sent successfully to shop owner!'
        });
      } else {
        setMessageStatus({
          type: 'error',
          message: response.error || 'Failed to send WhatsApp message'
        });
      }
    } catch (error: any) {
      setMessageStatus({
        type: 'error',
        message: error.message || 'Failed to send WhatsApp message'
      });
    } finally {
      setSendingWhatsApp(false);
    }
  };

  const statusBadge = (status: string) => {
    if (status === 'approved') return 'bg-green-100 text-green-700';
    if (status === 'pending') return 'bg-amber-100 text-amber-700';
    if (status === 'partial') return 'bg-blue-100 text-blue-700';
    return 'bg-red-100 text-red-700';
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">My Orders{orders.length ? ` (${orders.length})` : ''}</h2>
            <p className="text-sm text-gray-500">Track your order status and manage orders efficiently</p>
          </div>
        </div>
        {pendingOrders.length > 0 && (
          <button
            onClick={() => setShowPendingOrders(!showPendingOrders)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg text-sm font-semibold transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Pending ({pendingOrders.length})
          </button>
        )}
      </div>

      {/* Pending Orders Section */}
      {showPendingOrders && (
        <div className="bg-white rounded-xl border border-amber-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-amber-100 bg-amber-50">
            <div>
              <h3 className="text-sm font-bold text-amber-800">Pending Orders ({pendingOrders.length})</h3>
              <p className="text-xs text-amber-600 mt-0.5">Awaiting admin approval</p>
            </div>
            <button
              className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg text-sm font-semibold"
              onClick={() => setShowPendingOrders(false)}
            >
              Hide
            </button>
          </div>

          {/* Mobile pending */}
          <div className="lg:hidden divide-y divide-gray-100">
            {pendingOrders.map(order => (
              <div key={order.id} className="p-4 hover:bg-violet-50/30 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="font-semibold text-gray-900 truncate text-sm">{order.shop_name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{formatOrderDate(order.created_at)}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold text-gray-900 text-sm">{Number(order.total).toFixed(2)} LKR</p>
                    <p className="text-xs text-gray-500">{order.item_count} items</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">{order.status}</span>
                  <div className="flex items-center gap-2">
                    <button
                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors bg-violet-100 hover:bg-violet-200 text-violet-700"
                      onClick={() => handleEditPendingOrder(order)}
                    >
                      Edit
                    </button>
                    <button
                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors bg-blue-100 hover:bg-blue-200 text-blue-700"
                      onClick={() => setViewOrder(order)}
                    >
                      View
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop pending table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="py-3 px-5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left">Shop</th>
                  <th className="py-3 px-5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left">Date</th>
                  <th className="py-3 px-5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left">Total</th>
                  <th className="py-3 px-5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left">Items</th>
                  <th className="py-3 px-5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left">Status</th>
                  <th className="py-3 px-5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingOrders.map(order => (
                  <tr key={order.id} className="border-b border-gray-100 last:border-0 hover:bg-violet-50/30 transition-colors">
                    <td className="py-3.5 px-5 text-sm font-medium text-gray-900">{order.shop_name}</td>
                    <td className="py-3.5 px-5 text-sm text-gray-600">{formatOrderDate(order.created_at)}</td>
                    <td className="py-3.5 px-5 text-sm font-semibold text-gray-900">{Number(order.total).toFixed(2)} LKR</td>
                    <td className="py-3.5 px-5 text-sm text-gray-600">{order.item_count}</td>
                    <td className="py-3.5 px-5">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">{order.status}</span>
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-2">
                        <button
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors bg-violet-100 hover:bg-violet-200 text-violet-700"
                          onClick={() => handleEditPendingOrder(order)}
                        >
                          Edit
                        </button>
                        <button
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors bg-blue-100 hover:bg-blue-200 text-blue-700"
                          onClick={() => setViewOrder(order)}
                        >
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Main Orders Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between p-4 border-b border-gray-100">
          <div className="relative w-full sm:w-auto sm:flex-1 sm:max-w-xs">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search orders..."
              className="pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 text-sm w-full"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <select
            className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white text-gray-700 w-full sm:w-auto"
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          >
            <option value="all">All Status</option>
            {uniqueStatuses.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-red-600">{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="font-bold text-gray-900">No orders found</p>
            <p className="text-sm text-gray-500">Try adjusting your search or filter</p>
          </div>
        ) : (
          <>
            {/* Mobile card view */}
            <div className="lg:hidden divide-y divide-gray-100">
              {paginated.map(order => (
                <div key={order.id} className="p-4 hover:bg-violet-50/30 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="font-semibold text-gray-900 text-sm truncate">{order.shop_name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{formatOrderDate(order.created_at)}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-gray-900">{Number(order.total).toFixed(2)} LKR</p>
                      <p className="text-xs text-gray-500">{order.item_count} items</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusBadge(order.status)}`}>
                      {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </span>
                    <div className="flex gap-2">
                      {order.status === 'pending' && (
                        <button
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors bg-amber-100 hover:bg-amber-200 text-amber-700"
                          onClick={() => handleEditPendingOrder(order)}
                        >
                          Edit
                        </button>
                      )}
                      <button
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors bg-violet-100 hover:bg-violet-200 text-violet-700"
                        onClick={() => setViewOrder(order)}
                      >
                        View
                      </button>
                      {order.status === 'approved' && (
                        <button
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors bg-green-100 hover:bg-green-200 text-green-700"
                          onClick={() => handlePrintReceipt(order)}
                        >
                          Print
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="py-3 px-5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('shop_name')}>
                      <div className="flex items-center gap-1.5">
                        Shop {sortBy === 'shop_name' && <span className="text-violet-500">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                      </div>
                    </th>
                    <th className="py-3 px-5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('created_at')}>
                      <div className="flex items-center gap-1.5">
                        Date {sortBy === 'created_at' && <span className="text-violet-500">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                      </div>
                    </th>
                    <th className="py-3 px-5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('total')}>
                      <div className="flex items-center gap-1.5">
                        Total {sortBy === 'total' && <span className="text-violet-500">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                      </div>
                    </th>
                    <th className="py-3 px-5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left">Items</th>
                    <th className="py-3 px-5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('status')}>
                      <div className="flex items-center gap-1.5">
                        Status {sortBy === 'status' && <span className="text-violet-500">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                      </div>
                    </th>
                    <th className="py-3 px-5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map(order => (
                    <tr key={order.id} className="border-b border-gray-100 last:border-0 hover:bg-violet-50/30 transition-colors">
                      <td className="py-3.5 px-5 text-sm font-medium text-gray-900">{order.shop_name}</td>
                      <td className="py-3.5 px-5 text-sm text-gray-600">{formatOrderDate(order.created_at)}</td>
                      <td className="py-3.5 px-5 text-sm font-semibold text-gray-900">{Number(order.total).toFixed(2)} LKR</td>
                      <td className="py-3.5 px-5 text-sm text-gray-600">{order.item_count}</td>
                      <td className="py-3.5 px-5">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusBadge(order.status)}`}>
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        </span>
                      </td>
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-2">
                          {order.status === 'pending' && (
                            <button
                              className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors bg-amber-100 hover:bg-amber-200 text-amber-700"
                              onClick={() => handleEditPendingOrder(order)}
                            >
                              Edit
                            </button>
                          )}
                          <button
                            className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors bg-violet-100 hover:bg-violet-200 text-violet-700"
                            onClick={() => setViewOrder(order)}
                          >
                            View
                          </button>
                          {order.status === 'approved' && (
                            <button
                              className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors bg-green-100 hover:bg-green-200 text-green-700"
                              onClick={() => handlePrintReceipt(order)}
                            >
                              Print
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-100">
                <span className="text-sm text-gray-500">
                  Showing {page * ORDERS_PER_PAGE - ORDERS_PER_PAGE + 1}–{Math.min(page * ORDERS_PER_PAGE, filtered.length)} of {filtered.length}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPage(prev => Math.max(1, prev - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                  >
                    Prev
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map(pageNum => (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`px-3 py-1 text-sm rounded-lg font-semibold ${page === pageNum ? 'bg-violet-600 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    >
                      {pageNum}
                    </button>
                  ))}
                  <button
                    onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Edit Pending Order Modal */}
      {editOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto">
            <button
              className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
              onClick={() => { setEditOrder(null); setEditItems([]); setEditNotes(''); setEditError(''); }}
              aria-label="Close"
            >
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h3 className="text-base font-bold text-gray-900 mb-5">Edit Pending Order</h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-gray-50">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Order</span>
                <span className="text-sm font-medium text-gray-900">{editOrder.shop_name} · {editOrder.id.slice(0, 8)}...</span>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Notes</label>
                <textarea
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 text-sm bg-white text-gray-900"
                  placeholder="Add notes for this order"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">Order Items</label>
                  <span className="text-xs text-gray-500">Total: <span className="font-semibold text-gray-900">{editTotal.toFixed(2)} LKR</span></span>
                </div>
                <div className="space-y-2">
                  {editItems.map((item) => (
                    <div key={item.product_id} className="flex items-center gap-3 border border-gray-100 rounded-lg p-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{item.name}</p>
                        <p className="text-xs text-gray-500">{item.unit_price.toFixed(2)} LKR/unit</p>
                      </div>
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => {
                          const qty = Number(e.target.value);
                          setEditItems(prev => prev.map(i => i.product_id === item.product_id ? { ...i, quantity: qty, total: i.unit_price * qty } : i));
                        }}
                        className="w-20 px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 text-sm text-center"
                      />
                      <button
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors bg-red-100 hover:bg-red-200 text-red-700"
                        onClick={() => setEditItems(prev => prev.filter(i => i.product_id !== item.product_id))}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Add Item</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={newProductId}
                    onChange={(e) => setNewProductId(e.target.value)}
                    className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white text-gray-700 text-sm"
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
                    className="w-full sm:w-24 px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 text-sm bg-white text-gray-900"
                  />
                  <button
                    className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
                    onClick={addEditItem}
                  >
                    Add
                  </button>
                </div>
              </div>

              {editError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">
                  {editError}
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-gray-100">
              <button
                className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg text-sm font-semibold"
                onClick={() => { setEditOrder(null); setEditItems([]); setEditNotes(''); setEditError(''); }}
                disabled={editLoading}
              >
                Cancel
              </button>
              <button
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm disabled:opacity-60"
                onClick={handleSaveEditedOrder}
                disabled={editLoading}
              >
                {editLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Order Modal */}
      {viewOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto">
            <button
              className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
              onClick={() => setViewOrder(null)}
              aria-label="Close"
            >
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h3 className="text-base font-bold text-gray-900 mb-5">Order Details</h3>
            <div className="space-y-0">
              <div className="flex items-center justify-between py-2 border-b border-gray-50">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Shop</span>
                <span className="text-sm font-medium text-gray-900">{viewOrder.shop_name}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-50">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Date</span>
                <span className="text-sm font-medium text-gray-900">{formatOrderDateTime(viewOrder.created_at)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-50">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Total</span>
                <span className="text-sm font-semibold text-green-700">{Number(viewOrder.total).toFixed(2)} LKR</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-50">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Items</span>
                <span className="text-sm font-medium text-gray-900">{viewOrder.item_count}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Status</span>
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusBadge(viewOrder.status)}`}>
                  {viewOrder.status.charAt(0).toUpperCase() + viewOrder.status.slice(1)}
                </span>
              </div>
            </div>
            <div className="flex justify-end mt-6 pt-4 border-t border-gray-100">
              <button
                className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg text-sm font-semibold"
                onClick={() => setViewOrder(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Preview Modal */}
      {printReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto">
            <button
              className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
              onClick={() => setPrintReceipt(null)}
              aria-label="Close"
            >
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h3 className="text-base font-bold text-gray-900 mb-5">Receipt Preview</h3>

            {/* Receipt Content */}
            <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
              <div className="text-center mb-4">
                <p className="text-base font-bold text-gray-900">MotionRep</p>
                <p className="text-xs text-gray-500 mt-0.5">Sales Order Receipt</p>
                <span className="inline-block mt-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                  APPROVED — READY FOR DELIVERY
                </span>
              </div>

              <div className="space-y-0 mb-4">
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-xs text-gray-500 uppercase tracking-wide">Order ID</span>
                  <span className="text-sm font-medium text-gray-900 font-mono">{printReceipt.id.slice(0, 8)}...</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-xs text-gray-500 uppercase tracking-wide">Shop</span>
                  <span className="text-sm font-medium text-gray-900">{printReceipt.shop?.name || printReceipt.shop_name}</span>
                </div>
                {printReceipt.shop && (
                  <>
                    <div className="flex items-center justify-between py-2 border-b border-gray-100">
                      <span className="text-xs text-gray-500 uppercase tracking-wide">Address</span>
                      <span className="text-sm font-medium text-gray-900 text-right max-w-[60%]">{printReceipt.shop.address}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-gray-100">
                      <span className="text-xs text-gray-500 uppercase tracking-wide">Phone</span>
                      <span className="text-sm font-medium text-gray-900">{printReceipt.shop.phone}</span>
                    </div>
                  </>
                )}
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-xs text-gray-500 uppercase tracking-wide">Date</span>
                  <span className="text-sm font-medium text-gray-900">{formatOrderDate(printReceipt.created_at)}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-xs text-gray-500 uppercase tracking-wide">Time</span>
                  <span className="text-sm font-medium text-gray-900">{formatOrderTime(printReceipt.created_at)}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-xs text-gray-500 uppercase tracking-wide">Status</span>
                  <span className="text-sm font-medium text-green-700">{printReceipt.status}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-xs text-gray-500 uppercase tracking-wide">Items Count</span>
                  <span className="text-sm font-medium text-gray-900">{printReceipt.item_count}</span>
                </div>
              </div>

              <div className="border-t border-gray-200 my-3" />

              {printReceipt.items && printReceipt.items.length > 0 ? (
                <div className="mb-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Order Items</p>
                  <div className="space-y-2">
                    {printReceipt.items.map((item, index) => (
                      <div key={item.product_id} className="flex items-center justify-between text-sm">
                        <div>
                          <span className="font-medium text-gray-900">{index + 1}. {item.name}</span>
                          <p className="text-xs text-gray-500">Qty: {item.quantity} × {item.unit_price.toFixed(2)} LKR</p>
                        </div>
                        <span className="font-semibold text-gray-900">{item.total.toFixed(2)} LKR</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mb-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Order Items</p>
                  <p className="text-sm text-gray-500">Item details not available</p>
                  <p className="text-xs text-gray-500">Total Items: {printReceipt.item_count}</p>
                </div>
              )}

              <div className="border-t border-gray-200 my-3" />

              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-900">Total Amount</span>
                <span className="text-base font-bold text-violet-600">{Number(printReceipt.total).toFixed(2)} LKR</span>
              </div>

              <div className="mt-3 p-3 bg-green-50 border border-green-100 rounded-lg flex items-start gap-2">
                <svg className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <p className="text-xs font-semibold text-green-800">Order Approved</p>
                  <p className="text-xs text-green-700 mt-0.5">This order has been approved and is ready for delivery.</p>
                </div>
              </div>

              <p className="text-center text-xs text-gray-400 mt-4">Printed on: {new Date().toLocaleString()}</p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-5 print:hidden">
              <button
                className="flex-1 flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg text-sm font-semibold justify-center"
                onClick={() => setPrintReceipt(null)}
              >
                Close
              </button>
              <button
                className="flex-1 flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm justify-center"
                onClick={handleActualPrint}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print Receipt
              </button>
            </div>

            {/* E-Receipt Section */}
            <div className="mt-4 pt-4 border-t border-gray-100 print:hidden">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3 text-center">Send E-Receipt to Shop Owner</p>

              <div className="mb-3 p-3 bg-gray-50 border border-gray-100 rounded-lg flex items-center justify-between">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Shop Phone</span>
                {printReceipt.shop?.phone ? (
                  <span className="text-sm font-medium text-gray-900 font-mono">{printReceipt.shop.phone}</span>
                ) : (
                  <span className="text-sm text-red-500">Not available</span>
                )}
              </div>

              {!printReceipt.shop?.phone && (
                <p className="text-xs text-red-600 mb-3 text-center">Please update shop details with a valid phone number to send notifications</p>
              )}

              {messageStatus.type && (
                <div className={`mb-3 p-3 rounded-lg flex items-center gap-2 text-sm ${messageStatus.type === 'success' ? 'bg-green-50 border border-green-100 text-green-700' : 'bg-red-50 border border-red-100 text-red-700'}`}>
                  {messageStatus.type === 'success' ? (
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  ) : (
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  )}
                  {messageStatus.message}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-100 hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed text-blue-700 font-semibold text-sm transition-colors"
                  onClick={handleSendSMS}
                  disabled={sendingSMS || sendingWhatsApp || !printReceipt.shop?.phone || smsSent}
                >
                  {sendingSMS ? (
                    <><div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />Sending...</>
                  ) : smsSent ? (
                    <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>SMS Sent</>
                  ) : (
                    <>Send SMS</>
                  )}
                </button>
                {smsSent && (
                  <button
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-green-100 hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed text-green-700 font-semibold text-sm transition-colors"
                    onClick={handleSendWhatsApp}
                    disabled={sendingSMS || sendingWhatsApp || !printReceipt.shop?.phone}
                  >
                    {sendingWhatsApp ? (
                      <><div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />Sending...</>
                    ) : (
                      <>Send WhatsApp</>
                    )}
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-2 text-center">
                {printReceipt.shop?.phone
                  ? smsSent
                    ? 'SMS sent! You can now send a WhatsApp message if needed.'
                    : 'Send SMS to notify shop owner about this order'
                  : 'Phone number not available — please update shop details'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
