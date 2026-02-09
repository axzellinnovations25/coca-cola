import React, { useState } from 'react';

interface Log {
  id: string;
  created_at: string;
  sales_rep_email?: string;
  sales_rep_first_name?: string;
  sales_rep_last_name?: string;
  sales_rep_role?: string;
  shop_name?: string;
  payment_amount?: number;
  payment_notes?: string;
  order_total?: number;
  action: string;
  details?: any;
}

function renderPaymentDetails(details: any) {
  if (!details) return <div className="text-gray-400">No details available</div>;
  
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="font-semibold text-gray-600">Payment Amount:</span>
          <span className="ml-2 text-gray-800 font-bold">{details.amount ? `${Number(details.amount).toFixed(2)} LKR` : '-'}</span>
        </div>
        <div>
          <span className="font-semibold text-gray-600">Order Total:</span>
          <span className="ml-2 text-gray-800">{details.order_total ? `${Number(details.order_total).toFixed(2)} LKR` : '-'}</span>
        </div>
        <div>
          <span className="font-semibold text-gray-600">Previously Collected:</span>
          <span className="ml-2 text-gray-800">{details.previous_collected ? `${Number(details.previous_collected).toFixed(2)} LKR` : '-'}</span>
        </div>
        <div>
          <span className="font-semibold text-gray-600">New Outstanding Amount:</span>
          <span className="ml-2 text-gray-800 font-semibold">{details.new_outstanding ? `${Number(details.new_outstanding).toFixed(2)} LKR` : '-'}</span>
        </div>
        <div className="col-span-2">
          <span className="font-semibold text-gray-600">Notes(Others):</span>
          <span className="ml-2 text-gray-800">{details.notes || '-'}</span>
        </div>
      </div>
    </div>
  );
}

const LOGS_PER_PAGE = 10;
const sortableCols = ['created_at', 'shop_name', 'sales_rep_email', 'sales_rep_role', 'action'] as const;
type SortCol = typeof sortableCols[number];

