import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../../utils/api';

interface DashboardStats {
  total_orders: number;
  pending_orders: number;
  approved_orders: number;
  rejected_orders: number;
  total_revenue: number;
  total_collected: number;
  outstanding_amount: number;
  shop_count: number;
  today_orders: number;
  today_collections: number;
}

interface RecentOrder {
  id: string;
  shop_name: string;
  total: number;
  status: string;
  created_at: string;
}

interface RecentCollection {
  payment_id: string;
  shop_name: string;
  amount: number;
  payment_date: string;
}

interface DashboardProps {
  onNavigate?: (section: string) => void;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [recentCollections, setRecentCollections] = useState<RecentCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      const [ordersData, collectionsData, shopsData] = await Promise.all([
        apiFetch('/api/marudham/orders'),
        apiFetch('/api/marudham/collections/representative'),
        apiFetch('/api/marudham/shops/assigned')
      ]);

      const orders = ordersData.orders || [];
      const collections = collectionsData.collections || [];
      const shops = shopsData.shops || [];

      const dashboardStats: DashboardStats = {
        total_orders: orders.length,
        pending_orders: orders.filter((o: any) => o.status === 'pending').length,
        approved_orders: orders.filter((o: any) => o.status === 'approved').length,
        rejected_orders: orders.filter((o: any) => o.status === 'rejected').length,
        total_revenue: orders.reduce((sum: number, o: any) => sum + Number(o.total || 0), 0),
        total_collected: collections.reduce((sum: number, c: any) => sum + Number(c.payment_amount || 0), 0),
        outstanding_amount: shops.reduce((sum: number, s: any) => sum + Number(s.current_outstanding || 0), 0),
        shop_count: shops.length,
        today_orders: orders.filter((o: any) => {
          const orderDate = new Date(o.created_at).toDateString();
          const today = new Date().toDateString();
          return orderDate === today;
        }).length,
        today_collections: collections.filter((c: any) => {
          const collectionDate = new Date(c.payment_date).toDateString();
          const today = new Date().toDateString();
          return collectionDate === today;
        }).length
      };

