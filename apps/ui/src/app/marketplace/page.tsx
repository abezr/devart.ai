'use client';

import { useEffect, useState } from 'react';
import MarketplaceItemCard from '../../components/MarketplaceItemCard';
import { supabase } from '../../lib/supabase';

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

export default function MarketplacePage() {
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<MarketplaceItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'agent' | 'workflow'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchItems = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('marketplace_items')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          throw new Error(error.message);
        }

        setItems(data || []);
        setFilteredItems(data || []);
      } catch (err) {
        setError('Failed to fetch marketplace items');
        console.error('Error fetching marketplace items:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchItems();
  }, []);

  useEffect(() => {
    let result = items;

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(item => 
        item.name.toLowerCase().includes(term) || 
        (item.description && item.description.toLowerCase().includes(term)) ||
        (item.tags && item.tags.some(tag => tag.toLowerCase().includes(term)))
      );
    }

    // Apply type filter
    if (filterType !== 'all') {
      result = result.filter(item => item.item_type === filterType);
    }

    setFilteredItems(result);
  }, [searchTerm, filterType, items]);

  if (loading) {
    return (
      <div className="container mx-auto p-8">
        <h1 className="text-4xl font-bold mb-8">Agent & Workflow Marketplace</h1>
        <p>Loading marketplace items...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-8">
        <h1 className="text-4xl font-bold mb-8">Agent & Workflow Marketplace</h1>
        <div className="bg-red-900 border border-red-700 rounded p-4">
          <p className="text-red-200">Error: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-4xl font-bold mb-8">Agent & Workflow Marketplace</h1>
      
      <div className="mb-6">
        <input 
          type="text" 
          placeholder="Search by name, description, or tags..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-3 rounded bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="mb-6 flex space-x-4">
        <button 
          onClick={() => setFilterType('all')}
          className={`px-4 py-2 rounded ${filterType === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
        >
          All Items
        </button>
        <button 
          onClick={() => setFilterType('agent')}
          className={`px-4 py-2 rounded ${filterType === 'agent' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
        >
          Agents
        </button>
        <button 
          onClick={() => setFilterType('workflow')}
          className={`px-4 py-2 rounded ${filterType === 'workflow' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
        >
          Workflows
        </button>
      </div>

      {filteredItems.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 text-lg">
            {items.length === 0 
              ? 'No marketplace items available yet.' 
              : 'No items match your search criteria.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map(item => (
            <MarketplaceItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}