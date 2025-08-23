import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createSupabaseClient } from './lib/supabase';
import { checkAndChargeService, getAllServicesStatus } from './services/budget';
import { sendTelegramMessage } from './services/telegram';
import { generateEmbedding } from './services/embedding';

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
    .select('priority')
    .eq('id', parentTaskId)
    .single();

  if (fetchError || !parentTask) {
    return c.json({ error: 'Parent task not found' }, 404);
  }

  // 2. Create the new successor task
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

// Orchestration Engine: Agent Task Claiming Endpoint (with API key auth)
app.post('/api/agents/claim-task', async (c) => {
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

  const { data: claimedTask, error } = await supabase.rpc('claim_next_task', {
    requesting_agent_id: agentId,
  });

  if (error) {
    console.error('Error claiming task:', error);
    return c.json({ error: 'Failed to claim task' }, 500);
  }

  if (!claimedTask) {
    return c.json({ message: 'No available tasks to claim.' }, 404);
  }

  return c.json(claimedTask);
});

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

  // 1. Atomically update the task status, ONLY if the agentId matches.
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

  // 2. If task is finished, set agent back to IDLE.
  if (newStatus === 'DONE' || newStatus === 'QUARANTINED') {
    const { error: agentUpdateError } = await supabase
      .from('agents')
      .update({ status: 'IDLE' })
      .eq('id', agentId);

    if (agentUpdateError) {
      // Log the error but don't fail the request, as the primary task was updated.
      console.error(`Failed to reset agent ${agentId} to IDLE:`, agentUpdateError);
    }
  }

  return c.json(updatedTask);
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


export default app;