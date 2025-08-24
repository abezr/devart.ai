import { Env } from '../lib/types';
import { createSupabaseClient } from '../lib/supabase';

/**
 * User role types
 */
type UserRole = 'admin' | 'supervisor' | 'viewer';

/**
 * Check if user has required role
 * @param env Environment variables
 * @param requiredRole The required role
 * @returns Promise resolving to whether user has required role
 */
async function checkUserRole(env: Env, requiredRole: UserRole): Promise<boolean> {
  const supabase = createSupabaseClient(env);
  
  try {
    // This is a simplified implementation
    // In a real system, you would check the user's actual role from the database
    const { data, error } = await supabase.rpc('get_my_role');
    
    if (error) {
      console.error('Error fetching user role:', error);
      return false;
    }
    
    const userRole: UserRole = data?.role || 'viewer';
    
    // Define role hierarchy
    const roleHierarchy: Record<UserRole, number> = {
      'admin': 3,
      'supervisor': 2,
      'viewer': 1
    };
    
    return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
  } catch (error) {
    console.error('Error checking user role:', error);
    return false;
  }
}

/**
 * Remediation action types
 */
export type RemediationActionType = 'ROLLBACK' | 'RESTART' | 'SCALE' | 'NOTIFY' | 'REQUEUE';

/**
 * Confidence threshold levels
 */
export type ConfidenceThreshold = 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Remediation action interface
 */
export interface RemediationAction {
  id: string;
  root_cause_category: string;
  root_cause_details?: string;
  action_type: RemediationActionType;
  action_parameters: Record<string, any>;
  confidence_threshold: ConfidenceThreshold;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Remediation log interface
 */
export interface RemediationLog {
  id: string;
  anomaly_id: string;
  action_id: string;
  execution_status: 'SUCCESS' | 'FAILED' | 'PARTIAL';
  execution_result: Record<string, any>;
  executed_at: string;
  executed_by: 'AUTOMATED' | 'MANUAL';
}

/**
 * Supported remediation actions
 */
export interface RemediationActions {
  ROLLBACK: {
    config_key: string;
    previous_value: string;
    service_id: string;
  };
  RESTART: {
    service_id: string;
    container_id?: string;
    grace_period?: number;
  };
  SCALE: {
    service_id: string;
    resource_type: 'CPU' | 'MEMORY' | 'INSTANCES';
    scale_direction: 'UP' | 'DOWN';
    scale_amount: number;
  };
  NOTIFY: {
    message: string;
    recipients: string[];
  };
  REQUEUE: {
    task_id: string;
    delay_ms: number;
  };
}

/**
 * Get all remediation actions
 * @param env Environment variables
 * @returns Array of remediation actions
 */
export async function getRemediationActions(env: Env): Promise<RemediationAction[]> {
  const supabase = createSupabaseClient(env);
  
  const { data, error } = await supabase
    .from('remediation_actions')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching remediation actions:', error);
    throw new Error('Failed to fetch remediation actions');
  }
  
  return data || [];
}

/**
 * Get active remediation actions by root cause category
 * @param env Environment variables
 * @param rootCauseCategory Root cause category
 * @returns Array of active remediation actions
 */
export async function getActiveRemediationActionsByCategory(
  env: Env, 
  rootCauseCategory: string
): Promise<RemediationAction[]> {
  const supabase = createSupabaseClient(env);
  
  const { data, error } = await supabase
    .from('remediation_actions')
    .select('*')
    .eq('root_cause_category', rootCauseCategory)
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching remediation actions by category:', error);
    throw new Error('Failed to fetch remediation actions by category');
  }
  
  return data || [];
}

/**
 * Create a new remediation action
 * @param env Environment variables
 * @param action Remediation action to create
 * @returns Created remediation action
 */
