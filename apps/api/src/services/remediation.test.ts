import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getRemediationActions,
  getActiveRemediationActionsByCategory,
  createRemediationAction,
  updateRemediationAction,
  deleteRemediationAction,
  getRemediationLogs,
  logRemediationExecution,
  executeRemediationAction,
  shouldExecuteAutomatically,
  RemediationAction
} from './remediation';

// Mock the Supabase client
const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn().mockReturnThis(),
  rpc: vi.fn().mockReturnThis(),
};

// Mock the createSupabaseClient function
vi.mock('../lib/supabase', () => ({
  createSupabaseClient: vi.fn(() => mockSupabase)
}));

describe('Remediation Service', () => {
  const mockEnv = { SUPABASE_URL: 'test', SUPABASE_SERVICE_KEY: 'test' };
  
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  describe('getRemediationActions', () => {
    it('should fetch all remediation actions', async () => {
      const mockActions = [
        {
          id: '1',
          root_cause_category: 'Configuration',
          action_type: 'ROLLBACK',
          action_parameters: {},
          confidence_threshold: 'HIGH',
          is_active: true,
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z'
        }
      ];
      
      mockSupabase.select.mockResolvedValueOnce({ data: mockActions, error: null });
      
      const result = await getRemediationActions(mockEnv);
      
      expect(result).toEqual(mockActions);
      expect(mockSupabase.from).toHaveBeenCalledWith('remediation_actions');
      expect(mockSupabase.select).toHaveBeenCalled();
    });
    
    it('should handle errors when fetching remediation actions', async () => {
      mockSupabase.select.mockResolvedValueOnce({ data: null, error: new Error('Database error') });
      
      await expect(getRemediationActions(mockEnv)).rejects.toThrow('Failed to fetch remediation actions');
    });
  });
  
  describe('getActiveRemediationActionsByCategory', () => {
    it('should fetch active remediation actions by category', async () => {
      const mockActions = [
        {
          id: '1',
          root_cause_category: 'Configuration',
          action_type: 'ROLLBACK',
          action_parameters: {},
          confidence_threshold: 'HIGH',
          is_active: true,
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z'
        }
      ];
      
      mockSupabase.select.mockResolvedValueOnce({ data: mockActions, error: null });
      mockSupabase.eq.mockResolvedValueOnce({ data: mockActions, error: null });
      
      const result = await getActiveRemediationActionsByCategory(mockEnv, 'Configuration');
      
      expect(result).toEqual(mockActions);
      expect(mockSupabase.from).toHaveBeenCalledWith('remediation_actions');
      expect(mockSupabase.select).toHaveBeenCalled();
      expect(mockSupabase.eq).toHaveBeenCalledWith('root_cause_category', 'Configuration');
      expect(mockSupabase.eq).toHaveBeenCalledWith('is_active', true);
    });
  });
  
  describe('createRemediationAction', () => {
    it('should create a new remediation action', async () => {
      const newAction = {
        root_cause_category: 'Configuration',
        action_type: 'ROLLBACK',
        action_parameters: {},
        confidence_threshold: 'HIGH',
        is_active: true
      };
      
      const createdAction = {
        id: '1',
        ...newAction,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
      };
      
      // Mock role check to return true (supervisor role)
      mockSupabase.rpc.mockResolvedValueOnce({ data: { role: 'supervisor' }, error: null });
      mockSupabase.insert.mockResolvedValueOnce({ data: createdAction, error: null });
      mockSupabase.select.mockResolvedValueOnce({ data: createdAction, error: null });
      mockSupabase.single.mockResolvedValueOnce({ data: createdAction, error: null });
      
      const result = await createRemediationAction(mockEnv, newAction);
      
      expect(result).toEqual(createdAction);
      expect(mockSupabase.from).toHaveBeenCalledWith('remediation_actions');
      expect(mockSupabase.insert).toHaveBeenCalledWith(newAction);
    });
    
    it('should reject creation for users without proper permissions', async () => {
      const newAction = {
        root_cause_category: 'Configuration',
        action_type: 'ROLLBACK',
        action_parameters: {},
        confidence_threshold: 'HIGH',
        is_active: true
      };
      
      // Mock role check to return false (viewer role)
      mockSupabase.rpc.mockResolvedValueOnce({ data: { role: 'viewer' }, error: null });
      
      await expect(createRemediationAction(mockEnv, newAction)).rejects.toThrow('Insufficient permissions to create remediation actions');
    });
  });
  
  describe('shouldExecuteAutomatically', () => {
    it('should return true when confidence meets threshold', () => {
      const action: RemediationAction = {
        id: '1',
        root_cause_category: 'Configuration',
        action_type: 'ROLLBACK',
        action_parameters: {},
        confidence_threshold: 'MEDIUM',
        is_active: true,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
      };
      
      expect(shouldExecuteAutomatically(action, 'HIGH')).toBe(true);
      expect(shouldExecuteAutomatically(action, 'MEDIUM')).toBe(true);
    });
    
    it('should return false when confidence does not meet threshold', () => {
      const action: RemediationAction = {
        id: '1',
        root_cause_category: 'Configuration',
        action_type: 'ROLLBACK',
        action_parameters: {},
        confidence_threshold: 'HIGH',
        is_active: true,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
      };
      
      expect(shouldExecuteAutomatically(action, 'LOW')).toBe(false);
      expect(shouldExecuteAutomatically(action, 'MEDIUM')).toBe(false);
    });
  });
  
  describe('executeRemediationAction', () => {
    it('should execute a notify action successfully', async () => {
      const action: RemediationAction = {
        id: '1',
        root_cause_category: 'Configuration',
        action_type: 'NOTIFY',
        action_parameters: { message: 'Test notification', recipients: ['test@example.com'] },
        confidence_threshold: 'HIGH',
        is_active: true,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
      };
      
      // Mock the logRemediationExecution function
      const logSpy = vi.spyOn(require('./remediation'), 'logRemediationExecution')
        .mockResolvedValueOnce({
          id: 'log1',
          anomaly_id: null,
          action_id: '1',
          execution_status: 'SUCCESS',
          execution_result: { message: 'Notification sent successfully' },
          executed_at: '2023-01-01T00:00:00Z',
          executed_by: 'AUTOMATED'
        });
      
      const result = await executeRemediationAction(mockEnv, action);
      
      expect(result.status).toBe('SUCCESS');
      expect(logSpy).toHaveBeenCalledWith(mockEnv, {
        anomaly_id: null,
        action_id: '1',
        execution_status: 'SUCCESS',
        execution_result: { message: 'Notification sent successfully', recipients: ['test@example.com'] },
        executed_by: 'AUTOMATED'
      });
    });
  });
});