import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import LoadingSpinner from '../../components/LoadingSpinner';
import { clearCache } from '../../utils/api';
import { useRouter, useSearchParams } from 'next/navigation';

// Lazy load components for better performance
const Dashboard = lazy(() => import('./representative/Dashboard'));
const CreateOrder = lazy(() => import('./representative/CreateOrder'));
const MyOrders = lazy(() => import('./representative/MyOrders'));
const MyShops = lazy(() => import('./representative/MyShops'));
const BillsCollections = lazy(() => import('./representative/BillsCollections'));
const MyCollection = lazy(() => import('./representative/MyCollection'));

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

interface SalesRepDashboardProps {
  user: User;
  handleLogout: () => void;
}

// Memoized sidebar items to prevent unnecessary re-renders
const sidebarItems = [
  { 
    label: 'Dashboard', 
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v6H8V5z" />
      </svg>
    ), 
    description: 'Overview' 
  },
  { 
    label: 'My Shops', 
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ), 
    description: 'Manage shops' 
  },
  { 
    label: 'Create Order', 
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
      </svg>
    ), 
    description: 'New order' 
  },
  { 
    label: 'My Orders', 
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
      </svg>
    ), 
    description: 'Order history' 
  },
  { 
    label: 'Bills & Collections', 
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ), 
    description: 'Payments' 
  },
  { 
    label: 'My Collection', 
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
      </svg>
    ), 
    description: 'Collection history' 
  },
] as const;

// Loading component for lazy-loaded components
const ComponentLoader = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <LoadingSpinner size="lg" text="Loading..." />
  </div>
);

