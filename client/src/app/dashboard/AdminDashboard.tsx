import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { apiFetch } from '../../utils/api';
import ProductManagement from './admin/ProductManagement';
import ShopManagement from './admin/ShopManagement';
import OrderManagement from './admin/OrderManagement';
import SalesRepresentatives from './admin/SalesRepresentatives';
import ProductInventoryLogTable from './admin/ProductInventoryLogTable';
import ShopLogTable from './admin/ShopLogTable';
import OrderLogTable from './admin/OrderLogTable';
import PaymentLogTable from './admin/PaymentLogTable';
import SalesQuantityLogTable from './admin/SalesQuantityLogTable';
import PurchaseManagement from './admin/PurchaseManagement';

interface SidebarChild {
  label: string;
  icon: React.ReactNode;
}

interface SidebarItem {
  label: string;
  icon: React.ReactNode;
  isParent?: boolean;
  children?: SidebarChild[];
}

const sidebarItems: SidebarItem[] = [
  {
    label: 'Order Management',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
      </svg>
    )
  },
  {
    label: 'Product Management',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    )
  },
  {
    label: 'Purchase',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16M4 12h16M4 17h16" />
      </svg>
    )
  },
  {
    label: 'Sales Representatives',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
      </svg>
    )
  },
  {
    label: 'Shop Management',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    )
  },
  {
    label: 'Log History',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
    isParent: true,
    children: [
      {
        label: 'Inventory Log History',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        ),
      },
      {
        label: 'Shop Log History',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        ),
      },
      {
        label: 'Order Log History',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
          </svg>
        ),
      },
      {
        label: 'Return Log History',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h10a4 4 0 110 8H9m0 0l3-3m-3 3l3 3" />
          </svg>
        ),
      },
      {
        label: 'Payment Log History',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        ),
      },
      {
        label: 'Sales Quantity Log History',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        ),
      },
    ],
  },
];

interface User {
  id: string;
  email: string;
  role: string;
  first_name: string;
  last_name: string;
  phone_no?: string;
  nic_no?: string;
  created_at?: string;
}

interface Log {
  id: string;
  created_at: string;
  creator_email?: string;
  creator_role?: string;
  action: string;
  details?: Record<string, unknown>;
}

interface AdminDashboardProps {
  user: User;
  handleLogout: () => void;
}

const getValidSections = () => {
  const sections: string[] = [];
  sidebarItems.forEach(item => {
    sections.push(item.label);
    if (item.children) {
      item.children.forEach(child => sections.push(child.label));
    }
  });
  return sections;
};

const getInitialSection = () => {
  if (typeof window === 'undefined') return 'Product Management';
  const params = new URLSearchParams(window.location.search);
  const section = params.get('section');
  const validSections = getValidSections();
  return section && validSections.includes(section) ? section : 'Product Management';
};

