import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch, clearCache } from '../../../utils/api';

interface PurchaseManagementProps {
  userId?: string;
}

interface Product {
  id: string;
  name: string;
  description: string;
  stock: number;
}

interface PurchaseLog {
  id: string;
  product_id: string;
  product_name: string;
  created_at: string;
  details: {
    purchase_quantity?: number;
    previous_stock?: number;
    new_stock?: number;
    unit_cost?: number | null;
    total_cost?: number | null;
    supplier?: string;
    notes?: string;
  } | null;
}

interface PurchaseItemRow {
  rowId: string;
  productId: string;
  quantity: string;
}

function createEmptyRow(): PurchaseItemRow {
  return {
    rowId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    productId: '',
    quantity: '',
  };
}

export default function PurchaseManagement({ userId }: PurchaseManagementProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [purchaseLogs, setPurchaseLogs] = useState<PurchaseLog[]>([]);
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItemRow[]>([createEmptyRow()]);
  const [unitCost, setUnitCost] = useState('');
  const [supplier, setSupplier] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const productMap = useMemo(() => {
    return products.reduce<Record<string, Product>>((acc, product) => {
      acc[product.id] = product;
      return acc;
    }, {});
  }, [products]);

  const loadData = async () => {
    setLoading(true);
    setError('');

    try {
      const [productsResponse, logsResponse] = await Promise.all([
        apiFetch('/api/marudham/products'),
        apiFetch('/api/marudham/products/purchase/logs'),
      ]);
      setProducts((productsResponse.products || []) as Product[]);
      setPurchaseLogs((logsResponse.logs || []) as PurchaseLog[]);
    } catch (loadError: any) {
      setError(loadError.message || 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!success) return;
    const timeout = setTimeout(() => setSuccess(''), 4000);
    return () => clearTimeout(timeout);
  }, [success]);

  const addRow = () => {
    setPurchaseItems((prev) => [...prev, createEmptyRow()]);
  };

  const removeRow = (rowId: string) => {
    setPurchaseItems((prev) => {
      if (prev.length === 1) {
        return prev;
      }
      return prev.filter((row) => row.rowId !== rowId);
    });
  };

  const updateRow = (rowId: string, updates: Partial<PurchaseItemRow>) => {
    setPurchaseItems((prev) =>
      prev.map((row) => (row.rowId === rowId ? { ...row, ...updates } : row))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    let parsedUnitCost: number | null = null;
    if (unitCost.trim() !== '') {
      const unitCostValue = parseFloat(unitCost);
      if (Number.isNaN(unitCostValue) || unitCostValue < 0) {
        setError('Unit cost must be a valid number.');
        return;
      }
      parsedUnitCost = unitCostValue;
    }

    const validRows = purchaseItems.filter((row) => row.productId || row.quantity);
    if (validRows.length === 0) {
      setError('Add at least one product row.');
      return;
    }

    const seenProductIds = new Set<string>();
    const normalizedRows: Array<{ productId: string; qty: number; product: Product }> = [];

    for (const row of validRows) {
      if (!row.productId) {
        setError('Please select a product for each entered row.');
        return;
      }

      const qty = parseInt(row.quantity, 10);
      if (!Number.isInteger(qty) || qty <= 0) {
        setError('Each quantity must be a positive whole number.');
        return;
      }

      if (seenProductIds.has(row.productId)) {
        setError('Duplicate product selected. Use one row per product.');
        return;
      }
      seenProductIds.add(row.productId);

      const product = productMap[row.productId];
      if (!product) {
        setError('One selected product was not found.');
        return;
      }

      normalizedRows.push({ productId: row.productId, qty, product });
    }

    setSubmitting(true);

    try {
      await apiFetch('/api/marudham/products/purchase', {
        method: 'POST',
        body: JSON.stringify({
          items: normalizedRows.map(r => ({ product_id: r.productId, qty: r.qty })),
          unit_cost: parsedUnitCost,
          supplier: supplier.trim() || null,
          notes: notes.trim() || null,
        }),
      });

      setSuccess(`Bulk purchase recorded for ${normalizedRows.length} product(s). Form cleared.`);
      setPurchaseItems([createEmptyRow()]);
      setUnitCost('');
      setSupplier('');
      setNotes('');
      clearCache('/api/marudham/products');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to record purchase.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast notifications */}
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
          <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h18v4H3V3zm2 6h14v12H5V9zm4 3h6m-6 4h6" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Purchase Management</h1>
            <p className="text-sm text-gray-500">Record purchases and add quantities into current stock</p>
          </div>
        </div>
      </div>

      {/* Record Bulk Purchase Form */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900 mb-0.5">Record Bulk Purchase</h2>
          <p className="text-sm text-gray-500">Select multiple products and enter quantities. This updates stock directly in Supabase.</p>
        </div>

        <form className="p-5 space-y-5" onSubmit={handleSubmit}>
          {/* Product rows */}
          <div className="space-y-3">
            {purchaseItems.map((row, index) => (
              <div key={row.rowId} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                <div className="md:col-span-7">
                  <select
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 text-sm text-gray-900 bg-white"
                    value={row.productId}
                    onChange={(e) => updateRow(row.rowId, { productId: e.target.value })}
                    required={index === 0}
                  >
                    <option value="">Select product</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} (Current stock: {product.stock})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-3">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Qty"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 text-sm text-gray-900 bg-white"
                    value={row.quantity}
                    onChange={(e) => updateRow(row.rowId, { quantity: e.target.value })}
                    required={index === 0}
                  />
                </div>
                <div className="md:col-span-2">
                  <button
                    type="button"
                    onClick={() => removeRow(row.rowId)}
                    disabled={purchaseItems.length === 1}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}

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
                Unit Cost (optional)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 text-sm bg-white text-gray-900"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
                Supplier (optional)
              </label>
              <input
                type="text"
                placeholder="Supplier name"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 text-sm bg-white text-gray-900"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
                Notes (optional)
              </label>
              <textarea
                placeholder="Any additional notes..."
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 text-sm bg-white text-gray-900"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          {/* Error state */}
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
            className="w-full py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-semibold transition-colors mt-2 disabled:opacity-60"
          >
            {submitting ? 'Saving...' : 'Record Bulk Purchase'}
          </button>
        </form>
      </div>

      {/* Recent Purchases Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Recent Purchases</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
          </div>
        ) : purchaseLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-sm font-bold text-gray-900 mb-1">No purchases recorded yet</p>
            <p className="text-sm text-gray-500">Use the form above to record your first purchase.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="py-3 px-5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left">Date</th>
                  <th className="py-3 px-5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left">Product</th>
                  <th className="py-3 px-5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left">Qty</th>
                  <th className="py-3 px-5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left">Stock Change</th>
                  <th className="py-3 px-5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left">Supplier</th>
                </tr>
              </thead>
              <tbody>
                {purchaseLogs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-100 last:border-0 hover:bg-violet-50/30 transition-colors">
                    <td className="py-3.5 px-5 text-sm text-gray-500">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-5 text-sm font-medium text-gray-900">
                      {log.product_name || 'Unknown product'}
                    </td>
                    <td className="py-3.5 px-5 text-sm text-gray-700">
                      {log.details?.purchase_quantity ?? '-'}
                    </td>
                    <td className="py-3.5 px-5 text-sm">
                      {typeof log.details?.previous_stock === 'number' && typeof log.details?.new_stock === 'number' ? (
                        <span className="text-sm font-semibold text-green-700">
                          {log.details.previous_stock} &rarr; {log.details.new_stock}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-3.5 px-5 text-sm text-gray-700">
                      {log.details?.supplier || <span className="text-gray-400">-</span>}
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