export default function SalesRepDashboard({ user, handleLogout }: SalesRepDashboardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentSection, setCurrentSection] = useState(() => {
    const section = searchParams.get('section');
    return section || 'Dashboard';
  });

  // Update URL when section changes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set('section', currentSection);
    router.replace(`${window.location.pathname}?${params.toString()}`, { scroll: false });
  }, [currentSection, router]);

  const [ordersRefreshKey, setOrdersRefreshKey] = useState(0);
  const [shopsRefreshKey, setShopsRefreshKey] = useState(0);
  const [billsRefreshKey, setBillsRefreshKey] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  
  // Floating Action Button state
  const [showFAB, setShowFAB] = useState(false);
  const [fabExpanded, setFabExpanded] = useState(false);

  // Memoized screen size check to prevent unnecessary re-renders
  const checkScreenSize = useCallback(() => {
    setIsMobile(window.innerWidth < 1024);
  }, []);

  // Optimized resize listener with debouncing
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    const debouncedCheck = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(checkScreenSize, 100);
    };
    
    checkScreenSize();
    window.addEventListener('resize', debouncedCheck);
    
    return () => {
      window.removeEventListener('resize', debouncedCheck);
      clearTimeout(timeoutId);
    };
  }, [checkScreenSize]);

  // Show FAB when scrolling down, hide when scrolling up
  useEffect(() => {
    let lastScrollY = window.scrollY;
    
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setShowFAB(currentScrollY > 100); // Show FAB after scrolling 100px
      lastScrollY = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Memoized callbacks to prevent unnecessary re-renders
  const handleOrderPlaced = useCallback(() => {
    setCurrentSection('My Orders');
    setOrdersRefreshKey(k => k + 1);
    setShopsRefreshKey(k => k + 1); // Refresh shops to update outstanding amounts
    if (isMobile) setSidebarOpen(false);
  }, [isMobile]);

  const handlePaymentRecorded = useCallback(() => {
    setBillsRefreshKey(k => k + 1);
    setShopsRefreshKey(k => k + 1); // Refresh shops to update outstanding amounts
    setOrdersRefreshKey(k => k + 1); // Refresh orders to update payment status
  }, []);

  const handleSectionClick = (sectionLabel: string) => {
    clearCache();
    setCurrentSection(sectionLabel);
    // Close sidebar on mobile for better UX
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  // FAB navigation handlers
  const handleFABNavigate = (section: string) => {
    clearCache();
    setCurrentSection(section);
    setFabExpanded(false);
    if (isMobile) setSidebarOpen(false);
  };

  // Optimized click outside handler
  useEffect(() => {
    if (!isMobile || !sidebarOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const sidebar = document.getElementById('sidebar');
      const hamburger = document.getElementById('hamburger');
      
      if (sidebar && !sidebar.contains(event.target as Node) && 
          hamburger && !hamburger.contains(event.target as Node)) {
        setSidebarOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMobile, sidebarOpen]);

  // Function to handle logout with confirmation
  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  // Function to confirm logout
  const confirmLogout = async () => {
    setShowLogoutConfirm(false);
    await handleLogout();
  };

  // Memoized current component to prevent unnecessary re-renders
  const CurrentComponent = useMemo(() => {
    switch (currentSection) {
      case 'Dashboard':
        return (
          <Suspense fallback={<ComponentLoader />}>
            <Dashboard onNavigate={handleSectionClick} />
          </Suspense>
        );
      case 'Create Order':
        return (
          <Suspense fallback={<ComponentLoader />}>
            <CreateOrder onOrderPlaced={handleOrderPlaced} />
          </Suspense>
        );
      case 'My Orders':
        return (
          <Suspense fallback={<ComponentLoader />}>
            <MyOrders refreshKey={ordersRefreshKey} />
          </Suspense>
        );
      case 'My Shops':
        return (
          <Suspense fallback={<ComponentLoader />}>
            <MyShops refreshKey={shopsRefreshKey} />
          </Suspense>
        );
      case 'Bills & Collections':
        return (
          <Suspense fallback={<ComponentLoader />}>
            <BillsCollections refreshKey={billsRefreshKey} onPaymentRecorded={handlePaymentRecorded} />
          </Suspense>
        );
      case 'My Collection':
        return (
          <Suspense fallback={<ComponentLoader />}>
            <MyCollection />
          </Suspense>
        );
      default:
        return (
          <Suspense fallback={<ComponentLoader />}>
            <Dashboard onNavigate={handleSectionClick} />
          </Suspense>
        );
    }
  }, [currentSection, ordersRefreshKey, shopsRefreshKey, billsRefreshKey, handleOrderPlaced, handlePaymentRecorded, handleSectionClick]);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Mobile Overlay */}
      {sidebarOpen && isMobile && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        id="sidebar"
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col h-screen flex-shrink-0 shadow-xl transform transition-all duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand */}
        <div className="px-5 py-5 border-b border-slate-700/50 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-violet-600 rounded-lg flex items-center justify-center shadow-md flex-shrink-0">
                <span className="text-white font-bold text-sm">MR</span>
              </div>
              <div>
                <h1 className="text-white font-bold text-base leading-tight">Marudham</h1>
                <p className="text-slate-400 text-xs mt-0.5">Sales Dashboard</p>
              </div>
            </div>

            {/* Mobile Close Button */}
            <button
              id="hamburger"
              className="lg:hidden p-1.5 rounded-lg hover:bg-slate-700/50 transition-colors"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex flex-col flex-1 min-h-0">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest px-3 mb-2 mt-4 flex-shrink-0">
            Menu
          </p>
          <nav className="flex flex-col gap-1 px-3 py-2 overflow-y-auto flex-1">
            {sidebarItems.map((item) => (
              <button
                key={item.label}
                onClick={() => handleSectionClick(item.label)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 ${
                  currentSection === item.label
                    ? 'bg-violet-600 text-white shadow-md shadow-violet-900/40 font-semibold text-sm'
                    : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-100 font-medium text-sm'
                }`}
              >
                <span className="w-5 h-5 flex-shrink-0">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Footer — User Info & Logout */}
        <div className="px-4 py-4 border-t border-slate-700/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">
                {user.first_name?.[0]}{user.last_name?.[0]}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {user.first_name} {user.last_name}
              </p>
              <p className="text-xs text-slate-400 truncate">{user.email}</p>
            </div>
          </div>

          <button
            onClick={handleLogoutClick}
            className="flex items-center gap-2 text-slate-400 hover:text-red-400 text-sm font-medium transition-colors mt-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Mobile Header */}
        <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="text-base font-bold text-gray-900">Marudham</h1>
            <div className="w-10" />
          </div>
        </div>

        {/* Content Area */}
        <div className="p-6 md:p-8">
          {CurrentComponent}
        </div>
      </main>

      {/* Floating Action Button (FAB) */}
      <div className={`fixed bottom-6 right-6 z-50 transition-all duration-300 ${
        showFAB ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
      }`}>
        {/* FAB Menu Items */}
        <div className={`absolute bottom-16 right-0 mb-2 transition-all duration-300 ${
          fabExpanded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
        }`}>
          {/* Bills & Collections FAB Item */}
          <div className="mb-3">
            <button
              onClick={() => handleFABNavigate('Bills & Collections')}
              className={`group flex items-center gap-3 px-4 py-3 bg-white rounded-full shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-200 transform hover:scale-105 ${
                currentSection === 'Bills & Collections' ? 'ring-2 ring-violet-500' : ''
              }`}
            >
              <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center group-hover:bg-red-600 transition-colors">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-gray-900 whitespace-nowrap">Bills & Collections</div>
                <div className="text-xs text-gray-500">Manage payments</div>
              </div>
            </button>
          </div>

          {/* Create Order FAB Item */}
          <div className="mb-3">
            <button
              onClick={() => handleFABNavigate('Create Order')}
              className={`group flex items-center gap-3 px-4 py-3 bg-white rounded-full shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-200 transform hover:scale-105 ${
                currentSection === 'Create Order' ? 'ring-2 ring-violet-500' : ''
              }`}
            >
              <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center group-hover:bg-green-600 transition-colors">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-gray-900 whitespace-nowrap">Create Order</div>
                <div className="text-xs text-gray-500">New order</div>
              </div>
            </button>
          </div>
        </div>

        {/* Main FAB Button */}
        <button
          onClick={() => setFabExpanded(!fabExpanded)}
          className="w-14 h-14 bg-violet-600 hover:bg-violet-700 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 flex items-center justify-center"
        >
          <svg
            className={`w-6 h-6 text-white transition-transform duration-300 ${
              fabExpanded ? 'rotate-45' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </button>
      </div>

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
