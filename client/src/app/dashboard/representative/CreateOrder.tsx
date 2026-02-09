import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { apiFetch } from '../../../utils/api';

interface Shop {
  id: string;
  name: string;
  address: string;
  phone: string;
  max_bill_amount: number;
  max_active_bills: number;
  current_outstanding: number;
  active_bills: number;
}

interface Product {
  id: string;
  name: string;
  unit_price: number;
}

interface OrderItem {
  product_id: string;
  name: string;
  unit_price: number;
  quantity: number;
  free_quantity: number;
}

interface CreateOrderProps {
  onOrderPlaced?: () => void;
}

export default function CreateOrder({ onOrderPlaced }: CreateOrderProps) {
  const [shops, setShops] = useState<Shop[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const defaultSelectedQuantity = 0;
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedQuantity, setSelectedQuantity] = useState(defaultSelectedQuantity);
  const [quantityInputKey, setQuantityInputKey] = useState(0);
  const quantityInputRef = useRef<HTMLInputElement | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receipt, setReceipt] = useState<any>(null);
  const [printReceipt, setPrintReceipt] = useState<any>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [sendingSMS, setSendingSMS] = useState(false);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const [messageStatus, setMessageStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });
  const [smsSent, setSmsSent] = useState(false);
  const [orderToConfirm, setOrderToConfirm] = useState<any>(null);
  
  // Shop search functionality
  const [shopSearch, setShopSearch] = useState('');
  const [showShopDropdown, setShowShopDropdown] = useState(false);
  const [filteredShops, setFilteredShops] = useState<Shop[]>([]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiFetch('/api/marudham/shops/assigned'),
      apiFetch('/api/marudham/order-products'),
    ])
      .then(([shopData, productData]) => {
        setShops(shopData.shops);
        setFilteredShops(shopData.shops);
        setProducts(productData.products);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // Ensure quantity always starts at the default, even after fast refreshes
  useLayoutEffect(() => {
    setSelectedQuantity(defaultSelectedQuantity);
    setQuantityInputKey(key => key + 1); // remount input to wipe autofill
    if (quantityInputRef.current) {
      quantityInputRef.current.value = String(defaultSelectedQuantity);
    }
  }, []);

  // Some browsers apply autofill after first paint; enforce the default once more shortly after mount
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSelectedQuantity(defaultSelectedQuantity);
      setQuantityInputKey(key => key + 1);
      if (quantityInputRef.current) {
        quantityInputRef.current.value = String(defaultSelectedQuantity);
      }
    }, 100);
    return () => window.clearTimeout(timeout);
  }, []);

  // Filter shops based on search
  useEffect(() => {
    if (!shopSearch.trim()) {
      setFilteredShops(shops);
    } else {
      const filtered = shops.filter(shop => 
        shop.name.toLowerCase().includes(shopSearch.toLowerCase()) ||
        shop.address.toLowerCase().includes(shopSearch.toLowerCase()) ||
        shop.phone.includes(shopSearch)
      );
      setFilteredShops(filtered);
    }
  }, [shopSearch, shops]);

  const handleShopSelect = (shop: Shop) => {
    setSelectedShop(shop);
    setShopSearch(shop.name);
    setShowShopDropdown(false);
  };

  const handleShopSearchChange = (value: string) => {
    setShopSearch(value);
    setShowShopDropdown(true);
    if (!value.trim()) {
      setSelectedShop(null);
    }
  };

  const handleAddProduct = () => {
    if (!selectedProductId) return;
    const quantityToAdd = selectedQuantity;
    if (quantityToAdd <= 0) return;
    const product = products.find(p => p.id === selectedProductId);
    if (!product) return;
    setOrderItems(items => {
      const existing = items.find(i => i.product_id === selectedProductId);
      if (existing) {
        return items.map(i =>
          i.product_id === selectedProductId
            ? { ...i, quantity: i.quantity + quantityToAdd }
            : i
        );
      } else {
        return [...items, { product_id: product.id, name: product.name, unit_price: product.unit_price, quantity: quantityToAdd, free_quantity: 0 }];
      }
    });
    setSelectedProductId('');
    setSelectedQuantity(defaultSelectedQuantity);
  };

  const handleRemoveItem = (product_id: string) => {
    setOrderItems(items => items.filter(i => i.product_id !== product_id));
  };

  const handleQuantityChange = (product_id: string, delta: number) => {
    setOrderItems(items =>
      items.map(i =>
        i.product_id === product_id
          ? { ...i, quantity: Math.max(1, i.quantity + delta) }
          : i
      )
    );
  };

  const handleFreeQuantityChange = (product_id: string, delta: number) => {
    setOrderItems(items =>
      items.map(i =>
        i.product_id === product_id
          ? { ...i, free_quantity: Math.max(0, i.free_quantity + delta) }
          : i
      )
    );
  };

  const orderTotal = orderItems.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);

  const handleSendSMS = async () => {
    if (!receipt) return;
    
    setSendingSMS(true);
    setMessageStatus({ type: null, message: '' });
    
    try {
      const response = await apiFetch(`/api/marudham/orders/${receipt.id}/send-sms`, {
        method: 'POST'
      });
      
      if (response.success) {
        setMessageStatus({ 
          type: 'success', 
          message: 'SMS sent successfully to shop owner!' 
        });
        setSmsSent(true);
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

  const handleSendWhatsApp = async () => {
    if (!receipt) return;
    
    setSendingWhatsApp(true);
    setMessageStatus({ type: null, message: '' });
    
    try {
      const response = await apiFetch(`/api/marudham/orders/${receipt.id}/send-whatsapp`, {
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

  // Function to handle print receipt - shows modal first
  const handlePrintReceipt = () => {
    if (!receipt) return;
    
    try {
      // Set the receipt in state for the modal view
      setPrintReceipt(receipt);
      setSmsSent(false);
      setMessageStatus({ type: null, message: '' });

    } catch (error) {
      console.error('Error handling print receipt:', error);
      // Fallback to basic order info in modal
      setPrintReceipt(receipt);
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
            font-family: "Courier New", Courier, monospace;
            font-size: 10px;
            width: 79mm;
            margin: 0;
            padding: 6px 8px;
            color: #000;
            line-height: 1.25;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            height: auto !important;
          }
          .receipt {
            width: 100%;
          }
          .header {
            text-align: center;
            padding-bottom: 6px;
            margin-bottom: 6px;
            border-bottom: 1px solid #000;
          }
          .company-name {
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.4px;
          }
          .doc-title {
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            margin-top: 2px;
          }
          .meta-row {
            display: flex;
            justify-content: space-between;
            font-size: 9px;
            margin-top: 4px;
            gap: 6px;
          }
          .badge {
            border: 1px solid #000;
            padding: 1px 4px;
            font-size: 8px;
            font-weight: 700;
            text-transform: uppercase;
            white-space: nowrap;
          }
          .section {
            margin-top: 6px;
          }
          .section-title {
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
            border-bottom: 1px solid #000;
            padding-bottom: 2px;
            margin-bottom: 4px;
          }
          .kv-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 6px;
            margin-bottom: 2px;
            font-size: 9px;
          }
          .kv-label {
            font-weight: 700;
            white-space: nowrap;
          }
          .kv-value {
            text-align: right;
            max-width: 60%;
            word-break: break-word;
          }
          .table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9px;
          }
          .table th {
            text-align: left;
            border-bottom: 1px solid #000;
            padding: 2px 0;
            font-weight: 700;
          }
          .table td {
            padding: 2px 0;
            vertical-align: top;
            border-bottom: 1px dotted #000;
          }
          .col-item {
            width: 46%;
            word-break: break-word;
          }
          .col-qty {
            width: 10%;
            text-align: right;
            white-space: nowrap;
          }
          .col-unit {
            width: 20%;
            text-align: right;
            white-space: nowrap;
          }
          .col-total {
            width: 24%;
            text-align: right;
            white-space: nowrap;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            font-size: 10px;
            font-weight: 700;
            border-top: 1px solid #000;
            padding-top: 4px;
            margin-top: 4px;
          }
          .notes {
            font-size: 9px;
            margin-top: 4px;
            word-break: break-word;
          }
          .signature {
            margin-top: 10px;
            font-size: 9px;
          }
          .sig-line {
            border-top: 1px solid #000;
            margin-top: 16px;
          }
          .sig-label {
            margin-top: 3px;
            text-align: center;
          }
          .footer {
            margin-top: 8px;
            text-align: center;
            font-size: 8px;
            line-height: 1.2;
          }
          @media print {
            body { 
              padding: 0 8px;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
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
        <div class="receipt">
          <div class="header">
            <div class="company-name">S.B Distribution</div>
            <div class="doc-title">Sales Order Receipt</div>
            <div class="meta-row">
              <span>Order #: ${printReceipt.id.slice(0, 8).toUpperCase()}</span>
              <span class="badge">Pending Approval</span>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Bill To</div>
            <div class="kv-row">
              <span class="kv-label">Shop</span>
              <span class="kv-value">${printReceipt.shop?.name || "N/A"}</span>
            </div>
            ${printReceipt.shop?.address ? `
            <div class="kv-row">
              <span class="kv-label">Address</span>
              <span class="kv-value">${printReceipt.shop.address}</span>
            </div>
            ` : ""}
            ${printReceipt.shop?.phone ? `
            <div class="kv-row">
              <span class="kv-label">Phone</span>
              <span class="kv-value">${printReceipt.shop.phone}</span>
            </div>
            ` : ""}
          </div>

          <div class="section">
            <div class="section-title">Order Details</div>
            <div class="kv-row">
              <span class="kv-label">Date</span>
              <span class="kv-value">${new Date(printReceipt.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" })}</span>
            </div>
            <div class="kv-row">
              <span class="kv-label">Time</span>
              <span class="kv-value">${new Date(printReceipt.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}</span>
            </div>
            <div class="kv-row">
              <span class="kv-label">Items</span>
              <span class="kv-value">${(printReceipt.items || []).length}</span>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Items</div>
            ${printReceipt.items && printReceipt.items.length ? `
            <table class="table">
              <thead>
                <tr>
                  <th class="col-item">Item</th>
                  <th class="col-qty">Qty</th>
                  <th class="col-unit">Unit</th>
                  <th class="col-total">Total</th>
                </tr>
              </thead>
              <tbody>
                ${printReceipt.items.map((item: any, index: number) => `
                  <tr>
                    <td class="col-item">${index + 1}. ${item.name || "Unknown Item"}${item.free_quantity && item.free_quantity > 0 ? ` (+${item.free_quantity} free)` : ""}</td>
                    <td class="col-qty">${item.quantity}</td>
                    <td class="col-unit">${Number(item.unit_price).toFixed(2)}</td>
                    <td class="col-total">${(Number(item.unit_price) * item.quantity).toFixed(2)}</td>
                  </tr>
                `).join("\n")}
              </tbody>
            </table>
            ` : `
            <div class="kv-row">
              <span class="kv-value">Item details not available</span>
            </div>
            `}
          </div>

          ${printReceipt.notes ? `
          <div class="section">
            <div class="section-title">Notes</div>
            <div class="notes">${printReceipt.notes}</div>
          </div>
          ` : ""}

          <div class="total-row">
            <span>Total Amount (LKR)</span>
            <span>${printReceipt.items.reduce((sum: number, item: any) => sum + (Number(item.unit_price) * item.quantity), 0).toFixed(2)}</span>
          </div>

          <div class="signature">
            <div class="sig-line"></div>
            <div class="sig-label">Prepared By</div>
            <div class="sig-line" style="margin-top: 18px;"></div>
            <div class="sig-label">Customer Signature</div>
          </div>

          <div class="footer">
            <div>Thank you for your business.</div>
            <div>Printed on: ${new Date().toLocaleString("en-US", { 
              year: "numeric", 
              month: "short", 
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              hour12: true 
            })}</div>
            <div>axzell innovations | Innovative Solutions</div>
          </div>
        </div>

        <script>
          // Calculate content height and set page size
          function setDynamicPageSize() {
            const contentHeight = Math.ceil(document.body.scrollHeight * 0.264583); // Convert px to mm
            const height = Math.max(contentHeight, 50);
            const style = document.createElement("style");
            style.textContent = [
              "@page {",
              "  size: 79mm " + height + "mm;",
              "  margin: 0;",
              "  padding: 0;",
              "}",
              "html, body {",
              "  height: auto !important;",
              "}"
            ].join("\n");
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

  const handleConfirmOrder = async () => {
    if (!orderToConfirm) return;
    
    setSubmitting(true);
    setError('');
    setShowConfirm(false);
    
    try {
      // Create the order
      const res = await apiFetch('/api/marudham/orders', {
        method: 'POST',
        body: JSON.stringify({
          shop_id: orderToConfirm.shop_id,
          notes: orderToConfirm.notes,
          items: orderToConfirm.items,
        }),
      });
      
      const createdOrder = {
        ...res.order,
        shop: orderToConfirm.shop,
        items: orderToConfirm.orderItems,
        notes: orderToConfirm.notes,
        created_at: new Date().toISOString(),
      };
      
      setReceipt(createdOrder);
      setShowReceipt(true);
      setOrderItems([]);
      setNotes('');
      setSmsSent(false);
      setMessageStatus({ type: null, message: '' });
      
      // Auto-send SMS after order creation
      if (orderToConfirm.shop.phone) {
        setSendingSMS(true);
        try {
          const smsResponse = await apiFetch(`/api/marudham/orders/${res.order.id}/send-sms`, {
            method: 'POST'
          });
          
          if (smsResponse.success) {
            setSmsSent(true);
            setMessageStatus({ 
              type: 'success', 
              message: 'Order created and SMS sent successfully to shop owner!' 
            });
          } else {
            setMessageStatus({ 
              type: 'error', 
              message: smsResponse.error || 'Order created but failed to send SMS' 
            });
          }
        } catch (smsError: any) {
          setMessageStatus({ 
            type: 'error', 
            message: `Order created but SMS failed: ${smsError.message}` 
          });
        } finally {
          setSendingSMS(false);
        }
      } else {
        setMessageStatus({ 
          type: 'error', 
          message: 'Order created but shop phone number not available for SMS' 
        });
      }
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
      setOrderToConfirm(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShop || orderItems.length === 0) return;
    
    // Prepare order data for confirmation
    const orderData = {
      shop_id: selectedShop.id,
      notes,
      items: orderItems.flatMap(i => [
        { product_id: i.product_id, unit_price: i.unit_price, quantity: i.quantity },
        ...(i.free_quantity > 0 ? [{ product_id: i.product_id, unit_price: 0, quantity: i.free_quantity }] : [])
      ]),
      shop: selectedShop,
      orderItems,
      total: orderTotal
    };
    
    setOrderToConfirm(orderData);
    setShowConfirm(true);
  };

  // Validation logic
  let validationError = '';
  if (selectedShop) {
    const availableCredit = selectedShop.max_bill_amount - selectedShop.current_outstanding;
    const availableBillSlots = selectedShop.max_active_bills - selectedShop.active_bills;
    if (orderTotal > availableCredit) {
      validationError = `Order total exceeds available credit (${availableCredit.toFixed(2)} LKR).`;
    } else if (selectedShop.active_bills >= selectedShop.max_active_bills) {
      validationError = `Shop has reached the maximum number of active bills (${selectedShop.max_active_bills}).`;
    }
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-2 text-gray-900">Create Order</h2>
      <p className="text-gray-500 mb-4 text-sm">Create a new order for your assigned shop</p>

      {loading ? (
        <div className="text-gray-500 text-center py-8 font-medium">Loading shops and products...</div>
      ) : error ? (
        <div className="text-red-600 text-center py-8 font-medium">{error}</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Shop Selection */}
            <div>
              <label className="block text-gray-700 font-medium mb-2 text-sm">Search Shop</label>
              <div className="relative">
                <input
                  type="text"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-300 text-sm text-gray-900 bg-white"
                  placeholder="Search by shop name, address, or phone number..."
                  value={shopSearch}
                  onChange={e => handleShopSearchChange(e.target.value)}
                  onFocus={() => setShowShopDropdown(true)}
                  required
                />
                
                {/* Search Icon */}
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>

                {/* Shop Dropdown */}
                {showShopDropdown && filteredShops.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filteredShops.map(shop => (
                      <button
                        key={shop.id}
                        type="button"
                        className="w-full px-3 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none border-b border-gray-100 last:border-b-0"
                        onClick={() => handleShopSelect(shop)}
                      >
                        <div className="font-medium text-gray-900 text-sm">{shop.name}</div>
                        <div className="text-gray-600 text-xs">{shop.address}</div>
                        {shop.phone && (
                          <div className="text-gray-500 text-xs">{shop.phone}</div>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* No results message */}
                {showShopDropdown && shopSearch.trim() && filteredShops.length === 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
                    <div className="px-3 py-2 text-gray-500 text-sm">
                      No shops found matching "{shopSearch}"
                    </div>
                  </div>
                )}
              </div>

              {/* Click outside to close dropdown */}
              {showShopDropdown && (
                <div 
                  className="fixed inset-0 z-5" 
                  onClick={() => setShowShopDropdown(false)}
                />
              )}

              {selectedShop && (
                <div className="mt-2 p-4 bg-gray-50 rounded-lg">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-600">Max Bill:</span>
                      <span className="ml-1 font-semibold text-gray-900">{Number(selectedShop.max_bill_amount).toFixed(2)} LKR</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Outstanding:</span>
                      <span className={`ml-1 font-semibold ${selectedShop.current_outstanding > 0 ? 'text-red-500' : 'text-green-500'}`}>
                        {Number(selectedShop.current_outstanding).toFixed(2)} LKR
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Maximum Bills:</span>
                      <span className="ml-1 font-semibold text-gray-900">{selectedShop.max_active_bills}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Active Bills:</span>
                      <span className="ml-1 font-semibold text-purple-900">{selectedShop.active_bills}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Available:</span>
                      <span className="ml-1 font-semibold text-gray-900">
                        {Number(selectedShop.max_bill_amount - selectedShop.current_outstanding).toFixed(2)} LKR
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Product Selection */}
            <div>
              <label className="block text-gray-700 font-medium mb-2 text-sm">Add Products</label>
              <div className="flex flex-col sm:flex-row gap-3">
                <select
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-300 text-sm text-gray-900 bg-white"
                  value={selectedProductId}
                  onChange={e => setSelectedProductId(e.target.value)}
                >
                  <option value="" className="text-gray-500">Select a product...</option>
                  {products.map(product => (
                    <option key={product.id} value={product.id} className="text-gray-900">
                      {product.name} - {Number(product.unit_price).toFixed(2)} LKR
                    </option>
                  ))}
                </select>
                <input
                  key={quantityInputKey}
                  type="number"
                  min="0"
                  autoComplete="off"
                  inputMode="numeric"
                  name="add-product-quantity"
                  ref={quantityInputRef}
                  className="w-24 px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-300 text-sm text-gray-900 bg-white"
                  value={selectedQuantity}
                  onChange={e => {
                    const raw = e.target.value;
                    if (raw === '') {
                      setSelectedQuantity(defaultSelectedQuantity);
                      return;
                    }
                    const value = Math.max(0, parseInt(raw, 10) || 0);
                    setSelectedQuantity(value);
                  }}
                  placeholder="Qty"
                />
                <button
                  type="button"
                  className="px-4 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg font-medium text-sm transition-colors"
                  onClick={handleAddProduct}
                  disabled={!selectedProductId || selectedQuantity <= 0}
                >
                  Add
                </button>
              </div>
            </div>

            {/* Order Items */}
            {orderItems.length > 0 && (
              <div>
                <label className="block text-gray-900 font-medium mb-2 text-sm">Order Items</label>
                <div className="space-y-3">
                  {orderItems.map(item => (
                    <div
                      key={item.product_id}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-gray-50 rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 text-sm">{item.name}</div>
                        <div className="text-gray-900 text-xs">{Number(item.unit_price).toFixed(2)} LKR each</div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-900">Qty:</span>
                          <input
                            type="number"
                            min="1"
                            className="w-20 px-2 py-1 rounded border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-300 text-sm text-center text-gray-900"
                            value={item.quantity}
                            onChange={e => {
                              const newQuantity = parseInt(e.target.value) || 1;
                              setOrderItems(items =>
                                items.map(i =>
                                  i.product_id === item.product_id
                                    ? { ...i, quantity: Math.max(1, newQuantity) }
                                    : i
                                )
                              );
                            }}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-900">Free:</span>
                          <input
                            type="number"
                            min="0"
                            className="w-20 px-2 py-1 rounded border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-300 text-sm text-center text-gray-900"
                            value={item.free_quantity}
                            onChange={e => {
                              const newQuantity = parseInt(e.target.value) || 0;
                              setOrderItems(items =>
                                items.map(i =>
                                  i.product_id === item.product_id
                                    ? { ...i, free_quantity: Math.max(0, newQuantity) }
                                    : i
                                )
                              );
                            }}
                          />
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-gray-900 text-sm">
                            {(item.unit_price * item.quantity).toFixed(2)} LKR
                          </div>
                        </div>
                        <button
                          type="button"
                          className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-xs font-medium transition-colors"
                          onClick={() => handleRemoveItem(item.product_id)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-gray-900 font-medium mb-2 text-sm">Notes (Optional)</label>
              <textarea
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-300 text-sm text-gray-900 bg-white"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any special instructions or notes..."
                rows={3}
              />
            </div>

            {/* Order Summary */}
            {orderItems.length > 0 && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="text-base font-semibold text-gray-900 mb-4">Order Summary</h3>
                <div className="space-y-3">
                  {orderItems.map(item => (
                    <div key={item.product_id} className="flex justify-between text-sm">
                      <span className="text-gray-900">
                        {item.name} x {item.quantity}{item.free_quantity > 0 ? ` + ${item.free_quantity} free` : ''}
                      </span>
                      <span className="font-semibold text-gray-900">{(item.unit_price * item.quantity).toFixed(2)} LKR</span>
                    </div>
                  ))}
                  <div className="border-t border-gray-200 pt-3">
                    <div className="flex justify-between text-base font-semibold text-gray-900">
                      <span>Total</span>
                      <span>{orderTotal.toFixed(2)} LKR</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Validation Error */}
            {validationError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-red-700 font-medium text-sm">{validationError}</span>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!selectedShop || orderItems.length === 0 || !!validationError || submitting}
              className="w-full px-6 py-3 bg-purple-100 hover:bg-purple-200 disabled:bg-gray-100 disabled:cursor-not-allowed text-purple-700 font-medium rounded-lg transition-colors"
            >
              {submitting ? 'Creating Order...' : 'Review & Create Order'}
            </button>
          </form>
        </div>
      )}

      {/* Order Confirmation Modal */}
      {showConfirm && orderToConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="text-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Confirm Order</h3>
              <p className="text-gray-900 text-sm">Please review your order details before confirming</p>
            </div>
            
            <div className="space-y-4 mb-6">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Shop Details</h4>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-sm">
                    <div className="font-medium text-gray-900">{orderToConfirm.shop.name}</div>
                    <div className="text-gray-900">{orderToConfirm.shop.address}</div>
                    <div className="text-gray-900">{orderToConfirm.shop.phone || 'Phone not available'}</div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-2">Order Summary</h4>
                <div className="space-y-2 text-gray-900">
                  {orderToConfirm.orderItems.map((item: any) => (
                    <div key={item.product_id} className="flex justify-between text-sm">
                      <span className="text-gray-900">
                        {item.name} x {item.quantity}{item.free_quantity > 0 ? ` + ${item.free_quantity} free` : ''}
                      </span>
                      <span className="font-medium text-gray-900">{(item.unit_price * item.quantity).toFixed(2)} LKR</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-gray-200 pt-2 mt-2">
                  <div className="flex justify-between text-base font-semibold text-gray-900">
                    <span>Total</span>
                    <span>{orderToConfirm.total.toFixed(2)} LKR</span>
                  </div>
                </div>
              </div>

              {orderToConfirm.notes && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Notes</h4>
                  <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-900">
                    {orderToConfirm.notes}
                  </div>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-sm">
                    <p className="font-medium text-blue-800">SMS Notification</p>
                    <p className="text-blue-700">
                      {orderToConfirm.shop.phone 
                        ? `SMS will be automatically sent to ${orderToConfirm.shop.phone}`
                        : 'SMS cannot be sent - shop phone number not available'
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowConfirm(false);
                  setOrderToConfirm(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmOrder}
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-purple-100 hover:bg-purple-200 disabled:bg-purple-50 disabled:cursor-not-allowed text-purple-700 rounded-lg font-medium transition-colors"
              >
                {submitting ? 'Creating...' : 'Confirm & Create Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceipt && receipt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="text-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Order Receipt</h3>
              <p className="text-gray-600 text-sm mb-2">Order #{receipt.id}</p>
              <div className="inline-block px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                PENDING APPROVAL
              </div>
              <p className="text-gray-500 text-xs mt-2">This is a draft order awaiting admin approval</p>
            </div>
            
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Shop Details</h4>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-sm">
                    <div className="font-medium text-gray-900">{receipt.shop.name}</div>
                    <div className="text-gray-900">{receipt.shop.address}</div>
                    <div className="text-gray-900">{receipt.shop.phone}</div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-2">Order Items</h4>
                <div className="space-y-2 text-gray-900">
                  {receipt.items.map((item: any, index: number) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span className="text-gray-900">
                        {item.name} x {item.quantity}{item.free_quantity > 0 ? ` + ${item.free_quantity} free` : ''}
                      </span>
                      <span className="font-medium text-gray-900">{(item.unit_price * item.quantity).toFixed(2)} LKR</span>
                    </div>
                  ))}
                </div>
              </div>

              {receipt.notes && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Notes</h4>
                  <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-700">
                    {receipt.notes}
                  </div>
                </div>
              )}

              <div className="border-t border-gray-200 pt-4">
                <div className="flex justify-between text-base font-semibold text-gray-900">
                  <span>Total</span>
                  <span>{receipt.items.reduce((sum: number, item: any) => sum + item.unit_price * item.quantity, 0).toFixed(2)} LKR</span>
                </div>
              </div>
            </div>

            {/* SMS and WhatsApp Buttons */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600 mb-3 text-center">Send Order Details to Shop Owner</p>
              
              {/* Phone Number Display */}
              <div className="mb-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-700">Shop Phone:</span>
                  <span className="text-gray-900 font-mono">
                    {receipt.shop.phone ? receipt.shop.phone : (
                      <span className="text-red-500 font-normal">Not available</span>
                    )}
                  </span>
                </div>
                {!receipt.shop.phone && (
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
              
              <div className="flex gap-2">
                <button 
                  className="flex-1 px-4 py-2 bg-blue-100 hover:bg-blue-200 disabled:bg-blue-50 disabled:cursor-not-allowed text-blue-700 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
                  onClick={handleSendSMS}
                  disabled={sendingSMS || sendingWhatsApp || !receipt.shop.phone || smsSent}
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
              </div>
              <p className="text-xs text-gray-500 mt-2 text-center">
                {receipt.shop.phone 
                  ? smsSent 
                    ? 'SMS sent successfully! You can now send WhatsApp message if needed.'
                    : 'SMS will be sent automatically after order creation'
                  : 'Phone number not available - please update shop details'
                }
              </p>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setShowReceipt(false)}
                className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
              >
                Close
              </button>
              <button
                onClick={handlePrintReceipt}
                className="flex-1 px-4 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print Receipt
              </button>
              <button
                onClick={() => {
                  setShowReceipt(false);
                  onOrderPlaced?.();
                }}
                className="flex-1 px-4 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg font-medium transition-colors"
              >
                View Orders
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
              <h2 className="text-xl font-bold text-gray-900">Order Receipt Preview</h2>
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
              <div className="text-center border-b border-gray-300 pb-3 mb-3">
                <h3 className="text-lg font-semibold text-gray-900">S.B Distribution</h3>
                <p className="text-xs uppercase tracking-wide text-gray-600">Sales Order Receipt</p>
                <div className="mt-2 inline-flex items-center gap-2 text-[11px] font-semibold text-gray-700 border border-gray-700 px-2 py-0.5">
                  Pending Approval
                </div>
              </div>

              <div className="space-y-2 text-xs mb-4">
                <div className="flex justify-between">
                  <span className="font-semibold text-gray-700">Order #</span>
                  <span className="font-mono text-gray-900">{printReceipt.id.slice(0, 8).toUpperCase()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-gray-700">Shop</span>
                  <span className="text-gray-900 text-right max-w-[60%]">{printReceipt.shop?.name || "N/A"}</span>
                </div>
                {printReceipt.shop?.address && (
                  <div className="flex justify-between">
                    <span className="font-semibold text-gray-700">Address</span>
                    <span className="text-gray-900 text-right max-w-[60%]">{printReceipt.shop.address}</span>
                  </div>
                )}
                {printReceipt.shop?.phone && (
                  <div className="flex justify-between">
                    <span className="font-semibold text-gray-700">Phone</span>
                    <span className="text-gray-900">{printReceipt.shop.phone}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="font-semibold text-gray-700">Date</span>
                  <span className="text-gray-900">{new Date(printReceipt.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-gray-700">Time</span>
                  <span className="text-gray-900">{new Date(printReceipt.created_at).toLocaleTimeString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-gray-700">Items</span>
                  <span className="text-gray-900">{(printReceipt.items || []).length}</span>
                </div>
              </div>

              <div className="border-t border-gray-300 my-3"></div>

              {printReceipt.items && printReceipt.items.length > 0 ? (
                <div className="mb-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-700 mb-2">Items</h4>
                  <div className="border border-gray-200 rounded">
                    <div className="grid grid-cols-12 gap-1 px-2 py-1 text-[11px] font-semibold border-b border-gray-200">
                      <div className="col-span-6">Item</div>
                      <div className="col-span-2 text-right">Qty</div>
                      <div className="col-span-2 text-right">Unit</div>
                      <div className="col-span-2 text-right">Total</div>
                    </div>
                    <div className="divide-y divide-gray-200">
                      {printReceipt.items.map((item: any, index: number) => (
                        <div key={item.product_id || index} className="grid grid-cols-12 gap-1 px-2 py-1 text-[11px]">
                          <div className="col-span-6 text-gray-900">
                            {index + 1}. {item.name}{item.free_quantity > 0 ? ` (+${item.free_quantity} free)` : ""}
                          </div>
                          <div className="col-span-2 text-right text-gray-900">{item.quantity}</div>
                          <div className="col-span-2 text-right text-gray-900">{Number(item.unit_price).toFixed(2)}</div>
                          <div className="col-span-2 text-right text-gray-900">{(Number(item.unit_price) * item.quantity).toFixed(2)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mb-4 text-xs text-gray-600">Item details not available</div>
              )}

              {printReceipt.notes && (
                <>
                  <div className="border-t border-gray-300 my-3"></div>
                  <div className="text-xs">
                    <div className="font-semibold uppercase tracking-wide text-gray-700 mb-1">Notes</div>
                    <p className="text-gray-800">{printReceipt.notes}</p>
                  </div>
                </>
              )}

              <div className="border-t border-gray-300 my-3"></div>

              <div className="flex justify-between items-center text-sm font-semibold text-gray-900">
                <span>Total Amount (LKR)</span>
                <span>{printReceipt.items.reduce((sum: number, item: any) => sum + (Number(item.unit_price) * item.quantity), 0).toFixed(2)} LKR</span>
              </div>

              <div className="mt-4 text-xs text-gray-700">
                <div className="border-t border-gray-400 pt-1 text-center">Prepared By</div>
                <div className="mt-4 border-t border-gray-400 pt-1 text-center">Customer Signature</div>
              </div>

              <div className="mt-4 text-center text-[11px] text-gray-600">
                <p>Thank you for your business.</p>
                <p className="mt-1">Printed on: {new Date().toLocaleString()}</p>
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
