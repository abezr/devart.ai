'use client';

import { useState } from 'react';

interface MarketplaceItem {
  id: string;
  item_type: 'agent' | 'workflow';
  name: string;
  description: string | null;
  version: string;
  publisher_id: string;
  tags: string[] | null;
  repository_url: string | null;
  created_at: string;
}

interface MarketplaceItemCardProps {
  item: MarketplaceItem;
}

export default function MarketplaceItemCard({ item }: MarketplaceItemCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getTypeColor = (type: string) => {
    return type === 'agent' 
      ? 'bg-purple-600 text-purple-100' 
      : 'bg-blue-600 text-blue-100';
  };

  return (
    <>
      <div 
        className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden hover:border-blue-500 transition cursor-pointer"
        onClick={() => setIsModalOpen(true)}
      >
        <div className="p-5">
          <div className="flex justify-between items-start mb-3">
            <h3 className="text-xl font-bold text-white truncate">{item.name}</h3>
            <span className={`text-xs px-2 py-1 rounded-full ${getTypeColor(item.item_type)}`}>
              {item.item_type}
            </span>
          </div>
          
          <p className="text-gray-400 text-sm mb-4 line-clamp-2">
            {item.description || 'No description available'}
          </p>
          
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-500">v{item.version}</span>
            <span className="text-gray-500">{formatDate(item.created_at)}</span>
          </div>
          
          {item.tags && item.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {item.tags.slice(0, 3).map((tag, index) => (
                <span 
                  key={index} 
                  className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded"
                >
                  {tag}
                </span>
              ))}
              {item.tags.length > 3 && (
                <span className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded">
                  +{item.tags.length - 3} more
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div 
            className="bg-gray-800 rounded-lg border border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold text-white">{item.name}</h2>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
              
              <div className="flex items-center gap-3 mb-6">
                <span className={`text-sm px-3 py-1 rounded-full ${getTypeColor(item.item_type)}`}>
                  {item.item_type}
                </span>
                <span className="text-gray-400">Version {item.version}</span>
                <span className="text-gray-400">•</span>
                <span className="text-gray-400">{formatDate(item.created_at)}</span>
              </div>
              
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-white mb-2">Description</h3>
                <p className="text-gray-300">
                  {item.description || 'No description available'}
                </p>
              </div>
              
              {item.tags && item.tags.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-white mb-2">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {item.tags.map((tag, index) => (
                      <span 
                        key={index} 
                        className="bg-gray-700 text-gray-300 px-3 py-1 rounded-full text-sm"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {item.repository_url && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-white mb-2">Repository</h3>
                  <a 
                    href={item.repository_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 underline break-all"
                  >
                    {item.repository_url}
                  </a>
                </div>
              )}
              
              <div className="flex justify-end">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
