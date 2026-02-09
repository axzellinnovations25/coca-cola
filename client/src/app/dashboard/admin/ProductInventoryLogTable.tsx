import React, { useState } from 'react';

interface Log {
  id: string;
  created_at: string;
  user_email?: string;
  user_role?: string;
  product_name?: string;
  action: string;
  details?: any;
}

function renderEditDiff(before: any, after: any) {
  const fields = ['name', 'description', 'unit_price', 'stock'];
  return (
    <div className="flex flex-col gap-2">
      <div className="font-semibold text-xs text-gray-500 mb-1">Before:</div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        {fields.map(field => (
          <div key={field} className={before[field] !== after[field] ? 'text-red-600 font-semibold' : ''}>
            <span className="font-medium text-gray-600">{field}:</span> <span className="text-gray-500">{before[field] ?? '-'}</span>
          </div>
        ))}
      </div>
      <div className="font-semibold text-xs text-gray-500 mt-2 mb-1">After:</div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        {fields.map(field => (
          <div key={field} className={before[field] !== after[field] ? 'text-green-600 font-semibold' : ''}>
            <span className="font-medium text-gray-600">{field}:</span> <span className="text-gray-500">{after[field] ?? '-'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const LOGS_PER_PAGE = 10;
const sortableCols = ['created_at', 'product_name', 'user_email', 'user_role', 'action'] as const;
type SortCol = typeof sortableCols[number];

export default function ProductInventoryLogTable({ logs }: { logs: Log[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortCol>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  if (!logs || logs.length === 0) {
    return <div className="text-gray-400 text-center py-8">No product inventory logs found.</div>;
  }

  // Filter logs by search
  const filteredLogs = logs.filter(log => {
    const q = search.toLowerCase();
    return (
      (log.product_name && log.product_name.toLowerCase().includes(q)) ||
      (log.user_email && log.user_email.toLowerCase().includes(q)) ||
      (log.action && log.action.toLowerCase().includes(q)) ||
      (log.details && JSON.stringify(log.details).toLowerCase().includes(q))
    );
  });

  // Sort logs
  function handleSort(col: SortCol) {
    if (sortBy === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
    setPage(1);
  }
  const sortedLogs = [...filteredLogs].sort((a, b) => {
    let aVal = a[sortBy];
    let bVal = b[sortBy];
    if (sortBy === 'created_at') {
      return sortDir === 'asc'
        ? new Date(aVal ?? '').getTime() - new Date(bVal ?? '').getTime()
        : new Date(bVal ?? '').getTime() - new Date(aVal ?? '').getTime();
    }
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return 0;
  });
  const totalPages = Math.ceil(sortedLogs.length / LOGS_PER_PAGE) || 1;
  const paginatedLogs = sortedLogs.slice((page - 1) * LOGS_PER_PAGE, page * LOGS_PER_PAGE);

  // Export CSV
  function exportCSV() {
    const rows = [
      ['Date', 'Product', 'User', 'Role', 'Action', 'Details'],
      ...sortedLogs.map(l => [
        l.created_at,
        l.product_name,
        l.user_email,
        l.user_role,
        l.action,
        JSON.stringify(l.details)
      ]),
    ];
    const csv = rows.map(row => row.map(String).map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'product_inventory_logs.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const handleCopy = (details: any, id: string) => {
    navigator.clipboard.writeText(JSON.stringify(details, null, 2));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1200);
  };

  return (
    <div className="overflow-x-auto">
      <div className="flex flex-col sm:flex-row gap-2 mb-4 items-center">
        <input
          type="text"
          placeholder="Search by product, user, action, or details..."
          className="w-full max-w-xs px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-300 text-gray-700 bg-gray-50"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
        />
        <button
          className="px-5 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold text-base shadow-md"
          onClick={exportCSV}
        >
          Export CSV
        </button>
      </div>
      <table className="min-w-full text-sm text-left">
        <thead>
          <tr className="bg-gray-50">
            <th className="px-4 py-2 font-semibold text-gray-600 cursor-pointer" onClick={() => handleSort('created_at')}>
              Date {sortBy === 'created_at' && (sortDir === 'asc' ? '▲' : '▼')}
            </th>
            <th className="px-4 py-2 font-semibold text-gray-600 cursor-pointer" onClick={() => handleSort('product_name')}>
              Product {sortBy === 'product_name' && (sortDir === 'asc' ? '▲' : '▼')}
            </th>
            <th className="px-4 py-2 font-semibold text-gray-600 cursor-pointer" onClick={() => handleSort('user_email')}>
              User {sortBy === 'user_email' && (sortDir === 'asc' ? '▲' : '▼')}
            </th>
            <th className="px-4 py-2 font-semibold text-gray-600 cursor-pointer" onClick={() => handleSort('user_role')}>
              Role {sortBy === 'user_role' && (sortDir === 'asc' ? '▲' : '▼')}
            </th>
            <th className="px-4 py-2 font-semibold text-gray-600 cursor-pointer" onClick={() => handleSort('action')}>
              Action {sortBy === 'action' && (sortDir === 'asc' ? '▲' : '▼')}
            </th>
            <th className="px-4 py-2 font-semibold text-gray-600">Details</th>
          </tr>
        </thead>
        <tbody>
          {paginatedLogs.map(log => {
            const isExpanded = expanded === log.id;
            return (
              <React.Fragment key={log.id}>
                <tr
                  className={`border-b last:border-0 text-gray-600 hover:bg-violet-50/30 transition-colors cursor-pointer ${isExpanded ? 'bg-violet-50/20' : ''}`}
                  onClick={() => setExpanded(isExpanded ? null : log.id)}
                  title="Click to expand/collapse details"
                >
                  <td className="px-4 py-2 text-xs text-gray-400">{new Date(String(log.created_at)).toLocaleString()}</td>
                  <td className="px-4 py-2">{log.product_name || '-'}</td>
                  <td className="px-4 py-2">{log.user_email || '-'}</td>
                  <td className="px-4 py-2 capitalize">{log.user_role || '-'}</td>
                  <td className="px-4 py-2">{log.action}</td>
                  <td className="px-4 py-2">
                    <span className="inline-block align-middle mr-2">{isExpanded ? '▼' : '▶'}</span>
                    <button
                      className="ml-2 px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-xs text-gray-600 border border-gray-200"
                      onClick={e => { e.stopPropagation(); handleCopy(log.details, log.id); }}
                      title="Copy details to clipboard"
                    >
                      {copiedId === log.id ? 'Copied!' : 'Copy'}
                    </button>
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="bg-gray-50">
                    <td colSpan={6} className="px-4 py-3">
                      {log.action === 'edit' && log.details && log.details.before && log.details.after ? (
                        renderEditDiff(log.details.before, log.details.after)
                      ) : (
                        <pre className="whitespace-pre-wrap break-all text-xs bg-gray-100 rounded p-3 border border-gray-200">
                          {log.details ? JSON.stringify(log.details, null, 2) : '-'}
                        </pre>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
      {/* Pagination Controls */}
      {totalPages > 1 && (
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
      )}
    </div>
  );
} 