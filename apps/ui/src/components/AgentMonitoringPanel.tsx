'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Agent {
  id: string;
  alias: string;
  status: 'IDLE' | 'BUSY';
  capabilities: string[];
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
            <div key={agent.id} className="bg-gray-700 p-3 rounded-md">
              <div className="flex justify-between items-center">
                <p className="font-semibold text-white">{agent.alias}</p>
                <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                  agent.status === 'BUSY' ? 'bg-yellow-500 text-black' : 'bg-green-500 text-black'
                }`}>
                  {agent.status}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
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