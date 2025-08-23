'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import TaskDetailModal from './TaskDetailModal';

/**
 * Interface matching the Task database table structure
 */
interface Task {
  id: string;
  title: string;
  description: string | null;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'QUARANTINED' | 'PENDING_BUDGET_APPROVAL';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  agent_id: string | null;
  created_at: string;
  updated_at: string;
  parent_task_id: string | null; // For task chaining
  review_flag: boolean; // For performance outlier flagging
}

/**
 * Color mapping for different task statuses
 */
const statusColor: Record<string, string> = {
  DONE: 'bg-green-500',
  IN_PROGRESS: 'bg-blue-500',
  TODO: 'bg-gray-500',
  QUARANTINED: 'bg-yellow-500',
  PENDING_BUDGET_APPROVAL: 'bg-red-500',
};

/**
 * Color mapping for different task priorities
 */
const priorityColor: Record<string, string> = {
  LOW: 'text-gray-400',
  MEDIUM: 'text-yellow-400',
  HIGH: 'text-orange-400',
  CRITICAL: 'text-red-400',
};

interface TaskBoardProps {
  initialTasks: Task[];
}

/**
 * Real-time TaskBoard component that displays tasks with live updates
 * Uses Supabase real-time subscriptions to automatically refresh when data changes
 */
export default function TaskBoard({ initialTasks }: TaskBoardProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null); // State for the modal
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  /**
   * Fetches all tasks from the database
   */
  const fetchTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching tasks:', error);
        return;
      }

      setTasks(data || []);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Unexpected error fetching tasks:', err);
    }
  };

  useEffect(() => {
    // Set up real-time subscription
    const channel = supabase
      .channel('realtime-tasks')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        (payload) => {
          console.log('Real-time change received:', payload.eventType, payload.new || payload.old);
          // Refetch all tasks on any change for simplicity
          // In a production app, you might want to handle individual updates more granularly
          fetchTasks();
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
        setIsConnected(status === 'SUBSCRIBED');
      });

    // Initial connection indicator
    if (initialTasks.length > 0) {
      setLastUpdate(new Date());
    }

    // Cleanup subscription on component unmount
    return () => {
      console.log('Cleaning up real-time subscription');
      supabase.removeChannel(channel);
    };
  }, []);

  /**
   * Formats a date for display
   */
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
      {/* Conditionally render the modal */}
      {selectedTaskId && (
        <TaskDetailModal taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} />
      )}

      <div className="bg-gray-800 p-6 rounded-lg">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold">Task Board (Live)</h2>
          <div className="flex items-center space-x-4 text-sm">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className={isConnected ? 'text-green-400' : 'text-red-400'}>
                {isConnected ? 'Live' : 'Disconnected'}
              </span>
            </div>
            {lastUpdate && (
              <span className="text-gray-400">
                Updated: {lastUpdate.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
        
        <div className="space-y-4">
          {tasks.length === 0 ? (
            <div className="text-gray-400 text-center py-8">
              No tasks found. Create some tasks to see them here.
            </div>
          ) : (
            tasks.map((task) => (
              // Add onClick handler and cursor style with conditional flagged styling
              <div
                key={task.id}
                onClick={() => setSelectedTaskId(task.id)}
                className={`bg-gray-700 p-4 rounded-md cursor-pointer hover:bg-gray-600 transition-colors ${
                  task.review_flag ? 'ring-2 ring-red-500' : ''
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      {task.review_flag && (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.21 3.03-1.742 3.03H4.42c-1.532 0-2.492-1.696-1.742-3.03l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-4a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd" />
                        </svg>
                      )}
                      {task.parent_task_id && (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      )}
                      <h3 className="font-semibold text-white">{task.title}</h3>
                    </div>
                    {task.description && (
                      <p className="text-gray-300 text-sm mt-1">{task.description}</p>
                    )}
                    {task.agent_id && (
                      <p className="text-gray-400 text-xs mt-1">Agent: {task.agent_id}</p>
                    )}
                    {task.parent_task_id && (
                      <p className="text-blue-400 text-xs mt-1">↳ Chained from parent task</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end space-y-1 ml-4">
                    <span className={`px-2 py-1 text-xs font-bold rounded-full ${statusColor[task.status] || 'bg-gray-400'}`}>
                      {task.status.replace('_', ' ')}
                    </span>
                    <span className={`text-xs font-medium ${priorityColor[task.priority] || 'text-gray-400'}`}>
                      {task.priority}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-gray-500 flex justify-between">
                  <span>Created: {formatDate(task.created_at)}</span>
                  <span>Updated: {formatDate(task.updated_at)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
