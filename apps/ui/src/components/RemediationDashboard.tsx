import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';

interface RemediationAction {
  id: string;
  root_cause_category: string;
  root_cause_details?: string;
  action_type: 'ROLLBACK' | 'RESTART' | 'SCALE' | 'NOTIFY' | 'REQUEUE';
  action_parameters: Record<string, any>;
  confidence_threshold: 'HIGH' | 'MEDIUM' | 'LOW';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface RemediationLog {
  id: string;
  anomaly_id: string;
  action_id: string;
  execution_status: 'SUCCESS' | 'FAILED' | 'PARTIAL';
  execution_result: Record<string, any>;
  executed_at: string;
  executed_by: 'AUTOMATED' | 'MANUAL';
}

const RemediationDashboard: React.FC = () => {
  const [actions, setActions] = useState<RemediationAction[]>([]);
  const [logs, setLogs] = useState<RemediationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newAction, setNewAction] = useState<Omit<RemediationAction, 'id' | 'created_at' | 'updated_at'>>({
    root_cause_category: '',
    action_type: 'NOTIFY',
    action_parameters: {},
    confidence_threshold: 'HIGH',
    is_active: true
  });

  const supabase = createClient();

  useEffect(() => {
    fetchData();
    
    // Set up real-time subscriptions
    const actionsChannel = supabase
      .channel('remediation-actions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'remediation_actions',
        },
        (payload) => {
          fetchData();
        }
      )
      .subscribe();

    const logsChannel = supabase
      .channel('remediation-logs-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'remediation_logs',
        },
        (payload) => {
          fetchLogs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(actionsChannel);
      supabase.removeChannel(logsChannel);
    };
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch remediation actions
      const { data: actionsData, error: actionsError } = await supabase
        .from('remediation_actions')
        .select('*')
        .order('created_at', { ascending: false });

      if (actionsError) throw actionsError;

      setActions(actionsData || []);
      
      // Fetch logs
      await fetchLogs();
    } catch (err) {
      setError('Failed to fetch data');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const { data: logsData, error: logsError } = await supabase
        .from('remediation_logs')
        .select('*')
        .order('executed_at', { ascending: false })
        .limit(50);

      if (logsError) throw logsError;

      setLogs(logsData || []);
    } catch (err) {
      console.error('Error fetching logs:', err);
    }
  };

  const handleCreateAction = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { data, error } = await supabase
        .from('remediation_actions')
        .insert(newAction)
        .select()
        .single();

      if (error) throw error;

      setActions([data, ...actions]);
      setShowCreateForm(false);
      setNewAction({
        root_cause_category: '',
        action_type: 'NOTIFY',
        action_parameters: {},
        confidence_threshold: 'HIGH',
        is_active: true
      });
    } catch (err) {
      setError('Failed to create remediation action');
      console.error('Error creating action:', err);
    }
  };

  const handleDeleteAction = async (id: string) => {
    try {
      const { error } = await supabase
        .from('remediation_actions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setActions(actions.filter(action => action.id !== id));
    } catch (err) {
      setError('Failed to delete remediation action');
      console.error('Error deleting action:', err);
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const { data, error } = await supabase
        .from('remediation_actions')
        .update({ is_active: !isActive })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setActions(actions.map(action => 
        action.id === id ? { ...action, ...data } : action
      ));
    } catch (err) {
      setError('Failed to update remediation action');
      console.error('Error updating action:', err);
    }
  };

  const handleExecuteAction = async (id: string) => {
    try {
      const response = await fetch('/api/remediation/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action_id: id }),
      });

      if (!response.ok) {
        throw new Error('Failed to execute action');
      }

      const result = await response.json();
      console.log('Action executed:', result);
      
      // Refresh logs
      await fetchLogs();
    } catch (err) {
      setError('Failed to execute remediation action');
      console.error('Error executing action:', err);
    }
  };

  const getActionTypeColor = (type: string) => {
    switch (type) {
      case 'ROLLBACK':
        return 'bg-blue-100 text-blue-800';
      case 'RESTART':
        return 'bg-green-100 text-green-800';
      case 'SCALE':
        return 'bg-purple-100 text-purple-800';
      case 'NOTIFY':
        return 'bg-yellow-100 text-yellow-800';
      case 'REQUEUE':
        return 'bg-indigo-100 text-indigo-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'HIGH':
        return 'bg-green-100 text-green-800';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800';
      case 'LOW':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return 'bg-green-100 text-green-800';
      case 'FAILED':
        return 'bg-red-100 text-red-800';
      case 'PARTIAL':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-4">Remediation Dashboard</h2>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-4">Remediation Dashboard</h2>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Remediation Dashboard</h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          {showCreateForm ? 'Cancel' : 'Create Action'}
        </button>
      </div>

      {showCreateForm && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h3 className="text-lg font-medium mb-4">Create New Remediation Action</h3>
          <form onSubmit={handleCreateAction}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Root Cause Category</label>
                <input
                  type="text"
                  value={newAction.root_cause_category}
                  onChange={(e) => setNewAction({...newAction, root_cause_category: e.target.value})}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Action Type</label>
                <select
                  value={newAction.action_type}
                  onChange={(e) => setNewAction({...newAction, action_type: e.target.value as any})}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                >
                  <option value="ROLLBACK">Rollback</option>
                  <option value="RESTART">Restart</option>
                  <option value="SCALE">Scale</option>
                  <option value="NOTIFY">Notify</option>
                  <option value="REQUEUE">Requeue</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confidence Threshold</label>
                <select
                  value={newAction.confidence_threshold}
                  onChange={(e) => setNewAction({...newAction, confidence_threshold: e.target.value as any})}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                >
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={newAction.is_active}
                  onChange={(e) => setNewAction({...newAction, is_active: e.target.checked})}
                  className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                />
                <label className="ml-2 block text-sm text-gray-700">Active</label>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Action Parameters (JSON)</label>
              <textarea
                value={JSON.stringify(newAction.action_parameters, null, 2)}
                onChange={(e) => setNewAction({...newAction, action_parameters: JSON.parse(e.target.value)})}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 font-mono text-sm"
                rows={4}
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              >
                Create Action
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Remediation Actions */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Remediation Actions</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Confidence
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {actions.map((action) => (
                  <tr key={action.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{action.root_cause_category}</div>
                      {action.root_cause_details && (
                        <div className="text-sm text-gray-500">{action.root_cause_details}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getActionTypeColor(action.action_type)}`}>
                        {action.action_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getConfidenceColor(action.confidence_threshold)}`}>
                        {action.confidence_threshold}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {action.is_active ? (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          Active
                        </span>
                      ) : (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleToggleActive(action.id, action.is_active)}
                        className="text-indigo-600 hover:text-indigo-900 mr-3"
                      >
                        {action.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => handleExecuteAction(action.id)}
                        className="text-green-600 hover:text-green-900 mr-3"
                      >
                        Execute
                      </button>
                      <button
                        onClick={() => handleDeleteAction(action.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Remediation Logs */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Execution Logs</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Executed By
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.action_id.substring(0, 8)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(log.execution_status)}`}>
                        {log.execution_status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {log.executed_by}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(log.executed_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RemediationDashboard;