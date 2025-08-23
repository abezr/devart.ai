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

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  required_capabilities: string[];
}

export default function TaskDetailModal({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const [task, setTask] = useState<Task | null>(null);
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'details' | 'audit' | 'workflow'>('details');
  const [editingCapabilities, setEditingCapabilities] = useState(false);
  const [newCapabilities, setNewCapabilities] = useState('');

  const updateTaskCapabilities = async () => {
    if (!task) return;
    
    // Parse capabilities from comma-separated string to array
    const capabilitiesArray = newCapabilities
      .split(',')
      .map(cap => cap.trim())
      .filter(cap => cap.length > 0);
    
    try {
      const response = await fetch(`/api/tasks/${task.id}/capabilities`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capabilities: capabilitiesArray }),
      });
      
      if (response.ok) {
        // Update local state
        setTask({ ...task, required_capabilities: capabilitiesArray });
        setEditingCapabilities(false);
      } else {
        console.error('Failed to update task capabilities');
      }
    } catch (error) {
      console.error('Error updating task capabilities:', error);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      // Fetch task details
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single();

      if (taskError) {
        console.error('Error fetching task details:', taskError);
      } else {
        setTask(taskData);
        setNewCapabilities(taskData.required_capabilities?.join(', ') || '');
      }
      
      // Fetch usage logs
      const { data: logsData, error: logsError } = await supabase
        .from('service_usage_log')
        .select(`
          id,
          charge_amount,
          created_at,
          service_registry ( display_name )
        `)
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });

      if (logsError) {
        console.error('Error fetching usage logs:', logsError);
      } else {
        setLogs(logsData || []);
      }
      
      setLoading(false);
    };

    fetchData();
  }, [taskId]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-semibold mb-4">Task Details</h2>
        
        {task && (
          <div className="mb-6 p-4 bg-gray-700 rounded-md">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-semibold">{task.title}</h3>
                <p className="text-gray-300 mt-2">{task.description}</p>
              </div>
              <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                task.status === 'TODO' ? 'bg-blue-500' : 
                task.status === 'IN_PROGRESS' ? 'bg-yellow-500 text-black' : 
                task.status === 'DONE' ? 'bg-green-500' : 
                'bg-red-500'
              }`}>
                {task.status}
              </span>
            </div>
            
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <div>
                <span className="text-sm text-gray-400">Priority:</span>
                <span className="ml-2 px-2 py-1 bg-gray-600 rounded text-sm">{task.priority}</span>
              </div>
              
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Required Capabilities:</span>
                  <button 
                    onClick={() => {
                      setEditingCapabilities(!editingCapabilities);
                      setNewCapabilities(task.required_capabilities?.join(', ') || '');
                    }}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    {editingCapabilities ? 'Cancel' : 'Edit'}
                  </button>
                </div>
                
                {editingCapabilities ? (
                  <div className="mt-2 flex">
                    <input
                      type="text"
                      value={newCapabilities}
                      onChange={(e) => setNewCapabilities(e.target.value)}
                      placeholder="e.g., python, code-review, testing"
                      className="flex-1 bg-gray-600 border border-gray-500 rounded-l py-1 px-2 text-sm"
                    />
                    <button
                      onClick={updateTaskCapabilities}
                      className="bg-blue-600 hover:bg-blue-700 text-white py-1 px-3 rounded-r text-sm"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <div className="mt-2">
                    {task.required_capabilities && task.required_capabilities.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {task.required_capabilities.map((capability, index) => (
                          <span key={index} className="px-2 py-1 text-xs bg-blue-600 text-white rounded">
                            {capability}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500">No specific capabilities required</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        <div className="mb-4 border-b border-gray-700">
          <button
            className={`px-4 py-2 font-medium ${activeTab === 'details' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400'}`}
            onClick={() => setActiveTab('details')}
          >
            Task Details
          </button>
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

        {activeTab === 'details' ? (
          <div className="max-h-96 overflow-y-auto">
            {/* Task details are shown above the tabs */}
            <p className="text-gray-400 text-center py-4">Task details are displayed above</p>
          </div>
        ) : activeTab === 'audit' ? (
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