export default function PaymentLogTable({ logs }: { logs: Log[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortCol>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Debug: Log the first log entry to see data structure
  React.useEffect(() => {
    if (logs && logs.length > 0) {
      console.log('First payment log entry:', logs[0]);
      console.log('payment_amount type:', typeof logs[0].payment_amount);
      console.log('payment_amount value:', logs[0].payment_amount);
      console.log('order_total type:', typeof logs[0].order_total);
      console.log('order_total value:', logs[0].order_total);
    }
  }, [logs]);

  if (!logs || logs.length === 0) {
    return <div className="text-gray-400 text-center py-8">No payment logs found.</div>;
  }

  // Filter logs by search
  const filteredLogs = logs.filter(log => {
    const q = search.toLowerCase();
    return (
      (log.shop_name && log.shop_name.toLowerCase().includes(q)) ||
      (log.sales_rep_email && log.sales_rep_email.toLowerCase().includes(q)) ||
      (log.sales_rep_first_name && log.sales_rep_first_name.toLowerCase().includes(q)) ||
      (log.sales_rep_last_name && log.sales_rep_last_name.toLowerCase().includes(q)) ||
      (log.action && log.action.toLowerCase().includes(q)) ||
      (log.payment_notes && log.payment_notes.toLowerCase().includes(q)) ||
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
      ['Date', 'Shop', 'Sales Representative', 'Role', 'Action', 'Payment Amount', 'Order Total', 'Notes', 'Details'],
      ...sortedLogs.map(l => [
        l.created_at,
        l.shop_name || '-',
        `${l.sales_rep_first_name || ''} ${l.sales_rep_last_name || ''}`.trim() || l.sales_rep_email || '-',
        l.sales_rep_role || '-',
        l.action,
        l.payment_amount ? `${Number(l.payment_amount).toFixed(2)} LKR` : '-',
        l.order_total ? `${Number(l.order_total).toFixed(2)} LKR` : '-',
        l.payment_notes || '-',
        JSON.stringify(l.details)
      ]),
    ];
    const csv = rows.map(row => row.map(String).map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'payment_logs.csv';
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
          placeholder="Search by shop, representative, action, notes, or details..."
          className="w-full max-w-xs px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-300 text-gray-700 bg-gray-50"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
        />
        <button
          className="px-5 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold text-base shadow-md transition-colors"
          onClick={exportCSV}
        >
          Export CSV
        </button>
      </div>
      <table className="min-w-full text-sm text-left">
        <thead>
          <tr className="bg-gray-50">
            <th className="px-4 py-2 font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('created_at')}>
              Date {sortBy === 'created_at' && (sortDir === 'asc' ? '▲' : '▼')}
            </th>
            <th className="px-4 py-2 font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('shop_name')}>
              Shop {sortBy === 'shop_name' && (sortDir === 'asc' ? '▲' : '▼')}
            </th>
            <th className="px-4 py-2 font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('sales_rep_email')}>
              Sales Representative {sortBy === 'sales_rep_email' && (sortDir === 'asc' ? '▲' : '▼')}
            </th>
            <th className="px-4 py-2 font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('sales_rep_role')}>
              Role {sortBy === 'sales_rep_role' && (sortDir === 'asc' ? '▲' : '▼')}
            </th>
            <th className="px-4 py-2 font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('action')}>
              Action {sortBy === 'action' && (sortDir === 'asc' ? '▲' : '▼')}
            </th>
            <th className="px-4 py-2 font-semibold text-gray-600">Payment Amount</th>
            <th className="px-4 py-2 font-semibold text-gray-600">Order Total</th>
            <th className="px-4 py-2 font-semibold text-gray-600">Notes</th>
            <th className="px-4 py-2 font-semibold text-gray-600">Details</th>
          </tr>
        </thead>
        <tbody>
          {paginatedLogs.map(log => {
            const isExpanded = expanded === log.id;
            const repName = `${log.sales_rep_first_name || ''} ${log.sales_rep_last_name || ''}`.trim() || log.sales_rep_email || '-';
            return (
              <React.Fragment key={log.id}>
                <tr
                  className={`border-b last:border-0 text-gray-600 hover:bg-violet-50/30 transition-colors cursor-pointer ${isExpanded ? 'bg-violet-50/20' : ''}`}
                  onClick={() => setExpanded(isExpanded ? null : log.id)}
                  title="Click to expand/collapse details"
                >
                  <td className="px-4 py-2 text-xs text-gray-400">{new Date(String(log.created_at)).toLocaleString()}</td>
                  <td className="px-4 py-2 font-medium">{log.shop_name || '-'}</td>
                  <td className="px-4 py-2">{repName}</td>
                  <td className="px-4 py-2 capitalize">{log.sales_rep_role || '-'}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      log.action === 'record' ? 'bg-green-100 text-green-700' :
                      log.action === 'edit' ? 'bg-blue-100 text-blue-700' :
                      log.action === 'delete' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-semibold text-green-700">{log.payment_amount ? `${Number(log.payment_amount).toFixed(2)} LKR` : '-'}</td>
                  <td className="px-4 py-2 font-semibold">{log.order_total ? `${Number(log.order_total).toFixed(2)} LKR` : '-'}</td>
                  <td className="px-4 py-2 text-xs text-gray-500 max-w-32 truncate" title={log.payment_notes || '-'}>
                    {log.payment_notes || '-'}
                  </td>
                  <td className="px-4 py-2">
                    <span className="inline-block align-middle mr-2">{isExpanded ? '▼' : '▶'}</span>
                    <button
                      className="ml-2 px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-xs text-gray-600 border border-gray-200 transition-colors"
                      onClick={e => { e.stopPropagation(); handleCopy(log.details, log.id); }}
                      title="Copy details to clipboard"
                    >
                      {copiedId === log.id ? 'Copied!' : 'Copy'}
                    </button>
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="bg-gray-50">
                    <td colSpan={9} className="px-4 py-3">
                      {log.action === 'record' ? (
                        renderPaymentDetails(log.details)
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