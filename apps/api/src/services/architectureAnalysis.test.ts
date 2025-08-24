import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  createArchitectureAnalysisTask,
  getArchitectureAnalysisTask,
  updateArchitectureAnalysisTaskStatus,
  reportArchitectureFindings,
  reportRefactoringSuggestions,
  requestSandboxProvisioning,
  executeRefactoring
} from './architectureAnalysis';

// Mock Supabase client
const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  single: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  auth: {
    getUser: vi.fn()
  }
};

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
  mockSupabase.from.mockReturnThis();
  mockSupabase.insert.mockReturnThis();
  mockSupabase.select.mockReturnThis();
  mockSupabase.single.mockReturnThis();
  mockSupabase.eq.mockReturnThis();
  mockSupabase.update.mockReturnThis();
});

describe('Architecture Analysis Service', () => {
  describe('createArchitectureAnalysisTask', () => {
    it('should create a new architecture analysis task', async () => {
      const mockTask = {
        id: 'task-1',
        title: 'Test Analysis',
        repository_url: 'https://github.com/test/repo',
        status: 'TODO'
      };

      mockSupabase.insert.mockResolvedValueOnce({ data: mockTask, error: null });

      const result = await createArchitectureAnalysisTask(mockSupabase as any, {
        title: 'Test Analysis',
        repository_url: 'https://github.com/test/repo'
      });

      expect(result).toEqual(mockTask);
      expect(mockSupabase.from).toHaveBeenCalledWith('architecture_analysis_tasks');
      expect(mockSupabase.insert).toHaveBeenCalled();
    });

    it('should throw an error if creation fails', async () => {
      mockSupabase.insert.mockResolvedValueOnce({ data: null, error: new Error('Database error') });

      await expect(createArchitectureAnalysisTask(mockSupabase as any, {
        title: 'Test Analysis',
        repository_url: 'https://github.com/test/repo'
      })).rejects.toThrow('Could not create architecture analysis task');
    });
  });

  describe('getArchitectureAnalysisTask', () => {
    it('should retrieve an architecture analysis task', async () => {
      const mockTask = {
        id: 'task-1',
        title: 'Test Analysis',
        repository_url: 'https://github.com/test/repo',
        status: 'TODO'
      };

      mockSupabase.select.mockResolvedValueOnce({ data: mockTask, error: null });

      const result = await getArchitectureAnalysisTask(mockSupabase as any, 'task-1');

      expect(result).toEqual(mockTask);
      expect(mockSupabase.from).toHaveBeenCalledWith('architecture_analysis_tasks');
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'task-1');
    });
  });

  describe('updateArchitectureAnalysisTaskStatus', () => {
    it('should update task status', async () => {
      const mockTask = {
        id: 'task-1',
        title: 'Test Analysis',
        repository_url: 'https://github.com/test/repo',
        status: 'IN_PROGRESS'
      };

      mockSupabase.update.mockResolvedValueOnce({ data: mockTask, error: null });

      const result = await updateArchitectureAnalysisTaskStatus(
        mockSupabase as any,
        'task-1',
        'IN_PROGRESS',
        'agent-1'
      );

      expect(result).toEqual(mockTask);
      expect(mockSupabase.update).toHaveBeenCalledWith({
        status: 'IN_PROGRESS',
        updated_at: expect.any(Date),
        agent_id: 'agent-1'
      });
    });
  });

  describe('reportArchitectureFindings', () => {
    it('should report architecture findings', async () => {
      const mockTask = {
        id: 'task-1',
        agent_id: 'agent-1'
      };

      const mockFindings = [
        {
          type: 'circular_dependency',
          severity: 'HIGH',
          description: 'Circular dependency detected'
        }
      ];

      const mockReportedFindings = [
        {
          id: 'finding-1',
          task_id: 'task-1',
          type: 'circular_dependency',
          severity: 'HIGH',
          description: 'Circular dependency detected'
        }
      ];

      mockSupabase.select.mockResolvedValueOnce({ data: mockTask, error: null });
      mockSupabase.insert.mockResolvedValueOnce({ data: mockReportedFindings, error: null });

      const result = await reportArchitectureFindings(
        mockSupabase as any,
        'task-1',
        mockFindings,
        'agent-1'
      );

      expect(result).toEqual(mockReportedFindings);
      expect(mockSupabase.from).toHaveBeenCalledWith('architecture_findings');
      expect(mockSupabase.insert).toHaveBeenCalledWith([
        {
          ...mockFindings[0],
          task_id: 'task-1'
        }
      ]);
    });

    it('should throw an error if task is not found', async () => {
      mockSupabase.select.mockResolvedValueOnce({ data: null, error: new Error('Not found') });

      await expect(reportArchitectureFindings(
        mockSupabase as any,
        'task-1',
        [],
        'agent-1'
      )).rejects.toThrow('Task not found');
    });

    it('should throw an error if task is not assigned to agent', async () => {
      const mockTask = {
        id: 'task-1',
        agent_id: 'agent-2' // Different agent
      };

      mockSupabase.select.mockResolvedValueOnce({ data: mockTask, error: null });

      await expect(reportArchitectureFindings(
        mockSupabase as any,
        'task-1',
        [],
        'agent-1' // Different agent
      )).rejects.toThrow('Task not assigned to this agent');
    });
  });

  describe('reportRefactoringSuggestions', () => {
    it('should report refactoring suggestions', async () => {
      const mockTask = {
        id: 'task-1',
        agent_id: 'agent-1'
      };

      const mockSuggestions = [
        {
          title: 'Break Circular Dependency',
          description: 'Refactor to eliminate circular dependency',
          complexity: 'MEDIUM',
          impact: 'HIGH'
        }
      ];

      const mockReportedSuggestions = [
        {
          id: 'suggestion-1',
          task_id: 'task-1',
          title: 'Break Circular Dependency',
          description: 'Refactor to eliminate circular dependency',
          complexity: 'MEDIUM',
          impact: 'HIGH'
        }
      ];

      mockSupabase.select.mockResolvedValueOnce({ data: mockTask, error: null });
      mockSupabase.insert.mockResolvedValueOnce({ data: mockReportedSuggestions, error: null });

      const result = await reportRefactoringSuggestions(
        mockSupabase as any,
        'task-1',
        mockSuggestions,
        'agent-1'
      );

      expect(result).toEqual(mockReportedSuggestions);
      expect(mockSupabase.from).toHaveBeenCalledWith('refactoring_suggestions');
      expect(mockSupabase.insert).toHaveBeenCalledWith([
        {
          ...mockSuggestions[0],
          task_id: 'task-1'
        }
      ]);
    });
  });

  describe('requestSandboxProvisioning', () => {
    it('should request sandbox provisioning', async () => {
      const mockExecution = {
        id: 'execution-1',
        task_id: 'task-1',
        agent_id: 'agent-1',
        status: 'PROVISIONING',
        sandbox_id: 'sandbox-1234567890',
        sandbox_url: 'https://sandbox.devart.ai/sandbox-1234567890'
      };

      mockSupabase.insert.mockResolvedValueOnce({ data: mockExecution, error: null });

      const result = await requestSandboxProvisioning(
        mockSupabase as any,
        'task-1',
        'https://github.com/test/repo',
        'main',
        'agent-1'
      );

      expect(result).toEqual(mockExecution);
      expect(mockSupabase.from).toHaveBeenCalledWith('refactoring_executions');
    });
  });

  describe('executeRefactoring', () => {
    it('should execute refactoring', async () => {
      const mockExecution = {
        id: 'execution-1',
        status: 'SUCCESS',
        execution_result: {
          success: true,
          changes: [{ file: 'test.py', operation: 'refactor', description: 'Test refactor' }],
          performance_improvement: '25%',
          test_results: { passed: 15, failed: 0, skipped: 2 }
        }
      };

      // Mock the two update calls
      mockSupabase.update.mockResolvedValueOnce({ data: null, error: null }); // First update (EXECUTING)
      mockSupabase.update.mockResolvedValueOnce({ data: mockExecution, error: null }); // Second update (SUCCESS)
      mockSupabase.select.mockResolvedValueOnce({ data: mockExecution, error: null });
      mockSupabase.eq.mockReturnValue(mockSupabase); // Chain the eq calls

      const result = await executeRefactoring(
        mockSupabase as any,
        'execution-1',
        'suggestion-1',
        'agent-1'
      );

      expect(result).toEqual(mockExecution);
      expect(mockSupabase.update).toHaveBeenCalledTimes(2);
    });

    it('should handle execution failure', async () => {
      // Mock the update call to fail
      mockSupabase.update.mockResolvedValueOnce({ data: null, error: new Error('Execution failed') });

      await expect(executeRefactoring(
        mockSupabase as any,
        'execution-1',
        'suggestion-1',
        'agent-1'
      )).rejects.toThrow('Execution failed');

      // Should still call update to set status to FAILED
      expect(mockSupabase.update).toHaveBeenCalledTimes(2);
    });
  });
});