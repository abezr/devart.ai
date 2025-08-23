'use client';

import { useEffect, useState } from 'react';
import ReactFlow, { 
  MiniMap, 
  Controls, 
  Background, 
  useNodesState, 
  useEdgesState, 
  addEdge,
  Node,
  Edge
} from 'reactflow';
import 'reactflow/dist/style.css';
import { supabase } from '../lib/supabase';

interface TaskNodeData {
  title: string;
  status: string;
  priority: string;
}

type TaskNode = Node<TaskNodeData>;

interface TaskEdge extends Edge {
  type: 'parent-child';
}

interface TaskLineage {
  nodes: TaskNode[];
  edges: TaskEdge[];
  selectedTaskId: string;
}

interface WorkflowVisualizerProps {
  taskId: string;
}

export default function WorkflowVisualizer({ taskId }: WorkflowVisualizerProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<TaskNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTaskLineage = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/tasks/${taskId}/lineage`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch task lineage');
        }
        
        const data: TaskLineage = await response.json();
        
        // Transform nodes for React Flow
        const flowNodes = data.nodes.map(node => ({
          id: node.id,
          type: 'default',
          position: { x: 0, y: 0 }, // Will be positioned by layout
          data: { 
            title: node.title,
            status: node.status,
            priority: node.priority
          },
          className: node.id === data.selectedTaskId 
            ? 'ring-2 ring-blue-500' 
            : ''
        }));
        
        // Transform edges for React Flow
        const flowEdges = data.edges.map(edge => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#6366f1' }
        }));
        
        setNodes(flowNodes);
        setEdges(flowEdges);
      } catch (err) {
        setError('Failed to load workflow visualization');
        console.error('Error fetching task lineage:', err);
      } finally {
        setLoading(false);
      }
    };

    if (taskId) {
      fetchTaskLineage();
    }
  }, [taskId, setNodes, setEdges]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'TODO': return '#ef4444'; // red
      case 'IN_PROGRESS': return '#f59e0b'; // amber
      case 'DONE': return '#10b981'; // green
      case 'QUARANTINED': return '#8b5cf6'; // violet
      case 'PENDING_BUDGET_APPROVAL': return '#3b82f6'; // blue
      default: return '#6b7280'; // gray
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL': return '#ef4444'; // red
      case 'HIGH': return '#f59e0b'; // amber
      case 'MEDIUM': return '#10b981'; // green
      case 'LOW': return '#6b7280'; // gray
      default: return '#6b7280'; // gray
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading workflow visualization...</div>;
  }

  if (error) {
    return <div className="flex items-center justify-center h-64 text-red-400">Error: {error}</div>;
  }

  return (
    <div className="w-full h-96 border border-gray-700 rounded-lg">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        attributionPosition="bottom-left"
      >
        <MiniMap />
        <Controls />
        <Background gap={12} size={1} />
      </ReactFlow>
    </div>
  );
}
