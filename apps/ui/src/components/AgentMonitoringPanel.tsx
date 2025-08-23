'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Agent {
  id: string;
  alias: string;
  status: 'IDLE' | 'BUSY';
  capabilities: string[];
  is_active: boolean;
  last_seen: string;
  created_at: string;
}

// Helper function to format time difference
const timeAgo = (date: string) => {
  const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + " years ago";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + " months ago";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + " days ago";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + " hours ago";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + " minutes ago";
  return Math.floor(seconds) + " seconds ago";
};

interface AgentMonitoringPanelProps {
  initialAgents: Agent[];
}

export default function AgentMonitoringPanel({ initialAgents }: AgentMonitoringPanelProps) {
  const [agents, setAgents] = useState<Agent[]>(initialAgents);

  // Handler for toggling agent activation
  const handleToggleActivation = async (agent: Agent) => {
    try {
      const response = await fetch(`/api/agents/${agent.id}/activation`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !agent.is_active }),
      });
      
      if (!response.ok) {
        console.error('Failed to toggle agent activation');
      }
      // Real-time subscription will handle the UI update automatically
    } catch (error) {
      console.error('Error toggling agent activation:', error);
    }
  };

  useEffect(() => {
    const channel = supabase
      .channel('realtime-agents')
      .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'agents' },
          async () => {
            // Refetch data on any change
            const { data } = await supabase
              .from('agents')
              .select('*')
              .order('last_seen', { ascending: false });
            setAgents(data || []);
          }
      )
      .subscribe();

    return () => { 
      supabase.removeChannel(channel); 
    };
  }, []);

  return (
    <div className="bg-gray-800 p-6 rounded-lg">
      <h2 className="text-2xl font-semibold mb-4">Agent Workforce (Live)</h2>
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {agents.length === 0 ? (
          <p className="text-gray-400 text-center py-4">No agents registered yet</p>
        ) : (
          agents.map(agent => (
            <div key={agent.id} className={`p-3 rounded-md ${
              agent.is_active ? 'bg-gray-700' : 'bg-gray-800 border-2 border-gray-600'
            }`}>
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center space-x-2">
                  <p className="font-semibold text-white">{agent.alias}</p>
                  {!agent.is_active && (
                    <span className="px-2 py-1 text-xs font-bold rounded-full bg-red-500 text-white">
                      INACTIVE
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-3">
                  <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                    agent.status === 'BUSY' ? 'bg-yellow-500 text-black' : 'bg-green-500 text-black'
                  }`}>
                    {agent.status}
                  </span>
                  {/* Activation Toggle Switch */}
                  <label className="inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={agent.is_active} 
                      onChange={() => handleToggleActivation(agent)} 
                      className="sr-only peer" 
                    />
                    <div className="relative w-11 h-6 bg-gray-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                </div>
              </div>
              <p className="text-xs text-gray-400">
                Last seen: {timeAgo(agent.last_seen)}
              </p>
              {agent.capabilities && agent.capabilities.length > 0 && (
                <div className="mt-2">
                  <div className="flex flex-wrap gap-1">
                    {agent.capabilities.map((capability, index) => (
                      <span 
                        key={index}
                        className="px-2 py-1 text-xs bg-blue-600 text-white rounded"
                      >
                        {capability}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}