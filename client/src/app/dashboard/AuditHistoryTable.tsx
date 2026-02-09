import React, { useState } from 'react';

interface Log {
  id: string;
  created_at: string;
  creator_email?: string;
  creator_role?: string;
  action: string;
  details?: any;
}

function renderEditDiff(before: any, after: any) {
  const fields = [
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role' },
    { key: 'first_name', label: 'First Name' },
    { key: 'last_name', label: 'Last Name' },
    { key: 'nic_no', label: 'NIC No' },
    { key: 'phone_no', label: 'Phone No' }
  ];
  
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Before Section */}
        <div className="bg-red-50 rounded-lg p-4 border border-red-200">
          <div className="flex items-center mb-3">
            <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
            <h4 className="font-semibold text-red-800 text-sm">Previous Values</h4>
          </div>
          <div className="space-y-2">
            {fields.map(field => (
              <div key={field.key} className={`text-sm ${before[field.key] !== after[field.key] ? 'text-red-700 font-medium' : 'text-gray-600'}`}>
                <span className="font-medium text-gray-700">{field.label}:</span>
                <span className="ml-2">{before[field.key] || '-'}</span>
              </div>
            ))}
          </div>
        </div>
        
        {/* After Section */}
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <div className="flex items-center mb-3">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
            <h4 className="font-semibold text-green-800 text-sm">Updated Values</h4>
          </div>
          <div className="space-y-2">
            {fields.map(field => (
              <div key={field.key} className={`text-sm ${before[field.key] !== after[field.key] ? 'text-green-700 font-medium' : 'text-gray-600'}`}>
                <span className="font-medium text-gray-700">{field.label}:</span>
                <span className="ml-2">{after[field.key] || '-'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Summary of Changes */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <h5 className="font-semibold text-gray-800 text-sm mb-2">Summary of Changes:</h5>
        <div className="space-y-1">
          {fields.map(field => {
            if (before[field.key] !== after[field.key]) {
              return (
                <div key={field.key} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                  <span className="font-medium">{field.label}</span>: "{before[field.key] || '-'}" → "{after[field.key] || '-'}"
                </div>
              );
            }
            return null;
          })}
        </div>
      </div>
    </div>
  );
}

function renderGenericDetails(details: any) {
  if (!details) return <div className="text-gray-500 text-sm">No details available</div>;
  
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
      <div className="space-y-3">
        {Object.entries(details).map(([key, value]) => (
          <div key={key} className="border-b border-gray-100 pb-2 last:border-b-0">
            <div className="font-medium text-gray-700 text-sm capitalize mb-1">
              {key.replace(/_/g, ' ')}:
            </div>
            <div className="text-sm text-gray-800">
              {typeof value === 'object' ? (
                <pre className="whitespace-pre-wrap text-xs bg-gray-50 rounded p-2 border">
                  {JSON.stringify(value, null, 2)}
                </pre>
              ) : (
                <span className="break-all">{String(value)}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AuditHistoryTable({ logs }: { logs: Log[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!logs || logs.length === 0) {
    return <div className="text-gray-400 text-center py-8">No audit logs found.</div>;
  }

  const handleCopy = (details: any, id: string) => {
    navigator.clipboard.writeText(JSON.stringify(details, null, 2));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1200);
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm text-left bg-white rounded-lg border border-gray-200 shadow-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="px-4 py-3 font-semibold text-gray-700">Date</th>
            <th className="px-4 py-3 font-semibold text-gray-700">User</th>
            <th className="px-4 py-3 font-semibold text-gray-700">Role</th>
            <th className="px-4 py-3 font-semibold text-gray-700">Action</th>
            <th className="px-4 py-3 font-semibold text-gray-700">Details</th>
          </tr>
        </thead>
        <tbody>
          {logs.map(log => {
            let user = log.creator_email;
            let role = log.creator_role;
            if ((!user || user === '-') && log.details && typeof log.details === 'object') {
              user = log.details.email || '-';
            }
            if ((!role || role === '-') && log.details && typeof log.details === 'object') {
              role = log.details.role || '-';
            }
            const isExpanded = expanded === log.id;
            return (
              <React.Fragment key={log.id}>
                <tr
                  className={`border-b border-gray-100 text-gray-700 hover:bg-violet-50/30 transition-colors cursor-pointer ${isExpanded ? 'bg-violet-50/20' : ''}`}
                  onClick={() => setExpanded(isExpanded ? null : log.id)}
                  title="Click to expand/collapse details"
                >
                  <td className="px-4 py-3 text-xs text-gray-500 font-mono">{log.created_at ? new Date(log.created_at).toLocaleString() : '-'}</td>
                  <td className="px-4 py-3 font-medium">{user || '-'}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 capitalize">
                      {role || '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {log.action.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center">
                      <span className="inline-block align-middle mr-2 text-gray-400">{isExpanded ? '▼' : '▶'}</span>
                      <button
                        className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-xs text-gray-600 border border-gray-200 transition-colors"
                        onClick={e => { e.stopPropagation(); handleCopy(log.details, log.id); }}
                        title="Copy details to clipboard"
                      >
                        {copiedId === log.id ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="bg-gray-50">
                    <td colSpan={5} className="px-4 py-4">
                      {log.action === 'edit_user' && log.details && log.details.before && log.details.after ? (
                        renderEditDiff(log.details.before, log.details.after)
                      ) : (
                        renderGenericDetails(log.details)
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
} 