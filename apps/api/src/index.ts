import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createSupabaseClient } from './lib/supabase';
import { checkAndChargeService, getAllServicesStatus } from './services/budget';
import { sendTelegramMessage } from './services/telegram';
import { generateEmbedding } from './services/embedding';
import { postPRComment, createCheckRun } from './services/github';

// Import the RabbitMQ service functions
import { publishTask } from './services/rabbitmq';

// Import the Kubernetes service functions
import { provisionSandbox, terminateSandbox } from './services/kubernetes';

// This is the Cloudflare environment, which includes secrets
export type Env = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  OPENAI_API_KEY?: string; // For Intelligence and Analytics Layer embeddings
  GITHUB_WEBHOOK_SECRET?: string; // For GitHub webhook verification
};

const app = new Hono<{ Bindings: Env }>();

// Add CORS middleware to allow requests from our UI
app.use('/api/*', cors({
  origin: ['http://localhost:3000', 'https://devart.ai'], // Add your production UI URL here
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

// Helper function for GitHub signature verification
async function verifyGitHubSignature(secret: string, request: Request, body: string): Promise<boolean> {
  const signature = request.headers.get('x-hub-signature-256');
  if (!signature) return false;

  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  const hexMac = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, '0')).join('');
  
  return `sha256=${hexMac}` === signature;
}


// --- API Routes ---

app.get('/api', (c) => {
  return c.json({ message: 'Welcome to the devart.ai Supervisor API!' });
});

// Get all services from service_registry table
app.get('/api/services', async (c) => {
  try {
    const supabase = createSupabaseClient(c.env);
    const { data, error } = await supabase.from('service_registry').select('*');

    if (error) {
      console.error('Error fetching services:', error);
      return c.json({ error: 'Could not fetch services' }, 500);
    }
    return c.json(data);
  } catch (err) {
    console.error('Unexpected error fetching services:', err);
    return c.json({ error: 'Could not fetch services' }, 500);
  }
});

// Increase a service's budget and reactivate it
app.post('/api/services/:id/increase-budget', async (c) => {
  try {
    const serviceId = c.req.param('id');
    const { increaseAmount } = await c.req.json<{ increaseAmount: number }>();

    if (!increaseAmount || increaseAmount <= 0) {
      return c.json({ error: 'A positive increaseAmount is required' }, 400);
    }

    const supabase = createSupabaseClient(c.env);

    // Fetch the current budget first to perform the addition
    const { data: currentService, error: fetchError } = await supabase
      .from('service_registry')
      .select('monthly_budget_usd')
      .eq('id', serviceId)
      .single();

    if (fetchError || !currentService) {
      return c.json({ error: 'Service not found' }, 404);
    }

    const newBudget = currentService.monthly_budget_usd + increaseAmount;

    const { data, error } = await supabase
      .from('service_registry')
      .update({
        monthly_budget_usd: newBudget,
        status: 'ACTIVE', // Reactivate the service
      })
      .eq('id', serviceId)
      .select()
      .single();

    if (error) {
      console.error('Error updating budget:', error);
      return c.json({ error: 'Could not update budget' }, 500);
    }

    return c.json(data);
  } catch (err) {
    console.error('Unexpected error in budget increase:', err);
    return c.json({ error: 'Could not update budget' }, 500);
  }
});

// Get all services status for monitoring
app.get('/api/services/status', async (c) => {
  try {
    const supabase = createSupabaseClient(c.env);
    const services = await getAllServicesStatus(supabase);
    return c.json(services);
  } catch (err) {
    console.error('Error fetching services status:', err);
    return c.json({ error: 'Failed to fetch services status' }, 500);
  }
});

// Orchestration Engine: Get all agents for monitoring
app.get('/api/agents', async (c) => {
  try {
    const supabase = createSupabaseClient(c.env);
    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .order('last_seen', { ascending: false });
    
    if (error) {
      console.error('Error fetching agents:', error);
      return c.json({ error: error.message }, 500);
    }
    
    return c.json(data || []);
  } catch (err) {
    console.error('Unexpected error fetching agents:', err);
    return c.json({ error: 'Failed to fetch agents' }, 500);
  }
});

// Example route to get all tasks
app.get('/api/tasks', async (c) => {
  try {
    const supabase = createSupabaseClient(c.env);
    const { data, error } = await supabase.from('tasks').select('*');
    
    if (error) {
      console.error('Error fetching tasks:', error);
      return c.json({ error: error.message }, 500);
    }
    
    return c.json(data || []);
  } catch (err) {
    console.error('Unexpected error fetching tasks:', err);
    return c.json({ error: 'Failed to fetch tasks' }, 500);
  }
});

// Human-Supervisor Interface: Task Management Endpoints
const VALID_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

// POST /api/tasks/:taskId/create-successor - Create a successor task (for task chaining)
app.post('/api/tasks/:taskId/create-successor', async (c) => {
  const parentTaskId = c.req.param('taskId');
  const { title, description } = await c.req.json<{
    title: string;
    description?: string;
  }>();

  if (!title) {
    return c.json({ error: 'Successor task title is required' }, 400);
  }

  const supabase = createSupabaseClient(c.env);

  // 1. Fetch the parent task to inherit its properties
  const { data: parentTask, error: fetchError } = await supabase
    .from('tasks')
    .select('priority, parent_task_id')
    .eq('id', parentTaskId)
    .single();

  if (fetchError || !parentTask) {
    return c.json({ error: 'Parent task not found' }, 404);
  }

  // 2. Check if the parent task was part of a workflow
  let workflowCheck;
  if (parentTask.parent_task_id) {
    // If the parent has a parent, check if that ancestor is part of a workflow
    workflowCheck = await supabase
      .from('task_templates as tt')
      .select('tt.workflow_id, tt.stage_order')
      .join('tasks as t', 't.id', 'tt.id')
      .join('tasks as parent', 'parent.parent_task_id', 't.id')
      .eq('parent.id', parentTaskId);
  } else {
    // Otherwise, check if the parent itself is part of a workflow
    workflowCheck = await supabase
      .from('task_templates')
      .select('workflow_id, stage_order')
      .eq('id', parentTaskId);
  }

  const { data: workflowData, error: workflowError } = workflowCheck;

  // 3. If parent is part of a workflow, find the next task template
  if (!workflowError && workflowData && workflowData.length > 0) {
    const workflow = workflowData[0];
    
    // Get the next task template in the sequence
    const { data: nextTaskTemplate, error: nextTemplateError } = await supabase
      .from('task_templates')
      .select('*')
      .eq('workflow_id', workflow.workflow_id)
      .eq('stage_order', workflow.stage_order + 1)
      .single();

    if (!nextTemplateError && nextTaskTemplate) {
      // Create the next task in the workflow
      const { data: successorTask, error: insertError } = await supabase
        .from('tasks')
        .insert({
          title: nextTaskTemplate.title_template, // In a real implementation, this would be rendered with context
          description: nextTaskTemplate.description_template || undefined,
          priority: nextTaskTemplate.priority,
          status: 'TODO',
          parent_task_id: parentTaskId, // Link to the parent
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating successor task:', insertError);
        return c.json({ error: 'Could not create successor task' }, 500);
      }

      return c.json(successorTask, 201);
    }
  }

  // 4. If not part of a workflow or no next template, create a regular successor task
  const { data: successorTask, error: insertError } = await supabase
    .from('tasks')
    .insert({
      title,
      description,
      priority: parentTask.priority, // Inherit priority
      status: 'TODO',
      parent_task_id: parentTaskId, // Link to the parent
    })
    .select()
    .single();

  if (insertError) {
    console.error('Error creating successor task:', insertError);
    return c.json({ error: 'Could not create successor task' }, 500);
  }

  return c.json(successorTask, 201);
});

// GitHub Webhook Handler: Create code review tasks from PR events
app.post('/api/webhooks/github', async (c) => {
  try {
    const body = await c.req.text();
    
    // Verify webhook signature if secret is configured
    if (c.env.GITHUB_WEBHOOK_SECRET) {
      const isVerified = await verifyGitHubSignature(c.env.GITHUB_WEBHOOK_SECRET, c.req.raw, body);

      if (!isVerified) {
        return c.json({ error: 'Invalid signature' }, 401);
      }
    }

    const payload = JSON.parse(body);

    // Check if it's a pull request that was just opened
    if (payload.action === 'opened' && payload.pull_request) {
      const pr = payload.pull_request;
      const taskTitle = `Code Review: ${pr.title}`;
      const taskDescription = `Please review the pull request at: ${pr.html_url}\n\nDiff URL: ${pr.diff_url}`;

      const supabase = createSupabaseClient(c.env);
      const { data, error } = await supabase.from('tasks').insert({
        title: taskTitle,
        description: taskDescription,
        priority: 'CRITICAL', // Code reviews are high priority
        status: 'TODO',
      }).select().single();

      if (error) {
        console.error('Error creating code review task:', error);
        return c.json({ error: 'Could not create code review task' }, 500);
      }

      console.log('Created code review task:', data);
    }

    return c.json({ message: 'Webhook received' }, 202);
  } catch (err) {
    console.error('Error processing GitHub webhook:', err);
    return c.json({ error: 'Failed to process webhook' }, 500);
  }
});

// POST /api/tasks - Create a new task
app.post('/api/tasks', async (c) => {
  try {
    const { title, description, priority } = await c.req.json<{
      title: string;
      description?: string;
      priority: string;
    }>();

    if (!title || !priority || !VALID_PRIORITIES.includes(priority)) {
      return c.json({ error: 'Missing title or invalid priority' }, 400);
    }

    const supabase = createSupabaseClient(c.env);
    const { data, error } = await supabase
      .from('tasks')
      .insert({ title, description, priority, status: 'TODO' })
      .select()
      .single();

    if (error) {
      console.error('Error creating task:', error);
      return c.json({ error: 'Could not create task' }, 500);
    }
    
    // Publish the task to RabbitMQ queue
    try {
      await publishTask(data.id);
    } catch (publishError) {
      console.error('Failed to publish task to RabbitMQ:', publishError);
      // Don't fail the request if RabbitMQ publishing fails, just log it
    }
    
    return c.json(data, 201);
  } catch (err) {
    console.error('Unexpected error creating task:', err);
    return c.json({ error: 'Could not create task' }, 500);
  }
});

// PUT /api/tasks/:taskId - Update an existing task
app.put('/api/tasks/:taskId', async (c) => {
  try {
    const taskId = c.req.param('taskId');
    const { title, description, priority } = await c.req.json();

    if (priority && !VALID_PRIORITIES.includes(priority)) {
      return c.json({ error: 'Invalid priority value' }, 400);
    }

    const supabase = createSupabaseClient(c.env);
    const { data, error } = await supabase
      .from('tasks')
      .update({ title, description, priority })
      .eq('id', taskId)
      .select()
      .single();

    if (error) {
      return c.json({ error: 'Task not found or could not be updated' }, 404);
    }
    return c.json(data);
  } catch (err) {
    console.error('Unexpected error updating task:', err);
    return c.json({ error: 'Could not update task' }, 500);
  }
});

// DELETE /api/tasks/:taskId - Delete a task
app.delete('/api/tasks/:taskId', async (c) => {
  try {
    const taskId = c.req.param('taskId');
    const supabase = createSupabaseClient(c.env);

    const { error } = await supabase.from('tasks').delete().eq('id', taskId);

    if (error) {
      return c.json({ error: 'Task not found or could not be deleted' }, 404);
    }
    return c.json({ message: 'Task deleted successfully' }, 200);
  } catch (err) {
    console.error('Unexpected error deleting task:', err);
    return c.json({ error: 'Could not delete task' }, 500);
  }
});

// Task dispatch endpoint with Budget Supervisor integration and Audit Logging
app.post('/api/tasks/dispatch', async (c) => {
  // 1. VALIDATION: Now expecting taskId
  const { taskId, serviceId, cost } = await c.req.json<{ taskId: string; serviceId: string; cost: number }>();

  if (!taskId || !serviceId || typeof cost !== 'number' || cost < 0) {
    return c.json({ error: 'Missing or invalid taskId, serviceId, or cost' }, 400);
  }

  const supabase = createSupabaseClient(c.env);
  
  const { data: rpcResponse, error: rpcError } = await supabase.rpc('charge_service', {
    service_id_to_charge: serviceId,
    charge_amount: cost,
  });

  if (rpcError) {
    console.error('RPC Error:', rpcError);
    return c.json({ error: 'Failed to process service charge' }, 500);
  }

  const { serviceToUse, wasSuspended, error: procedureError } = rpcResponse;

  if (procedureError) {
    return c.json({ error: procedureError }, 404);
  }

  if (wasSuspended) {
    const message = `*Budget Alert* 🚨\n\nService *${serviceId}* has been automatically suspended due to exceeding its budget.`;
    await sendTelegramMessage(c.env, message);
  }

  if (!serviceToUse) {
    return c.json({ error: `Budget exceeded for service '${serviceId}' and no substitutor is available.` }, 402);
  }
  
  // 2. LOGGING: Insert a record into the audit log.
  const { error: logError } = await supabase.from('service_usage_log').insert({
    task_id: taskId,
    service_id: serviceToUse.id, // Log the service that was actually used
    charge_amount: cost,
  });

  if (logError) {
    // Do not fail the request, but log the error for observability.
    console.error('Failed to write to audit log:', logError);
  }

  // --- Dispatch Logic would go here ---
  console.log(`Dispatching task ${taskId} using service: ${serviceToUse.id}`);

  return c.json({
    message: 'Task dispatched successfully and usage logged.',
    serviceUsed: serviceToUse.id,
    wasDelegated: serviceToUse.id !== serviceId,
  });
});

// =====================================================
// Enterprise Agent Management Endpoints
// =====================================================

// Helper function to hash API keys using Web Crypto API
async function hashApiKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Helper function to verify agent API key
async function verifyAgentApiKey(apiKey: string, supabase: any): Promise<any> {
  const hashedKey = await hashApiKey(apiKey);
  
  const { data: agent, error } = await supabase
    .from('agents')
    .select('*')
    .eq('api_key_hash', hashedKey)
    .eq('is_active', true)
    .single();
    
  return error ? null : agent;
}

// Secure Agent Registration Endpoint (for supervisors)
app.post('/api/agents/register', async (c) => {
  const { alias, capabilities } = await c.req.json<{ alias: string; capabilities?: string[] }>();

  if (!alias) {
    return c.json({ error: 'Agent alias is required' }, 400);
  }

  // 1. Generate a secure, random API key
  const apiKey = `da_agent_${crypto.randomUUID()}`;
  
  // 2. Hash the API key for secure storage
  const apiKeyHash = await hashApiKey(apiKey);

  const supabase = createSupabaseClient(c.env);

  // 3. Register the agent with the hashed key
  const { data: newAgent, error } = await supabase
    .from('agents')
    .insert({
      alias,
      capabilities: capabilities || [],
      api_key_hash: apiKeyHash,
      is_active: true,
      status: 'IDLE',
      last_seen: new Date().toISOString()
    })
    .select('id, alias, capabilities, is_active, created_at')
    .single();

  if (error) {
    console.error('Error registering agent:', error);
    if (error.code === '23505') { // Unique constraint violation
      return c.json({ error: 'Could not register agent. Alias may be taken.' }, 500);
    }
    return c.json({ error: 'Could not register agent. Alias may be taken.' }, 500);
  }

  // 4. Return the plaintext key ONCE - it will not be stored
  return c.json({ ...newAgent, apiKey });
});

// Agent Activation Management Endpoint
app.put('/api/agents/:agentId/activation', async (c) => {
  const agentId = c.req.param('agentId');
  const { isActive } = await c.req.json<{ isActive: boolean }>();

  if (typeof isActive !== 'boolean') {
    return c.json({ error: 'isActive must be a boolean value' }, 400);
  }

  const supabase = createSupabaseClient(c.env);
  const { data, error } = await supabase
    .from('agents')
    .update({ is_active: isActive })
    .eq('id', agentId)
    .select()
    .single();

  if (error) {
    return c.json({ error: 'Agent not found' }, 404);
  }
  
  return c.json(data);
});

// Orchestration Engine: Agent Heartbeat Endpoint (with API key auth)
app.put('/api/agents/heartbeat', async (c) => {
  const { agentId, apiKey } = await c.req.json<{ agentId: string; apiKey: string }>();

  if (!agentId || !apiKey) {
    return c.json({ error: 'Agent ID and API key are required' }, 400);
  }

  const supabase = createSupabaseClient(c.env);

  // Verify the API key
  const agent = await verifyAgentApiKey(apiKey, supabase);
  if (!agent || agent.id !== agentId) {
    return c.json({ error: 'Invalid API key or agent not active' }, 401);
  }

  // Update the agent's last_seen timestamp
  const { data: updatedAgent, error } = await supabase
    .from('agents')
    .update({ last_seen: new Date().toISOString() })
    .eq('id', agentId)
    .select()
    .single();

  if (error || !updatedAgent) {
    return c.json({ error: 'Agent not found' }, 404);
  }

  return c.json({ message: 'Heartbeat updated successfully' });
});

// // DEPRECATED: Orchestration Engine: Agent Task Claiming Endpoint (with API key auth)
// // This endpoint has been deprecated in favor of the RabbitMQ-based task distribution system
// app.post('/api/agents/claim-task', async (c) => {
//   const { agentId, apiKey } = await c.req.json<{ agentId: string; apiKey: string }>();
// 
//   if (!agentId || !apiKey) {
//     return c.json({ error: 'Agent ID and API key are required' }, 400);
//   }
// 
//   const supabase = createSupabaseClient(c.env);
// 
//   // Verify the API key
//   const agent = await verifyAgentApiKey(apiKey, supabase);
//   if (!agent || agent.id !== agentId) {
//     return c.json({ error: 'Invalid API key or agent not active' }, 401);
//   }
// 
//   const { data: claimedTask, error } = await supabase.rpc('claim_next_task', {
//     requesting_agent_id: agentId,
//   });
// 
//   if (error) {
//     console.error('Error claiming task:', error);
//     return c.json({ error: 'Failed to claim task' }, 500);
//   }
// 
//   if (!claimedTask) {
//     return c.json({ message: 'No available tasks to claim.' }, 404);
//   }
// 
//   return c.json(claimedTask);
// });

// Orchestration Engine: Task Status Update Endpoint (with API key auth)
app.put('/api/tasks/:taskId/status', async (c) => {
  const taskId = c.req.param('taskId');
  const { agentId, apiKey, newStatus } = await c.req.json<{ agentId: string; apiKey: string; newStatus: string }>();

  const validStatuses = ['DONE', 'QUARANTINED', 'IN_PROGRESS']; // Example valid statuses
  if (!agentId || !apiKey || !newStatus || !validStatuses.includes(newStatus)) {
    return c.json({ error: 'Missing or invalid agentId, apiKey, or newStatus' }, 400);
  }

  const supabase = createSupabaseClient(c.env);

  // Verify the API key
  const agent = await verifyAgentApiKey(apiKey, supabase);
  if (!agent || agent.id !== agentId) {
    return c.json({ error: 'Invalid API key or agent not active' }, 401);
  }

  // 1. Fetch the task to check if it belongs to a workflow
  const { data: task, error: fetchError } = await supabase
    .from('tasks')
    .select('workflow_run_id')
    .eq('id', taskId)
    .eq('agent_id', agentId) // CRITICAL: Ownership check
    .single();

  if (fetchError || !task) {
    return c.json({ error: 'Task not found or agent not authorized to update.' }, 404);
  }

  // 2. Atomically update the task status, ONLY if the agentId matches.
  const { data: updatedTask, error: updateError } = await supabase
    .from('tasks')
    .update({ status: newStatus })
    .eq('id', taskId)
    .eq('agent_id', agentId) // CRITICAL: Ownership check
    .select()
    .single();

  if (updateError || !updatedTask) {
    return c.json({ error: 'Task not found or agent not authorized to update.' }, 404);
  }

  // 3. If task is finished, set agent back to IDLE.
  if (newStatus === 'DONE' || newStatus === 'QUARANTINED') {
    const { error: agentUpdateError } = await supabase
      .from('agents')
      .update({ status: 'IDLE' })
      .eq('id', agentId);

    if (agentUpdateError) {
      // Log the error but don't fail the request, as the primary task was updated.
      console.error(`Failed to reset agent ${agentId} to IDLE:`, agentUpdateError);
    }

    // 4. If the task belongs to a workflow, check if the workflow is complete
    if (task.workflow_run_id) {
      // Check if there are any other non-complete tasks associated with the same workflow_run_id
      const { data: incompleteTasks, error: incompleteTasksError } = await supabase
        .from('tasks')
        .select('id')
        .eq('workflow_run_id', task.workflow_run_id)
        .not('status', 'in', 'DONE,QUARANTINED')
        .limit(1);

      // If there are no incomplete tasks, the workflow is complete
      if (!incompleteTasksError && incompleteTasks && incompleteTasks.length === 0) {
        // Update the workflow run status to COMPLETED
        const { error: workflowUpdateError } = await supabase
          .from('workflow_runs')
          .update({ 
            status: 'COMPLETED',
            end_time: new Date().toISOString()
          })
          .eq('id', task.workflow_run_id);

        if (workflowUpdateError) {
          console.error(`Failed to update workflow run ${task.workflow_run_id} to COMPLETED:`, workflowUpdateError);
        }
      }
    }
  }

  return c.json(updatedTask);
});

// POST /api/tasks/:taskId/report-failure - Endpoint for agents to report failures
app.post('/api/tasks/:taskId/report-failure', async (c) => {
  const taskId = c.req.param('taskId');
  const { agentId, errorMessage } = await c.req.json<{ agentId: string; errorMessage: string }>();

  const supabase = createSupabaseClient(c.env);

  // 1. Fetch the task to check its current state and max_retries
  const { data: task, error: fetchError } = await supabase
    .from('tasks')
    .select('retry_count, max_retries')
    .eq('id', taskId)
    .eq('agent_id', agentId) // Ownership check
    .single();

  if (fetchError || !task) {
    return c.json({ error: 'Task not found or agent not authorized.' }, 404);
  }

  const newRetryCount = task.retry_count + 1;
  let nextStatus = 'TODO'; // Re-queue for another attempt

  // 2. If max retries are exceeded, move to quarantine
  if (newRetryCount >= task.max_retries) {
    nextStatus = 'QUARANTINED';
  }

  // 3. Update the task and reset the agent's status
  const { data: updatedTask, error: updateError } = await supabase
    .from('tasks')
    .update({
      status: nextStatus,
      retry_count: newRetryCount,
      last_error: errorMessage,
      agent_id: null, // Unassign the task
    })
    .eq('id', taskId)
    .select()
    .single();
  
  // Reset the failing agent to IDLE so it can pick up new work
  await supabase.from('agents').update({ status: 'IDLE' }).eq('id', agentId);

  if (updateError) return c.json({ error: 'Failed to update task status.' }, 500);
  
  // 4. If the task is being re-queued, republish it to RabbitMQ with exponential backoff delay
  if (nextStatus === 'TODO') {
    try {
      // Calculate exponential backoff delay: baseDelay * 2^retryCount
      const baseDelay = 5000; // 5 seconds base delay
      const delayMs = baseDelay * Math.pow(2, task.retry_count);
      const maxDelay = 300000; // Maximum 5 minutes delay
      const finalDelay = Math.min(delayMs, maxDelay);
      
      await republishTaskWithDelay(taskId, finalDelay);
    } catch (publishError) {
      console.error('Failed to republish task to RabbitMQ:', publishError);
      // Don't fail the request if RabbitMQ publishing fails, just log it
    }
  }

  return c.json(updatedTask);
});

// Agent Execution Sandboxing: Request a sandbox for an agent
app.post('/api/agents/:agentId/request-sandbox', async (c) => {
  const agentId = c.req.param('agentId');
  const { taskId } = await c.req.json<{ taskId: string }>();

  // Validate input
  if (!taskId) {
    return c.json({ error: 'Task ID is required' }, 400);
  }

  // Verify agent exists and is active
  const supabase = createSupabaseClient(c.env);
  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('id, is_active')
    .eq('id', agentId)
    .single();

  if (agentError || !agent) {
    return c.json({ error: 'Agent not found' }, 404);
  }

  if (!agent.is_active) {
    return c.json({ error: 'Agent is not active' }, 400);
  }

  // Verify task exists
  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .select('id')
    .eq('id', taskId)
    .single();

  if (taskError || !task) {
    return c.json({ error: 'Task not found' }, 404);
  }

  // Provision a sandbox using Kubernetes
  try {
    const { containerId, connectionDetails } = await provisionSandbox(taskId);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now

    // Create sandbox record in database
    const { data: sandbox, error } = await supabase
      .from('agent_sandboxes')
      .insert({
        agent_id: agentId,
        task_id: taskId,
        status: 'PROVISIONING', // Set initial status to PROVISIONING
        container_id: containerId,
        connection_details: connectionDetails,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create sandbox record:', error);
      // Try to clean up the Kubernetes resources
      try {
        await terminateSandbox(containerId);
      } catch (cleanupError) {
        console.error('Failed to clean up Kubernetes resources:', cleanupError);
      }
      return c.json({ error: 'Failed to create sandbox record' }, 500);
    }

    return c.json(sandbox, 201);
  } catch (provisionError) {
    console.error('Failed to provision sandbox:', provisionError);
    return c.json({ error: 'Failed to provision sandbox' }, 500);
  }
});

// Agent Execution Sandboxing: Terminate a sandbox
app.delete('/api/sandboxes/:sandboxId', async (c) => {
  const sandboxId = c.req.param('sandboxId');
  
  // Validate input
  if (!sandboxId) {
    return c.json({ error: 'Sandbox ID is required' }, 400);
  }

  const supabase = createSupabaseClient(c.env);
  
  // Verify sandbox exists
  const { data: sandbox, error: fetchError } = await supabase
    .from('agent_sandboxes')
    .select('id, container_id, status')
    .eq('id', sandboxId)
    .single();

  if (fetchError || !sandbox) {
    return c.json({ error: 'Sandbox not found' }, 404);
  }

  // Check if sandbox is already terminated
  if (sandbox.status === 'TERMINATED') {
    return c.json({ message: 'Sandbox already terminated' });
  }

  // Terminate the sandbox using Kubernetes
  try {
    await terminateSandbox(sandbox.container_id);
  } catch (terminationError) {
    console.error('Failed to terminate sandbox:', terminationError);
    return c.json({ error: 'Failed to terminate sandbox' }, 500);
  }
  
  // Update sandbox status in database
  const { error } = await supabase
    .from('agent_sandboxes')
    .update({ 
      status: 'TERMINATED',
      expires_at: new Date().toISOString() // Set expiration to now
    })
    .eq('id', sandboxId);

  if (error) {
    console.error('Failed to update sandbox status:', error);
    return c.json({ error: 'Failed to terminate sandbox' }, 500);
  }

  return c.json({ message: 'Sandbox terminated successfully' });
});

// =====================================================
// System Configuration Management Endpoints
// =====================================================

// GET /api/settings/:key - Get a specific setting value
app.get('/api/settings/:key', async (c) => {
  try {
    const key = c.req.param('key');
    const supabase = createSupabaseClient(c.env);
    
    const { data, error } = await supabase
      .from('system_settings')
      .select('value, description')
      .eq('key', key)
      .single();
      
    if (error) {
      return c.json({ error: 'Setting not found' }, 404);
    }
    
    return c.json(data);
  } catch (err) {
    console.error('Error fetching setting:', err);
    return c.json({ error: 'Failed to fetch setting' }, 500);
  }
});

// PUT /api/settings/:key - Update a specific setting value
app.put('/api/settings/:key', async (c) => {
  try {
    const key = c.req.param('key');
    const { value } = await c.req.json<{ value: any }>();
    
    if (value === undefined || value === null) {
      return c.json({ error: 'Value is required' }, 400);
    }
    
    const supabase = createSupabaseClient(c.env);
    const { data, error } = await supabase
      .from('system_settings')
      .update({ 
        value, 
        updated_at: new Date().toISOString() 
      })
      .eq('key', key)
      .select()
      .single();
      
    if (error) {
      return c.json({ error: 'Setting not found or could not be updated' }, 404);
    }
    
    return c.json(data);
  } catch (err) {
    console.error('Error updating setting:', err);
    return c.json({ error: 'Failed to update setting' }, 500);
  }
});

// GET /api/settings - Get all settings
app.get('/api/settings', async (c) => {
  try {
    const supabase = createSupabaseClient(c.env);
    const { data, error } = await supabase
      .from('system_settings')
      .select('*')
      .order('key');
      
    if (error) {
      return c.json({ error: 'Failed to fetch settings' }, 500);
    }
    
    return c.json(data || []);
  } catch (err) {
    console.error('Error fetching settings:', err);
    return c.json({ error: 'Failed to fetch settings' }, 500);
  }
});

// =====================================================
// Intelligence and Analytics Layer Endpoints
// =====================================================

// Knowledge Ingestion: Add new content to knowledge base
app.post('/api/knowledge', async (c) => {
  try {
    const { content, source } = await c.req.json<{ content: string; source?: string }>();

    if (!content || content.trim().length === 0) {
      return c.json({ error: 'Content is required and cannot be empty' }, 400);
    }

    // 1. Generate the embedding for the content
    const embedding = await generateEmbedding(c.env, content);
    if (!embedding) {
      return c.json({ error: 'Failed to generate embedding for the content' }, 500);
    }

    // 2. Store the content and its embedding in the database
    const supabase = createSupabaseClient(c.env);
    const { data, error } = await supabase
      .from('knowledge_base')
      .insert({ 
        content: content.trim(), 
        source: source || null, 
        embedding 
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving to knowledge base:', error);
      return c.json({ error: 'Could not save knowledge entry' }, 500);
    }

    return c.json(data, 201);
  } catch (err) {
    console.error('Unexpected error in knowledge ingestion:', err);
    return c.json({ error: 'Failed to process knowledge ingestion' }, 500);
  }
});

// Knowledge Search: Semantic search in knowledge base
app.post('/api/knowledge/search', async (c) => {
  try {
    const { query, threshold = 0.7, limit = 10 } = await c.req.json<{
      query: string;
      threshold?: number;
      limit?: number;
    }>();

    if (!query || query.trim().length === 0) {
      return c.json({ error: 'Query is required and cannot be empty' }, 400);
    }

    // 1. Generate embedding for the search query
    const queryEmbedding = await generateEmbedding(c.env, query);
    if (!queryEmbedding) {
      return c.json({ error: 'Failed to generate embedding for search query' }, 500);
    }

    // 2. Use the match_knowledge function for semantic search
    const supabase = createSupabaseClient(c.env);
    const { data, error } = await supabase.rpc('match_knowledge', {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: limit
    });

    if (error) {
      console.error('Error in semantic search:', error);
      return c.json({ error: 'Failed to perform semantic search' }, 500);
    }

    return c.json(data || []);
  } catch (err) {
    console.error('Unexpected error in knowledge search:', err);
    return c.json({ error: 'Failed to process knowledge search' }, 500);
  }
});

// Analytics: Task Cost Summary
app.get('/api/analytics/task-costs', async (c) => {
  try {
    const supabase = createSupabaseClient(c.env);
    // Query the task_cost_summary view for aggregated cost data
    const { data, error } = await supabase.from('task_cost_summary').select('*');

    if (error) {
      console.error('Error fetching task cost analytics:', error);
      return c.json({ error: 'Could not fetch analytics data' }, 500);
    }
    
    return c.json(data || []);
  } catch (err) {
    console.error('Unexpected error fetching analytics:', err);
    return c.json({ error: 'Failed to fetch task cost analytics' }, 500);
  }
});

// GitHub Integration: Post PR feedback
app.post('/api/integrations/github/pr-feedback', async (c) => {
  const { owner, repo, prNumber, sha, comment, status } = await c.req.json();

  if (!owner || !repo || !prNumber || !sha || !status) {
    return c.json({ error: 'Missing required GitHub parameters' }, 400);
  }

  // Post a comment if one is provided
  if (comment) {
    await postPRComment(c.env, owner, repo, prNumber, comment);
  }

  // Create a status check
  await createCheckRun(c.env, owner, repo, sha, status, 'AI Code Review', comment || 'Review complete.');

  return c.json({ message: 'Feedback posted to GitHub successfully.' });
});

// Analytics: Service Usage Summary
app.get('/api/analytics/service-usage', async (c) => {
  try {
    const supabase = createSupabaseClient(c.env);
    
    // Get service usage statistics
    const { data, error } = await supabase
      .from('service_usage_log')
      .select(`
        service_id,
        count(*) as usage_count,
        sum(charge_amount) as total_cost,
        avg(charge_amount) as avg_cost,
        max(created_at) as last_used
      `)
      .group('service_id')
      .order('total_cost', { ascending: false });

    if (error) {
      console.error('Error fetching service usage analytics:', error);
      return c.json({ error: 'Could not fetch service usage data' }, 500);
    }
    
    return c.json(data || []);
  } catch (err) {
    console.error('Unexpected error fetching service usage:', err);
    return c.json({ error: 'Failed to fetch service usage analytics' }, 500);
  }
});

// Performance Analysis: Flag Costly Tasks (can be called manually or via cron)
app.post('/api/analytics/flag-costly-tasks', async (c) => {
  try {
    const supabase = createSupabaseClient(c.env);
    
    const { error } = await supabase.rpc('flag_costly_tasks');

    if (error) {
      console.error('Error flagging costly tasks:', error);
      return c.json({ error: 'Could not flag costly tasks' }, 500);
    }

    return c.json({ message: 'Successfully flagged costly tasks for review' });
  } catch (err) {
    console.error('Unexpected error flagging costly tasks:', err);
    return c.json({ error: 'Failed to flag costly tasks' }, 500);
  }
});

// Workflow Engine: Get all workflows
app.get('/api/workflows', async (c) => {
  const supabase = createSupabaseClient(c.env);
  
  const { data, error } = await supabase
    .from('workflows')
    .select('*')
    .order('name');
    
  if (error) {
    console.error('Error fetching workflows:', error);
    return c.json({ error: 'Could not fetch workflows' }, 500);
  }
  
  return c.json(data || []);
});

// Workflow Engine: Create a new workflow
app.post('/api/workflows', async (c) => {
  const { name, description } = await c.req.json<{ name: string; description?: string }>();
  
  if (!name) {
    return c.json({ error: 'Workflow name is required' }, 400);
  }
  
  const supabase = createSupabaseClient(c.env);
  
  const { data, error } = await supabase
    .from('workflows')
    .insert({ name, description })
    .select()
    .single();
    
  if (error) {
    console.error('Error creating workflow:', error);
    return c.json({ error: 'Could not create workflow' }, 500);
  }
  
  return c.json(data, 201);
});

// Workflow Engine: Get task templates for a workflow
app.get('/api/workflows/:workflowId/templates', async (c) => {
  const workflowId = c.req.param('workflowId');
  
  const supabase = createSupabaseClient(c.env);
  
  const { data, error } = await supabase
    .from('task_templates')
    .select('*')
    .eq('workflow_id', workflowId)
    .order('stage_order');
    
  if (error) {
    console.error('Error fetching task templates:', error);
    return c.json({ error: 'Could not fetch task templates' }, 500);
  }
  
  return c.json(data || []);
});

// Workflow Engine: Trigger a workflow
app.post('/api/workflows/:workflowId/trigger', async (c) => {
  const workflowId = c.req.param('workflowId');
  const context = await c.req.json<Record<string, any>>();

  const supabase = createSupabaseClient(c.env);

  // Create a workflow run record
  const { data: workflowRun, error: runError } = await supabase
    .from('workflow_runs')
    .insert({
      workflow_id: workflowId,
      status: 'RUNNING',
      trigger_context: context,
      start_time: new Date().toISOString(),
    })
    .select()
    .single();

  if (runError) {
    return c.json({ error: 'Failed to create workflow run record' }, 500);
  }

  // Get the first task template in the workflow
  const { data: firstTaskTemplate, error: templateError } = await supabase
    .from('task_templates')
    .select('*')
    .eq('workflow_id', workflowId)
    .order('stage_order', { ascending: true })
    .limit(1)
    .single();

  if (templateError || !firstTaskTemplate) {
    return c.json({ error: 'Workflow not found or has no tasks' }, 404);
  }

  // Template rendering function with better error handling
  const renderTemplate = (template: string, context: Record<string, any>): string => {
    try {
      let result = template;
      // Replace all template variables in the format {{variable_name}}
      for (const [key, value] of Object.entries(context)) {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        result = result.replace(regex, String(value));
      }
      return result;
    } catch (error) {
      console.error('Template rendering error:', error);
      return template; // Return original template if rendering fails
    }
  };

  // Render the template with context
  const title = renderTemplate(firstTaskTemplate.title_template, context);
  const description = firstTaskTemplate.description_template 
    ? renderTemplate(firstTaskTemplate.description_template, context)
    : undefined;

  // Create the first task and associate it with the workflow run
  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .insert({
      title,
      description,
      priority: firstTaskTemplate.priority,
      status: 'TODO',
      workflow_run_id: workflowRun.id, // Associate task with workflow run
    })
    .select()
    .single();

  if (taskError) {
    return c.json({ error: 'Failed to create initial task' }, 500);
  }

  return c.json({ 
    message: 'Workflow triggered successfully',
    initialTask: task,
    workflowRun: workflowRun
  });
});

// =====================================================
// Marketplace Implementation
// =====================================================

// GET /api/marketplace - List/search all items
app.get('/api/marketplace', async (c) => {
  const supabase = createSupabaseClient(c.env);
  // In a real app, add filtering by tags, type, etc.
  const { data, error } = await supabase.from('marketplace_items').select('*');
  if (error) return c.json({ error: 'Could not fetch marketplace items' }, 500);
  return c.json(data);
});

// POST /api/marketplace - Publish a new item
app.post('/api/marketplace', async (c) => {
  // NOTE: This endpoint must be protected by RBAC (supervisor/admin role)
  const { item_type, name, description, version, tags, repository_url } = await c.req.json();
  
  // Add validation logic here...
  if (!item_type || !name || !version) {
    return c.json({ error: 'Missing required fields: item_type, name, and version are required' }, 400);
  }
  
  // Validate item_type
  if (item_type !== 'agent' && item_type !== 'workflow') {
    return c.json({ error: 'Invalid item_type. Must be either "agent" or "workflow"' }, 400);
  }

  const supabase = createSupabaseClient(c.env);
  // Get the publisher_id from the authenticated user session
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return c.json({ error: 'Authentication required' }, 401);

  const { data: newItem, error } = await supabase
    .from('marketplace_items')
    .insert({ item_type, name, description, version, tags, repository_url, publisher_id: user.id })
    .select()
    .single();

  if (error) return c.json({ error: 'Failed to publish item. Name/version may exist.' }, 500);
  return c.json(newItem, 201);
});

// =====================================================
// Visual Workflow Monitor Implementation
// =====================================================

// GET /api/tasks/:taskId/lineage - Get task lineage for visualization
app.get('/api/tasks/:taskId/lineage', async (c) => {
  const taskId = c.req.param('taskId');
  
  if (!taskId) {
    return c.json({ error: 'Task ID is required' }, 400);
  }
  
  const supabase = createSupabaseClient(c.env);
  
  try {
    // Get the target task first
    const { data: targetTask, error: taskError } = await supabase
      .from('tasks')
      .select('id, title, status, priority, parent_task_id')
      .eq('id', taskId)
      .single();
      
    if (taskError || !targetTask) {
      return c.json({ error: 'Task not found' }, 404);
    }
    
    // Recursive function to get all ancestors
    const getAncestors = async (taskId: string, depth = 0): Promise<any[]> => {
      // Safety check to prevent infinite loops
      if (depth > 10) return [];
      
      const { data: parentTask, error } = await supabase
        .from('tasks')
        .select('id, title, status, priority, parent_task_id')
        .eq('id', taskId)
        .single();
        
      if (error || !parentTask || !parentTask.parent_task_id) {
        return [];
      }
      
      const ancestors = await getAncestors(parentTask.parent_task_id, depth + 1);
      return [...ancestors, parentTask];
    };
    
    // Recursive function to get all descendants
    const getDescendants = async (taskId: string, depth = 0): Promise<any[]> => {
      // Safety check to prevent infinite loops
      if (depth > 10) return [];
      
      const { data: childTasks, error } = await supabase
        .from('tasks')
        .select('id, title, status, priority, parent_task_id')
        .eq('parent_task_id', taskId);
        
      if (error || !childTasks || childTasks.length === 0) {
        return [];
      }
      
      let allDescendants = [...childTasks];
      for (const child of childTasks) {
        const descendants = await getDescendants(child.id, depth + 1);
        allDescendants = [...allDescendants, ...descendants];
      }
      
      return allDescendants;
    };
    
    // Get ancestors and descendants
    const ancestors = await getAncestors(taskId);
    const descendants = await getDescendants(taskId);
    
    // Combine all tasks
    const allTasks = [targetTask, ...ancestors, ...descendants];
    
    // Remove duplicates
    const uniqueTasks = allTasks.filter((task, index, self) => 
      index === self.findIndex(t => t.id === task.id)
    );
    
    // Create nodes and edges for visualization
    const nodes = uniqueTasks.map(task => ({
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      type: 'task'
    }));
    
    const edges = uniqueTasks
      .filter(task => task.parent_task_id)
      .map(task => ({
        id: `edge-${task.parent_task_id}-${task.id}`,
        source: task.parent_task_id,
        target: task.id,
        type: 'parent-child'
      }));
    
    return c.json({
      nodes,
      edges,
      selectedTaskId: taskId
    });
    
  } catch (err) {
    console.error('Error fetching task lineage:', err);
    return c.json({ error: 'Failed to fetch task lineage' }, 500);
  }
});

export default app;