export default function AdminDashboard({ user, handleLogout }: AdminDashboardProps) {
  const router = useRouter();
  const [currentSection, setCurrentSection] = useState(getInitialSection);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Hydrate initial section from URL on client
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const section = params.get('section');
    const validSections = getValidSections();
    if (section && validSections.includes(section)) {
      setCurrentSection(section);
    }
    setHasHydrated(true);
  }, []);

  // Update URL when section changes (after hydration)
  useEffect(() => {
    if (!hasHydrated || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    params.set('section', currentSection);
    router.replace(`${window.location.pathname}?${params.toString()}`, { scroll: false });
  }, [currentSection, router, hasHydrated]);

  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [productLogs, setProductLogs] = useState<Log[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState('');
  const [shopLogs, setShopLogs] = useState<Log[]>([]);
  const [shopLogsLoading, setShopLogsLoading] = useState(false);
  const [shopLogsError, setShopLogsError] = useState('');
  const [orderLogs, setOrderLogs] = useState<Log[]>([]);
  const [orderLogsLoading, setOrderLogsLoading] = useState(false);
  const [orderLogsError, setOrderLogsError] = useState('');
  const [paymentLogs, setPaymentLogs] = useState<Log[]>([]);
  const [paymentLogsLoading, setPaymentLogsLoading] = useState(false);
  const [paymentLogsError, setPaymentLogsError] = useState('');

  const toggleSection = (sectionLabel: string) => {
    setExpandedSections(prev => 
      prev.includes(sectionLabel) 
        ? prev.filter(s => s !== sectionLabel)
        : [...prev, sectionLabel]
    );
  };

  const handleSectionClick = (sectionLabel: string) => {
    setCurrentSection(sectionLabel);
  };

  useEffect(() => {
    if (currentSection === 'Inventory Log History') {
      setLogsLoading(true);
      setLogsError('');
      apiFetch('/api/marudham/products/logs')
        .then(data => setProductLogs(data.logs || []))
        .catch(err => setLogsError(err.message))
        .finally(() => setLogsLoading(false));
    }
    if (currentSection === 'Shop Log History') {
      setShopLogsLoading(true);
      setShopLogsError('');
      apiFetch('/api/marudham/shops/logs')
        .then(data => setShopLogs(data.logs || []))
        .catch(err => setShopLogsError(err.message))
        .finally(() => setShopLogsLoading(false));
    }
    if (currentSection === 'Order Log History' || currentSection === 'Return Log History') {
      setOrderLogsLoading(true);
      setOrderLogsError('');
      apiFetch('/api/marudham/orders/logs')
        .then(data => setOrderLogs(data.logs || []))
        .catch(err => setOrderLogsError(err.message))
        .finally(() => setOrderLogsLoading(false));
    }
    if (currentSection === 'Payment Log History') {
      setPaymentLogsLoading(true);
      setPaymentLogsError('');
      apiFetch('/api/marudham/payments/logs')
        .then(data => setPaymentLogs(data.logs || []))
        .catch(err => setPaymentLogsError(err.message))
        .finally(() => setPaymentLogsLoading(false));
    }
  }, [currentSection]);

  // Function to handle logout with confirmation
  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  // Function to confirm logout
  const confirmLogout = async () => {
    setShowLogoutConfirm(false);
    await handleLogout();
  };

  const returnLogs = orderLogs.filter(log => String(log.action || '').toLowerCase() === 'return');

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col h-screen flex-shrink-0 shadow-xl">
        {/* Brand */}
        <div className="px-5 py-5 border-b border-slate-700/60 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-violet-600 rounded-lg flex items-center justify-center shadow-md flex-shrink-0">
              <Image
                src="/MotionRep.png"
                alt="MotionRep Logo"
                width={22}
                height={22}
                className="object-contain"
              />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-tight">S.B Distributions</h1>
              <p className="text-xs text-slate-400 mt-0.5">Admin Panel</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-0.5 px-3 py-4 overflow-y-auto flex-1">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest px-3 mb-2">Menu</p>
          {sidebarItems.map(item => (
            <div key={item.label}>
              {item.isParent ? (
                <div>
                  <button
                    className={`flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 text-left group ${
                      expandedSections.includes(item.label)
                        ? 'bg-violet-600/20 text-violet-300'
                        : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-100'
                    }`}
                    onClick={() => toggleSection(item.label)}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`transition-colors ${expandedSections.includes(item.label) ? 'text-violet-400' : 'text-slate-500 group-hover:text-slate-300'}`}>
                        {item.icon}
                      </span>
                      {item.label}
                    </div>
                    <svg
                      className={`w-3.5 h-3.5 transition-transform duration-200 ${expandedSections.includes(item.label) ? 'rotate-180 text-violet-400' : 'text-slate-500'}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {expandedSections.includes(item.label) && item.children && (
                    <div className="ml-3 mt-0.5 pl-3 border-l border-slate-700 space-y-0.5">
                      {item.children.map(child => (
                        <button
                          key={child.label}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 w-full text-left group ${
                            currentSection === child.label
                              ? 'bg-violet-600 text-white shadow-md shadow-violet-900/40'
                              : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-100'
                          }`}
                          onClick={() => handleSectionClick(child.label)}
                        >
                          <span className={`transition-colors ${currentSection === child.label ? 'text-violet-200' : 'text-slate-500 group-hover:text-slate-300'}`}>
                            {child.icon}
                          </span>
                          {child.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <button
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 w-full text-left group ${
                    currentSection === item.label
                      ? 'bg-violet-600 text-white shadow-md shadow-violet-900/40'
                      : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-100'
                  }`}
                  onClick={() => handleSectionClick(item.label)}
                >
                  <span className={`transition-colors ${currentSection === item.label ? 'text-violet-200' : 'text-slate-500 group-hover:text-slate-300'}`}>
                    {item.icon}
                  </span>
                  {item.label}
                </button>
              )}
            </div>
          ))}
        </nav>

        {/* User Footer */}
        <div className="px-3 py-4 border-t border-slate-700/60 flex-shrink-0">
          <div className="flex items-center gap-3 px-2 mb-3">
            <div className="w-8 h-8 bg-violet-600 rounded-full flex items-center justify-center flex-shrink-0 shadow">
              <span className="text-white text-xs font-bold">
                {user.first_name?.[0]}{user.last_name?.[0]}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-100 truncate leading-tight">
                {user.first_name} {user.last_name}
              </p>
              <p className="text-xs text-slate-500 truncate">{user.email}</p>
            </div>
          </div>
          <button
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all duration-150 border border-transparent hover:border-red-500/20"
            onClick={handleLogoutClick}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign out
          </button>
        </div>
      </aside>
      {/* Main Content */}
      <main className="flex-1 p-6 overflow-y-auto">
        
        {/* Section Content */}
        {currentSection === 'Product Management' ? (
          <ProductManagement />
        ) : currentSection === 'Purchase' ? (
          <PurchaseManagement userId={user.id} />
        ) : currentSection === 'Shop Management' ? (
          <ShopManagement />
        ) : currentSection === 'Order Management' ? (
          <OrderManagement />
        ) : currentSection === 'Sales Representatives' ? (
          <SalesRepresentatives />
        ) : currentSection === 'Inventory Log History' ? (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Product Inventory Log History</h2>
            {logsLoading ? (
              <div className="text-gray-400 text-center py-8">Loading logs...</div>
            ) : logsError ? (
              <div className="text-red-500 text-center py-8">{logsError}</div>
            ) : (
              <ProductInventoryLogTable logs={productLogs} />
            )}
          </div>
        ) : currentSection === 'Shop Log History' ? (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Shop Log History</h2>
            {shopLogsLoading ? (
              <div className="text-gray-400 text-center py-8">Loading logs...</div>
            ) : shopLogsError ? (
              <div className="text-red-500 text-center py-8">{shopLogsError}</div>
            ) : (
              <ShopLogTable logs={shopLogs} />
            )}
          </div>
        ) : currentSection === 'Order Log History' ? (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Log History</h2>
            <p className="text-gray-600 mb-4 text-sm">Track all order activities with representative details</p>
            {orderLogsLoading ? (
              <div className="text-gray-400 text-center py-8">Loading logs...</div>
            ) : orderLogsError ? (
              <div className="text-red-500 text-center py-8">{orderLogsError}</div>
            ) : (
              <OrderLogTable logs={orderLogs} />
            )}
          </div>
        ) : currentSection === 'Return Log History' ? (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Return Log History</h2>
            <p className="text-gray-600 mb-4 text-sm">Returns recorded by sales representatives</p>
            {orderLogsLoading ? (
              <div className="text-gray-400 text-center py-8">Loading returns...</div>
            ) : orderLogsError ? (
              <div className="text-red-500 text-center py-8">{orderLogsError}</div>
            ) : returnLogs.length === 0 ? (
              <div className="text-gray-400 text-center py-8">No returns recorded.</div>
            ) : (
              <OrderLogTable logs={returnLogs} />
            )}
          </div>
        ) : currentSection === 'Payment Log History' ? (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Log History</h2>
            <p className="text-gray-600 mb-4 text-sm">Track all payment activities with representative details</p>
            {paymentLogsLoading ? (
              <div className="text-gray-400 text-center py-8">Loading logs...</div>
            ) : paymentLogsError ? (
              <div className="text-red-500 text-center py-8">{paymentLogsError}</div>
            ) : (
              <PaymentLogTable logs={paymentLogs} />
            )}
          </div>
        ) : currentSection === 'Sales Quantity Log History' ? (
          <SalesQuantityLogTable />
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{currentSection}</h2>
            <p className="text-gray-600">Section coming soon.</p>
          </div>
        )}
      </main>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#f0f0f5] w-full max-w-md p-6 sm:p-8 relative animate-fadeIn">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Confirm Logout</h3>
              <p className="text-gray-600 mb-6">Are you sure you want to logout? You will need to log in again to access the system.</p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmLogout}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 