export async function createRemediationAction(
  env: Env, 
  action: Omit<RemediationAction, 'id' | 'created_at' | 'updated_at'>
): Promise<RemediationAction> {
  // Check if user has required role (supervisor or admin)
  const hasPermission = await checkUserRole(env, 'supervisor');
  if (!hasPermission) {
    throw new Error('Insufficient permissions to create remediation actions');
  }
  
  const supabase = createSupabaseClient(env);
  
  const { data, error } = await supabase
    .from('remediation_actions')
    .insert(action)
    .select()
    .single();
  
  if (error) {
    console.error('Error creating remediation action:', error);
    throw new Error('Failed to create remediation action');
  }
  
  return data;
}

/**
 * Update a remediation action
 * @param env Environment variables
 * @param id Action ID
 * @param updates Updates to apply
 * @returns Updated remediation action
 */
export async function updateRemediationAction(
  env: Env, 
  id: string, 
  updates: Partial<RemediationAction>
): Promise<RemediationAction> {
  // Check if user has required role (supervisor or admin)
  const hasPermission = await checkUserRole(env, 'supervisor');
  if (!hasPermission) {
    throw new Error('Insufficient permissions to update remediation actions');
  }
  
  const supabase = createSupabaseClient(env);
  
  const { data, error } = await supabase
    .from('remediation_actions')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating remediation action:', error);
    throw new Error('Failed to update remediation action');
  }
  
  return data;
}

/**
 * Delete a remediation action
 * @param env Environment variables
 * @param id Action ID
 */
export async function deleteRemediationAction(env: Env, id: string): Promise<void> {
  // Check if user has required role (supervisor or admin)
  const hasPermission = await checkUserRole(env, 'supervisor');
  if (!hasPermission) {
    throw new Error('Insufficient permissions to delete remediation actions');
  }
  
  const supabase = createSupabaseClient(env);
  
  const { error } = await supabase
    .from('remediation_actions')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('Error deleting remediation action:', error);
    throw new Error('Failed to delete remediation action');
  }
}

/**
 * Get remediation logs
 * @param env Environment variables
 * @param limit Number of logs to retrieve (default: 50)
 * @returns Array of remediation logs
 */
export async function getRemediationLogs(
  env: Env, 
  limit: number = 50
): Promise<RemediationLog[]> {
  const supabase = createSupabaseClient(env);
  
  const { data, error } = await supabase
    .from('remediation_logs')
    .select('*')
    .order('executed_at', { ascending: false })
    .limit(limit);
  
  if (error) {
    console.error('Error fetching remediation logs:', error);
    throw new Error('Failed to fetch remediation logs');
  }
  
  return data || [];
}

/**
 * Log a remediation execution
 * @param env Environment variables
 * @param log Remediation log entry
 * @returns Created remediation log
 */
