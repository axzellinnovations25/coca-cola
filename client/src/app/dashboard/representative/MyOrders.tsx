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

  return (
    <div className="space-y-6 overflow-x-hidden">
      {/* Enhanced Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">My Orders{orders.length ? ` (${orders.length})` : ''}</h2>
          <p className="text-gray-600 text-sm">Track your order status and manage orders efficiently</p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <span>Pending</span>
            <div className="w-3 h-3 bg-green-500 rounded-full ml-4"></div>
            <span>Approved</span>
            <div className="w-3 h-3 bg-red-500 rounded-full ml-4"></div>
            <span>Rejected</span>
          </div>
          {pendingOrders.length > 0 && (
            <button
              onClick={() => setShowPendingOrders(!showPendingOrders)}
              className="px-4 py-2 bg-yellow-100 hover:bg-yellow-200 text-yellow-700 rounded-lg text-sm font-medium transition-colors active:scale-95"
            >
              <span>⚠️</span>
              Pending ({pendingOrders.length})
            </button>
          )}
        </div>
      </div>
      
      {/* Enhanced Pending Orders Section */}
      {showPendingOrders && (
        <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4">
            <div className="flex items-center gap-3 mb-4 sm:mb-0">
              <div>
                <h3 className="text-lg font-semibold text-yellow-800">Pending Orders ({pendingOrders.length})</h3>
                <p className="text-yellow-600 text-sm">Orders awaiting admin approval</p>
              </div>
            </div>
            <button
              className="px-4 py-2 bg-yellow-100 hover:bg-yellow-200 text-yellow-700 rounded-lg text-sm font-medium transition-colors"
              onClick={() => setShowPendingOrders(!showPendingOrders)}
            >
              Hide Pending Orders
            </button>
          </div>
          
          <div className="bg-white rounded-lg border border-yellow-200 overflow-hidden">
            {/* Mobile Card View for Pending Orders */}
            <div className="lg:hidden">
              <div className="p-4 border-b border-yellow-200">
                <h4 className="font-semibold text-yellow-800">Pending Orders</h4>
              </div>
              <div className="divide-y divide-yellow-100">
                {pendingOrders.map(order => (
                  <div key={order.id} className="p-4 hover:bg-yellow-50 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0 mr-3">
                        <h5 className="font-medium text-gray-900 truncate">{order.shop_name}</h5>
                        <p className="text-sm text-gray-600 mt-1">{formatOrderDate(order.created_at)}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-semibold text-gray-900">{Number(order.total).toFixed(2)} LKR</div>
                        <div className="text-sm text-gray-600">{order.item_count} items</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="px-3 py-1 bg-yellow-200 text-yellow-800 rounded-full text-xs font-medium">
                        {order.status}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium transition-colors active:scale-95"
                          onClick={() => handleEditPendingOrder(order)}
                        >
                          Edit
                        </button>
                        <button
                          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors active:scale-95"
                          onClick={() => setViewOrder(order)}
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Desktop Table View for Pending Orders */}
            <div className="hidden lg:block">
              <div className="px-6 py-4 bg-yellow-50 border-b border-yellow-200">
                <h4 className="font-semibold text-yellow-800">Pending Orders</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-yellow-100">
                      <th className="px-6 py-3 font-medium text-yellow-800 text-left">Shop</th>
                      <th className="px-6 py-3 font-medium text-yellow-800 text-left">Date</th>
                      <th className="px-6 py-3 font-medium text-yellow-800 text-left">Total</th>
                      <th className="px-6 py-3 font-medium text-yellow-800 text-left">Items</th>
                      <th className="px-6 py-3 font-medium text-yellow-800 text-left">Status</th>
                      <th className="px-6 py-3 font-medium text-yellow-800 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-yellow-200">
                    {pendingOrders.map(order => (
                      <tr key={order.id} className="hover:bg-yellow-50 transition-colors">
                        <td className="px-6 py-3 font-medium text-gray-900">{order.shop_name}</td>
                        <td className="px-6 py-3 text-gray-700">{formatOrderDate(order.created_at)}</td>
                        <td className="px-6 py-3 font-semibold text-gray-900">{Number(order.total).toFixed(2)} LKR</td>
                        <td className="px-6 py-3 text-gray-700">{order.item_count}</td>
                        <td className="px-6 py-3">
                          <span className="px-3 py-1 bg-yellow-200 text-yellow-800 rounded-full text-xs font-medium">
                            {order.status}
                          </span>
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium transition-colors"
                              onClick={() => handleEditPendingOrder(order)}
                            >
                              Edit
                            </button>
                            <button
                              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
                              onClick={() => setViewOrder(order)}
                            >
                              View Details
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Main Orders Section */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {/* Header Section */}
        <div className="p-4 lg:p-6 border-b border-gray-100">
          <div className="flex flex-col gap-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">All Orders</h3>
              <p className="text-gray-600 text-sm">View and manage your complete order history</p>
            </div>
            
            {/* Enhanced Search and Filter - Mobile Optimized */}
            <div className="flex flex-col gap-3 w-full">
              <div className="relative w-full">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search orders..."
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-transparent text-sm text-gray-900 bg-white focus:bg-white transition-colors"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                />
              </div>
              
              <select
                className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-transparent text-sm text-gray-900 bg-white focus:bg-white transition-colors"
                value={statusFilter}
                onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
              >
                <option value="all" className="text-gray-900">All Status</option>
                {uniqueStatuses.map(status => (
                  <option key={status} value={status} className="text-gray-900">{status}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="p-4 lg:p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-gray-600 font-medium">Loading orders...</span>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-red-600 font-medium">{error}</p>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-gray-500 font-medium">No orders found</p>
              </div>
            </div>
          ) : (
            <>
              {/* Enhanced Mobile Card View */}
              <div className="lg:hidden space-y-4">
                {paginated.map(order => (
                  <div key={order.id} className="bg-gradient-to-br from-white to-gray-50 rounded-xl p-4 border border-gray-200 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                    {/* Header with Shop and Status */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0 mr-3">
                        <h4 className="font-bold text-gray-900 text-base truncate">{order.shop_name}</h4>
                        <p className="text-sm text-gray-600 mt-1">{formatOrderDate(order.created_at)}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-bold text-gray-900 text-lg">{Number(order.total).toFixed(2)} LKR</div>
                        <div className="text-sm text-gray-600">{order.item_count} items</div>
                      </div>
                    </div>
                    
                    {/* Status Badge */}
                    <div className="flex items-center justify-between mb-4">
                      <span className={`px-3 py-1.5 rounded-full text-sm font-semibold ${
                        order.status === 'approved' ? 'bg-green-100 text-green-700 border border-green-200' :
                        order.status === 'pending' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' :
                        'bg-red-100 text-red-700 border border-red-200'
                      }`}>
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </span>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      {order.status === 'pending' && (
                        <button
                          className="flex-1 px-4 py-3 bg-yellow-100 hover:bg-yellow-200 text-yellow-700 rounded-lg text-sm font-semibold transition-colors active:scale-95"
                          onClick={() => handleEditPendingOrder(order)}
                        >
                          <div className="flex items-center justify-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5h2m-1-1v2m-7.05 8.95a7 7 0 119.9-9.9l-7.5 7.5-2.83.83.83-2.83 7.5-7.5" />
                            </svg>
                            Edit
                          </div>
                        </button>
                      )}
                      <button
                        className="flex-1 px-4 py-3 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg text-sm font-semibold transition-colors active:scale-95"
                        onClick={() => setViewOrder(order)}
                      >
                        <div className="flex items-center justify-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          View Details
                        </div>
                      </button>
                      {order.status === 'approved' && (
                        <button
                          className="flex-1 px-4 py-3 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg text-sm font-semibold transition-colors active:scale-95"
                          onClick={() => handlePrintReceipt(order)}
                        >
                          <div className="flex items-center justify-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                            </svg>
                            Print
                          </div>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Enhanced Desktop Table View */}
              <div className="hidden lg:block">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-6 py-3 font-medium text-gray-700 text-left cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('shop_name')}>
                          <div className="flex items-center gap-2">
                            Shop
                            {sortBy === 'shop_name' && (sortDir === 'asc' ? '▲' : '▼')}
                          </div>
                        </th>
                        <th className="px-6 py-3 font-medium text-gray-700 text-left cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('created_at')}>
                          <div className="flex items-center gap-2">
                            Date
                            {sortBy === 'created_at' && (sortDir === 'asc' ? '▲' : '▼')}
                          </div>
                        </th>
                        <th className="px-6 py-3 font-medium text-gray-700 text-left cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('total')}>
                          <div className="flex items-center gap-2">
                            Total
                            {sortBy === 'total' && (sortDir === 'asc' ? '▲' : '▼')}
                          </div>
                        </th>
                        <th className="px-6 py-3 font-medium text-gray-700 text-left">Items</th>
                        <th className="px-6 py-3 font-medium text-gray-700 text-left cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('status')}>
                          <div className="flex items-center gap-2">
                            Status
                            {sortBy === 'status' && (sortDir === 'asc' ? '▲' : '▼')}
                          </div>
                        </th>
                        <th className="px-6 py-3 font-medium text-gray-700 text-left">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {paginated.map(order => (
                        <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-3 font-medium text-gray-900">{order.shop_name}</td>
                          <td className="px-6 py-3 text-gray-700">{formatOrderDate(order.created_at)}</td>
                          <td className="px-6 py-3 font-semibold text-gray-900">{Number(order.total).toFixed(2)} LKR</td>
                          <td className="px-6 py-3 text-gray-700">{order.item_count}</td>
                          <td className="px-6 py-3">
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                              order.status === 'approved' ? 'bg-green-100 text-green-600' :
                              order.status === 'pending' ? 'bg-yellow-100 text-yellow-600' :
                              'bg-red-100 text-red-600'
                            }`}>
                              {order.status}
                            </span>
                          </td>
                          <td className="px-6 py-3">
                            <div className="flex gap-2">
                              {order.status === 'pending' && (
                                <button
                                  className="px-4 py-2 bg-yellow-100 hover:bg-yellow-200 text-yellow-700 rounded-lg text-sm font-medium transition-colors"
                                  onClick={() => handleEditPendingOrder(order)}
                                >
                                  Edit
                                </button>
                              )}
                              <button
                                className="px-4 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg text-sm font-medium transition-colors"
                                onClick={() => setViewOrder(order)}
                              >
                                View
                              </button>
                              {order.status === 'approved' && (
                                <button
                                  className="px-4 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg text-sm font-medium transition-colors"
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
              </div>

              {/* Enhanced Mobile-Friendly Pagination */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-8 pt-6 border-t border-gray-200">
                  <span className="text-sm text-gray-600 text-center sm:text-left">
                    Showing {page * ORDERS_PER_PAGE - ORDERS_PER_PAGE + 1} to {Math.min(page * ORDERS_PER_PAGE, filtered.length)} of {filtered.length} entries
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage(prev => Math.max(1, prev - 1))}
                      disabled={page === 1}
                      className="px-4 py-3 lg:py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-colors active:scale-95"
                    >
                      Previous
                    </button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const pageNum = i + 1;
                        return (
                          <button
                            key={pageNum}
                            className={`w-10 h-10 rounded-lg font-medium transition-colors text-sm active:scale-95 ${
                              page === pageNum
                                ? 'bg-purple-500 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
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
                      className="px-4 py-3 lg:py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-colors active:scale-95"
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

      {/* Edit Pending Order Modal */}
      {editOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 lg:p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto relative">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Edit Pending Order</h3>
              <button
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold transition-colors p-1 rounded-full hover:bg-gray-100"
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
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div className="text-sm text-gray-600">Order</div>
                <div className="font-semibold text-gray-900">
                  {editOrder.shop_name} • {editOrder.id.slice(0, 8)}...
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
                  {editItems.map((item) => (
                    <div key={item.product_id} className="flex flex-col sm:flex-row sm:items-center gap-3 border border-gray-200 rounded-lg p-3">
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
                          className="w-24 px-2 py-1 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
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
                    className="w-32 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300 text-gray-900"
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
                onClick={handleSaveEditedOrder}
                disabled={editLoading}
              >
                {editLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced View Order Modal - Mobile Responsive */}
      {viewOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 lg:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto relative">
            <button 
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl font-bold transition-colors p-2 rounded-full hover:bg-gray-100" 
              onClick={() => setViewOrder(null)}
              aria-label="Close"
            >
              &times;
            </button>
            <h3 className="text-lg font-semibold mb-4 text-gray-900 pr-8">Order Details</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="font-medium text-gray-700">Shop:</span>
                <span className="text-gray-900 text-right font-semibold">{viewOrder.shop_name}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="font-medium text-gray-700">Date:</span>
                <span className="text-gray-900 text-right">{formatOrderDateTime(viewOrder.created_at)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="font-medium text-gray-700">Total:</span>
                <span className="text-gray-900 font-bold text-lg">{Number(viewOrder.total).toFixed(2)} LKR</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="font-medium text-gray-700">Items:</span>
                <span className="text-gray-900 font-semibold">{viewOrder.item_count}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="font-medium text-gray-700">Status:</span>
                <span className={`font-semibold px-3 py-1 rounded-full text-sm ${
                  viewOrder.status === 'approved' ? 'bg-green-100 text-green-700' : 
                  viewOrder.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 
                  'bg-red-100 text-red-700'
                }`}>
                  {viewOrder.status.charAt(0).toUpperCase() + viewOrder.status.slice(1)}
                </span>
              </div>
            </div>
            <div className="flex justify-end mt-6 pt-4 border-t border-gray-200">
              <button 
                className="w-full lg:w-auto px-6 py-3 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-700 font-semibold transition-colors active:scale-95" 
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 lg:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto relative">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">Receipt Preview</h2>
              <button 
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold transition-colors p-1 rounded-full hover:bg-gray-100"
                onClick={() => setPrintReceipt(null)}
                aria-label="Close"
              >
                &times;
              </button>
            </div>
            
            {/* Receipt Content - Preview Only */}
            <div className="border border-gray-200 p-4 rounded-lg bg-white print-receipt">
              {/* Header */}
              <div className="text-center mb-4 print:mb-3">
                <h3 className="text-lg font-semibold text-gray-900 mb-1 print:text-base print:font-bold print:text-black">MotionRep</h3>
                <p className="text-sm text-gray-600 print:text-xs print:text-black">Sales Order Receipt</p>
                <div className="mt-2 print:mt-1">
                  <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium print:bg-white print:text-black print:border print:border-black print:font-bold">
                    APPROVED - READY FOR DELIVERY
                  </span>
                </div>
              </div>

              {/* Receipt Details */}
              <div className="space-y-2 mb-4 print:mb-3">
                <div className="flex justify-between text-sm print:text-xs">
                  <span className="font-medium text-gray-700 print:font-bold print:text-black">Order ID:</span>
                  <span className="text-gray-900 font-mono print:font-mono print:text-black">{printReceipt.id.slice(0, 8)}...</span>
                </div>
                <div className="flex justify-between text-sm print:text-xs">
                  <span className="font-medium text-gray-700 print:font-bold print:text-black">Shop:</span>
                  <span className="text-gray-900 print:text-black">{printReceipt.shop?.name || printReceipt.shop_name}</span>
                </div>
                {printReceipt.shop && (
                  <>
                    <div className="flex justify-between text-sm print:text-xs">
                      <span className="font-medium text-gray-700 print:font-bold print:text-black">Address:</span>
                      <span className="text-gray-900 print:text-black text-right max-w-[60%]">{printReceipt.shop.address}</span>
                    </div>
                    <div className="flex justify-between text-sm print:text-xs">
                      <span className="font-medium text-gray-700 print:font-bold print:text-black">Phone:</span>
                      <span className="text-gray-900 print:text-black">{printReceipt.shop.phone}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between text-sm print:text-xs">
                  <span className="font-medium text-gray-700 print:font-bold print:text-black">Date:</span>
                  <span className="text-gray-900 print:text-black">{formatOrderDate(printReceipt.created_at)}</span>
                </div>
                <div className="flex justify-between text-sm print:text-xs">
                  <span className="font-medium text-gray-700 print:font-bold print:text-black">Time:</span>
                  <span className="text-gray-900 print:text-black">{formatOrderTime(printReceipt.created_at)}</span>
                </div>
                <div className="flex justify-between text-sm print:text-xs">
                  <span className="font-medium text-gray-700 print:font-bold print:text-black">Status:</span>
                  <span className="text-green-600 font-medium print:text-black print:font-bold">{printReceipt.status}</span>
                </div>
                <div className="flex justify-between text-sm print:text-xs">
                  <span className="font-medium text-gray-700 print:font-bold print:text-black">Items Count:</span>
                  <span className="text-gray-900 print:text-black">{printReceipt.item_count}</span>
                </div>
              </div>

              {/* Separator */}
              <div className="border-t border-gray-300 my-3 print:my-2 print:border-black"></div>

              {/* Order Items */}
              {printReceipt.items && printReceipt.items.length > 0 ? (
                <div className="mb-4 print:mb-3">
                  <h4 className="font-medium text-gray-900 mb-2 print:text-sm print:font-bold print:text-black">Order Items:</h4>
                  <div className="space-y-1 print:space-y-0">
                    {printReceipt.items.map((item, index) => (
                      <div key={item.product_id} className="text-sm print:text-xs">
                        <div className="flex justify-between mb-1">
                          <span className="font-medium text-gray-900 print:text-black print:font-bold">{index + 1}. {item.name}</span>
                          <span className="text-gray-900 print:text-black print:font-bold">{item.total.toFixed(2)} LKR</span>
                        </div>
                        <div className="flex justify-between text-gray-600 print:text-black">
                          <span>Qty: {item.quantity} × {item.unit_price.toFixed(2)} LKR</span>
                          <span></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mb-4 print:mb-3">
                  <h4 className="font-medium text-gray-900 mb-2 print:text-sm print:font-bold print:text-black">Order Items:</h4>
                  <div className="text-sm print:text-xs text-gray-600 print:text-black">
                    <p>Item details not available</p>
                    <p>Total Items: {printReceipt.item_count}</p>
                  </div>
                </div>
              )}

              {/* Separator */}
              <div className="border-t border-gray-300 my-3 print:my-2 print:border-black"></div>

              {/* Total */}
              <div className="mb-4 print:mb-3">
                <div className="flex justify-between items-center">
                  <span className="text-base font-semibold text-gray-900 print:text-sm print:font-bold print:text-black">Total Amount:</span>
                  <span className="text-lg font-semibold text-purple-600 print:text-sm print:text-black print:font-bold">{Number(printReceipt.total).toFixed(2)} LKR</span>
                </div>
              </div>

              {/* Approval Notice */}
              <div className="bg-green-50 border border-green-200 rounded p-3 mb-4 print:mb-3 print:bg-white print:border-black print:border-dashed">
                <div className="flex items-center gap-2">
                  <span className="text-green-600 print:text-black">✅</span>
                  <div>
                    <p className="text-sm font-medium text-green-800 print:text-xs print:text-black print:font-bold">Order Approved</p>
                    <p className="text-xs text-green-700 print:text-xs print:text-black">This order has been approved and is ready for delivery.</p>
                  </div>
                </div>
              </div>

              {/* Separator */}
              <div className="border-t border-gray-300 my-3 print:my-2 print:border-black"></div>

              {/* Footer */}
              <div className="text-center text-gray-500 text-sm print:text-xs print:text-black">
                <p>Thank you for your business!</p>
                <p className="mt-1">MotionRep - Professional Sales Management</p>
                <p className="mt-1 print:mt-0">Printed on: {new Date().toLocaleString()}</p>
              </div>
            </div>

            {/* Action Buttons - Hidden in Print */}
            <div className="flex flex-col sm:flex-row gap-3 print:hidden mt-6">
              <button 
                className="flex-1 px-4 py-3 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold transition-colors active:scale-95" 
                onClick={() => setPrintReceipt(null)}
              >
                Close
              </button>
              <button 
                className="flex-1 px-4 py-3 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-700 font-semibold transition-colors active:scale-95" 
                onClick={handleActualPrint}
              >
                Print Receipt
              </button>
            </div>

            {/* E-Receipt Buttons - Hidden in Print */}
            <div className="mt-4 pt-4 border-t border-gray-200 print:hidden">
              <p className="text-sm text-gray-600 mb-3 text-center">Send E-Receipt to Shop Owner</p>
              
              {/* Phone Number Display */}
              <div className="mb-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-700">Shop Phone:</span>
                  <span className="text-gray-900 font-mono">
                    {printReceipt.shop?.phone ? printReceipt.shop.phone : (
                      <span className="text-red-500 font-normal">Not available</span>
                    )}
                  </span>
                </div>
                {!printReceipt.shop?.phone && (
                  <p className="text-xs text-red-600 mt-1">
                    ⚠️ Please update shop details with a valid phone number to send notifications
                  </p>
                )}
              </div>
              
              {/* Message Status */}
              {messageStatus.type && (
                <div className={`mb-3 p-3 rounded-lg text-sm ${
                  messageStatus.type === 'success' 
                    ? 'bg-green-50 border border-green-200 text-green-700' 
                    : 'bg-red-50 border border-red-200 text-red-700'
                }`}>
                  <div className="flex items-center gap-2">
                    {messageStatus.type === 'success' ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                    <span>{messageStatus.message}</span>
                  </div>
                </div>
              )}
              
              <div className="flex flex-col sm:flex-row gap-2">
                <button 
                  className="flex-1 px-4 py-3 rounded-lg bg-blue-100 hover:bg-blue-200 disabled:bg-blue-50 disabled:cursor-not-allowed text-blue-700 font-semibold text-sm transition-colors flex items-center justify-center gap-2 active:scale-95"
                  onClick={handleSendSMS}
                  disabled={sendingSMS || sendingWhatsApp || !printReceipt.shop?.phone || smsSent}
                >
                  {sendingSMS ? (
                    <>
                      <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      Sending...
                    </>
                  ) : smsSent ? (
                    <>
                      <span>✅</span> SMS Sent
                    </>
                  ) : (
                    <>
                      <span>📱</span> Send SMS
                    </>
                  )}
                </button>
                {smsSent && (
                  <button 
                    className="flex-1 px-4 py-3 rounded-lg bg-green-100 hover:bg-green-200 disabled:bg-green-50 disabled:cursor-not-allowed text-green-700 font-semibold text-sm transition-colors flex items-center justify-center gap-2 active:scale-95"
                    onClick={handleSendWhatsApp}
                    disabled={sendingSMS || sendingWhatsApp || !printReceipt.shop?.phone}
                  >
                    {sendingWhatsApp ? (
                      <>
                        <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                        Sending...
                      </>
                    ) : (
                      <>
                        <span>💬</span> Send WhatsApp
                      </>
                    )}
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-2 text-center">
                {printReceipt.shop?.phone 
                  ? smsSent 
                    ? 'SMS sent successfully! You can now send WhatsApp message if needed.'
                    : 'Send SMS to notify shop owner about this order'
                  : 'Phone number not available - please update shop details'
                }
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 
