import React, { useEffect, useState } from 'react';
import { apiFetch, clearCache } from '../../../utils/api';

interface Bill {
  id: string;
  created_at: string;
  total: number;
  collected: number;
  outstanding: number;
}

interface OrderItem {
  product_id: string;
  name: string;
  unit_price: number;
  quantity: number;
  total: number;
}
interface ShopWithBills {
  shop_id: string;
  shop_name: string;
  total_outstanding: number;
  bills: Bill[];
}

interface BillsCollectionsProps {
  refreshKey?: number;
  onPaymentRecorded?: () => void;
}

export default function BillsCollections({ refreshKey, onPaymentRecorded }: BillsCollectionsProps) {
  const [shops, setShops] = useState<ShopWithBills[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedShopId, setExpandedShopId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [outstandingOnly, setOutstandingOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const SHOPS_PER_PAGE = 5;

  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState('');
  const [lastPaymentId, setLastPaymentId] = useState<string | null>(null);
  const [smsStatus, setSmsStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });
  const [sendingSMS, setSendingSMS] = useState(false);
  const [printReceiptLoading, setPrintReceiptLoading] = useState(false);
  const [printReceipt, setPrintReceipt] = useState<any>(null);

  // Return modal state
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnOrderId, setReturnOrderId] = useState<string | null>(null);
  const [returnItems, setReturnItems] = useState<OrderItem[]>([]);
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  const [returnLoading, setReturnLoading] = useState(false);
  const [returnError, setReturnError] = useState('');

  const triggerRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  useEffect(() => {
    setLoading(true);
    setError('');
    apiFetch('/api/marudham/bills/representative')
      .then(data => setShops((data.bills || []).map((shop: any) => ({
        ...shop,
        bills: (shop.bills || []).map((bill: any) => ({
          ...bill,
          collected: Number(bill.collected || 0),
          outstanding: Number(bill.outstanding || 0),
          total: Number(bill.total || 0)
        }))
      }))))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [refreshTrigger, refreshKey]);

  // Calculate total outstanding and total collected
  const totalOutstanding = shops.reduce((sum, s) => sum + (s.total_outstanding || 0), 0);
  const totalCollected = shops.reduce((sum, s) => (s.bills ?? []).reduce((acc, b) => acc + (b.collected || 0), sum), 0);

  // Filter and paginate shops
  const filteredShops = shops
    .filter(shop => shop.shop_name.toLowerCase().includes(search.toLowerCase()))
    .filter(shop => !outstandingOnly || shop.total_outstanding > 0);
  const totalPages = Math.ceil(filteredShops.length / SHOPS_PER_PAGE) || 1;
  const paginatedShops = filteredShops.slice((page - 1) * SHOPS_PER_PAGE, page * SHOPS_PER_PAGE);

  // Payment handlers
  const handleRecordPayment = (bill: Bill) => {
    setSelectedBill(bill);
    setPaymentAmount('');
    setPaymentNotes('');
    setPaymentError('');
    setPaymentSuccess('');
    setSmsStatus({ type: null, message: '' });
    setLastPaymentId(null);
    setShowPaymentModal(true);
  };

  const handleReturnProducts = async (bill: Bill) => {
    setReturnLoading(true);
    setReturnError('');
    setReturnOrderId(bill.id);
    try {
      const response = await apiFetch(`/api/marudham/orders/${bill.id}/details`);
      const items = response.order?.items || [];
      setReturnItems(items);
      const initialQuantities: Record<string, number> = {};
      items.forEach((item: OrderItem) => {
        initialQuantities[item.product_id] = 0;
      });
      setReturnQuantities(initialQuantities);
      setShowReturnModal(true);
    } catch (err: any) {
      setReturnError(err.message || 'Failed to load order items');
    } finally {
      setReturnLoading(false);
    }
  };

  const handleSendPaymentSMS = async () => {
    if (!lastPaymentId) return;
    
    setSendingSMS(true);
    setSmsStatus({ type: null, message: '' });
    
    try {
      const response = await apiFetch(`/api/marudham/payments/${lastPaymentId}/send-sms`, {
        method: 'POST'
      });
      
      if (response.success) {
        setSmsStatus({ 
          type: 'success', 
          message: 'Payment SMS sent successfully to shop owner!' 
        });
      } else {
        setSmsStatus({ 
          type: 'error', 
          message: response.error || 'Failed to send payment SMS' 
        });
      }
    } catch (error: any) {
      setSmsStatus({ 
        type: 'error', 
        message: error.message || 'Failed to send payment SMS' 
      });
    } finally {
      setSendingSMS(false);
    }
  };

  // Function to handle print receipt - shows modal first
  const handlePrintReceipt = async () => {
    if (!selectedBill || !lastPaymentId) return;
    
    setPrintReceiptLoading(true);
    
    try {
      // Get payment details for receipt (with fallback)
      let payment = null;
      try {
        const paymentResponse = await apiFetch(`/api/marudham/payments/${lastPaymentId}`);
        if (paymentResponse.success && paymentResponse.payment) {
          payment = paymentResponse.payment;
        }
      } catch (apiError) {
        console.warn('Payment API not available, using fallback data');
        // Create fallback payment data
        payment = {
          id: lastPaymentId,
          created_at: new Date().toISOString(),
          status: 'Completed'
        };
      }
      
      const shop = shops.find(s => s.bills?.some(b => b.id === selectedBill.id));
      
      // Set the receipt in state for the modal view
      setPrintReceipt({
        bill: selectedBill,
        payment: payment,
        shop: shop,
        paymentAmount: Number(paymentAmount),
        paymentNotes: paymentNotes
      });
      setSmsStatus({ type: null, message: '' });

    } catch (error: any) {
      console.error('Error handling print receipt:', error);
      // Fallback to basic payment info in modal
      const shop = shops.find(s => s.bills?.some(b => b.id === selectedBill.id));
      setPrintReceipt({
        bill: selectedBill,
        payment: {
          id: lastPaymentId,
          created_at: new Date().toISOString(),
          status: 'Completed'
        },
        shop: shop,
        paymentAmount: Number(paymentAmount),
        paymentNotes: paymentNotes
      });
      setSmsStatus({ type: 'error', message: 'Error generating receipt. Showing basic payment info.' });
    } finally {
      setPrintReceiptLoading(false);
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
        <title>Payment Receipt - ${printReceipt.bill.id.slice(0, 8)}</title>
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
          .payment-summary { 
            font-weight: bold; 
            margin: 6px 0 3px;
            border-bottom: 1px solid #000;
            padding-bottom: 2px;
            font-size: 9px;
            text-transform: uppercase;
          }
          .amount-row { 
            margin-bottom: 4px;
            font-size: 9px;
            page-break-inside: avoid;
          }
          .amount-label { 
            font-weight: bold;
            white-space: normal;
            word-break: break-word;
          }
          .amount-details { 
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
          <div class="receipt-subtitle">PAYMENT RECEIPT</div>
          <div class="status-badge">PAYMENT RECORDED</div>
        </div>

        <div class="receipt-details">
          <div class="detail-row">
            <span class="detail-label">BILL #:</span>
            <span class="detail-value">${printReceipt.bill.id.slice(0, 8).toUpperCase()}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">SHOP:</span>
            <span class="detail-value">${(printReceipt.shop?.shop_name || printReceipt.shop?.name || 'N/A').toUpperCase()}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">DATE:</span>
            <span class="detail-value">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' }).toUpperCase()}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">TIME:</span>
            <span class="detail-value">${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase()}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">PAYMENT #:</span>
            <span class="detail-value">${printReceipt.payment.id.slice(0, 8).toUpperCase()}</span>
          </div>
        </div>

        <div class="divider"></div>

        <div class="payment-summary">
          <div class="payment-summary">PAYMENT SUMMARY</div>
          <div class="amount-row">
            <div class="amount-label">Total Bill Amount:</div>
            <div class="amount-details">
              <span></span>
              <span>${Number(printReceipt.bill.total).toFixed(2)} LKR</span>
            </div>
          </div>
          <div class="amount-row">
            <div class="amount-label">Previously Paid:</div>
            <div class="amount-details">
              <span></span>
              <span>${Number(printReceipt.bill.collected).toFixed(2)} LKR</span>
            </div>
          </div>
          <div class="amount-row">
            <div class="amount-label">Outstanding Amount:</div>
            <div class="amount-details">
              <span></span>
              <span>${Number(printReceipt.bill.outstanding).toFixed(2)} LKR</span>
            </div>
          </div>
          <div class="amount-row">
            <div class="amount-label">Payment Made:</div>
            <div class="amount-details">
              <span></span>
              <span>${printReceipt.paymentAmount.toFixed(2)} LKR</span>
            </div>
          </div>
          <div class="amount-row">
            <div class="amount-label">Remaining Balance:</div>
            <div class="amount-details">
              <span></span>
              <span>${(Number(printReceipt.bill.outstanding) - printReceipt.paymentAmount).toFixed(2)} LKR</span>
            </div>
          </div>
        </div>

        ${printReceipt.paymentNotes ? `
        <div class="divider"></div>
        <div class="amount-row">
          <div class="amount-label">Payment Notes:</div>
          <div class="amount-details">
            <span style="white-space: normal; word-break: break-word;">${printReceipt.paymentNotes}</span>
            <span></span>
          </div>
        </div>
        ` : ''}

        <div class="divider"></div>

        <div class="total-row">
          <span>PAYMENT RECEIVED:</span>
          <span>${printReceipt.paymentAmount.toFixed(2)} LKR</span>
        </div>

        <div class="receipt-footer">
          <div>THANK YOU FOR YOUR PAYMENT!</div>
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


  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBill) return;
    setPaymentLoading(true);
    setPaymentError('');
    setPaymentSuccess('');
    setSmsStatus({ type: null, message: '' });
    
    try {
      const response = await apiFetch(`/api/marudham/bills/${selectedBill.id}/payment`, {
        method: 'POST',
        body: JSON.stringify({ amount: Number(paymentAmount), notes: paymentNotes }),
      });
      
      setPaymentSuccess('Payment recorded successfully!');
      setLastPaymentId(response.payment_id); // Store the payment ID for SMS sending
      
      // Auto-send SMS after payment recording
      if (response.sms_sent) {
        setSmsStatus({ 
          type: 'success', 
          message: 'Payment recorded and SMS sent successfully to shop owner!' 
        });
      } else if (response.sms_error) {
        setSmsStatus({ 
          type: 'error', 
          message: `Payment recorded but SMS failed: ${response.sms_error}` 
        });
      } else {
        setSmsStatus({ 
          type: 'error', 
          message: 'Payment recorded but SMS could not be sent - shop phone number not available' 
        });
      }
      
      // Close modal and reset fields after success
      setShowPaymentModal(false);
      setSelectedBill(null);
      setPaymentAmount('');
      setPaymentNotes('');
      setPaymentError('');
      setPaymentSuccess('');
      setLastPaymentId(null);
      setSmsStatus({ type: null, message: '' });

      // Trigger refresh after payment
      clearCache('/api/marudham/bills/representative');
      triggerRefresh();
      onPaymentRecorded?.(); // Call the prop function
    } catch (err: any) {
      setPaymentError(err.message);
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnOrderId) return;

    const itemsToReturn = Object.entries(returnQuantities)
      .filter(([, qty]) => qty > 0)
      .map(([product_id, quantity]) => ({ product_id, quantity }));

    if (itemsToReturn.length === 0) {
      setReturnError('Select at least one item to return.');
      return;
    }

    setReturnLoading(true);
    setReturnError('');

    try {
      await apiFetch(`/api/marudham/bills/${returnOrderId}/return`, {
        method: 'POST',
        body: JSON.stringify({ items: itemsToReturn })
      });

      setShowReturnModal(false);
      setReturnOrderId(null);
      setReturnItems([]);
      setReturnQuantities({});
      setShowPaymentModal(false);
      setSelectedBill(null);
      clearCache('/api/marudham/bills/representative');
      clearCache(`/api/marudham/orders/${returnOrderId}/details`);
      triggerRefresh();
      onPaymentRecorded?.();
    } catch (err: any) {
      setReturnError(err.message || 'Failed to record return.');
    } finally {
      setReturnLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Enhanced Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Bills & Collections</h2>
          <p className="text-gray-600 text-sm">Track outstanding payments and manage collections</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-2 text-sm text-gray-500">
            <div className="w-3 h-3 bg-red-400 rounded-full"></div>
            <span>Outstanding</span>
            <div className="w-3 h-3 bg-green-400 rounded-full ml-4"></div>
            <span>Paid</span>
          </div>
        </div>
      </div>

      {/* Enhanced Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-red-50 rounded-lg border border-red-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-black mb-1">Total Outstanding</p>
              <p className="text-2xl font-semibold text-red-700">{totalOutstanding.toFixed(2)} LKR</p>
              <p className="text-xs text-red-500 mt-2">From approved orders only</p>
            </div>
          </div>
        </div>
        
        <div className="bg-green-50 rounded-lg border border-green-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-black mb-1">Total Collected</p>
              <p className="text-2xl font-semibold text-green-700">{totalCollected.toFixed(2)} LKR</p>
              <p className="text-xs text-green-500 mt-2">Payments received</p>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Main Content */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {/* Header Section */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Outstanding Bills by Shop</h3>
              <p className="text-gray-600 text-sm">Click a shop to view detailed bill information</p>
            </div>
            
            {/* Enhanced Search and Filter */}
            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              <div className="relative flex-1 sm:flex-initial">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search by shop name..."
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-transparent text-sm text-gray-900 bg-white focus:bg-white transition-colors"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                />
              </div>
              
              <label className="flex items-center gap-3 px-4 py-2 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={outstandingOnly}
                  onChange={e => { setOutstandingOnly(e.target.checked); setPage(1); }}
                  className="w-4 h-4 text-purple-500 border-gray-300 rounded focus:ring-purple-500"
                />
                <span className="text-sm text-gray-700 font-medium">Show only outstanding</span>
              </label>
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-gray-600 font-medium">Loading bills...</span>
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
          ) : shops.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-gray-500 font-medium">No outstanding bills found</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Mobile Card View */}
              <div className="lg:hidden space-y-3">
                {paginatedShops.map((shop, idx) => (
                  <div key={`${shop.shop_id || 'shop'}-${idx}`} 
                       className={`rounded-lg p-3 border transition-all duration-200 ${
                         shop.total_outstanding > 0 
                           ? 'bg-red-50 border-red-100 hover:border-red-200' 
                           : 'bg-green-50 border-green-100 hover:border-green-200'
                       }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 truncate">{shop.shop_name}</h4>
                        <p className="text-xs text-gray-500">{(shop.bills ?? []).length} bills</p>
                      </div>
                      <div className={`px-3 py-1 rounded-md font-medium text-sm ${
                        shop.total_outstanding > 0 
                          ? 'bg-red-100 text-red-600' 
                          : 'bg-green-100 text-green-600'
                      }`}>
                        {Number(shop.total_outstanding || 0).toFixed(2)} LKR
                      </div>
                    </div>
                    
                    <button
                      className="w-full py-1.5 px-3 bg-white border border-gray-200 rounded-md text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                      onClick={() => setExpandedShopId(expandedShopId === shop.shop_id ? null : shop.shop_id)}
                    >
                      {expandedShopId === shop.shop_id ? 'Hide Details' : 'View Details'}
                    </button>
                    
                    {expandedShopId === shop.shop_id && (
                      <div className="mt-3 space-y-2">
                        {(shop.bills ?? []).map((bill, billIdx) => (
                          <div key={`${bill.id}-${billIdx}`} className="bg-white rounded-md p-3 border border-gray-100">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-xs font-mono text-gray-400">{bill.id?.slice(0, 8)}...</span>
                              <span className="text-xs text-gray-400">{bill.created_at ? new Date(bill.created_at).toLocaleDateString() : ''}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <div>
                                <span className="text-gray-500">Total:</span>
                                <div className="font-medium">{Number(bill.total || 0).toFixed(2)} LKR</div>
                              </div>
                              <div>
                                <span className="text-gray-500">Collected:</span>
                                <div className="font-medium text-green-500">{Number(bill.collected || 0).toFixed(2)} LKR</div>
                              </div>
                              <div>
                                <span className="text-gray-500">Outstanding:</span>
                                <div className="font-medium text-red-500">{Number(bill.outstanding || 0).toFixed(2)} LKR</div>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {bill.outstanding > 0 && (
                                <button
                                  className="flex-1 min-w-[110px] py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-md font-medium text-xs transition-colors whitespace-nowrap"
                                  onClick={(e) => { e.stopPropagation(); handleRecordPayment(bill); }}
                                >
                                  Record Payment
                                </button>
                              )}
                              <button
                                className="flex-1 min-w-[90px] py-1.5 rounded-md font-medium text-xs transition-colors border bg-orange-100 hover:bg-orange-200 text-orange-700 border-orange-200 whitespace-nowrap"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReturnProducts(bill);
                                }}
                                title="Return products"
                              >
                                Return
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden lg:block">
                <div className="space-y-3">
                  {paginatedShops.map((shop, idx) => (
                    <div key={`${shop.shop_id || 'shop'}-${idx}`} 
                         className={`rounded-lg border transition-all duration-200 ${
                           shop.total_outstanding > 0 
                             ? 'bg-red-50 border-red-100 hover:border-red-200' 
                             : 'bg-green-50 border-green-100 hover:border-green-200'
                         }`}>
                      <div
                        className="flex items-center justify-between p-4 cursor-pointer"
                        onClick={() => setExpandedShopId(expandedShopId === shop.shop_id ? null : shop.shop_id)}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-2.5 h-2.5 rounded-full ${
                            shop.total_outstanding > 0 ? 'bg-red-400' : 'bg-green-400'
                          }`}></div>
                          <span className="font-medium text-gray-900">{shop.shop_name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-sm font-medium px-4 py-2 rounded-md ${
                            shop.total_outstanding > 0 
                              ? 'bg-red-100 text-red-600 border border-red-200' 
                              : 'bg-green-100 text-green-600 border border-green-200'
                          }`}>
                            {Number(shop.total_outstanding || 0).toFixed(2)} LKR
                          </span>
                          <svg className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
                            expandedShopId === shop.shop_id ? 'rotate-180' : ''
                          }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                      
                      {expandedShopId === shop.shop_id && (
                        <div className="px-4 pb-4">
                          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                              <h4 className="font-medium text-gray-900">Bills for {shop.shop_name}</h4>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full">
                                <thead>
                                  <tr className="bg-gray-50">
                                    <th className="px-4 py-3 font-medium text-gray-700 text-left">Bill ID</th>
                                    <th className="px-4 py-3 font-medium text-gray-700 text-left">Created</th>
                                    <th className="px-4 py-3 font-medium text-gray-700 text-left">Total</th>
                                    <th className="px-4 py-3 font-medium text-gray-700 text-left">Collected</th>
                                    <th className="px-4 py-3 font-medium text-gray-700 text-left">Outstanding</th>
                                    <th className="px-4 py-3 font-medium text-gray-700 text-left">Action</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                  {(shop.bills ?? []).map((bill, billIdx) => (
                                    <tr key={`${bill.id}-${billIdx}`} className="hover:bg-gray-50 transition-colors">
                                      <td className="px-4 py-3 font-mono text-gray-600 font-medium">{bill.id ? bill.id.slice(0, 8) : ''}...</td>
                                      <td className="px-4 py-3 text-gray-600 font-medium">{bill.created_at ? new Date(bill.created_at).toLocaleDateString() : ''}</td>
                                      <td className="px-4 py-3 font-medium text-gray-900">{Number(bill.total || 0).toFixed(2)} LKR</td>
                                      <td className="px-4 py-3 font-medium text-green-600">{Number(bill.collected || 0).toFixed(2)} LKR</td>
                                      <td className="px-4 py-3 font-medium text-red-600">{Number(bill.outstanding || 0).toFixed(2)} LKR</td>
                                      <td className="px-4 py-3">
                                        <div className="flex flex-wrap gap-2">
                                          {bill.outstanding > 0 && (
                                            <button
                                              className="bg-purple-100 hover:bg-purple-200 text-purple-700 px-3 py-1.5 rounded-md font-medium text-sm transition-colors whitespace-nowrap"
                                              onClick={(e) => { e.stopPropagation(); handleRecordPayment(bill); }}
                                            >
                                              Record Payment
                                            </button>
                                          )}
                                          <button
                                            className="px-3 py-1.5 rounded-md font-medium text-sm transition-colors border bg-orange-100 hover:bg-orange-200 text-orange-700 border-orange-200 whitespace-nowrap"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleReturnProducts(bill);
                                            }}
                                            title="Return products"
                                          >
                                            Return
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
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Enhanced Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-6 pt-4 border-t border-gray-200">
              <span className="text-sm text-gray-600">
                Showing {page * SHOPS_PER_PAGE - SHOPS_PER_PAGE + 1} to {Math.min(page * SHOPS_PER_PAGE, filteredShops.length)} of {filteredShops.length} shops
              </span>
              <div className="flex items-center gap-2">
                <button
                  className="px-3 py-1.5 rounded-md bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed text-sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pageNum = i + 1;
                    return (
                      <button
                        key={pageNum}
                        className={`w-8 h-8 rounded-md font-medium transition-colors text-sm ${
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
                  className="px-3 py-1.5 rounded-md bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed text-sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Record Payment/Return Modal */}
      {showPaymentModal && selectedBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 w-full max-w-md p-6 relative">
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl font-bold"
              onClick={() => setShowPaymentModal(false)}
              aria-label="Close"
            >
              &times;
            </button>
            <h3 className="text-lg font-semibold mb-4 text-gray-900">Record Payment</h3>
            <div className="mb-4 bg-gray-50 rounded-lg p-4">
              <div className="font-medium mb-2 text-gray-800 text-sm">Bill Summary</div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Bill ID:</span>
                  <span className="font-medium text-gray-800">{selectedBill.id.slice(0, 8)}...</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Bill:</span>
                  <span className="font-medium text-gray-800">{Number(selectedBill.total).toFixed(2)} LKR</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Outstanding:</span>
                  <span className="font-medium text-red-600">
                    {Number(selectedBill.outstanding).toFixed(2)} LKR
                  </span>
                </div>
              </div>
            </div>
            
            {/* SMS Status Display */}
            {smsStatus.type && (
              <div className={`mb-4 p-3 rounded-lg text-sm ${
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
            
            <form onSubmit={handleSubmitPayment}>
              <label className="block text-gray-700 font-medium mb-2 text-sm">Payment Amount</label>
              <input
                type="number"
                min="1"
                max={selectedBill.outstanding}
                step="0.01"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-300 text-gray-700 mb-4 text-sm"
                value={paymentAmount}
                onChange={e => setPaymentAmount(e.target.value)}
                required
                placeholder="Enter amount"
              />
              <label className="block text-gray-700 font-medium mb-2 text-sm">Notes (Optional)</label>
              <textarea
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-300 text-gray-700 mb-4 text-sm"
                value={paymentNotes}
                onChange={e => setPaymentNotes(e.target.value)}
                placeholder="Payment method, reference number, etc..."
                rows={3}
              />
              {paymentError && <div className="text-red-600 text-sm text-center mb-4 font-medium bg-red-50 p-3 rounded-lg">{paymentError}</div>}
              {paymentSuccess && <div className="text-green-600 text-sm text-center mb-4 font-medium bg-green-50 p-3 rounded-lg">{paymentSuccess}</div>}
              
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white font-medium text-sm transition-colors disabled:opacity-60"
                  disabled={paymentLoading}
                >
                  {paymentLoading ? 'Recording...' : 'Record Payment'}
                </button>
                
                {/* Manual SMS Button */}
                {lastPaymentId && smsStatus.type === 'error' && (
                  <button
                    type="button"
                    className="px-4 py-2 bg-blue-100 hover:bg-blue-200 disabled:bg-blue-50 disabled:cursor-not-allowed text-blue-700 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
                    onClick={handleSendPaymentSMS}
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
              </div>
              
              {/* Print Receipt Button - Show after successful payment */}
              {lastPaymentId && paymentSuccess && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    className="w-full py-2 bg-green-100 hover:bg-green-200 disabled:bg-green-50 disabled:cursor-not-allowed text-green-700 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
                    onClick={handlePrintReceipt}
                    disabled={printReceiptLoading}
                  >
                    {printReceiptLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                        Preparing...
                      </>
                    ) : (
                      <>
                        <span>🖨️</span> Print Receipt
                      </>
                    )}
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Return Products Modal */}
      {showReturnModal && returnOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 w-full max-w-2xl p-6 relative">
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl font-bold"
              onClick={() => {
                setShowReturnModal(false);
                setReturnOrderId(null);
                setReturnItems([]);
                setReturnQuantities({});
                setReturnError('');
              }}
              aria-label="Close"
            >
              &times;
            </button>
            <h3 className="text-lg font-semibold mb-4 text-gray-900">Return Products</h3>

            {returnError && (
              <div className="text-red-600 text-sm text-center mb-4 font-medium bg-red-50 p-3 rounded-lg">
                {returnError}
              </div>
            )}

            <form onSubmit={handleSubmitReturn}>
              <div className="overflow-x-auto border border-gray-200 rounded-lg mb-4">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Product</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Ordered Qty</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Return Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {returnItems.map(item => (
                      <tr key={item.product_id}>
                        <td className="px-4 py-3 text-sm text-gray-900">{item.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{item.quantity}</td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min={0}
                            max={item.quantity}
                            value={returnQuantities[item.product_id] ?? 0}
                            onChange={(e) => {
                              const qty = Number(e.target.value);
                              setReturnQuantities(prev => ({
                                ...prev,
                                [item.product_id]: qty
                              }));
                            }}
                            className="w-24 px-2 py-1 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300 text-gray-900"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                  onClick={() => {
                    setShowReturnModal(false);
                    setReturnOrderId(null);
                    setReturnItems([]);
                    setReturnQuantities({});
                    setReturnError('');
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors disabled:opacity-60"
                  disabled={returnLoading}
                >
                  {returnLoading ? 'Saving...' : 'Record Return'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receipt Preview Modal */}
      {printReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 lg:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto relative">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">Payment Receipt Preview</h2>
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
                <p className="text-sm text-gray-600 print:text-xs print:text-black">Payment Receipt</p>
                <div className="mt-2 print:mt-1">
                  <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium print:bg-white print:text-black print:border print:border-black print:font-bold">
                    PAYMENT RECORDED
                  </span>
                </div>
              </div>

              {/* Receipt Details */}
              <div className="space-y-2 mb-4 print:mb-3">
                <div className="flex justify-between text-sm print:text-xs">
                  <span className="font-medium text-gray-700 print:font-bold print:text-black">Bill ID:</span>
                  <span className="text-gray-900 font-mono print:font-mono print:text-black">{printReceipt.bill.id.slice(0, 8)}...</span>
                </div>
                <div className="flex justify-between text-sm print:text-xs">
                  <span className="font-medium text-gray-700 print:font-bold print:text-black">Shop:</span>
                  <span className="text-gray-900 print:text-black">{printReceipt.shop?.shop_name || printReceipt.shop?.name || 'N/A'}</span>
                </div>
                <div className="flex justify-between text-sm print:text-xs">
                  <span className="font-medium text-gray-700 print:font-bold print:text-black">Payment ID:</span>
                  <span className="text-gray-900 font-mono print:font-mono print:text-black">{printReceipt.payment.id.slice(0, 8)}...</span>
                </div>
                <div className="flex justify-between text-sm print:text-xs">
                  <span className="font-medium text-gray-700 print:font-bold print:text-black">Date:</span>
                  <span className="text-gray-900 print:text-black">{new Date().toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between text-sm print:text-xs">
                  <span className="font-medium text-gray-700 print:font-bold print:text-black">Time:</span>
                  <span className="text-gray-900 print:text-black">{new Date().toLocaleTimeString()}</span>
                </div>
              </div>

              {/* Separator */}
              <div className="border-t border-gray-300 my-3 print:my-2 print:border-black"></div>

              {/* Payment Summary */}
              <div className="mb-4 print:mb-3">
                <h4 className="font-medium text-gray-900 mb-2 print:text-sm print:font-bold print:text-black">Payment Summary:</h4>
                <div className="space-y-1 print:space-y-0">
                  <div className="flex justify-between text-sm print:text-xs">
                    <span className="text-gray-600 print:text-black">Total Bill Amount:</span>
                    <span className="text-gray-900 print:text-black print:font-bold">{Number(printReceipt.bill.total).toFixed(2)} LKR</span>
                  </div>
                  <div className="flex justify-between text-sm print:text-xs">
                    <span className="text-gray-600 print:text-black">Previously Paid:</span>
                    <span className="text-gray-900 print:text-black print:font-bold">{Number(printReceipt.bill.collected).toFixed(2)} LKR</span>
                  </div>
                  <div className="flex justify-between text-sm print:text-xs">
                    <span className="text-gray-600 print:text-black">Outstanding Amount:</span>
                    <span className="text-red-600 print:text-black print:font-bold">{Number(printReceipt.bill.outstanding).toFixed(2)} LKR</span>
                  </div>
                  <div className="flex justify-between text-sm print:text-xs">
                    <span className="text-gray-600 print:text-black">Payment Made:</span>
                    <span className="text-green-600 print:text-black print:font-bold">{printReceipt.paymentAmount.toFixed(2)} LKR</span>
                  </div>
                  <div className="flex justify-between text-sm print:text-xs">
                    <span className="text-gray-600 print:text-black">Remaining Balance:</span>
                    <span className="text-gray-900 print:text-black print:font-bold">{(Number(printReceipt.bill.outstanding) - printReceipt.paymentAmount).toFixed(2)} LKR</span>
                  </div>
                </div>
              </div>

              {/* Payment Notes */}
              {printReceipt.paymentNotes && (
                <>
                  <div className="border-t border-gray-300 my-3 print:my-2 print:border-black"></div>
                  <div className="mb-4 print:mb-3">
                    <h4 className="font-medium text-gray-900 mb-2 print:text-sm print:font-bold print:text-black">Payment Notes:</h4>
                    <p className="text-sm print:text-xs text-gray-600 print:text-black">{printReceipt.paymentNotes}</p>
                  </div>
                </>
              )}

              {/* Separator */}
              <div className="border-t border-gray-300 my-3 print:my-2 print:border-black"></div>

              {/* Total */}
              <div className="mb-4 print:mb-3">
                <div className="flex justify-between items-center">
                  <span className="text-base font-semibold text-gray-900 print:text-sm print:font-bold print:text-black">Payment Received:</span>
                  <span className="text-lg font-semibold text-green-600 print:text-sm print:text-black print:font-bold">{printReceipt.paymentAmount.toFixed(2)} LKR</span>
                </div>
              </div>

              {/* Payment Notice */}
              <div className="bg-green-50 border border-green-200 rounded p-3 mb-4 print:mb-3 print:bg-white print:border-black print:border-dashed">
                <div className="flex items-center gap-2">
                  <span className="text-green-600 print:text-black">✅</span>
                  <div>
                    <p className="text-sm font-medium text-green-800 print:text-xs print:text-black print:font-bold">Payment Recorded</p>
                    <p className="text-xs text-green-700 print:text-xs print:text-black">This payment has been successfully recorded in the system.</p>
                  </div>
                </div>
              </div>

              {/* Separator */}
              <div className="border-t border-gray-300 my-3 print:my-2 print:border-black"></div>

              {/* Footer */}
              <div className="text-center text-gray-500 text-sm print:text-xs print:text-black">
                <p>Thank you for your payment!</p>
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
                className="flex-1 px-4 py-3 rounded-lg bg-green-100 hover:bg-green-200 text-green-700 font-semibold transition-colors active:scale-95" 
                onClick={handleActualPrint}
              >
                Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 
