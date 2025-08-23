'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Service {
  id: string;
  display_name: string;
  monthly_budget_usd: number;
  current_usage_usd: number;
  status: 'ACTIVE' | 'SUSPENDED';
  substitutor_service_id: string | null;
  created_at: string;
}

export default function ServiceStatusPanel({ initialServices }: { initialServices: Service[] }) {
  const [services, setServices] = useState(initialServices);
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    const channel = supabase
      .channel('realtime-services')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'service_registry' },
        async () => {
          // Refetch all services on any change
          const { data } = await supabase.from('service_registry').select('*');
          setServices(data || []);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleIncreaseBudget = async (serviceId: string) => {
    const amountStr = prompt('Enter amount to increase budget by (e.g., 50):');
    if (!amountStr) return;
    
    const increaseAmount = parseFloat(amountStr);
    if (isNaN(increaseAmount) || increaseAmount <= 0) {
      alert('Please enter a valid positive number.');
      return;
    }

    setLoading(serviceId);
    try {
      // NOTE: In a real app, the API URL would come from an environment variable.
      const response = await fetch(`/api/services/${serviceId}/increase-budget`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ increaseAmount }),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(`Error: ${error.error || 'Failed to increase budget'}`);
      }
      // The real-time listener will automatically update the UI.
    } catch (err) {
      console.error('Error increasing budget:', err);
      alert('Failed to increase budget. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="bg-gray-800 p-6 rounded-lg">
      <h2 className="text-2xl font-semibold mb-4">Service Status (Live)</h2>
      <div className="space-y-4">
        {services.map((service) => {
          const usagePercent = service.monthly_budget_usd > 0
            ? (service.current_usage_usd / service.monthly_budget_usd) * 100
            : 0;
          const isSuspended = service.status === 'SUSPENDED';

          return (
            <div 
              key={service.id} 
              className={`bg-gray-700 p-4 rounded-md border-l-4 ${
                isSuspended ? 'border-red-500' : 'border-green-500'
              }`}
            >
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">{service.display_name}</h3>
                <button
                  onClick={() => handleIncreaseBudget(service.id)}
                  disabled={loading === service.id}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-1 px-2 rounded disabled:opacity-50"
                >
                  {loading === service.id ? '...' : '+ Budget'}
                </button>
              </div>
              <p className="text-sm text-gray-400">
                Usage: ${service.current_usage_usd.toFixed(2)} / ${service.monthly_budget_usd.toFixed(2)}
              </p>
              <div className="w-full bg-gray-600 rounded-full h-2.5 mt-2">
                <div
                  className={`${isSuspended ? 'bg-red-600' : 'bg-green-600'} h-2.5 rounded-full`}
                  style={{ width: `${Math.min(usagePercent, 100)}%` }}
                ></div>
              </div>
              {isSuspended && (
                <p className="text-red-400 text-xs mt-1 font-semibold">SUSPENDED</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}