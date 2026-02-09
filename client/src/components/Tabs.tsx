import React from 'react';

interface TabsProps {
  tabs: string[];
  currentTab: string;
  onTabChange: (tab: string) => void;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, currentTab, onTabChange }) => {
  return (
    <nav className="w-full border-b border-gray-200 mb-6">
      <ul className="flex flex-wrap gap-2 sm:gap-4 overflow-x-auto">
        {tabs.map(tab => (
          <li key={tab}>
            <button
              className={`px-4 py-2 rounded-t-lg font-semibold transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-violet-300 ${
                currentTab === tab
                  ? 'bg-white border-x border-t border-b-0 border-violet-600 text-violet-700 shadow-sm'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
              onClick={() => onTabChange(tab)}
              aria-current={currentTab === tab ? 'page' : undefined}
            >
              {tab}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
};
export default Tabs; 