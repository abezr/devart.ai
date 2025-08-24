import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Creates a new architecture analysis task
 * @param supabase Supabase client
 * @param taskData Task data
 * @returns Created task
 */
export async function createArchitectureAnalysisTask(
  supabase: SupabaseClient,
  taskData: {
    title: string;
    description?: string;
    repository_url: string;
    branch?: string;
    analysis_scope?: string;
    target_modules?: string[];
    created_by?: string;
  }
) {
  try {
    const { data, error } = await supabase
      .from('architecture_analysis_tasks')
      .insert({
        title: taskData.title,
        description: taskData.description,
        repository_url: taskData.repository_url,
        branch: taskData.branch || 'main',
        analysis_scope: taskData.analysis_scope,
        target_modules: taskData.target_modules,
        created_by: taskData.created_by,
        status: 'TODO'
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating architecture analysis task:', error);
      throw new Error('Could not create architecture analysis task');
    }

    return data;
  } catch (err) {
    console.error('Unexpected error creating architecture analysis task:', err);
    throw err;
  }
}

/**
 * Gets an architecture analysis task by ID
 * @param supabase Supabase client
 * @param taskId Task ID
 * @returns Task data
 */
export async function getArchitectureAnalysisTask(
  supabase: SupabaseClient,
  taskId: string
) {
  try {
    const { data, error } = await supabase
      .from('architecture_analysis_tasks')
      .select(`
        *,
        findings:architecture_findings(*),
        suggestions:refactoring_suggestions(*)
      `)
      .eq('id', taskId)
      .single();

    if (error) {
      console.error('Error fetching architecture analysis task:', error);
      throw new Error('Could not fetch architecture analysis task');
    }

    return data;
  } catch (err) {
    console.error('Unexpected error fetching architecture analysis task:', err);
    throw err;
  }
}

/**
 * Updates the status of an architecture analysis task
 * @param supabase Supabase client
 * @param taskId Task ID
 * @param status New status
 * @param agentId Agent ID (optional)
 * @returns Updated task
 */
export async function updateArchitectureAnalysisTaskStatus(
  supabase: SupabaseClient,
  taskId: string,
  status: string,
  agentId?: string
) {
  try {
    const updates: any = { status, updated_at: new Date() };
    if (agentId) {
      updates.agent_id = agentId;
    }

    const { data, error } = await supabase
      .from('architecture_analysis_tasks')
      .update(updates)
      .eq('id', taskId)
      .select()
      .single();

    if (error) {
      console.error('Error updating architecture analysis task status:', error);
      throw new Error('Could not update architecture analysis task status');
    }

    return data;
  } catch (err) {
    console.error('Unexpected error updating architecture analysis task status:', err);
    throw err;
  }
}

/**
 * Reports architecture findings for a task
 * @param supabase Supabase client
 * @param taskId Task ID
 * @param findings Array of findings
 * @param agentId Agent ID
 * @returns Reported findings
 */
export async function reportArchitectureFindings(
  supabase: SupabaseClient,
  taskId: string,
  findings: any[],
  agentId: string
) {
  try {
    // First verify the task exists and is assigned to this agent
    const { data: task, error: taskError } = await supabase
      .from('architecture_analysis_tasks')
      .select('id, agent_id')
      .eq('id', taskId)
      .single();

    if (taskError || !task) {
      throw new Error('Task not found');
    }

    if (task.agent_id !== agentId) {
      throw new Error('Task not assigned to this agent');
    }

    // Insert findings
    const findingsWithTaskId = findings.map(finding => ({
      ...finding,
      task_id: taskId
    }));

    const { data, error } = await supabase
      .from('architecture_findings')
      .insert(findingsWithTaskId)
      .select();

    if (error) {
      console.error('Error reporting architecture findings:', error);
      throw new Error('Could not report architecture findings');
    }

    return data;
  } catch (err) {
    console.error('Unexpected error reporting architecture findings:', err);
    throw err;
  }
}

/**
 * Reports refactoring suggestions for a task
 * @param supabase Supabase client
 * @param taskId Task ID
 * @param suggestions Array of suggestions
 * @param agentId Agent ID
 * @returns Reported suggestions
 */
export async function reportRefactoringSuggestions(
  supabase: SupabaseClient,
  taskId: string,
  suggestions: any[],
  agentId: string
) {
  try {
    // First verify the task exists and is assigned to this agent
    const { data: task, error: taskError } = await supabase
      .from('architecture_analysis_tasks')
      .select('id, agent_id')
      .eq('id', taskId)
      .single();

    if (taskError || !task) {
      throw new Error('Task not found');
    }

    if (task.agent_id !== agentId) {
      throw new Error('Task not assigned to this agent');
    }

    // Insert suggestions
    const suggestionsWithTaskId = suggestions.map(suggestion => ({
      ...suggestion,
      task_id: taskId
    }));

    const { data, error } = await supabase
      .from('refactoring_suggestions')
      .insert(suggestionsWithTaskId)
      .select();

    if (error) {
      console.error('Error reporting refactoring suggestions:', error);
      throw new Error('Could not report refactoring suggestions');
    }

    return data;
  } catch (err) {
    console.error('Unexpected error reporting refactoring suggestions:', err);
    throw err;
  }
}

/**
 * Requests sandbox provisioning for refactoring execution
 * @param supabase Supabase client
 * @param taskId Task ID
 * @param repositoryUrl Repository URL
 * @param branch Branch
 * @param agentId Agent ID
 * @returns Provisioning result
 */
export async function requestSandboxProvisioning(
  supabase: SupabaseClient,
  taskId: string,
  repositoryUrl: string,
  branch: string,
  agentId: string
) {
  try {
    // In a real implementation, this would call the Kubernetes service to provision a sandbox
    // For now, we'll simulate the response
    const sandboxId = `sandbox-${Date.now()}`;
    const sandboxUrl = `https://sandbox.devart.ai/${sandboxId}`;

    // Create a refactoring execution record
    const { data, error } = await supabase
      .from('refactoring_executions')
      .insert({
        task_id: taskId,
        agent_id: agentId,
        status: 'PROVISIONING',
        sandbox_id: sandboxId,
        sandbox_url: sandboxUrl
      })
      .select()
      .single();

    if (error) {
      console.error('Error requesting sandbox provisioning:', error);
      throw new Error('Could not request sandbox provisioning');
    }

    return data;
  } catch (err) {
    console.error('Unexpected error requesting sandbox provisioning:', err);
    throw err;
  }
}

/**
 * Executes a refactoring suggestion
 * @param supabase Supabase client
 * @param executionId Execution ID
 * @param suggestionId Suggestion ID
 * @param agentId Agent ID
 * @returns Execution result
 */
export async function executeRefactoring(
  supabase: SupabaseClient,
  executionId: string,
  suggestionId: string,
  agentId: string
) {
  try {
    // Update execution status to EXECUTING
    await supabase
      .from('refactoring_executions')
      .update({
        status: 'EXECUTING',
        started_at: new Date()
      })
      .eq('id', executionId)
      .eq('agent_id', agentId);

    // In a real implementation, this would execute the refactoring in the sandbox
    // For now, we'll simulate the execution
    const executionResult = {
      success: true,
      changes: [
        {
          file: 'src/moduleA/service.py',
          operation: 'refactor',
          description: 'Removed circular dependency'
        }
      ],
      performance_improvement: '25%',
      test_results: {
        passed: 15,
        failed: 0,
        skipped: 2
      }
    };

    // Update execution status to SUCCESS and record results
    const { data, error } = await supabase
      .from('refactoring_executions')
      .update({
        status: 'SUCCESS',
        execution_result: executionResult,
        completed_at: new Date()
      })
      .eq('id', executionId)
      .eq('agent_id', agentId)
      .select()
      .single();

    if (error) {
      console.error('Error updating refactoring execution:', error);
      throw new Error('Could not update refactoring execution');
    }

    return data;
  } catch (err) {
    console.error('Unexpected error executing refactoring:', err);
    
    // Update execution status to FAILED
    await supabase
      .from('refactoring_executions')
      .update({
        status: 'FAILED',
        completed_at: new Date()
      })
      .eq('id', executionId)
      .eq('agent_id', agentId);
    
    throw err;
  }
}