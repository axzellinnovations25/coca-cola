import React, { useEffect, useState, useRef } from 'react';
import { apiFetch, clearCache } from '../../../utils/api';

interface Product {
  id: string;
  name: string;
  description: string;
  unit_price: number;
  stock: number;
  created_at?: string;
  updated_at?: string;
}

export default function ProductManagement() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [form, setForm] = useState({ name: '', description: '', unit_price: '', stock: '' });
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Search/filter and pagination state
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const PRODUCTS_PER_PAGE = 10;
  // Sorting state
  const [sortBy, setSortBy] = useState<'name' | 'description' | 'unit_price' | 'stock' | 'created_at'>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Filtered and paginated products
  const filteredProducts = products.filter(product => {
    const q = search.toLowerCase();
    return (
      product.name.toLowerCase().includes(q) ||
      product.description.toLowerCase().includes(q)
    );
  });
  const totalPages = Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE) || 1;

  function handleSort(col: typeof sortBy) {
    if (sortBy === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
    setPage(1);
  }

  // Sort filtered products
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    let aVal = a[sortBy];
    let bVal = b[sortBy];
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    }
    return 0;
  });
  const paginatedProducts = sortedProducts.slice((page - 1) * PRODUCTS_PER_PAGE, page * PRODUCTS_PER_PAGE);

  // Export CSV
  function exportCSV() {
    const rows = [
      ['Name', 'Description', 'Price', 'Stock'],
      ...sortedProducts.map(p => [p.name, p.description, p.unit_price, p.stock]),
    ];
    const csv = rows.map(row => row.map(String).map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'products.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const fetchProducts = () => {
    setLoading(true);
    setError('');
    clearCache('/api/marudham/products');
    apiFetch('/api/marudham/products')
      .then((data: { products: Product[] }) => setProducts(data.products))
      .catch((err: { message: string }) => setError(err.message))
      .finally(() => setLoading(false));
  };

  // Function to show toast notification
  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    // Clear any existing timeout
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    // Auto-dismiss toast after 4 seconds
    const timeout = setTimeout(() => setToast(null), 4000);
    toastTimeoutRef.current = timeout;
  };

  // Function to trigger refresh
  const triggerRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Small delay to ensure server operation completes
      await new Promise(resolve => setTimeout(resolve, 200));
      // Fetch fresh data directly
      clearCache('/api/marudham/products');
      const data = await apiFetch('/api/marudham/products');
      setProducts(data.products);
      setError('');
      // Reset to first page to show updated data
      setPage(1);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const openAddModal = () => {
    setForm({ name: '', description: '', unit_price: '', stock: '' });
    setFormError('');
    setShowAddModal(true);
    setTimeout(() => firstInputRef.current?.focus(), 100);
  };

  const openEditModal = (product: Product) => {
    setEditProduct(product);
    setForm({
      name: product.name,
      description: product.description,
      unit_price: product.unit_price.toString(),
      stock: product.stock.toString(),
    });
    setFormError('');
    setShowEditModal(true);
    setTimeout(() => firstInputRef.current?.focus(), 100);
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    try {
      await apiFetch('/api/marudham/products', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          unit_price: parseFloat(form.unit_price),
          stock: parseInt(form.stock, 10),
        }),
      });
      setShowAddModal(false);
      await triggerRefresh();
      showToast('success', 'Product added successfully!');
    } catch (err: any) {
      setFormError(err.message);
      showToast('error', err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleEditProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProduct) return;
    setFormLoading(true);
    setFormError('');
    try {
      await apiFetch(`/api/marudham/products/${editProduct.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          unit_price: parseFloat(form.unit_price),
          stock: parseInt(form.stock, 10),
        }),
      });
      setShowEditModal(false);
      setEditProduct(null);
      await triggerRefresh();
      showToast('success', 'Product updated successfully!');
    } catch (err: any) {
      setFormError(err.message);
      showToast('error', err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    setFormLoading(true);
    try {
      await apiFetch(`/api/marudham/products/${id}`, { method: 'DELETE' });
      await triggerRefresh();
      showToast('success', 'Product deleted successfully!');
    } catch (err: any) {
      alert(err.message);
      showToast('error', err.message);
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex items-center gap-3">
        <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Product Management</h1>
          <p className="text-gray-600 text-sm">Manage your product catalog and stock levels</p>
        </div>
      </div>

      {/* Product Management Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Product Inventory</h2>
            <p className="text-gray-600 text-sm">Manage your product catalog and stock levels</p>
          </div>
          <div className="flex gap-2 items-center">
            <button
              className="px-4 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg font-medium flex items-center gap-2 transition-colors"
              onClick={openAddModal}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add Product
            </button>
            <button
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium flex items-center gap-2 transition-colors"
              onClick={exportCSV}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by name or description..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300 text-sm text-gray-900 bg-white"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
        </div>

        {loading ? (
          <div className="text-gray-400 text-center py-8">Loading products...</div>
        ) : error ? (
          <div className="text-red-500 text-center py-8">{error}</div>
        ) : (
          <div className="overflow-x-auto">
            {isRefreshing && (
              <div className="text-center py-2 bg-blue-50 border-b border-blue-200">
                <div className="flex items-center justify-center text-blue-600 text-sm">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Refreshing data...
                </div>
              </div>
            )}
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-700 text-sm cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('name')}>
                    <div className="flex items-center">
                      Name
                      {(loading || isRefreshing) && (
                        <svg className="animate-spin ml-2 h-3 w-3 text-purple-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      )}
                      {sortBy === 'name' && (sortDir === 'asc' ? '▲' : '▼')}
                    </div>
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700 text-sm cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('description')}>
                    Description {sortBy === 'description' && (sortDir === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700 text-sm cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('unit_price')}>
                    Price {sortBy === 'unit_price' && (sortDir === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700 text-sm cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('stock')}>
                    Stock {sortBy === 'stock' && (sortDir === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700 text-sm">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedProducts.map(product => (
                  <tr key={product.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-4">
                      <div className="font-medium text-gray-900 text-sm">{product.name}</div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-gray-700 text-sm">{product.description}</div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-semibold text-purple-600 text-sm">
                        {typeof product.unit_price === 'number' ? product.unit_price.toFixed(2) : Number(product.unit_price).toFixed(2)} LKR
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className={`font-semibold text-sm ${product.stock < 10 ? 'text-red-600' : product.stock < 50 ? 'text-orange-600' : 'text-green-600'}`}>
                        {product.stock}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <button
                          className="text-purple-600 hover:text-purple-700 transition-colors"
                          onClick={() => openEditModal(product)}
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          className="text-red-500 hover:text-red-700 transition-colors"
                          onClick={() => handleDeleteProduct(product.id)}
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7v10l16 0" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center mt-6">
            <span className="text-sm text-gray-600">
              Showing {page * PRODUCTS_PER_PAGE - PRODUCTS_PER_PAGE + 1} to {Math.min(page * PRODUCTS_PER_PAGE, filteredProducts.length)} of {filteredProducts.length} entries
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(prev => Math.max(1, prev - 1))}
                disabled={page === 1}
                className="px-3 py-1 bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                Previous
              </button>
              <span className="text-sm text-gray-700">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {filteredProducts.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            No products found matching your criteria.
          </div>
        )}
      </div>
      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-lg border border-gray-200 w-full max-w-md p-6 relative">
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl font-bold"
              onClick={() => setShowAddModal(false)}
              aria-label="Close"
            >
              &times;
            </button>
            <h3 className="text-lg font-semibold text-gray-900 mb-6 text-center">Add Product</h3>
            <form className="flex flex-col gap-4" onSubmit={handleAddProduct}>
              <input
                ref={firstInputRef}
                type="text"
                placeholder="Product Name"
                className="px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-300 text-sm text-gray-900 bg-white"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
              />
              <input
                type="text"
                placeholder="Description"
                className="px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-300 text-sm text-gray-900 bg-white"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                required
              />
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Unit Price"
                className="px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-300 text-sm text-gray-900 bg-white"
                value={form.unit_price}
                onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))}
                required
              />
              <input
                type="number"
                min="0"
                step="1"
                placeholder="Stock"
                className="px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-300 text-sm text-gray-900 bg-white"
                value={form.stock}
                onChange={e => setForm(f => ({ ...f, stock: e.target.value }))}
                required
              />
              {formError && <div className="text-red-500 text-sm text-center">{formError}</div>}
              <button
                type="submit"
                className="w-full py-2 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-700 font-medium transition-colors mt-2 disabled:opacity-60"
                disabled={formLoading}
              >
                {formLoading ? 'Adding...' : 'Add Product'}
              </button>
            </form>
          </div>
        </div>
      )}
      {/* Edit Product Modal */}
      {showEditModal && editProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-lg border border-gray-200 w-full max-w-md p-6 relative">
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl font-bold"
              onClick={() => setShowEditModal(false)}
              aria-label="Close"
            >
              &times;
            </button>
            <h3 className="text-lg font-semibold text-gray-900 mb-6 text-center">Edit Product</h3>
            <form className="flex flex-col gap-4" onSubmit={handleEditProduct}>
              <input
                ref={firstInputRef}
                type="text"
                placeholder="Product Name"
                className="px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-300 text-sm text-gray-900 bg-white"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
              />
              <input
                type="text"
                placeholder="Description"
                className="px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-300 text-sm text-gray-900 bg-white"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                required
              />
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Unit Price"
                className="px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-300 text-sm text-gray-900 bg-white"
                value={form.unit_price}
                onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))}
                required
              />
              <input
                type="number"
                min="0"
                step="1"
                placeholder="Stock"
                className="px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-300 text-sm text-gray-900 bg-white"
                value={form.stock}
                onChange={e => setForm(f => ({ ...f, stock: e.target.value }))}
                required
              />
              {formError && <div className="text-red-500 text-sm text-center">{formError}</div>}
              <button
                type="submit"
                className="w-full py-2 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-700 font-medium transition-colors mt-2 disabled:opacity-60"
                disabled={formLoading}
              >
                {formLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>
      )}
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-fadeIn">
          <div className={`rounded-lg p-4 shadow-lg border ${
            toast.type === 'success' 
              ? 'bg-green-50 border-green-200 text-green-800' 
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <div className="flex items-center">
              {toast.type === 'success' ? (
                <svg className="w-5 h-5 text-green-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              )}
              <span className="font-medium">{toast.message}</span>
              <button
                onClick={() => setToast(null)}
                className="ml-3 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 
