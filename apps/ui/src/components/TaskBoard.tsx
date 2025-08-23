'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

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
  const [tasks, setTasks] = useState<Task[]>(initialTasks);\n  const [isConnected, setIsConnected] = useState(false);\n  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);\n\n  /**\n   * Fetches all tasks from the database\n   */\n  const fetchTasks = async () => {\n    try {\n      const { data, error } = await supabase\n        .from('tasks')\n        .select('*')\n        .order('created_at', { ascending: false });\n\n      if (error) {\n        console.error('Error fetching tasks:', error);\n        return;\n      }\n\n      setTasks(data || []);\n      setLastUpdate(new Date());\n    } catch (err) {\n      console.error('Unexpected error fetching tasks:', err);\n    }\n  };\n\n  useEffect(() => {\n    // Set up real-time subscription\n    const channel = supabase\n      .channel('realtime-tasks')\n      .on(\n        'postgres_changes',\n        { event: '*', schema: 'public', table: 'tasks' },\n        (payload) => {\n          console.log('Real-time change received:', payload.eventType, payload.new || payload.old);\n          // Refetch all tasks on any change for simplicity\n          // In a production app, you might want to handle individual updates more granularly\n          fetchTasks();\n        }\n      )\n      .subscribe((status) => {\n        console.log('Subscription status:', status);\n        setIsConnected(status === 'SUBSCRIBED');\n      });\n\n    // Initial connection indicator\n    if (initialTasks.length > 0) {\n      setLastUpdate(new Date());\n    }\n\n    // Cleanup subscription on component unmount\n    return () => {\n      console.log('Cleaning up real-time subscription');\n      supabase.removeChannel(channel);\n    };\n  }, []);\n\n  /**\n   * Formats a date for display\n   */\n  const formatDate = (dateString: string): string => {\n    return new Date(dateString).toLocaleDateString('en-US', {\n      month: 'short',\n      day: 'numeric',\n      hour: '2-digit',\n      minute: '2-digit',\n    });\n  };\n\n  return (\n    <div className=\"bg-gray-800 p-6 rounded-lg\">\n      <div className=\"flex justify-between items-center mb-4\">\n        <h2 className=\"text-2xl font-semibold\">Task Board (Live)</h2>\n        <div className=\"flex items-center space-x-4 text-sm\">\n          <div className=\"flex items-center space-x-2\">\n            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>\n            <span className={isConnected ? 'text-green-400' : 'text-red-400'}>\n              {isConnected ? 'Live' : 'Disconnected'}\n            </span>\n          </div>\n          {lastUpdate && (\n            <span className=\"text-gray-400\">\n              Updated: {lastUpdate.toLocaleTimeString()}\n            </span>\n          )}\n        </div>\n      </div>\n      \n      <div className=\"space-y-4\">\n        {tasks.length === 0 ? (\n          <div className=\"text-gray-400 text-center py-8\">\n            No tasks found. Create some tasks to see them here.\n          </div>\n        ) : (\n          tasks.map((task) => (\n            <div key={task.id} className=\"bg-gray-700 p-4 rounded-md\">\n              <div className=\"flex justify-between items-start mb-2\">\n                <div className=\"flex-1\">\n                  <h3 className=\"font-semibold text-white\">{task.title}</h3>\n                  {task.description && (\n                    <p className=\"text-gray-300 text-sm mt-1\">{task.description}</p>\n                  )}\n                  {task.agent_id && (\n                    <p className=\"text-gray-400 text-xs mt-1\">Agent: {task.agent_id}</p>\n                  )}\n                </div>\n                <div className=\"flex flex-col items-end space-y-1 ml-4\">\n                  <span className={`px-2 py-1 text-xs font-bold rounded-full ${statusColor[task.status] || 'bg-gray-400'}`}>\n                    {task.status.replace('_', ' ')}\n                  </span>\n                  <span className={`text-xs font-medium ${priorityColor[task.priority] || 'text-gray-400'}`}>\n                    {task.priority}\n                  </span>\n                </div>\n              </div>\n              <div className=\"text-xs text-gray-500 flex justify-between\">\n                <span>Created: {formatDate(task.created_at)}</span>\n                <span>Updated: {formatDate(task.updated_at)}</span>\n              </div>\n            </div>\n          ))\n        )}\n      </div>\n    </div>\n  );\n}