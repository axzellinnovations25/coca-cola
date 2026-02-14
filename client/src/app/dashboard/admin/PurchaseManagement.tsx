import React, { useEffect, useMemo, useState } from 'react';
import { getSupabaseClient } from '../../../utils/supabase';
import { apiFetch } from '../../../utils/api';

interface PurchaseManagementProps {
  userId: string;
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
      const productsResponse = await apiFetch('/api/marudham/products');
      const backendProducts = (productsResponse.products || []) as Product[];
      setProducts(backendProducts);

      let supabase;
      try {
        supabase = getSupabaseClient();
      } catch {
        setPurchaseLogs([]);
        setLoading(false);
        return;
      }

      const logsResult = await supabase
        .from('product_logs')
        .select('id, product_id, created_at, details')
        .eq('action', 'purchase')
        .order('created_at', { ascending: false })
        .limit(20);

      if (logsResult.error) {
        setPurchaseLogs([]);
      } else {
        setPurchaseLogs((logsResult.data || []) as PurchaseLog[]);
      }
    } catch (loadError: any) {
      setError(loadError.message || 'Failed to load products.');
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

    let supabase;
    try {
      supabase = getSupabaseClient();
    } catch (clientError: any) {
      setError(clientError.message || 'Supabase configuration is missing.');
      setSubmitting(false);
      return;
    }

    for (const row of normalizedRows) {
      const previousStock = Number(row.product.stock || 0);
      const newStock = previousStock + row.qty;

      const updateResult = await supabase
        .from('products')
        .update({
          stock: newStock,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.productId);

      if (updateResult.error) {
        setError(`Failed to update stock for ${row.product.name}: ${updateResult.error.message}`);
        setSubmitting(false);
        await loadData();
        return;
      }

      const totalCost = parsedUnitCost !== null ? parsedUnitCost * row.qty : null;

      const details = {
        purchase_quantity: row.qty,
        previous_stock: previousStock,
        new_stock: newStock,
        unit_cost: parsedUnitCost,
        total_cost: totalCost,
        supplier: supplier.trim() || null,
        notes: notes.trim() || null,
      };

      const logResult = await supabase.from('product_logs').insert({
        id: crypto.randomUUID(),
        product_id: row.productId,
        user_id: userId,
        action: 'purchase',
        details,
      });

      if (logResult.error) {
        setError(`Stock updated for ${row.product.name}, but log failed: ${logResult.error.message}`);
        setSubmitting(false);
        await loadData();
        return;
      }
    }

    setSuccess(`Bulk purchase recorded for ${normalizedRows.length} product(s). Form cleared.`);
    setPurchaseItems([createEmptyRow()]);
    setUnitCost('');
    setSupplier('');
    setNotes('');
    await loadData();
    setSubmitting(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h18v4H3V3zm2 6h14v12H5V9zm4 3h6m-6 4h6" />
        </svg>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Purchase Management</h1>
          <p className="text-gray-600 text-sm">Record purchases and add quantities into current stock</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Record Bulk Purchase</h2>
        <p className="text-gray-600 text-sm mb-6">Select multiple products and enter quantities. This updates stock directly in Supabase.</p>

        <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={handleSubmit}>
          <div className="md:col-span-2 space-y-3">
            {purchaseItems.map((row, index) => (
              <div key={row.rowId} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                <div className="md:col-span-7">
                  <select
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-300 text-sm text-gray-900 bg-white"
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
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-300 text-sm text-gray-900 bg-white"
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
                    className="w-full px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium disabled:opacity-60"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addRow}
              className="px-4 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg font-medium transition-colors"
            >
              Add Another Product
            </button>
          </div>

          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Unit cost (optional)"
            className="px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-300 text-sm text-gray-900 bg-white"
            value={unitCost}
            onChange={(e) => setUnitCost(e.target.value)}
          />

          <input
            type="text"
            placeholder="Supplier (optional)"
            className="px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-300 text-sm text-gray-900 bg-white"
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
          />

          <textarea
            placeholder="Notes (optional)"
            className="md:col-span-2 px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-300 text-sm text-gray-900 bg-white"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />

          {error && <div className="md:col-span-2 text-sm text-red-500">{error}</div>}
          {success && (
            <div className="md:col-span-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {success}
            </div>
          )}

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={submitting || loading}
              className="px-4 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg font-medium transition-colors disabled:opacity-60"
            >
              {submitting ? 'Saving...' : 'Record Bulk Purchase'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Purchases</h2>
        {loading ? (
          <div className="text-gray-400 text-center py-6">Loading purchases...</div>
        ) : purchaseLogs.length === 0 ? (
          <div className="text-gray-400 text-center py-6">No purchases recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-700 text-sm">Date</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700 text-sm">Product</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700 text-sm">Qty</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700 text-sm">Stock Change</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700 text-sm">Supplier</th>
                </tr>
              </thead>
              <tbody>
                {purchaseLogs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-100">
                    <td className="py-3 px-4 text-sm text-gray-700">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900">
                      {productMap[log.product_id]?.name || 'Unknown product'}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700">
                      {log.details?.purchase_quantity ?? '-'}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700">
                      {typeof log.details?.previous_stock === 'number' && typeof log.details?.new_stock === 'number'
                        ? `${log.details.previous_stock} -> ${log.details.new_stock}`
                        : '-'}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700">{log.details?.supplier || '-'}</td>
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
