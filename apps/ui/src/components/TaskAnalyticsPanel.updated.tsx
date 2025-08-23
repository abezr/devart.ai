'use client';

import { useEffect, useState } from 'react';
import GrafanaPanel from './GrafanaPanel';

interface TaskCost {
  task_id: string;
  task_title: string;
  task_status: string;
  task_priority: string;
  usage_count: number;
  total_cost: number;
  task_created_at: string;
}

interface ServiceUsage {
  service_id: string;
  usage_count: number;
  total_cost: number;
  avg_cost: number;
  last_used: string;
}

export default function TaskAnalyticsPanel() {
  const [taskCosts, setTaskCosts] = useState<TaskCost[]>([]);
  const [serviceUsage, setServiceUsage] = useState<ServiceUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'tasks' | 'services' | 'grafana'>('tasks');

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch both task costs and service usage data in parallel
        const [taskResponse, serviceResponse] = await Promise.all([
          fetch('/api/analytics/task-costs'),
          fetch('/api/analytics/service-usage')
        ]);

        if (!taskResponse.ok || !serviceResponse.ok) {
          throw new Error('Failed to fetch analytics data');
        }

        const [taskData, serviceData] = await Promise.all([
          taskResponse.json(),
          serviceResponse.json()
        ]);

        setTaskCosts(taskData || []);
        setServiceUsage(serviceData || []);
      } catch (err) {
        console.error('Error fetching analytics:', err);
        setError('Failed to load analytics data');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toUpperCase()) {
      case 'CRITICAL': return 'text-red-400';
      case 'HIGH': return 'text-orange-400';
      case 'MEDIUM': return 'text-yellow-400';
      case 'LOW': return 'text-green-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'DONE': return 'text-green-400';
      case 'IN_PROGRESS': return 'text-blue-400';
      case 'TODO': return 'text-gray-400';
      case 'QUARANTINED': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const totalTaskCosts = taskCosts.reduce((sum, task) => sum + task.total_cost, 0);
  const totalUsageCount = taskCosts.reduce((sum, task) => sum + task.usage_count, 0);

  return (
    <div className="bg-gray-800 p-6 rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold text-white">Cost Analytics</h2>
        {!loading && !error && activeTab !== 'grafana' && (
          <div className="text-right">
            <p className="text-sm text-gray-400">Total Spent</p>
            <p className="text-xl font-bold text-green-400">{formatCurrency(totalTaskCosts)}</p>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex mb-4 border-b border-gray-700">
        <button
          onClick={() => setActiveTab('tasks')}
          className={`px-4 py-2 font-medium text-sm transition-colors ${
            activeTab === 'tasks'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Tasks ({taskCosts.length})
        </button>
        <button
          onClick={() => setActiveTab('services')}
          className={`px-4 py-2 font-medium text-sm transition-colors ml-4 ${
            activeTab === 'services'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Services ({serviceUsage.length})
        </button>
        {/* Add Grafana tab */}
        <button
          onClick={() => setActiveTab('grafana')}
          className={`px-4 py-2 font-medium text-sm transition-colors ml-4 ${
            activeTab === 'grafana'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Dashboards
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
          <span className="ml-2 text-gray-400">Loading analytics...</span>
        </div>
      ) : error ? (
        <div className="text-center py-8">
          <p className="text-red-400 mb-2">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-blue-400 hover:text-blue-300 text-sm underline"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {activeTab === 'tasks' ? (
            taskCosts.length === 0 ? (
              <p className="text-gray-400 text-center py-4">No cost data available for tasks.</p>
            ) : (
              taskCosts.map((task) => (
                <div key={task.task_id} className="bg-gray-700 p-4 rounded-md hover:bg-gray-650 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-white text-sm leading-tight">{task.task_title}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className={`text-xs px-2 py-1 rounded ${getPriorityColor(task.task_priority)} bg-gray-600`}>
                          {task.task_priority}
                        </span>
                        <span className={`text-xs ${getStatusColor(task.task_status)}`}>
                          {task.task_status}
                        </span>
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-lg font-bold text-green-400">{formatCurrency(task.total_cost)}</p>
                      <p className="text-xs text-gray-400">{task.usage_count} calls</p>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    Created: {formatDate(task.task_created_at)}
                  </div>
                </div>
              ))
            )
          ) : activeTab === 'services' ? (
            serviceUsage.length === 0 ? (
              <p className="text-gray-400 text-center py-4">No service usage data available.</p>
            ) : (
              serviceUsage.map((service) => (
                <div key={service.service_id} className="bg-gray-700 p-4 rounded-md hover:bg-gray-650 transition-colors">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-semibold text-white">{service.service_id}</h3>
                      <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                        <span>{service.usage_count} calls</span>
                        <span>Avg: {formatCurrency(service.avg_cost)}</span>
                        <span>Last: {formatDate(service.last_used)}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-green-400">{formatCurrency(service.total_cost)}</p>
                    </div>
                  </div>
                </div>
              ))
            )
          ) : (
            /* Add Grafana panel content */
            <div className="space-y-6">
              <GrafanaPanel 
                dashboardId="task-analytics" 
                panelId="1" 
                title="Task Throughput" 
              />
              <GrafanaPanel 
                dashboardId="agent-status" 
                panelId="2" 
                title="Agent Status" 
              />
              <GrafanaPanel 
                dashboardId="task-cost" 
                panelId="3" 
                title="Average Task Cost" 
              />
            </div>
          )}
        </div>
      )}

      {/* Summary Footer */}
      {!loading && !error && activeTab !== 'grafana' && (taskCosts.length > 0 || serviceUsage.length > 0) && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-gray-400">Total Tasks</p>
              <p className="text-lg font-semibold text-white">{taskCosts.length}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">API Calls</p>
              <p className="text-lg font-semibold text-white">{totalUsageCount}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Avg Cost/Task</p>
              <p className="text-lg font-semibold text-white">
                {taskCosts.length > 0 ? formatCurrency(totalTaskCosts / taskCosts.length) : '$0.00'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}