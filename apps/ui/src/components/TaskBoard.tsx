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
              // Add onClick handler and cursor style
              <div
                key={task.id}
                onClick={() => setSelectedTaskId(task.id)}
                className="bg-gray-700 p-4 rounded-md cursor-pointer hover:bg-gray-600 transition-colors"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <h3 className="font-semibold text-white">{task.title}</h3>
                    {task.description && (
                      <p className="text-gray-300 text-sm mt-1">{task.description}</p>
                    )}
                    {task.agent_id && (
                      <p className="text-gray-400 text-xs mt-1">Agent: {task.agent_id}</p>
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
