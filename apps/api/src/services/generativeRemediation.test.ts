import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getGenerativeRemediationScripts,
  getGenerativeRemediationScriptById,
  createGenerativeRemediationScript,
  updateGenerativeRemediationScript,
  deleteGenerativeRemediationScript,
  getGenerativeRemediationTemplates,
  getGenerativeRemediationTemplateById,
  createGenerativeRemediationTemplate,
  updateGenerativeRemediationTemplate,
  deleteGenerativeRemediationTemplate,
  selectTemplateForRootCause,
  approveScript,
  rejectScript
} from './generativeRemediation';

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
};

// Mock the createSupabaseClient function
vi.mock('../lib/supabase', () => ({
  createSupabaseClient: vi.fn(() => mockSupabase)
}));

describe('Generative Remediation Service', () => {
  const mockEnv = { SUPABASE_URL: 'test', SUPABASE_SERVICE_KEY: 'test' };
  
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  describe('getGenerativeRemediationScripts', () => {
    it('should fetch all generative remediation scripts', async () => {
      const mockScripts = [
        {
          id: '1',
          anomaly_id: 'anomaly-1',
          root_cause_analysis: {
            root_cause_category: 'Configuration',
            root_cause_details: 'Configuration issue detected',
            confidence_score: 'HIGH',
            suggested_actions: ['Review configuration']
          },
          generated_script: 'echo "Fix configuration"',
          script_language: 'bash',
          target_system: 'linux',
          confidence_score: 0.9,
          validation_status: 'PENDING',
          execution_status: 'PENDING',
          approval_status: 'REQUIRED',
          created_at: '2023-01-01T00:00:00Z'
        }
      ];
      
      mockSupabase.select.mockResolvedValueOnce({ data: mockScripts, error: null });
      
      const result = await getGenerativeRemediationScripts(mockEnv);
      
      expect(result).toEqual(mockScripts);
      expect(mockSupabase.from).toHaveBeenCalledWith('generative_remediation_scripts');
      expect(mockSupabase.select).toHaveBeenCalled();
    });
    
    it('should handle errors when fetching generative remediation scripts', async () => {
      mockSupabase.select.mockResolvedValueOnce({ data: null, error: new Error('Database error') });
      
      await expect(getGenerativeRemediationScripts(mockEnv)).rejects.toThrow('Failed to fetch generative remediation scripts');
    });
  });
  
  describe('getGenerativeRemediationScriptById', () => {
    it('should fetch a generative remediation script by ID', async () => {
      const mockScript = {
        id: '1',
        anomaly_id: 'anomaly-1',
        root_cause_analysis: {
          root_cause_category: 'Configuration',
          root_cause_details: 'Configuration issue detected',
          confidence_score: 'HIGH',
          suggested_actions: ['Review configuration']
        },
        generated_script: 'echo "Fix configuration"',
        script_language: 'bash',
        target_system: 'linux',
        confidence_score: 0.9,
        validation_status: 'PENDING',
        execution_status: 'PENDING',
        approval_status: 'REQUIRED',
        created_at: '2023-01-01T00:00:00Z'
      };
      
      mockSupabase.select.mockResolvedValueOnce({ data: mockScript, error: null });
      mockSupabase.eq.mockResolvedValueOnce({ data: mockScript, error: null });
      mockSupabase.single.mockResolvedValueOnce({ data: mockScript, error: null });
      
      const result = await getGenerativeRemediationScriptById(mockEnv, '1');
      
      expect(result).toEqual(mockScript);
      expect(mockSupabase.from).toHaveBeenCalledWith('generative_remediation_scripts');
      expect(mockSupabase.select).toHaveBeenCalled();
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', '1');
    });
  });
  
  describe('createGenerativeRemediationScript', () => {
    it('should create a new generative remediation script', async () => {
      const newScript = {
        anomaly_id: 'anomaly-1',
        root_cause_analysis: {
          root_cause_category: 'Configuration',
          root_cause_details: 'Configuration issue detected',
          confidence_score: 'HIGH',
          suggested_actions: ['Review configuration']
        },
        generated_script: 'echo "Fix configuration"',
        script_language: 'bash',
        target_system: 'linux',
        confidence_score: 0.9,
        validation_status: 'PENDING',
        execution_status: 'PENDING',
        approval_status: 'REQUIRED'
      };
      
      const createdScript = {
        id: '1',
        ...newScript,
        created_at: '2023-01-01T00:00:00Z'
      };
      
      mockSupabase.insert.mockResolvedValueOnce({ data: createdScript, error: null });
      mockSupabase.select.mockResolvedValueOnce({ data: createdScript, error: null });
      mockSupabase.single.mockResolvedValueOnce({ data: createdScript, error: null });
      
      const result = await createGenerativeRemediationScript(mockEnv, newScript);
      
      expect(result).toEqual(createdScript);
      expect(mockSupabase.from).toHaveBeenCalledWith('generative_remediation_scripts');
      expect(mockSupabase.insert).toHaveBeenCalledWith(newScript);
    });
  });
  
  describe('updateGenerativeRemediationScript', () => {
    it('should update a generative remediation script', async () => {
      const updates = { approval_status: 'APPROVED' };
      const updatedScript = {
        id: '1',
        anomaly_id: 'anomaly-1',
        root_cause_analysis: {
          root_cause_category: 'Configuration',
          root_cause_details: 'Configuration issue detected',
          confidence_score: 'HIGH',
          suggested_actions: ['Review configuration']
        },
        generated_script: 'echo "Fix configuration"',
        script_language: 'bash',
        target_system: 'linux',
        confidence_score: 0.9,
        validation_status: 'PENDING',
        execution_status: 'PENDING',
        approval_status: 'APPROVED',
        created_at: '2023-01-01T00:00:00Z',
        approved_at: '2023-01-01T01:00:00Z'
      };
      
      mockSupabase.update.mockResolvedValueOnce({ data: updatedScript, error: null });
      mockSupabase.eq.mockResolvedValueOnce({ data: updatedScript, error: null });
      mockSupabase.select.mockResolvedValueOnce({ data: updatedScript, error: null });
      mockSupabase.single.mockResolvedValueOnce({ data: updatedScript, error: null });
      
      const result = await updateGenerativeRemediationScript(mockEnv, '1', updates);
      
      expect(result).toEqual(updatedScript);
      expect(mockSupabase.from).toHaveBeenCalledWith('generative_remediation_scripts');
      expect(mockSupabase.update).toHaveBeenCalledWith(updates);
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', '1');
    });
  });
  
  describe('approveScript', () => {
    it('should approve a script', async () => {
      const approvedScript = {
        id: '1',
        anomaly_id: 'anomaly-1',
        root_cause_analysis: {
          root_cause_category: 'Configuration',
          root_cause_details: 'Configuration issue detected',
          confidence_score: 'HIGH',
          suggested_actions: ['Review configuration']
        },
        generated_script: 'echo "Fix configuration"',
        script_language: 'bash',
        target_system: 'linux',
        confidence_score: 0.9,
        validation_status: 'PENDING',
        execution_status: 'PENDING',
        approval_status: 'APPROVED',
        created_at: '2023-01-01T00:00:00Z',
        approved_at: '2023-01-01T01:00:00Z'
      };
      
      // Mock the updateGenerativeRemediationScript function
      const updateSpy = vi.spyOn(require('./generativeRemediation'), 'updateGenerativeRemediationScript')
        .mockResolvedValueOnce(approvedScript);
      
      const result = await approveScript(mockEnv, '1');
      
      expect(result).toEqual(approvedScript);
      expect(updateSpy).toHaveBeenCalledWith(mockEnv, '1', {
        approval_status: 'APPROVED',
        approved_at: expect.any(String)
      });
    });
  });
  
  describe('rejectScript', () => {
    it('should reject a script', async () => {
      const rejectedScript = {
        id: '1',
        anomaly_id: 'anomaly-1',
        root_cause_analysis: {
          root_cause_category: 'Configuration',
          root_cause_details: 'Configuration issue detected',
          confidence_score: 'HIGH',
          suggested_actions: ['Review configuration']
        },
        generated_script: 'echo "Fix configuration"',
        script_language: 'bash',
        target_system: 'linux',
        confidence_score: 0.9,
        validation_status: 'PENDING',
        execution_status: 'PENDING',
        approval_status: 'REJECTED',
        created_at: '2023-01-01T00:00:00Z',
        approved_at: '2023-01-01T01:00:00Z'
      };
      
      // Mock the updateGenerativeRemediationScript function
      const updateSpy = vi.spyOn(require('./generativeRemediation'), 'updateGenerativeRemediationScript')
        .mockResolvedValueOnce(rejectedScript);
      
      const result = await rejectScript(mockEnv, '1');
      
      expect(result).toEqual(rejectedScript);
      expect(updateSpy).toHaveBeenCalledWith(mockEnv, '1', {
        approval_status: 'REJECTED',
        approved_at: expect.any(String)
      });
    });
  });
  
  describe('getGenerativeRemediationTemplates', () => {
    it('should fetch all generative remediation templates', async () => {
      const mockTemplates = [
        {
          id: '1',
          root_cause_category: 'Configuration',
          template_content: 'echo "Fix configuration issue: {{issue}}"',
          target_systems: ['linux', 'unix'],
          required_capabilities: { 'bash': true },
          safety_checks: { 'no_rm_rf': true },
          template_variables: { 'issue': 'string' },
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z'
        }
      ];
      
      mockSupabase.select.mockResolvedValueOnce({ data: mockTemplates, error: null });
      
      const result = await getGenerativeRemediationTemplates(mockEnv);
      
      expect(result).toEqual(mockTemplates);
      expect(mockSupabase.from).toHaveBeenCalledWith('generative_remediation_templates');
      expect(mockSupabase.select).toHaveBeenCalled();
    });
  });
  
  describe('selectTemplateForRootCause', () => {
    it('should select the best template for a root cause category', async () => {
      const mockTemplate = {
        id: '1',
        root_cause_category: 'Configuration',
        template_content: 'echo "Fix configuration issue: {{issue}}"',
        target_systems: ['linux', 'unix'],
        required_capabilities: { 'bash': true },
        safety_checks: { 'no_rm_rf': true },
        template_variables: { 'issue': 'string' },
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
      };
      
      mockSupabase.select.mockResolvedValueOnce({ data: mockTemplate, error: null });
      mockSupabase.eq.mockResolvedValueOnce({ data: mockTemplate, error: null });
      mockSupabase.order.mockResolvedValueOnce({ data: mockTemplate, error: null });
      mockSupabase.limit.mockResolvedValueOnce({ data: mockTemplate, error: null });
      mockSupabase.single.mockResolvedValueOnce({ data: mockTemplate, error: null });
      
      const result = await selectTemplateForRootCause(mockEnv, 'Configuration');
      
      expect(result).toEqual(mockTemplate);
      expect(mockSupabase.from).toHaveBeenCalledWith('generative_remediation_templates');
      expect(mockSupabase.select).toHaveBeenCalled();
      expect(mockSupabase.eq).toHaveBeenCalledWith('root_cause_category', 'Configuration');
    });
  });
});