      const recentOrdersData = orders
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5)
        .map((order: any) => ({
          id: order.id,
          shop_name: order.shop_name,
          total: Number(order.total),
          status: order.status,
          created_at: order.created_at
        }));

      const recentCollectionsData = collections
        .sort((a: any, b: any) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())
        .slice(0, 5)
        .map((collection: any) => ({
          payment_id: collection.payment_id,
          shop_name: collection.shop.name,
          amount: Number(collection.payment_amount),
          payment_date: collection.payment_date
        }));

      setStats(dashboardStats);
      setRecentOrders(recentOrdersData);
      setRecentCollections(recentCollectionsData);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-700';
      case 'pending': return 'bg-amber-100 text-amber-700';
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-LK', {
      style: 'currency',
      currency: 'LKR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
          <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-gray-900">Error loading dashboard</p>
        <p className="text-sm text-gray-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-500">Here's what's happening with your sales today</p>
          </div>
        </div>
        <div className="hidden md:flex flex-col items-end gap-0.5">
          <span className="text-2xl font-bold text-gray-900">{stats?.today_orders || 0}</span>
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Orders Today</span>
        </div>
      </div>

      {/* Quick Actions — Mobile Only */}
      {onNavigate && (
        <div className="md:hidden bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-900">Quick Actions</span>
          </div>
          <div className="grid grid-cols-2 gap-3 p-4">
            <button
              onClick={() => onNavigate('Create Order')}
              className="flex flex-col items-center justify-center p-4 bg-gray-50 hover:bg-violet-50 rounded-xl border border-gray-100 transition-colors active:scale-95"
            >
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center mb-2">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <span className="text-xs font-semibold text-gray-700">Create Order</span>
            </button>

            <button
              onClick={() => onNavigate('Bills & Collections')}
              className="flex flex-col items-center justify-center p-4 bg-gray-50 hover:bg-violet-50 rounded-xl border border-gray-100 transition-colors active:scale-95"
            >
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center mb-2">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <span className="text-xs font-semibold text-gray-700">Bills &amp; Collections</span>
            </button>

            <button
              onClick={() => onNavigate('My Orders')}
              className="flex flex-col items-center justify-center p-4 bg-gray-50 hover:bg-violet-50 rounded-xl border border-gray-100 transition-colors active:scale-95"
            >
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mb-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              <span className="text-xs font-semibold text-gray-700">My Orders</span>
            </button>

            <button
              onClick={() => onNavigate('My Collection')}
              className="flex flex-col items-center justify-center p-4 bg-gray-50 hover:bg-violet-50 rounded-xl border border-gray-100 transition-colors active:scale-95"
            >
              <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center mb-2">
                <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <span className="text-xs font-semibold text-gray-700">My Collection</span>
            </button>
          </div>
        </div>
      )}

      {/* Key Statistics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Orders */}
        <div className="bg-white rounded-xl border border-violet-100 shadow-sm p-5">
          <div className="w-9 h-9 bg-violet-50 rounded-lg flex items-center justify-center mb-3">
            <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Total Orders</p>
          <p className="text-2xl font-bold text-gray-900">{stats?.total_orders || 0}</p>
        </div>

        {/* Total Revenue */}
        <div className="bg-white rounded-xl border border-green-100 shadow-sm p-5">
          <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center mb-3">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Total Revenue</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats?.total_revenue || 0)}</p>
        </div>

        {/* Outstanding Amount */}
        <div className="bg-white rounded-xl border border-orange-100 shadow-sm p-5">
          <div className="w-9 h-9 bg-orange-50 rounded-lg flex items-center justify-center mb-3">
            <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Outstanding</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats?.outstanding_amount || 0)}</p>
        </div>

        {/* Today's Collections */}
        <div className="bg-white rounded-xl border border-purple-100 shadow-sm p-5">
          <div className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center mb-3">
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Today's Collections</p>
          <p className="text-2xl font-bold text-gray-900">{stats?.today_collections || 0}</p>
        </div>
      </div>

      {/* Order Status + Recent Orders + Recent Collections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order Status */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-900">Order Status</span>
          </div>
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 bg-amber-400 rounded-full"></div>
                <span className="text-sm text-gray-700">Pending</span>
              </div>
              <span className="text-sm font-semibold text-gray-900">{stats?.pending_orders || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 bg-green-400 rounded-full"></div>
                <span className="text-sm text-gray-700">Approved</span>
              </div>
              <span className="text-sm font-semibold text-gray-900">{stats?.approved_orders || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 bg-red-400 rounded-full"></div>
                <span className="text-sm text-gray-700">Rejected</span>
              </div>
              <span className="text-sm font-semibold text-gray-900">{stats?.rejected_orders || 0}</span>
            </div>
          </div>
        </div>

        {/* Recent Orders */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-900">Recent Orders</span>
          </div>
          <div className="p-5 space-y-2">
            {recentOrders.length > 0 ? (
              recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-violet-50/30 transition-colors border border-gray-100">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{order.shop_name}</p>
                    <p className="text-xs text-gray-500">{formatCurrency(order.total)}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusColor(order.status)}`}>
                    {getStatusText(order.status)}
                  </span>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </div>
                <p className="text-sm text-gray-500">No recent orders</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Collections */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-900">Recent Collections</span>
          </div>
          <div className="p-5 space-y-2">
            {recentCollections.length > 0 ? (
              recentCollections.map((collection) => (
                <div key={collection.payment_id} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-violet-50/30 transition-colors border border-gray-100">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{collection.shop_name}</p>
                    <p className="text-xs text-gray-500">{formatCurrency(collection.amount)}</p>
                  </div>
                  <p className="text-xs text-gray-400 shrink-0 ml-2">
                    {new Date(collection.payment_date).toLocaleDateString()}
                  </p>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <p className="text-sm text-gray-500">No recent collections</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions — Desktop */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <span className="text-sm font-semibold text-gray-900">Quick Actions</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5">
          <button className="flex items-center gap-3 p-4 bg-gray-50 hover:bg-violet-50 rounded-xl border border-gray-100 transition-colors text-left">
            <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Create Order</p>
              <p className="text-xs text-gray-500">New order for shop</p>
            </div>
          </button>

          <button className="flex items-center gap-3 p-4 bg-gray-50 hover:bg-violet-50 rounded-xl border border-gray-100 transition-colors text-left">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Record Payment</p>
              <p className="text-xs text-gray-500">Collect payment</p>
            </div>
          </button>

          <button className="flex items-center gap-3 p-4 bg-gray-50 hover:bg-violet-50 rounded-xl border border-gray-100 transition-colors text-left">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">View Orders</p>
              <p className="text-xs text-gray-500">Order history</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
