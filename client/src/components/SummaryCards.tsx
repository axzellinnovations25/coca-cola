import React from 'react';

interface SummaryCardsProps {
  adminCount: number;
  repCount: number;
  systemHealth: string;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({ adminCount, repCount, systemHealth }) => (
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
    <div className="bg-white rounded-xl shadow border p-6 flex flex-col items-start">
      <span className="text-gray-500 text-sm mb-1">Total Admins</span>
      <span className="text-3xl font-bold text-violet-700">{adminCount}</span>
      <span className="text-xs text-gray-400 mt-1">Active administrators</span>
    </div>
    <div className="bg-white rounded-xl shadow border p-6 flex flex-col items-start">
      <span className="text-gray-500 text-sm mb-1">Total Sales Reps</span>
      <span className="text-3xl font-bold text-violet-700">{repCount}</span>
      <span className="text-xs text-gray-400 mt-1">Active sales representatives</span>
    </div>
    <div className="bg-white rounded-xl shadow border p-6 flex flex-col items-start">
      <span className="text-gray-500 text-sm mb-1">System Health</span>
      <span className="text-2xl font-bold text-green-600">{systemHealth}</span>
      <span className="text-xs text-gray-400 mt-1">All systems operational</span>
    </div>
  </div>
);

export default SummaryCards; 