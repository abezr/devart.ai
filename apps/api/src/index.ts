import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createSupabaseClient } from './lib/supabase';
import { checkAndChargeService, getAllServicesStatus } from './services/budget';
import { sendTelegramMessage } from './services/telegram';

// This is the Cloudflare environment, which includes secrets
export type Env = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
};

const app = new Hono<{ Bindings: Env }>();

// Add CORS middleware to allow requests from our UI
app.use('/api/*', cors({
  origin: ['http://localhost:3000', 'https://devart.ai'], // Add your production UI URL here
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));


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

// Orchestration Engine: Agent Registration Endpoint
app.post('/api/agents/register', async (c) => {
  const { alias, capabilities } = await c.req.json<{ alias: string; capabilities?: string[] }>();

  if (!alias) {
    return c.json({ error: 'Agent alias is required' }, 400);
  }

  const supabase = createSupabaseClient(c.env);

  // Register the agent in the agents table
  const { data: newAgent, error } = await supabase
    .from('agents')
    .insert({
      alias,
      capabilities: capabilities || [],
      status: 'IDLE',
      last_seen: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    console.error('Error registering agent:', error);
    if (error.code === '23505') { // Unique constraint violation
      return c.json({ error: 'Agent alias already exists' }, 409);
    }
    return c.json({ error: 'Failed to register agent' }, 500);
  }

  return c.json(newAgent);
});

// Orchestration Engine: Agent Heartbeat Endpoint
app.put('/api/agents/:agentId/heartbeat', async (c) => {
  const agentId = c.req.param('agentId');

  if (!agentId) {
    return c.json({ error: 'Agent ID is required' }, 400);
  }

  const supabase = createSupabaseClient(c.env);

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

// Orchestration Engine: Agent Task Claiming Endpoint
app.post('/api/agents/:agentId/claim-task', async (c) => {
  const agentId = c.req.param('agentId');

  if (!agentId) {
    return c.json({ error: 'Agent ID is required' }, 400);
  }

  const supabase = createSupabaseClient(c.env);

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

// Orchestration Engine: Task Status Update Endpoint
app.put('/api/tasks/:taskId/status', async (c) => {
  const taskId = c.req.param('taskId');
  const { agentId, newStatus } = await c.req.json<{ agentId: string; newStatus: string }>();

  const validStatuses = ['DONE', 'QUARANTINED', 'IN_PROGRESS']; // Example valid statuses
  if (!agentId || !newStatus || !validStatuses.includes(newStatus)) {
    return c.json({ error: 'Missing or invalid agentId or newStatus' }, 400);
  }

  const supabase = createSupabaseClient(c.env);

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


export default app;