'use client';

import { useEffect, useState } from 'react';

interface Workflow {
  id: string;
  name: string;
  description: string | null;
}

interface TaskTemplate {
  id: string;
  workflow_id: string;
  stage_order: number;
  title_template: string;
  description_template: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

interface WorkflowFormData {
  name: string;
  description: string;
}

interface TaskTemplateFormData {
  workflow_id: string;
  stage_order: number;
  title_template: string;
  description_template: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

interface TriggerWorkflowFormData {
  [key: string]: string;
}

export default function WorkflowManagementPanel() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [taskTemplates, setTaskTemplates] = useState<TaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'templates'>('list');
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [triggerFormData, setTriggerFormData] = useState<TriggerWorkflowFormData>({});
  
  // Form states
  const [workflowFormData, setWorkflowFormData] = useState<WorkflowFormData>({ name: '', description: '' });
  const [taskTemplateFormData, setTaskTemplateFormData] = useState<TaskTemplateFormData>({
    workflow_id: '',
    stage_order: 1,
    title_template: '',
    description_template: '',
    priority: 'MEDIUM'
  });

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const fetchWorkflows = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/workflows');
      if (!response.ok) {
        throw new Error('Failed to fetch workflows');
      }
      
      const data = await response.json();
      setWorkflows(data || []);
    } catch (err) {
      console.error('Error fetching workflows:', err);
      setError('Failed to load workflows');
    } finally {
      setLoading(false);
    }
  };

  const fetchTaskTemplates = async (workflowId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/workflows/${workflowId}/templates`);
      if (!response.ok) {
        throw new Error('Failed to fetch task templates');
      }
      
      const data = await response.json();
      setTaskTemplates(data || []);
    } catch (err) {
      console.error('Error fetching task templates:', err);
      setError('Failed to load task templates');
    } finally {
      setLoading(false);
    }
  };

  const createWorkflow = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workflowFormData)
      });
      
      if (!response.ok) {
        throw new Error('Failed to create workflow');
      }
      
      const newWorkflow = await response.json();
      setWorkflows([...workflows, newWorkflow]);
      setWorkflowFormData({ name: '', description: '' });
      setActiveTab('list');
    } catch (err) {
      console.error('Error creating workflow:', err);
      setError('Failed to create workflow');
    }
  };

  const triggerWorkflow = async (workflowId: string, workflowName: string) => {
    try {
      // For simplicity, we'll just send an empty context object
      // In a real implementation, you would collect context variables from the user
      const context = triggerFormData;
      
      const response = await fetch(`/api/workflows/${workflowId}/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(context)
      });
      
      if (!response.ok) {
        throw new Error('Failed to trigger workflow');
      }
      
      alert(`Workflow "${workflowName}" triggered successfully!`);
      setTriggerFormData({});
    } catch (err) {
      console.error('Error triggering workflow:', err);
      setError('Failed to trigger workflow');
    }
  };

  const handleTriggerFormChange = (key: string, value: string) => {
    setTriggerFormData(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="bg-gray-800 p-6 rounded-lg">
        <h2 className="text-2xl font-semibold text-white mb-4">Workflow Management</h2>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
          <span className="ml-2 text-gray-400">Loading workflows...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-800 p-6 rounded-lg">
        <h2 className="text-2xl font-semibold text-white mb-4">Workflow Management</h2>
        <div className="text-center py-8">
          <p className="text-red-400 mb-2">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-blue-400 hover:text-blue-300 text-sm underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 p-6 rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold text-white">Workflow Management</h2>
      </div>

      {/* Tab Navigation */}
      <div className="flex mb-4 border-b border-gray-700">
        <button
          onClick={() => setActiveTab('list')}
          className={`px-4 py-2 font-medium text-sm transition-colors ${
            activeTab === 'list'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Workflows ({workflows.length})
        </button>
        <button
          onClick={() => setActiveTab('create')}
          className={`px-4 py-2 font-medium text-sm transition-colors ml-4 ${
            activeTab === 'create'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Create Workflow
        </button>
      </div>

      {/* Workflow List Tab */}
      {activeTab === 'list' && (
        <div className="space-y-4">
          {workflows.length === 0 ? (
            <p className="text-gray-400 text-center py-4">No workflows available. Create your first workflow!</p>
          ) : (
            workflows.map((workflow) => (
              <div key={workflow.id} className="bg-gray-700 p-4 rounded-md hover:bg-gray-650 transition-colors">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-semibold text-white text-lg">{workflow.name}</h3>
                    {workflow.description && (
                      <p className="text-gray-300 mt-1">{workflow.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedWorkflow(workflow);
                        setActiveTab('templates');
                        fetchTaskTemplates(workflow.id);
                      }}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => triggerWorkflow(workflow.id, workflow.name)}
                      className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors"
                    >
                      Run
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Create Workflow Tab */}
      {activeTab === 'create' && (
        <form onSubmit={createWorkflow} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">
              Workflow Name
            </label>
            <input
              type="text"
              id="name"
              value={workflowFormData.name}
              onChange={(e) => setWorkflowFormData({...workflowFormData, name: e.target.value})}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-1">
              Description
            </label>
            <textarea
              id="description"
              value={workflowFormData.description}
              onChange={(e) => setWorkflowFormData({...workflowFormData, description: e.target.value})}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>
          
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('list')}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
            >
              Create Workflow
            </button>
          </div>
        </form>
      )}

      {/* Templates Tab */}
      {activeTab === 'templates' && selectedWorkflow && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold text-white">{selectedWorkflow.name} - Task Templates</h3>
            <button
              onClick={() => setActiveTab('list')}
              className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded transition-colors"
            >
              Back to Workflows
            </button>
          </div>
          
          {taskTemplates.length === 0 ? (
            <p className="text-gray-400 text-center py-4">No task templates defined for this workflow.</p>
          ) : (
            <div className="space-y-3">
              {taskTemplates.map((template) => (
                <div key={template.id} className="bg-gray-700 p-4 rounded-md">
                  <div className="flex justify-between">
                    <div>
                      <h4 className="font-semibold text-white">Stage {template.stage_order}</h4>
                      <p className="text-gray-300">{template.title_template}</p>
                      {template.description_template && (
                        <p className="text-gray-400 text-sm mt-1">{template.description_template}</p>
                      )}
                    </div>
                    <span className="px-2 py-1 bg-gray-600 text-gray-300 text-xs rounded">
                      {template.priority}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <div className="pt-4 border-t border-gray-700">
            <button
              onClick={() => {
                // In a real implementation, you would show a form to create a new task template
                alert('In a full implementation, this would open a form to create a new task template.');
              }}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
            >
              Add Task Template
            </button>
          </div>
        </div>
      )}
    </div>
  );
}