export async function logRemediationExecution(
  env: Env, 
  log: Omit<RemediationLog, 'id' | 'executed_at'>
): Promise<RemediationLog> {
  const supabase = createSupabaseClient(env);
  
  const { data, error } = await supabase
    .from('remediation_logs')
    .insert({
      ...log,
      executed_at: new Date().toISOString()
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error logging remediation execution:', error);
    throw new Error('Failed to log remediation execution');
  }
  
  return data;
}

/**
 * Execute a remediation action
 * @param env Environment variables
 * @param action The remediation action to execute
 * @param executedBy Who executed the action ('AUTOMATED' or 'MANUAL')
 * @returns Execution result
 */
export async function executeRemediationAction(
  env: Env,
  action: RemediationAction,
  executedBy: 'AUTOMATED' | 'MANUAL' = 'AUTOMATED'
): Promise<{ status: 'SUCCESS' | 'FAILED' | 'PARTIAL'; result: any }> {
  try {
    let result: any;
    
    // Execute the appropriate action based on action_type
    switch (action.action_type) {
      case 'NOTIFY':
        result = await executeNotifyAction(env, action.action_parameters);
        break;
      case 'RESTART':
        result = await executeRestartAction(env, action.action_parameters);
        break;
      case 'SCALE':
        result = await executeScaleAction(env, action.action_parameters);
        break;
      case 'ROLLBACK':
        result = await executeRollbackAction(env, action.action_parameters);
        break;
      case 'REQUEUE':
        result = await executeRequeueAction(env, action.action_parameters);
        break;
      default:
        throw new Error(`Unsupported action type: ${action.action_type}`);
    }
    
    // Log successful execution
    await logRemediationExecution(env, {
      anomaly_id: action.action_parameters.anomaly_id || null,
      action_id: action.id,
      execution_status: 'SUCCESS',
      execution_result: result,
      executed_by: executedBy
    });
    
    return { status: 'SUCCESS', result };
  } catch (error) {
    console.error('Error executing remediation action:', error);
    
    // Log failed execution
    await logRemediationExecution(env, {
      anomaly_id: action.action_parameters.anomaly_id || null,
      action_id: action.id,
      execution_status: 'FAILED',
      execution_result: { error: error.message },
      executed_by: executedBy
    });
    
    return { status: 'FAILED', result: { error: error.message } };
  }
}

/**
 * Execute notify action
 * @param env Environment variables
 * @param params Action parameters
 * @returns Execution result
 */
async function executeNotifyAction(
  env: Env, 
  params: RemediationActions['NOTIFY']
): Promise<any> {
  // In a real implementation, this would send notifications via email, Slack, etc.
  console.log('Executing NOTIFY action:', params);
  return { message: 'Notification sent successfully', recipients: params.recipients };
}

/**
 * Execute restart action
 * @param env Environment variables
 * @param params Action parameters
 * @returns Execution result
 */
async function executeRestartAction(
  env: Env, 
  params: RemediationActions['RESTART']
): Promise<any> {
  // In a real implementation, this would interact with Kubernetes or service management APIs
  console.log('Executing RESTART action:', params);
  return { message: `Service ${params.service_id} restarted successfully` };
}

/**
 * Execute scale action
 * @param env Environment variables
 * @param params Action parameters
 * @returns Execution result
 */
async function executeScaleAction(
  env: Env, 
  params: RemediationActions['SCALE']
): Promise<any> {
  // In a real implementation, this would interact with Kubernetes or cloud provider APIs
  console.log('Executing SCALE action:', params);
  return { 
    message: `Service ${params.service_id} scaled ${params.scale_direction} by ${params.scale_amount} ${params.resource_type}` 
  };
}

/**
 * Execute rollback action
 * @param env Environment variables
 * @param params Action parameters
 * @returns Execution result
 */
async function executeRollbackAction(
  env: Env, 
  params: RemediationActions['ROLLBACK']
): Promise<any> {
  // In a real implementation, this would interact with configuration management systems
  console.log('Executing ROLLBACK action:', params);
  return { 
    message: `Configuration ${params.config_key} rolled back to previous value` 
  };
}

/**
 * Execute requeue action
 * @param env Environment variables
 * @param params Action parameters
 * @returns Execution result
 */
async function executeRequeueAction(
  env: Env, 
  params: RemediationActions['REQUEUE']
): Promise<any> {
  // In a real implementation, this would interact with RabbitMQ or task queue systems
  console.log('Executing REQUEUE action:', params);
  return { 
    message: `Task ${params.task_id} requeued with ${params.delay_ms}ms delay` 
  };
}

/**
 * Determine if an action should be executed automatically based on confidence score
 * @param action The remediation action
 * @param confidenceScore The confidence score of the root cause analysis
 * @returns Whether the action should be executed automatically
 */
export function shouldExecuteAutomatically(
  action: RemediationAction, 
  confidenceScore: ConfidenceThreshold
): boolean {
  // Define the order of confidence levels
  const confidenceOrder: Record<ConfidenceThreshold, number> = {
    'HIGH': 3,
    'MEDIUM': 2,
    'LOW': 1
  };
  
  // Check if the action's confidence threshold is met
  return confidenceOrder[confidenceScore] >= confidenceOrder[action.confidence_threshold];
}