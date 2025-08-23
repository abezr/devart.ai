#!/usr/bin/env node
/**
 * Test script for the task failure reporting with exponential backoff.
 * This script tests the exponential backoff functionality in the report-failure endpoint.
 */

// Mock Supabase client for testing
const mockSupabase = {
  from: (table: string) => ({
    select: (fields: string) => ({
      eq: (field: string, value: any) => ({
        single: () => {
          if (table === 'tasks') {
            return Promise.resolve({
              data: {
                retry_count: 0,
                max_retries: 3
              },
              error: null
            });
          }
          return Promise.resolve({ data: {}, error: null });
        }
      })
    }),
    update: (data: any) => ({
      eq: (field: string, value: any) => ({
        select: () => ({
          single: () => Promise.resolve({ data: { id: value, ...data }, error: null })
        })
      })
    })
  }),
  rpc: (functionName: string, params: any) => {
    return Promise.resolve({ data: {}, error: null });
  }
};

// Mock republishTaskWithDelay function
async function mockRepublishTaskWithDelay(taskId: string, delayMs: number) {
  console.log(`Mock republishing task ${taskId} with ${delayMs}ms delay`);
  return Promise.resolve();
}

// Test the exponential backoff calculation
function testExponentialBackoff() {
  console.log('Testing exponential backoff calculation...');
  
  const baseDelay = 5000; // 5 seconds
  const maxDelay = 300000; // 5 minutes
  
  for (let retryCount = 0; retryCount < 10; retryCount++) {
    const delayMs = baseDelay * Math.pow(2, retryCount);
    const finalDelay = Math.min(delayMs, maxDelay);
    
    console.log(`Retry ${retryCount}: ${delayMs}ms (capped at ${finalDelay}ms)`);
  }
  
  console.log('Exponential backoff calculation test completed');
}

// Test the task failure reporting logic
async function testTaskFailureReporting() {
  console.log('Testing task failure reporting with exponential backoff...');
  
  const taskId = 'test-task-003';
  const agentId = 'test-agent-001';
  const errorMessage = 'Test error message';
  
  try {
    // Mock the request context
    const c = {
      req: {
        param: (param: string) => {
          if (param === 'taskId') return taskId;
          return null;
        },
        json: async () => ({ agentId, errorMessage })
      },
      json: (data: any, status?: number) => {
        console.log(`Response: ${JSON.stringify(data)}, Status: ${status}`);
        return { json: () => data };
      }
    };
    
    // Simulate the endpoint logic
    const { data: task, error: fetchError } = await mockSupabase.from('tasks')
      .select('retry_count, max_retries')
      .eq('id', taskId)
      .eq('agent_id', agentId)
      .single();
    
    if (fetchError || !task) {
      console.log('Task not found or agent not authorized.');
      return;
    }
    
    const newRetryCount = task.retry_count + 1;
    let nextStatus = 'TODO';
    
    if (newRetryCount >= task.max_retries) {
      nextStatus = 'QUARANTINED';
    }
    
    const { data: updatedTask, error: updateError } = await mockSupabase.from('tasks')
      .update({
        status: nextStatus,
        retry_count: newRetryCount,
        last_error: errorMessage,
        agent_id: null,
      })
      .eq('id', taskId)
      .select()
      .single();
    
    console.log(`Task updated: ${JSON.stringify(updatedTask)}`);
    
    if (nextStatus === 'TODO') {
      // Calculate exponential backoff delay
      const baseDelay = 5000; // 5 seconds base delay
      const delayMs = baseDelay * Math.pow(2, task.retry_count);
      const maxDelay = 300000; // Maximum 5 minutes delay
      const finalDelay = Math.min(delayMs, maxDelay);
      
      console.log(`Republishing task with ${finalDelay}ms delay`);
      await mockRepublishTaskWithDelay(taskId, finalDelay);
    }
    
    console.log('Task failure reporting test completed successfully');
  } catch (error) {
    console.error('Error during task failure reporting test:', error);
  }
}

// Run the tests
async function runTests() {
  testExponentialBackoff();
  console.log('---');
  await testTaskFailureReporting();
}

runTests();