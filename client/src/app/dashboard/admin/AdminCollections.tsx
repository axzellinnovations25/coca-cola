import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch, clearCache } from '../../../utils/api';

interface SalesRep {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface Shop {
  id: string;
  name: string;
  address: string;
}

interface Collection {
  payment_id: string;
  payment_amount: number;
  payment_notes: string | null;
  payment_date: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  reviewed_by_admin: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
  order_id: string;
  order_total: number;
  shop: Shop;
  sales_rep: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
}

function toLocalDateTimeInput(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

const DEFAULT_PAGE_SIZE = 50;
const PAGE_SIZE_OPTIONS = [25, 50, 100, 200, 500];

export default function AdminCollections() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [reps, setReps] = useState<SalesRep[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [repFilter, setRepFilter] = useState('');
  const [shopFilter, setShopFilter] = useState('');
  const [search, setSearch] = useState('');
  const [reviewFilter, setReviewFilter] = useState<'all' | 'unreviewed' | 'reviewed'>('all');
  const [updatingReview, setUpdatingReview] = useState<string | null>(null);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editError, setEditError] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const fetchCollections = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);
      if (repFilter) params.set('sales_rep_id', repFilter);
      if (shopFilter) params.set('shop_id', shopFilter);
      const query = params.toString() ? `?${params.toString()}` : '';
      const res = await apiFetch(`/api/marudham/collections/admin${query}`);
      setCollections((res.collections || []) as Collection[]);
    } catch (err: any) {
      setError(err.message || 'Failed to load collections.');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, repFilter, shopFilter]);

  useEffect(() => {
    const loadMeta = async () => {
      try {
        const [usersRes, shopsRes] = await Promise.all([
          apiFetch('/api/marudham/users'),
          apiFetch('/api/marudham/shops'),
        ]);
        const allUsers: any[] = usersRes.users || [];
        setReps(allUsers.filter(u => u.role === 'representative'));
        setShops((shopsRes.shops || []) as Shop[]);
      } catch {
        // non-critical
      }
    };
    loadMeta();
  }, []);

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return collections.filter(c => {
      if (reviewFilter === 'reviewed' && !c.reviewed_at) return false;
      if (reviewFilter === 'unreviewed' && c.reviewed_at) return false;
      if (!q.trim()) return true;
      return c.shop.name.toLowerCase().includes(q) ||
        `${c.sales_rep.first_name} ${c.sales_rep.last_name}`.toLowerCase().includes(q) ||
        c.order_id.toLowerCase().includes(q) ||
        (c.payment_notes || '').toLowerCase().includes(q);
    });
  }, [collections, search, reviewFilter]);

  // Reset page when filters or search changes
  useEffect(() => { setPage(1); }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(current => Math.min(current, totalPages));
  }, [totalPages]);

  const handlePageSizeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setPageSize(Number(event.target.value));
    setPage(1);
  };

  // Summary stats computed from filtered results
  const stats = useMemo(() => {
    const total = filtered.reduce((s, c) => s + c.payment_amount, 0);
    const uniqueReps = new Set(filtered.map(c => c.sales_rep.id)).size;
    const uniqueShops = new Set(filtered.map(c => c.shop.id)).size;
    const reviewed = filtered.filter(c => Boolean(c.reviewed_at)).length;
    return { total, count: filtered.length, uniqueReps, uniqueShops, reviewed, unreviewed: filtered.length - reviewed };
  }, [filtered]);

  // Per-rep breakdown
  const repBreakdown = useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number; shops: Set<string> }>();
    for (const c of filtered) {
      const key = c.sales_rep.id;
      if (!map.has(key)) {
        map.set(key, {
          name: `${c.sales_rep.first_name} ${c.sales_rep.last_name}`,
          total: 0,
          count: 0,
          shops: new Set(),
        });
      }
      const entry = map.get(key)!;
      entry.total += c.payment_amount;
      entry.count += 1;
      entry.shops.add(c.shop.id);
    }
    return Array.from(map.values())
      .map(e => ({ ...e, shops: e.shops.size }))
      .sort((a, b) => b.total - a.total);
  }, [filtered]);

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setRepFilter('');
    setShopFilter('');
    setSearch('');
    setReviewFilter('all');
  };

  const handleReviewToggle = async (collection: Collection) => {
    const reviewed = !collection.reviewed_at;
    setUpdatingReview(collection.payment_id);
    try {
      const response = await apiFetch(`/api/marudham/collections/admin/${collection.payment_id}/reviewed`, {
        method: 'PATCH',
        body: JSON.stringify({ reviewed }),
      });
      const updated = response.collection;
      setCollections(current => current.map(item => item.payment_id === collection.payment_id
        ? {
            ...item,
            reviewed_at: updated.reviewed_at || null,
            reviewed_by: updated.reviewed_by || null,
            reviewed_by_admin: updated.reviewed_by_admin || null,
          }
        : item));
      clearCache('/api/marudham/collections/admin');
    } catch (err: any) {
      setError(err.message || 'Failed to update the collection review marker.');
    } finally {
      setUpdatingReview(null);
    }
  };

  const openEdit = (collection: Collection) => {
    setEditingCollection(collection);
    setEditAmount(String(collection.payment_amount));
    setEditNotes(collection.payment_notes || '');
    setEditDate(toLocalDateTimeInput(collection.payment_date));
    setEditError('');
  };

  const closeEdit = () => {
    if (savingEdit) return;
    setEditingCollection(null);
    setEditError('');
  };

  const handleSaveEdit = async () => {
    if (!editingCollection) return;
    const amount = Number(editAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setEditError('Enter a collection amount greater than zero.');
      return;
    }
    const parsedDate = new Date(editDate);
    if (!editDate || Number.isNaN(parsedDate.getTime())) {
      setEditError('Enter a valid collection date and time.');
      return;
    }

    setSavingEdit(true);
    setEditError('');
    try {
      const response = await apiFetch(`/api/marudham/collections/admin/${editingCollection.payment_id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          amount,
          notes: editNotes,
          payment_date: parsedDate.toISOString(),
        }),
      });
      const updated = response.collection;
      setCollections(current => current.map(item => item.payment_id === editingCollection.payment_id
        ? {
            ...item,
            payment_amount: Number(updated.payment_amount),
            payment_notes: updated.payment_notes || null,
            payment_date: updated.payment_date,
          }
        : item));
      clearCache('/api/marudham/collections/admin');
      setEditingCollection(null);
    } catch (err: any) {
      setEditError(err.message || 'Failed to update the collection.');
    } finally {
      setSavingEdit(false);
    }
  };

  const hasFilters = startDate || endDate || repFilter || shopFilter || search || reviewFilter !== 'all';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
          <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Collections</h1>
          <p className="text-sm text-gray-500">All payments collected by sales representatives</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">From</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-300" />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">To</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-300" />
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Representative</label>
            <select value={repFilter} onChange={e => setRepFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300">
              <option value="">All reps</option>
              {reps.map(r => (
                <option key={r.id} value={r.id}>{r.first_name} {r.last_name}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Shop</label>
            <select value={shopFilter} onChange={e => setShopFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300">
              <option value="">All shops</option>
              {shops.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Search</label>
            <input type="text" placeholder="Shop, rep, order ID…" value={search} onChange={e => setSearch(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-300" />
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Review</label>
            <select value={reviewFilter} onChange={e => setReviewFilter(e.target.value as typeof reviewFilter)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300">
              <option value="all">All</option>
              <option value="unreviewed">Needs review</option>
              <option value="reviewed">Reviewed</option>
            </select>
          </div>
          {hasFilters && (
            <button onClick={clearFilters}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-1">Total Collected</p>
          <p className="text-xl font-bold text-emerald-800">{stats.total.toFixed(2)} LKR</p>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Payments</p>
          <p className="text-xl font-bold text-blue-800">{stats.count}</p>
        </div>
        <div className="bg-violet-50 border border-violet-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide mb-1">Representatives</p>
          <p className="text-xl font-bold text-violet-800">{stats.uniqueReps}</p>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1">Shops</p>
          <p className="text-xl font-bold text-amber-800">{stats.uniqueShops}</p>
        </div>
        <div className="bg-rose-50 border border-rose-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-rose-600 uppercase tracking-wide mb-1">Needs Review</p>
          <p className="text-xl font-bold text-rose-800">{stats.unreviewed}</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-lg p-4 text-sm text-red-700">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {/* Rep breakdown */}
      {repBreakdown.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-900">By Representative</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="py-3 px-5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left">Rep</th>
                  <th className="py-3 px-5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-right">Payments</th>
                  <th className="py-3 px-5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-right">Shops</th>
                  <th className="py-3 px-5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-right">Total Collected</th>
                  <th className="py-3 px-5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-right">Share</th>
                </tr>
              </thead>
              <tbody>
                {repBreakdown.map(r => (
                  <tr key={r.name} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60 transition-colors">
                    <td className="py-3 px-5 text-sm font-semibold text-gray-900">{r.name}</td>
                    <td className="py-3 px-5 text-sm text-gray-700 text-right">{r.count}</td>
                    <td className="py-3 px-5 text-sm text-gray-700 text-right">{r.shops}</td>
                    <td className="py-3 px-5 text-sm font-bold text-emerald-700 text-right">{r.total.toFixed(2)} LKR</td>
                    <td className="py-3 px-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-24 bg-gray-100 rounded-full h-1.5">
                          <div className="bg-emerald-500 h-1.5 rounded-full"
                            style={{ width: `${stats.total > 0 ? (r.total / stats.total) * 100 : 0}%` }} />
                        </div>
                        <span className="text-xs text-gray-500 w-10 text-right">
                          {stats.total > 0 ? ((r.total / stats.total) * 100).toFixed(0) : 0}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Collections table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-gray-900">All Collections</h2>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-gray-500">
              <span>Rows per page</span>
              <select
                value={pageSize}
                onChange={handlePageSizeChange}
                className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300"
              >
                {PAGE_SIZE_OPTIONS.map(size => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </label>
            <span className="text-xs text-gray-500">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm font-bold text-gray-900 mb-1">No collections found</p>
            <p className="text-sm text-gray-500">Try adjusting your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="py-3 px-5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left">Date</th>
                  <th className="py-3 px-5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left">Rep</th>
                  <th className="py-3 px-5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left">Shop</th>
                  <th className="py-3 px-5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left">Order</th>
                  <th className="py-3 px-5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-right">Order Total</th>
                  <th className="py-3 px-5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-right">Collected</th>
                  <th className="py-3 px-5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left">Notes</th>
                  <th className="py-3 px-5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left">Admin Review</th>
                  <th className="py-3 px-5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(c => (
                  <tr key={c.payment_id} className={`border-b border-gray-100 last:border-0 transition-colors ${c.reviewed_at ? 'bg-emerald-50/30 hover:bg-emerald-50/60' : 'hover:bg-amber-50/30'}`}>
                    <td className="py-3.5 px-5 text-sm text-gray-500 whitespace-nowrap">
                      {new Date(c.payment_date).toLocaleDateString()}{' '}
                      <span className="text-gray-400 text-xs">
                        {new Date(c.payment_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-sm font-medium text-gray-900">
                      {c.sales_rep.first_name} {c.sales_rep.last_name}
                    </td>
                    <td className="py-3.5 px-5">
                      <p className="text-sm font-medium text-gray-900">{c.shop.name}</p>
                      {c.shop.address && (
                        <p className="text-xs text-gray-400 truncate max-w-[160px]">{c.shop.address}</p>
                      )}
                    </td>
                    <td className="py-3.5 px-5 text-sm text-gray-500 font-mono">
                      #{c.order_id.slice(0, 8)}
                    </td>
                    <td className="py-3.5 px-5 text-sm text-gray-700 text-right font-medium">
                      {c.order_total.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                        +{c.payment_amount.toFixed(2)} LKR
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-sm text-gray-500 max-w-[180px] truncate">
                      {c.payment_notes || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="py-3.5 px-5 whitespace-nowrap">
                      <button
                        onClick={() => handleReviewToggle(c)}
                        disabled={updatingReview === c.payment_id}
                        title={c.reviewed_at
                          ? `Reviewed${c.reviewed_by_admin ? ` by ${[c.reviewed_by_admin.first_name, c.reviewed_by_admin.last_name].filter(Boolean).join(' ') || c.reviewed_by_admin.email}` : ''} on ${new Date(c.reviewed_at).toLocaleString()}. Click to mark as unreviewed.`
                          : 'Mark this collection as seen and reviewed'}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          c.reviewed_at
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200'
                            : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50'
                        }`}
                      >
                        {updatingReview === c.payment_id ? (
                          'Saving…'
                        ) : c.reviewed_at ? (
                          <><span aria-hidden="true">✓</span> Reviewed</>
                        ) : (
                          'Mark Reviewed'
                        )}
                      </button>
                    </td>
                    <td className="py-3.5 px-5 whitespace-nowrap">
                      <button
                        onClick={() => openEdit(c)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 11l6.586-6.586a2 2 0 112.828 2.828L11.828 13.828a2 2 0 01-.828.486L8 15l.686-3a2 2 0 01.314-.686zM5 19h14" />
                        </svg>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
                .reduce<(number | '...')[]>((acc, n, i, arr) => {
                  if (i > 0 && n - (arr[i - 1] as number) > 1) acc.push('...');
                  acc.push(n);
                  return acc;
                }, [])
                .map((n, i) =>
                  n === '...' ? (
                    <span key={`ellipsis-${i}`} className="w-8 h-8 flex items-center justify-center text-xs text-gray-400">…</span>
                  ) : (
                    <button
                      key={n}
                      onClick={() => setPage(n as number)}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-semibold transition-colors ${
                        page === n
                          ? 'bg-emerald-600 text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {n}
                    </button>
                  )
                )}

              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {editingCollection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/45 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 mb-1">Edit Collection</p>
                <h2 className="text-lg font-bold text-gray-900">{editingCollection.shop.name}</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Order #{editingCollection.order_id.slice(0, 8)} - {editingCollection.sales_rep.first_name} {editingCollection.sales_rep.last_name}
                </p>
              </div>
              <button
                onClick={closeEdit}
                disabled={savingEdit}
                className="w-9 h-9 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
                aria-label="Close edit collection"
              >
                <svg className="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-5">
              {editError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {editError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Amount (LKR)</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={editAmount}
                  onChange={event => setEditAmount(event.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                <p className="mt-1.5 text-xs text-gray-400">Original value: {editingCollection.payment_amount.toFixed(2)} LKR</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Collection Date &amp; Time</label>
                <input
                  type="datetime-local"
                  value={editDate}
                  onChange={event => setEditDate(event.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Notes</label>
                <textarea
                  rows={4}
                  maxLength={1000}
                  value={editNotes}
                  onChange={event => setEditNotes(event.target.value)}
                  placeholder="Optional collection notes"
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-3">
              <button
                onClick={closeEdit}
                disabled={savingEdit}
                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
