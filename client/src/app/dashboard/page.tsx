"use client";
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import Tabs from '../../components/Tabs';
import SummaryCards from '../../components/SummaryCards';
import SuperAdminDashboard from './superadmin/SuperAdminDashboard';
import AdminDashboard from './AdminDashboard';
import SalesRepDashboard from './SalesRepDashboard';

interface User {
  id: string;
  email: string;
  role: string;
  first_name: string;
  last_name: string;
  phone_no: string;
  nic_no: string;
  created_at: string;
}

export default function DashboardPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();
  const { user, logout, isLoading: authLoading } = useAuth();
  const [showAddModal, setShowAddModal] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Add User form state
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    nic_no: '',
    phone_no: '',
    role: 'representative',
  });

  // Phone number validation function
  const validatePhoneNumber = (phone: string) => {
    // Remove all non-digit characters except +
    const cleaned = phone.replace(/[^\d+]/g, '');
    
    // If it doesn't start with +94, add it
    if (!cleaned.startsWith('+94')) {
      return '+94' + cleaned.replace(/^\+/, '');
    }
    
    // Ensure it's exactly +94 followed by 9 digits
    const match = cleaned.match(/^\+94(\d{9})$/);
    if (match) {
      return cleaned;
    }
    
    // If it has more than 9 digits after +94, truncate
    if (cleaned.startsWith('+94') && cleaned.length > 13) {
      return cleaned.substring(0, 13);
    }
    
    return cleaned;
  };

  const handlePhoneChange = (value: string) => {
    const validated = validatePhoneNumber(value);
    setForm(f => ({ ...f, phone_no: validated }));
  };

  const handleEditPhoneChange = (value: string) => {
    const validated = validatePhoneNumber(value);
    setEditForm((f: any) => ({ ...f, phone_no: validated }));
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddLoading(true);
    setAddError('');
    try {
      await apiFetch('/api/marudham/users', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      showToast('success', 'User added successfully!');
      setForm({ first_name: '', last_name: '', email: '', nic_no: '', phone_no: '', role: 'representative' });
      setShowAddModal(false);
      // Auto refresh user list
      await triggerRefresh();
    } catch (err: any) {
      setAddError(err.message);
      showToast('error', err.message);
    } finally {
      setAddLoading(false);
    }
  };

  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState<any>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  const openEditModal = (user: User) => {
    setEditForm({ ...user });
    setShowEditModal(true);
    setTimeout(() => editInputRef.current?.focus(), 100);
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditLoading(true);
    setEditError('');
    try {
      await apiFetch(`/api/marudham/users/${editForm.id}`, {
        method: 'PUT',
        body: JSON.stringify(editForm),
      });
      showToast('success', 'User updated successfully!');
      setShowEditModal(false);
      setEditForm(null);
      // Auto refresh user list
      await triggerRefresh();
    } catch (err: any) {
      setEditError(err.message);
      showToast('error', err.message);
    } finally {
      setEditLoading(false);
    }
  };

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleteUserInfo, setDeleteUserInfo] = useState<any>(null);
  const [deleteUserShops, setDeleteUserShops] = useState<any[]>([]);
  const [loadingShops, setLoadingShops] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

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

  // Function to handle logout with confirmation
  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  // Function to confirm logout
  const confirmLogout = async () => {
    setShowLogoutConfirm(false);
    await handleLogout();
  };

  const openDeleteModal = async (id: string) => {
    const userToDelete = users.find(u => u.id === id);
    setDeleteUserId(id);
    setDeleteUserInfo(userToDelete);
    setDeleteError('');
    setShowDeleteModal(true);
    
    // If user is a sales representative, fetch their shop assignments
    if (userToDelete?.role === 'representative') {
      setLoadingShops(true);
      try {
        const shopsData = await apiFetch('/api/marudham/shops');
        const userShops = shopsData.shops.filter((shop: any) => shop.sales_rep_id === id);
        setDeleteUserShops(userShops);
      } catch (error) {
        console.error('Error fetching shops:', error);
        setDeleteUserShops([]);
      } finally {
        setLoadingShops(false);
      }
    } else {
      setDeleteUserShops([]);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUserId) return;
    setDeleteLoading(true);
    setDeleteError('');
    try {
      await apiFetch(`/api/marudham/users/${deleteUserId}`, {
        method: 'DELETE',
      });
      showToast('success', 'User deleted successfully!');
      setShowDeleteModal(false);
      setDeleteUserId(null);
      setDeleteUserInfo(null);
      setDeleteUserShops([]);
      // Auto refresh user list
      await triggerRefresh();
    } catch (err: any) {
      setDeleteError(err.message);
      showToast('error', err.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [page, setPage] = useState(1);
  const USERS_PER_PAGE = 10;

  // User Management filters
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Filtered and paginated users
  const filteredUsers = users.filter((u: User) => {
    const q = userSearch.toLowerCase();
    const matchesSearch =
      u.first_name.toLowerCase().includes(q) ||
      u.last_name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.nic_no.toLowerCase().includes(q);
    const matchesRole = userRoleFilter === 'all' || u.role === userRoleFilter;
    return matchesSearch && matchesRole;
  });
  const totalPages = Math.ceil(filteredUsers.length / USERS_PER_PAGE) || 1;
  const paginatedUsers = filteredUsers.slice((page - 1) * USERS_PER_PAGE, page * USERS_PER_PAGE);

  // Function to trigger refresh
  const triggerRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Small delay to ensure server operation completes
      await new Promise(resolve => setTimeout(resolve, 200));
      // Fetch fresh data directly
      const data = await apiFetch('/api/marudham/users');
      setUsers(data.users);
      setError('');
      // Reset to first page to show updated data
      setPage(1);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsRefreshing(false);
    }
  };

  const [currentTab, setCurrentTab] = useState('User Management');
  // Dummy data for summary cards (replace with real data as needed)
  const adminCount = users.filter(u => u.role === 'superadmin' || u.role === 'admin').length;
  const repCount = users.filter(u => u.role === 'representative').length;
  const systemHealth = 'Excellent';

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setError('');
    apiFetch('/api/marudham/users')
      .then(data => setUsers(data.users))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [user]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  if (!user) {
    return null;
  }

  // Use logout from auth context
  const handleLogout = async () => {
    await logout();
  };

  // Add a menubar at the top right with user's name and logout
  // Remove the old logout button from the header
  // Only show summary cards and tabs for superadmin
  if (user.role === 'superadmin') {
  return (
      <SuperAdminDashboard
        user={user}
        users={users}
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        handleLogout={handleLogout}
      >
        {/* Toast Notification */}
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
        
        {currentTab === 'User Management' && (
          <main>
            <div className="bg-white rounded-2xl shadow-xl border border-[#f0f0f5] p-6">
              <div className="flex flex-col sm:flex-row gap-2 mb-4 items-center justify-between">
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Search by name, email, or NIC..."
                    className="w-full max-w-xs px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-300 text-gray-700 bg-gray-50"
                    value={userSearch}
                    onChange={e => { setUserSearch(e.target.value); setPage(1); }}
                  />
                  <select
                    className="w-full max-w-xs px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-300 text-gray-700 bg-gray-50"
                    value={userRoleFilter}
                    onChange={e => { setUserRoleFilter(e.target.value); setPage(1); }}
                  >
                    <option value="all">All Roles</option>
                    <option value="superadmin">Superadmin</option>
                    <option value="admin">Admin</option>
                    <option value="representative">Representative</option>
                  </select>
          </div>
            <button
              className="px-6 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-semibold shadow-md transition-colors duration-200 text-base"
              onClick={() => {
                setShowAddModal(true);
                setTimeout(() => firstInputRef.current?.focus(), 100);
              }}
            >
              Add User
            </button>
            </div>
            <h2 className="text-lg font-semibold text-gray-700 mb-4">Users</h2>
            {loading ? (
              <div className="text-gray-400 text-center py-12">
                <div className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-violet-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading users...
                </div>
              </div>
            ) : error ? (
              <div className="text-red-500 text-center py-12">{error}</div>
            ) : paginatedUsers.length === 0 ? (
              <div className="text-gray-400 text-center py-12">No users found.</div>
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
                <table className="min-w-full text-sm text-left">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-2 font-semibold text-gray-600">
                        <div className="flex items-center">
                          First Name
                          {(loading || isRefreshing) && (
                            <svg className="animate-spin ml-2 h-3 w-3 text-violet-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          )}
                        </div>
                      </th>
                      <th className="px-4 py-2 font-semibold text-gray-600">Last Name</th>
                      <th className="px-4 py-2 font-semibold text-gray-600">Email</th>
                      <th className="px-4 py-2 font-semibold text-gray-600">Role</th>
                      <th className="px-4 py-2 font-semibold text-gray-600">Phone</th>
                      <th className="px-4 py-2 font-semibold text-gray-600">Created</th>
                      {(user.role === 'superadmin' || user.role === 'admin') && <th className="px-4 py-2"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedUsers.map(u => (
                      <tr key={u.id} className="border-b last:border-0 text-gray-600 hover:bg-violet-50/30 transition-all duration-200 animate-fadeIn">
                        <td className="px-4 py-2">{u.first_name}</td>
                        <td className="px-4 py-2">{u.last_name}</td>
                        <td className="px-4 py-2">{u.email}</td>
                        <td className="px-4 py-2 capitalize">{u.role}</td>
                        <td className="px-4 py-2">{u.phone_no}</td>
                        <td className="px-4 py-2 text-xs text-gray-400">{new Date(u.created_at).toLocaleDateString()}</td>
                        {(user.role === 'superadmin' || user.role === 'admin') && (
                          <td className="px-4 py-2">
                            <button
                              className="text-violet-600 hover:text-violet-900 font-semibold text-xs px-2 py-1 rounded transition-colors"
                                onClick={e => { e.stopPropagation(); openEditModal(u); }}
                            >
                              Edit
                            </button>
                            <button
                              className="text-red-500 hover:text-red-700 font-semibold text-xs px-2 py-1 rounded transition-colors ml-2"
                                onClick={e => { e.stopPropagation(); openDeleteModal(u.id); }}
                            >
                              Delete
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* Pagination Controls */}
                <div className="flex justify-center items-center gap-4 mt-6">
                  <button
                    className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold transition-colors disabled:opacity-60"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </button>
                  <span className="text-gray-500 text-sm">Page {page} of {totalPages}</span>
                  <button
                    className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold transition-colors disabled:opacity-60"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
      </div>
      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#f0f0f5] w-full max-w-lg p-6 sm:p-8 relative animate-fadeIn max-h-[90vh] overflow-y-auto">
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-violet-600 text-xl font-bold"
              onClick={() => setShowAddModal(false)}
              aria-label="Close"
            >
              &times;
            </button>
            <h3 className="text-xl font-semibold text-gray-800 mb-6 text-center">Add New User</h3>
            <form className="flex flex-col gap-4" onSubmit={handleAddUser}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <input
                  ref={firstInputRef}
                  type="text"
                  placeholder="First Name"
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-300 text-gray-700 bg-gray-50"
                  value={form.first_name}
                  onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                  required
                />
                <input
                  type="text"
                  placeholder="Last Name"
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-300 text-gray-700 bg-gray-50"
                  value={form.last_name}
                  onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                  required
                />
              </div>
              <input
                type="email"
                placeholder="Email Address"
                className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-300 text-gray-700 bg-gray-50"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <input
                  type="text"
                  placeholder="NIC No"
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-300 text-gray-700 bg-gray-50"
                  value={form.nic_no}
                  onChange={e => setForm(f => ({ ...f, nic_no: e.target.value }))}
                  required
                />
                <input
                  type="text"
                  placeholder="Phone No (+94XXXXXXXXX)"
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-300 text-gray-700 bg-gray-50"
                  value={form.phone_no}
                  onChange={e => handlePhoneChange(e.target.value)}
                  required
                />
              </div>
              <select
                className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-300 text-gray-700 bg-gray-50"
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                required
              >
                <option value="superadmin">Superadmin</option>
                <option value="admin">Admin</option>
                <option value="representative">Representative</option>
              </select>
              {addError && <div className="text-red-500 text-sm text-center">{addError}</div>}
              <button
                type="submit"
                className="w-full py-3 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-semibold text-lg transition-colors duration-200 shadow-md mt-2 disabled:opacity-60"
                disabled={addLoading}
              >
                {addLoading ? 'Adding...' : 'Add User'}
              </button>
            </form>
          </div>
        </div>
      )}
      {/* Edit User Modal */}
      {showEditModal && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#f0f0f5] w-full max-w-lg p-6 sm:p-8 relative animate-fadeIn max-h-[90vh] overflow-y-auto">
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-violet-600 text-xl font-bold"
              onClick={() => setShowEditModal(false)}
              aria-label="Close"
            >
              &times;
            </button>
            <h3 className="text-xl font-semibold text-gray-800 mb-6 text-center">Edit User</h3>
            <form className="flex flex-col gap-4" onSubmit={handleEditUser}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <input
                  ref={editInputRef}
                  type="text"
                  placeholder="First Name"
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-300 text-gray-700 bg-gray-50"
                  value={editForm.first_name}
                  onChange={e => setEditForm((f: any) => ({ ...f, first_name: e.target.value }))}
                  required
                />
                <input
                  type="text"
                  placeholder="Last Name"
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-300 text-gray-700 bg-gray-50"
                  value={editForm.last_name}
                  onChange={e => setEditForm((f: any) => ({ ...f, last_name: e.target.value }))}
                  required
                />
              </div>
              <input
                type="email"
                placeholder="Email Address"
                className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-300 text-gray-700 bg-gray-50"
                value={editForm.email}
                onChange={e => setEditForm((f: any) => ({ ...f, email: e.target.value }))}
                required
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <input
                  type="text"
                  placeholder="NIC No"
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-300 text-gray-700 bg-gray-50"
                  value={editForm.nic_no}
                  onChange={e => setEditForm((f: any) => ({ ...f, nic_no: e.target.value }))}
                  required
                />
                <input
                  type="text"
                  placeholder="Phone No (+94XXXXXXXXX)"
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-300 text-gray-700 bg-gray-50"
                  value={editForm.phone_no}
                  onChange={e => handleEditPhoneChange(e.target.value)}
                  required
                />
              </div>
              <select
                className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-300 text-gray-700 bg-gray-50"
                value={editForm.role}
                onChange={e => setEditForm((f: any) => ({ ...f, role: e.target.value }))}
                required
              >
                <option value="superadmin">Superadmin</option>
                <option value="admin">Admin</option>
                <option value="representative">Representative</option>
              </select>
              {editError && <div className="text-red-500 text-sm text-center">{editError}</div>}
              <button
                type="submit"
                className="w-full py-3 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-semibold text-lg transition-colors duration-200 shadow-md mt-2 disabled:opacity-60"
                disabled={editLoading}
              >
                {editLoading ? 'Updating...' : 'Update User'}
              </button>
            </form>
          </div>
        </div>
      )}
      {/* Delete User Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#f0f0f5] w-full max-w-md p-6 sm:p-8 relative animate-fadeIn">
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-violet-600 text-xl font-bold"
              onClick={() => {
                setShowDeleteModal(false);
                setDeleteUserId(null);
                setDeleteUserInfo(null);
                setDeleteError('');
                setDeleteUserShops([]);
              }}
              aria-label="Close"
            >
              &times;
            </button>
            <h3 className="text-xl font-semibold text-gray-800 mb-4 text-center">Delete User</h3>
            
            {deleteUserInfo && (
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-600 mb-2">User to be deleted:</p>
                <p className="font-medium text-gray-800">{deleteUserInfo.first_name} {deleteUserInfo.last_name}</p>
                <p className="text-sm text-gray-600">{deleteUserInfo.email}</p>
                <p className="text-sm text-gray-600 capitalize">Role: {deleteUserInfo.role}</p>
                
                {/* Show shop assignments for sales representatives */}
                {deleteUserInfo.role === 'representative' && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-sm text-gray-600 mb-2">Shop Assignments:</p>
                    {loadingShops ? (
                      <p className="text-sm text-gray-500">Loading shop assignments...</p>
                    ) : deleteUserShops.length > 0 ? (
                      <div className="space-y-1">
                        {deleteUserShops.map((shop: any) => (
                          <div key={shop.id} className="text-sm bg-white rounded px-2 py-1 border">
                            <span className="font-medium">{shop.name}</span>
                            <span className="text-gray-500 ml-2">({shop.address})</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-green-600">No shop assignments</p>
                    )}
                  </div>
                )}
              </div>
            )}
            
            <p className="text-gray-600 text-center mb-6">Are you sure you want to delete this user? This action cannot be undone.</p>
            
            {deleteError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-red-400 mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <div>
                    <p className="text-red-800 font-medium text-sm">Cannot Delete User</p>
                    <p className="text-red-700 text-sm mt-1">{deleteError}</p>
                    {deleteError.includes('shop') && (
                      <div className="mt-3 text-sm text-red-700">
                        <p className="font-medium">To resolve this:</p>
                        <ul className="list-disc list-inside mt-1 space-y-1">
                          <li>Go to Shop Management</li>
                          <li>Find shops assigned to this user</li>
                          <li>Reassign them to another sales representative</li>
                          <li>Or remove the sales representative assignment</li>
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex gap-4 justify-center">
              <button
                className="px-6 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold transition-colors"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteUserId(null);
                  setDeleteUserInfo(null);
                  setDeleteError('');
                  setDeleteUserShops([]);
                }}
                disabled={deleteLoading}
              >
                Cancel
              </button>
              <button
                className="px-6 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold transition-colors disabled:opacity-60"
                onClick={handleDeleteUser}
                disabled={deleteLoading || !!deleteError}
              >
                {deleteLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
      
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
          </main>
        )}
        {currentTab === 'Audit History' && (
          <div className="bg-white rounded-2xl shadow-xl border border-[#f0f0f5] p-6 text-gray-700">
            <h2 className="text-lg font-semibold mb-4">Audit History</h2>
            <p>Audit log history will be displayed here.</p>
          </div>
        )}
        {currentTab === 'System Reports' && (
          <div className="bg-white rounded-2xl shadow-xl border border-[#f0f0f5] p-6 text-gray-700">
            <h2 className="text-lg font-semibold mb-4">System Reports</h2>
            <p>System reports will be implemented later.</p>
          </div>
        )}
        {currentTab === 'Settings' && (
          <div className="bg-white rounded-2xl shadow-xl border border-[#f0f0f5] p-6 text-gray-700">
            <h2 className="text-lg font-semibold mb-4">System Settings</h2>
            <p>System settings will be displayed here...</p>
    </div>
        )}
      </SuperAdminDashboard>
    );
  }
  if (user.role === 'admin') {
    return <AdminDashboard user={user} handleLogout={handleLogout} />;
  }
  if (user.role === 'representative') {
    return <SalesRepDashboard user={user} handleLogout={handleLogout} />;
  }
  return null;
}