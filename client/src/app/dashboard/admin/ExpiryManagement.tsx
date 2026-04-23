import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch, clearCache } from '../../../utils/api';


interface Product {
  id: string;
  name: string;
  description: string;
  stock: number;
  reserved_stock: number;
}

interface ExpiryLog {
  id: string;
  product_id: string;
  product_name: string;
  created_at: string;
  details: {
    expired_quantity?: number;
    previous_stock?: number;
    new_stock?: number;
    reason?: string | null;
    batch_number?: string | null;
    notes?: string | null;
  } | null;
}

interface ExpiryItemRow {
  rowId: string;
  productId: string;
  quantity: string;
}

function createEmptyRow(): ExpiryItemRow {
  return {
    rowId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    productId: '',
    quantity: '',
  };
}

export default function ExpiryManagement() {
  const [products, setProducts] = useState<Product[]>([]);
  const [expiryLogs, setExpiryLogs] = useState<ExpiryLog[]>([]);
  const [expiryItems, setExpiryItems] = useState<ExpiryItemRow[]>([createEmptyRow()]);
  const [reason, setReason] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const productMap = useMemo(() => {
    return products.reduce<Record<string, Product>>((acc, p) => {
      acc[p.id] = p;
      return acc;
    }, {});
  }, [products]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [productsResponse, logsResponse] = await Promise.all([
        apiFetch('/api/marudham/products'),
        apiFetch('/api/marudham/products/expiry/logs'),
      ]);
      setProducts((productsResponse.products || []) as Product[]);
      setExpiryLogs((logsResponse.logs || []) as ExpiryLog[]);
    } catch (err: any) {
      setError(err.message || 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(''), 4000);
    return () => clearTimeout(t);
  }, [success]);

  const addRow = () => setExpiryItems(prev => [...prev, createEmptyRow()]);

  const removeRow = (rowId: string) =>
    setExpiryItems(prev => prev.length === 1 ? prev : prev.filter(r => r.rowId !== rowId));

  const updateRow = (rowId: string, updates: Partial<ExpiryItemRow>) =>
    setExpiryItems(prev => prev.map(r => r.rowId === rowId ? { ...r, ...updates } : r));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const validRows = expiryItems.filter(r => r.productId || r.quantity);
    if (validRows.length === 0) {
      setError('Add at least one product row.');
      return;
    }

    const seenIds = new Set<string>();
    const normalizedRows: Array<{ productId: string; qty: number; product: Product }> = [];

    for (const row of validRows) {
      if (!row.productId) {
        setError('Please select a product for each row.');
        return;
      }
      const qty = parseInt(row.quantity, 10);
      if (!Number.isInteger(qty) || qty <= 0) {
        setError('Each quantity must be a positive whole number.');
        return;
      }
      if (seenIds.has(row.productId)) {
        setError('Duplicate product selected. Use one row per product.');
        return;
      }
      seenIds.add(row.productId);

      const product = productMap[row.productId];
      if (!product) {
        setError('One selected product was not found.');
        return;
      }

      const available = Number(product.stock) - Number(product.reserved_stock);
      if (qty > available) {
        setError(
          `"${product.name}": cannot expire ${qty} units — only ${available} available (${product.reserved_stock} reserved for pending orders).`
        );
        return;
      }

      normalizedRows.push({ productId: row.productId, qty, product });
    }

    setSubmitting(true);

    try {
      await apiFetch('/api/marudham/products/expiry', {
        method: 'POST',
        body: JSON.stringify({
          items: normalizedRows.map(r => ({ product_id: r.productId, qty: r.qty })),
          reason: reason.trim() || null,
          batch_number: batchNumber.trim() || null,
          notes: notes.trim() || null,
        }),
      });

      setSuccess(`Expiry recorded for ${normalizedRows.length} product(s). Form cleared.`);
      setExpiryItems([createEmptyRow()]);
      setReason('');
      setBatchNumber('');
      setNotes('');
      clearCache('/api/marudham/products');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to record expiry.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {success && (
        <div className="fixed top-4 right-4 z-50">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 flex items-start gap-3 min-w-[280px]">
            <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Success</p>
              <p className="text-xs text-gray-500 mt-0.5">{success}</p>
            </div>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Expiry Management</h1>
            <p className="text-sm text-gray-500">Record expired products and deduct quantities from current stock</p>
          </div>
        </div>
      </div>

      {/* Record Expiry Form */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900 mb-0.5">Record Expired Products</h2>
          <p className="text-sm text-gray-500">
            Select products and enter expired quantities. Stock will be deducted immediately.
            You can only expire up to the available (unreserved) quantity.
          </p>
        </div>

        <form className="p-5 space-y-5" onSubmit={handleSubmit}>
          {/* Product rows */}
          <div className="space-y-3">
            {expiryItems.map((row, index) => {
              const product = productMap[row.productId];
              const available = product
                ? Number(product.stock) - Number(product.reserved_stock)
                : null;
              const qty = parseInt(row.quantity, 10);
              const qtyExceeds = product && !isNaN(qty) && available !== null && qty > available;

              return (
                <div key={row.rowId} className="space-y-1">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                    <div className="md:col-span-7">
                      <select
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300 text-sm text-gray-900 bg-white"
                        value={row.productId}
                        onChange={e => updateRow(row.rowId, { productId: e.target.value, quantity: '' })}
                        required={index === 0}
                      >
                        <option value="">Select product</option>
                        {products.map(p => {
                          const avail = Number(p.stock) - Number(p.reserved_stock);
                          return (
                            <option key={p.id} value={p.id} disabled={avail <= 0}>
                              {p.name}
                              {avail <= 0
                                ? ' (No available stock)'
                                : ` — Available: ${avail}${p.reserved_stock > 0 ? ` (${p.reserved_stock} reserved)` : ''}`}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    <div className="md:col-span-3">
                      <input
                        type="number"
                        min="1"
                        max={available ?? undefined}
                        step="1"
                        placeholder="Qty"
                        className={`w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 text-sm text-gray-900 bg-white ${
                          qtyExceeds
                            ? 'border-red-400 focus:ring-red-300'
                            : 'border-gray-200 focus:ring-red-300'
                        }`}
                        value={row.quantity}
                        onChange={e => updateRow(row.rowId, { quantity: e.target.value })}
                        required={index === 0}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <button
                        type="button"
                        onClick={() => removeRow(row.rowId)}
                        disabled={expiryItems.length === 1}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  {/* Inline stock info + warning */}
                  {product && (
                    <div className="ml-0 md:ml-0 flex items-center gap-4 text-xs pl-1">
                      <span className="text-gray-500">
                        Total stock: <span className="font-semibold text-gray-700">{product.stock}</span>
                      </span>
                      {product.reserved_stock > 0 && (
                        <span className="text-amber-600">
                          Reserved: <span className="font-semibold">{product.reserved_stock}</span>
                        </span>
                      )}
                      <span className={available !== null && available <= 0 ? 'text-red-600 font-semibold' : 'text-green-700'}>
                        Available: <span className="font-semibold">{available ?? 0}</span>
                      </span>
                      {qtyExceeds && (
                        <span className="text-red-600 font-medium">
                          Exceeds available stock
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            <button
              type="button"
              onClick={addRow}
              className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg text-sm font-semibold transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Another Product
            </button>
          </div>

          {/* Additional fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
                Expiry Reason (optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Past expiry date, Damaged"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300 text-sm bg-white text-gray-900"
                value={reason}
                onChange={e => setReason(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
                Batch / Lot Number (optional)
              </label>
              <input
                type="text"
                placeholder="e.g. BATCH-2024-05"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300 text-sm bg-white text-gray-900"
                value={batchNumber}
                onChange={e => setBatchNumber(e.target.value)}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
                Notes (optional)
              </label>
              <textarea
                placeholder="Any additional notes..."
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300 text-sm bg-white text-gray-900"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-lg p-3">
              <div className="w-5 h-5 rounded bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-3 h-3 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || loading}
            className="w-full py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors mt-2 disabled:opacity-60"
          >
            {submitting ? 'Saving...' : 'Record Expiry & Deduct Stock'}
          </button>
        </form>
      </div>

      {/* Recent Expiry Logs */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Recent Expiry Records</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-red-200 border-t-red-600 rounded-full animate-spin" />
          </div>
        ) : expiryLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <p className="text-sm font-bold text-gray-900 mb-1">No expiry records yet</p>
            <p className="text-sm text-gray-500">Use the form above to record expired products.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="py-3 px-5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left">Date</th>
                  <th className="py-3 px-5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left">Product</th>
                  <th className="py-3 px-5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left">Expired Qty</th>
                  <th className="py-3 px-5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left">Stock Change</th>
                  <th className="py-3 px-5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left">Reason</th>
                  <th className="py-3 px-5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left">Batch</th>
                </tr>
              </thead>
              <tbody>
                {expiryLogs.map(log => (
                  <tr key={log.id} className="border-b border-gray-100 last:border-0 hover:bg-red-50/20 transition-colors">
                    <td className="py-3.5 px-5 text-sm text-gray-500">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-5 text-sm font-medium text-gray-900">
                      {log.product_name || 'Unknown product'}
                    </td>
                    <td className="py-3.5 px-5 text-sm">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                        -{log.details?.expired_quantity ?? '-'}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-sm">
                      {typeof log.details?.previous_stock === 'number' && typeof log.details?.new_stock === 'number' ? (
                        <span className="font-semibold text-red-700">
                          {log.details.previous_stock} &rarr; {log.details.new_stock}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-3.5 px-5 text-sm text-gray-700">
                      {log.details?.reason || <span className="text-gray-400">-</span>}
                    </td>
                    <td className="py-3.5 px-5 text-sm text-gray-700">
                      {log.details?.batch_number || <span className="text-gray-400">-</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
