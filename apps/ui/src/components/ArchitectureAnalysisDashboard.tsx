'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface ArchitectureAnalysisTask {
  id: string;
  title: string;
  description: string | null;
  repository_url: string;
  branch: string;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'ERROR';
  created_at: string;
  updated_at: string;
  findings?: ArchitectureFinding[];
  suggestions?: RefactoringSuggestion[];
}

interface ArchitectureFinding {
  id: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  file_path: string | null;
  line_number: number | null;
  impact_score: number | null;
  confidence_score: number | null;
  created_at: string;
}

interface RefactoringSuggestion {
  id: string;
  title: string;
  description: string;
  complexity: 'LOW' | 'MEDIUM' | 'HIGH';
  impact: 'LOW' | 'MEDIUM' | 'HIGH';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  estimated_effort_hours: number | null;
  created_at: string;
}

export default function ArchitectureAnalysisDashboard() {
  const [tasks, setTasks] = useState<ArchitectureAnalysisTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    repository_url: '',
    branch: 'main',
    analysis_scope: 'full'
  });
  const [isCreating, setIsCreating] = useState(false);

  const fetchTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('architecture_analysis_tasks')
        .select(`
          *,
          findings:architecture_findings(*),
          suggestions:refactoring_suggestions(*)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching architecture analysis tasks:', error);
        return;
      }

      setTasks(data || []);
    } catch (err) {
      console.error('Unexpected error fetching architecture analysis tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();

    // Set up real-time subscription
    const channel = supabase
      .channel('architecture-analysis-changes')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'architecture_analysis_tasks' 
        },
        (payload) => {
          console.log('Architecture analysis change received:', payload);
          fetchTasks();
        }
      )
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'architecture_findings' 
        },
        (payload) => {
          console.log('Architecture findings change received:', payload);
          fetchTasks();
        }
      )
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'refactoring_suggestions' 
        },
        (payload) => {
          console.log('Refactoring suggestions change received:', payload);
          fetchTasks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      const response = await fetch('/api/architecture-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newTask),
      });

      if (!response.ok) {
        throw new Error('Failed to create architecture analysis task');
      }

      const createdTask = await response.json();
      console.log('Created architecture analysis task:', createdTask);

      // Reset form
      setNewTask({
        title: '',
        description: '',
        repository_url: '',
        branch: 'main',
        analysis_scope: 'full'
      });

      // Refresh tasks
      fetchTasks();
    } catch (err) {
      console.error('Error creating architecture analysis task:', err);
      alert('Failed to create architecture analysis task');
    } finally {
      setIsCreating(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DONE': return 'bg-green-500';
      case 'IN_PROGRESS': return 'bg-blue-500';
      case 'ERROR': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'text-red-500';
      case 'HIGH': return 'text-orange-500';
      case 'MEDIUM': return 'text-yellow-500';
      case 'LOW': return 'text-green-500';
      default: return 'text-gray-500';
    }
  };

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'HIGH': return 'text-red-500';
      case 'MEDIUM': return 'text-yellow-500';
      case 'LOW': return 'text-green-500';
      default: return 'text-gray-500';
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'HIGH': return 'text-red-500';
      case 'MEDIUM': return 'text-yellow-500';
      case 'LOW': return 'text-green-500';
      default: return 'text-gray-500';
    }
  };

  return (
    <div className="bg-gray-800 p-6 rounded-lg">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold">Architecture Analysis</h2>
      </div>

      {/* Create Task Form */}
      <div className="bg-gray-700 p-4 rounded-md mb-6">
        <h3 className="text-lg font-medium mb-4">Create New Analysis Task</h3>
        <form onSubmit={handleCreateTask} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-300 mb-1">
                Title
              </label>
              <input
                type="text"
                id="title"
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                className="w-full bg-gray-600 border border-gray-500 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label htmlFor="repository_url" className="block text-sm font-medium text-gray-300 mb-1">
                Repository URL
              </label>
              <input
                type="text"
                id="repository_url"
                value={newTask.repository_url}
                onChange={(e) => setNewTask({ ...newTask, repository_url: e.target.value })}
                className="w-full bg-gray-600 border border-gray-500 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-1">
              Description
            </label>
            <textarea
              id="description"
              value={newTask.description}
              onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
              rows={3}
              className="w-full bg-gray-600 border border-gray-500 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="branch" className="block text-sm font-medium text-gray-300 mb-1">
                Branch
              </label>
              <input
                type="text"
                id="branch"
                value={newTask.branch}
                onChange={(e) => setNewTask({ ...newTask, branch: e.target.value })}
                className="w-full bg-gray-600 border border-gray-500 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="analysis_scope" className="block text-sm font-medium text-gray-300 mb-1">
                Analysis Scope
              </label>
              <select
                id="analysis_scope"
                value={newTask.analysis_scope}
                onChange={(e) => setNewTask({ ...newTask, analysis_scope: e.target.value })}
                className="w-full bg-gray-600 border border-gray-500 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="full">Full Repository</option>
                <option value="module">Specific Module</option>
                <option value="directory">Specific Directory</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={isCreating}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-md transition-colors"
              >
                {isCreating ? 'Creating...' : 'Create Task'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Tasks List */}
      <div>
        <h3 className="text-lg font-medium mb-4">Analysis Tasks</h3>
        {loading ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            <p className="mt-2 text-gray-400">Loading tasks...</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            No architecture analysis tasks found. Create one above to get started.
          </div>
        ) : (
          <div className="space-y-4">
            {tasks.map((task) => (
              <div key={task.id} className="bg-gray-700 p-4 rounded-md">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-medium text-white">{task.title}</h4>
                    <p className="text-sm text-gray-300 mt-1">{task.description}</p>
                    <div className="flex items-center mt-2 text-xs text-gray-400">
                      <span className="mr-4">Repository: {task.repository_url}</span>
                      <span>Branch: {task.branch}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className={`px-2 py-1 text-xs font-bold rounded-full ${getStatusColor(task.status)}`}>
                      {task.status.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-gray-400 mt-1">
                      Created: {new Date(task.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Findings */}
                {task.findings && task.findings.length > 0 && (
                  <div className="mt-4">
                    <h5 className="font-medium text-gray-300 mb-2">Findings ({task.findings.length})</h5>
                    <div className="space-y-2">
                      {task.findings.map((finding) => (
                        <div key={finding.id} className="bg-gray-600 p-3 rounded">
                          <div className="flex justify-between">
                            <span className="font-medium text-white">{finding.type}</span>
                            <span className={`font-medium ${getSeverityColor(finding.severity)}`}>
                              {finding.severity}
                            </span>
                          </div>
                          <p className="text-sm text-gray-300 mt-1">{finding.description}</p>
                          {finding.file_path && (
                            <p className="text-xs text-gray-400 mt-1">
                              {finding.file_path}{finding.line_number && `:${finding.line_number}`}
                            </p>
                          )}
                          <div className="flex space-x-4 mt-2 text-xs">
                            {finding.impact_score && (
                              <span>Impact: {(finding.impact_score * 100).toFixed(0)}%</span>
                            )}
                            {finding.confidence_score && (
                              <span>Confidence: {(finding.confidence_score * 100).toFixed(0)}%</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suggestions */}
                {task.suggestions && task.suggestions.length > 0 && (
                  <div className="mt-4">
                    <h5 className="font-medium text-gray-300 mb-2">Refactoring Suggestions ({task.suggestions.length})</h5>
                    <div className="space-y-2">
                      {task.suggestions.map((suggestion) => (
                        <div key={suggestion.id} className="bg-gray-600 p-3 rounded">
                          <div className="flex justify-between">
                            <span className="font-medium text-white">{suggestion.title}</span>
                            <span className={`font-medium ${getSeverityColor(suggestion.priority)}`}>
                              {suggestion.priority}
                            </span>
                          </div>
                          <p className="text-sm text-gray-300 mt-1">{suggestion.description}</p>
                          <div className="flex space-x-4 mt-2 text-xs">
                            <span>Complexity: <span className={getComplexityColor(suggestion.complexity)}>{suggestion.complexity}</span></span>
                            <span>Impact: <span className={getImpactColor(suggestion.impact)}>{suggestion.impact}</span></span>
                            {suggestion.estimated_effort_hours && (
                              <span>Effort: {suggestion.estimated_effort_hours} hours</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}