'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import WorkflowVisualizer from './WorkflowVisualizer';

interface UsageLog {
  id: string;
  charge_amount: number;
  created_at: string;
  service_registry: any;
}

export default function TaskDetailModal({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'audit' | 'workflow'>('audit');

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('service_usage_log')
        .select(`
          id,
          charge_amount,
          created_at,
          service_registry ( display_name )
        `)
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching usage logs:', error);
      } else {
        setLogs(data || []);
      }
      setLoading(false);
    };

    fetchLogs();
  }, [taskId]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-semibold mb-4">Task Details</h2>
        
        <div className="mb-4 border-b border-gray-700">
          <button
            className={`px-4 py-2 font-medium ${activeTab === 'audit' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400'}`}
            onClick={() => setActiveTab('audit')}
          >
            Audit Log
          </button>
          <button
            className={`px-4 py-2 font-medium ${activeTab === 'workflow' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400'}`}
            onClick={() => setActiveTab('workflow')}
          >
            Workflow Visualization
          </button>
        </div>

        {activeTab === 'audit' ? (
          loading ? <p>Loading history...</p> : (
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-600">
                    <th className="p-2">Service Used</th>
                    <th className="p-2">Cost</th>
                    <th className="p-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 ? (
                    <tr><td colSpan={3} className="p-4 text-center text-gray-400">No usage history for this task.</td></tr>
                  ) : (
                    logs.map(log => (
                      <tr key={log.id} className="border-b border-gray-700">
                        <td className="p-2">{log.service_registry?.display_name || 'Unknown Service'}</td>
                        <td className="p-2">${log.charge_amount.toFixed(2)}</td>
                        <td className="p-2 text-sm text-gray-400">{new Date(log.created_at).toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <div className="max-h-96 overflow-y-auto">
            <WorkflowVisualizer taskId={taskId} />
          </div>
        )}
      </div>
    </div>
  );
}