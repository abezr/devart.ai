import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';

interface GenerativeRemediationScript {
  id: string;
  anomaly_id: string;
  root_cause_analysis: {
    root_cause_category: string;
    root_cause_details: string;
    confidence_score: 'LOW' | 'MEDIUM' | 'HIGH';
    suggested_actions: string[];
  };
  generated_script: string;
  script_language: string;
  target_system: string;
  confidence_score: number;
  validation_status: 'PENDING' | 'PASSED' | 'FAILED';
  execution_status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED';
  approval_status: 'REQUIRED' | 'APPROVED' | 'REJECTED';
  created_at: string;
  validated_at?: string;
  executed_at?: string;
  approved_at?: string;
}

interface GenerativeRemediationTemplate {
  id: string;
  root_cause_category: string;
  template_content: string;
  target_systems: string[];
  required_capabilities: Record<string, any>;
  safety_checks: Record<string, any>;
  template_variables: Record<string, any>;
  created_at: string;
  updated_at: string;
}

const GenerativeRemediationDashboard: React.FC = () => {
  const [scripts, setScripts] = useState<GenerativeRemediationScript[]>([]);
  const [templates, setTemplates] = useState<GenerativeRemediationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedScript, setSelectedScript] = useState<GenerativeRemediationScript | null>(null);
  const [showCreateTemplateForm, setShowCreateTemplateForm] = useState(false);
  const [newTemplate, setNewTemplate] = useState<Omit<GenerativeRemediationTemplate, 'id' | 'created_at' | 'updated_at'>>({
    root_cause_category: '',
    template_content: '',
    target_systems: [],
    required_capabilities: {},
    safety_checks: {},
    template_variables: {}
  });

  const supabase = createClient();

  useEffect(() => {
    fetchData();
    
    // Set up real-time subscriptions
    const scriptsChannel = supabase
      .channel('generative-remediation-scripts-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'generative_remediation_scripts',
        },
        (payload) => {
          fetchData();
        }
      )
      .subscribe();

    const templatesChannel = supabase
      .channel('generative-remediation-templates-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'generative_remediation_templates',
        },
        (payload) => {
          fetchTemplates();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(scriptsChannel);
      supabase.removeChannel(templatesChannel);
    };
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch generative remediation scripts
      const { data: scriptsData, error: scriptsError } = await supabase
        .from('generative_remediation_scripts')
        .select('*')
        .order('created_at', { ascending: false });

      if (scriptsError) throw scriptsError;

      setScripts(scriptsData || []);
      
      // Fetch templates
      await fetchTemplates();
    } catch (err) {
      setError('Failed to fetch data');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const { data: templatesData, error: templatesError } = await supabase
        .from('generative_remediation_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (templatesError) throw templatesError;

      setTemplates(templatesData || []);
    } catch (err) {
      console.error('Error fetching templates:', err);
    }
  };

  const handleApproveScript = async (id: string) => {
    try {
      const response = await fetch(`/api/generative-remediation/scripts/${id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Failed to approve script');

      const updatedScript = await response.json();
      
      // Update the script in the state
      setScripts(scripts.map(script => 
        script.id === id ? { ...script, ...updatedScript } : script
      ));
      
      // If we're viewing this script, update the selected script too
      if (selectedScript && selectedScript.id === id) {
        setSelectedScript({ ...selectedScript, ...updatedScript });
      }
    } catch (err) {
      setError('Failed to approve script');
      console.error('Error approving script:', err);
    }
  };

  const handleRejectScript = async (id: string) => {
    try {
      const response = await fetch(`/api/generative-remediation/scripts/${id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Failed to reject script');

      const updatedScript = await response.json();
      
      // Update the script in the state
      setScripts(scripts.map(script => 
        script.id === id ? { ...script, ...updatedScript } : script
      ));
      
      // If we're viewing this script, update the selected script too
      if (selectedScript && selectedScript.id === id) {
        setSelectedScript({ ...selectedScript, ...updatedScript });
      }
    } catch (err) {
      setError('Failed to reject script');
      console.error('Error rejecting script:', err);
    }
  };

  const handleValidateScript = async (id: string) => {
    try {
      const response = await fetch(`/api/generative-remediation/scripts/${id}/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Failed to validate script');

      const result = await response.json();
      console.log('Script validation result:', result);
      
      // Refresh the scripts to show updated validation status
      fetchData();
    } catch (err) {
      setError('Failed to validate script');
      console.error('Error validating script:', err);
    }
  };

  const handleExecuteScript = async (id: string) => {
    try {
      const response = await fetch(`/api/generative-remediation/scripts/${id}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Failed to execute script');

      const result = await response.json();
      console.log('Script execution result:', result);
      
      // Refresh the scripts to show updated execution status
      fetchData();
    } catch (err) {
      setError('Failed to execute script');
      console.error('Error executing script:', err);
    }
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch('/api/generative-remediation/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newTemplate),
      });

      if (!response.ok) throw new Error('Failed to create template');

      const createdTemplate = await response.json();
      
      setTemplates([createdTemplate, ...templates]);
      setShowCreateTemplateForm(false);
      setNewTemplate({
        root_cause_category: '',
        template_content: '',
        target_systems: [],
        required_capabilities: {},
        safety_checks: {},
        template_variables: {}
      });
    } catch (err) {
      setError('Failed to create template');
      console.error('Error creating template:', err);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      const response = await fetch(`/api/generative-remediation/templates/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete template');

      setTemplates(templates.filter(template => template.id !== id));
    } catch (err) {
      setError('Failed to delete template');
      console.error('Error deleting template:', err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED':
      case 'PASSED':
      case 'SUCCESS':
        return 'bg-green-100 text-green-800';
      case 'PENDING':
      case 'REQUIRED':
        return 'bg-yellow-100 text-yellow-800';
      case 'REJECTED':
      case 'FAILED':
        return 'bg-red-100 text-red-800';
      case 'RUNNING':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Generative Remediation</h1>
        <button
          onClick={() => setShowCreateTemplateForm(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
        >
          Create Template
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {showCreateTemplateForm && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Create New Template</h2>
          <form onSubmit={handleCreateTemplate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Root Cause Category</label>
              <input
                type="text"
                value={newTemplate.root_cause_category}
                onChange={(e) => setNewTemplate({ ...newTemplate, root_cause_category: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Template Content</label>
              <textarea
                value={newTemplate.template_content}
                onChange={(e) => setNewTemplate({ ...newTemplate, template_content: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 h-32"
                required
              />
            </div>
            <div className="flex space-x-4">
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
              >
                Create Template
              </button>
              <button
                type="button"
                onClick={() => setShowCreateTemplateForm(false)}
                className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-md"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scripts Panel */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Generated Scripts</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Script</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Root Cause</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Confidence</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {scripts.map((script) => (
                  <tr key={script.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {script.target_system} ({script.script_language})
                      </div>
                      <div className="text-sm text-gray-500">
                        {new Date(script.created_at).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{script.root_cause_analysis.root_cause_category}</div>
                      <div className="text-sm text-gray-500 truncate max-w-xs">
                        {script.root_cause_analysis.root_cause_details}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{(script.confidence_score * 100).toFixed(0)}%</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(script.approval_status)}`}>
                        {script.approval_status}
                      </span>
                      <span className={`ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(script.validation_status)}`}>
                        {script.validation_status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => setSelectedScript(script)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        View
                      </button>
                      {script.approval_status === 'REQUIRED' && (
                        <>
                          <button
                            onClick={() => handleApproveScript(script.id)}
                            className="text-green-600 hover:text-green-900 mr-3"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleRejectScript(script.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {script.approval_status === 'APPROVED' && script.validation_status === 'PENDING' && (
                        <button
                          onClick={() => handleValidateScript(script.id)}
                          className="text-yellow-600 hover:text-yellow-900 mr-3"
                        >
                          Validate
                        </button>
                      )}
                      {script.approval_status === 'APPROVED' && script.validation_status === 'PASSED' && script.execution_status === 'PENDING' && (
                        <button
                          onClick={() => handleExecuteScript(script.id)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Execute
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Templates Panel */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Templates</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target Systems</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {templates.map((template) => (
                  <tr key={template.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{template.root_cause_category}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {template.target_systems.join(', ')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(template.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleDeleteTemplate(template.id)}
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
      </div>

      {/* Script Detail Modal */}
      {selectedScript && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-start">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Script Details
                </h3>
                <button
                  onClick={() => setSelectedScript(null)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <span className="text-2xl">&times;</span>
                </button>
              </div>
              <div className="mt-2 space-y-4">
                <div>
                  <h4 className="text-md font-medium text-gray-900">Root Cause Analysis</h4>
                  <div className="mt-2 p-3 bg-gray-50 rounded-md">
                    <p><strong>Category:</strong> {selectedScript.root_cause_analysis.root_cause_category}</p>
                    <p><strong>Details:</strong> {selectedScript.root_cause_analysis.root_cause_details}</p>
                    <p><strong>Confidence:</strong> {selectedScript.root_cause_analysis.confidence_score}</p>
                    <p><strong>Suggested Actions:</strong> {selectedScript.root_cause_analysis.suggested_actions.join(', ')}</p>
                  </div>
                </div>
                <div>
                  <h4 className="text-md font-medium text-gray-900">Generated Script</h4>
                  <pre className="mt-2 p-3 bg-gray-800 text-gray-100 rounded-md overflow-x-auto">
                    {selectedScript.generated_script}
                  </pre>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-md font-medium text-gray-900">Metadata</h4>
                    <div className="mt-2 p-3 bg-gray-50 rounded-md">
                      <p><strong>Language:</strong> {selectedScript.script_language}</p>
                      <p><strong>Target System:</strong> {selectedScript.target_system}</p>
                      <p><strong>Confidence Score:</strong> {(selectedScript.confidence_score * 100).toFixed(0)}%</p>
                      <p><strong>Created:</strong> {new Date(selectedScript.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-md font-medium text-gray-900">Status</h4>
                    <div className="mt-2 p-3 bg-gray-50 rounded-md">
                      <p><strong>Approval:</strong> 
                        <span className={`ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(selectedScript.approval_status)}`}>
                          {selectedScript.approval_status}
                        </span>
                      </p>
                      <p><strong>Validation:</strong> 
                        <span className={`ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(selectedScript.validation_status)}`}>
                          {selectedScript.validation_status}
                        </span>
                      </p>
                      <p><strong>Execution:</strong> 
                        <span className={`ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(selectedScript.execution_status)}`}>
                          {selectedScript.execution_status}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GenerativeRemediationDashboard;