import React, { useEffect, useState } from 'react';
import Tabs from '../../../components/Tabs';
import SummaryCards from '../../../components/SummaryCards';
import AuditHistoryTable from '../AuditHistoryTable';
import { apiFetch } from '../../../utils/api';

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
  details?: any;
}

interface SuperAdminDashboardProps {
  user: User;
  users: User[];
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  handleLogout: () => void;
  children?: React.ReactNode;
}

export default function SuperAdminDashboard({ user, users, currentTab, setCurrentTab, handleLogout, children }: SuperAdminDashboardProps) {
  const adminCount = users.filter((u: User) => u.role === 'superadmin' || u.role === 'admin').length;
  const repCount = users.filter((u: User) => u.role === 'representative').length;
  const systemHealth = 'Excellent';

  // Audit logs state
  const [logs, setLogs] = useState<Log[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState('');
  const [logSearch, setLogSearch] = useState('');
  const [logActionFilter, setLogActionFilter] = useState('all');
  const [logRoleFilter, setLogRoleFilter] = useState('all');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    if (currentTab === 'Audit History') {
      setLogsLoading(true);
      setLogsError('');
      apiFetch('/api/marudham/logs')
        .then((data: { logs: Log[] }) => setLogs(data.logs || []))
        .catch((err: Error) => setLogsError(err.message))
        .finally(() => setLogsLoading(false));
    }
  }, [currentTab]);

  // Get unique actions and roles for dropdowns
  const uniqueActions = Array.from(new Set(logs.map((log: Log) => log.action))).filter(Boolean);
  const uniqueRoles = Array.from(new Set(logs.map((log: Log) => {
    let role = log.creator_role;
    if ((!role || role === '-') && log.details && typeof log.details === 'object') {
      role = log.details.role || '-';
    }
    return role;
  }))).filter(Boolean);

  // Filter logs by search, action, and role
  const filteredLogs = logs.filter((log: Log) => {
    const q = logSearch.toLowerCase();
    let role = log.creator_role;
    if ((!role || role === '-') && log.details && typeof log.details === 'object') {
      role = log.details.role || '-';
    }
    const matchesSearch =
      (log.creator_email && log.creator_email.toLowerCase().includes(q)) ||
      (log.action && log.action.toLowerCase().includes(q)) ||
      (log.details && JSON.stringify(log.details).toLowerCase().includes(q));
    const matchesAction = logActionFilter === 'all' || log.action === logActionFilter;
    const matchesRole = logRoleFilter === 'all' || role === logRoleFilter;
    return matchesSearch && matchesAction && matchesRole;
  });

  // Audit logs pagination
  const LOGS_PER_PAGE = 10;
  const [logPage, setLogPage] = useState(1);
  const totalLogPages = Math.ceil(filteredLogs.length / LOGS_PER_PAGE) || 1;
  const paginatedLogs = filteredLogs.slice((logPage - 1) * LOGS_PER_PAGE, logPage * LOGS_PER_PAGE);

  // Function to handle logout with confirmation
  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  // Function to confirm logout
  const confirmLogout = async () => {
    setShowLogoutConfirm(false);
    await handleLogout();
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Main Content */}
      <main className="flex-1 p-4 lg:p-6">
        <div className="space-y-6">
          {/* Page Title */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Super Admin Dashboard</h1>
                <p className="text-gray-600 text-sm">System administration and oversight</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-gray-700 font-medium">{user.first_name} {user.last_name}</span>
              <button
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors flex items-center gap-2"
                onClick={handleLogoutClick}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-600 text-sm font-medium mb-1">Total Admins</p>
                  <p className="text-xl font-bold text-blue-800">{adminCount}</p>
                </div>
                <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
              </div>
            </div>
            
            <div className="bg-green-50 rounded-lg border border-green-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-700 text-sm font-medium mb-1">Sales Representatives</p>
                  <p className="text-xl font-bold text-green-800">{repCount}</p>
                </div>
                <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
            
            <div className="bg-purple-50 rounded-lg border border-purple-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-700 text-sm font-medium mb-1">System Health</p>
                  <p className="text-xl font-bold text-purple-800">{systemHealth}</p>
                </div>
                <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            
            <div className="bg-orange-50 rounded-lg border border-orange-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-700 text-sm font-medium mb-1">Total Users</p>
                  <p className="text-xl font-bold text-orange-800">{users.length}</p>
                </div>
                <svg className="w-8 h-8 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <Tabs
            tabs={["User Management", "Audit History", "System Reports", "Settings"]}
            currentTab={currentTab}
            onTabChange={setCurrentTab}
          />

          {/* Content Sections */}
          {currentTab === 'Audit History' ? (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-1">Audit History</h2>
                  <p className="text-gray-600 text-sm">Track system activities and user actions</p>
                </div>
              </div>

              {/* Search and Filter Bar */}
              <div className="flex flex-col lg:flex-row gap-4 mb-6">
                <div className="flex-1">
                  <div className="relative">
                    <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Search by user, action, or details..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300 text-sm text-gray-900 bg-white"
                      value={logSearch}
                      onChange={e => setLogSearch(e.target.value)}
                    />
                  </div>
                </div>
                <select
                  className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300 text-sm text-gray-900 bg-white"
                  value={logActionFilter}
                  onChange={e => setLogActionFilter(e.target.value)}
                >
                  <option value="all">All Actions</option>
                  {uniqueActions.map(action => (
                    <option key={action} value={action}>{action}</option>
                  ))}
                </select>
                <select
                  className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300 text-sm text-gray-900 bg-white"
                  value={logRoleFilter}
                  onChange={e => setLogRoleFilter(e.target.value)}
                >
                  <option value="all">All Roles</option>
                  {uniqueRoles.map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>

              {logsLoading ? (
                <div className="text-gray-400 text-center py-8">Loading logs...</div>
              ) : logsError ? (
                <div className="text-red-500 text-center py-8">{logsError}</div>
              ) : (
                <>
                  <div className="overflow-hidden rounded-lg border border-gray-200">
                    <AuditHistoryTable logs={paginatedLogs} />
                  </div>
                  <div className="flex justify-center items-center gap-4 mt-6">
                    <button
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors disabled:opacity-60 flex items-center gap-2"
                      onClick={() => setLogPage(p => Math.max(1, p - 1))}
                      disabled={logPage === 1}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      Previous
                    </button>
                    <span className="text-gray-500 text-sm">Page {logPage} of {totalLogPages}</span>
                    <button
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors disabled:opacity-60 flex items-center gap-2"
                      onClick={() => setLogPage(p => Math.min(totalLogPages, p + 1))}
                      disabled={logPage === totalLogPages}
                    >
                      Next
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              {children}
            </div>
          )}
        </div>
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