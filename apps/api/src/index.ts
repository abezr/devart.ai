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

// Task dispatch endpoint with Budget Supervisor integration
app.post('/api/tasks/dispatch', async (c) => {
  try {
    const { serviceId, cost } = await c.req.json<{ serviceId: string; cost: number }>();

    // Validate input parameters
    if (!serviceId || typeof cost !== 'number' || cost < 0) {
      return c.json({ 
        error: 'Missing or invalid serviceId or cost. Cost must be a positive number.' 
      }, 400);
    }

    const supabase = createSupabaseClient(c.env);
    const { serviceToUse, wasSuspended, error } = await checkAndChargeService(supabase, serviceId, cost);

    if (error) {
      console.error('Budget check failed:', error);
      return c.json({ error: 'Failed to process service charge' }, 500);
    }

    // If the service was just suspended, send a notification
    if (wasSuspended) {
      const message = `*Budget Alert* 🚨\n\nService *${serviceId}* has been automatically suspended due to exceeding its budget.\n\nUse the dashboard to increase the budget and reactivate the service.`;
      await sendTelegramMessage(c.env, message);
    }

    if (!serviceToUse) {
      // Budget exceeded and no substitutor available
      return c.json({ 
        error: `Budget exceeded for service '${serviceId}' and no substitutor is available.`,
        status: 'SUSPENDED'
      }, 402); // 402 Payment Required is semantically correct
    }
    
    // Determine if the task was delegated to a substitutor service
    const wasDelegated = serviceToUse.id !== serviceId;
    
    if (wasDelegated) {
      console.log(`Task delegated from ${serviceId} to ${serviceToUse.id}`);
    }

    // --- This is where actual task dispatch logic would go ---
    // In a real implementation, you would:
    // 1. Use serviceToUse.api_endpoint to make the actual API call
    // 2. Create a task record in the database
    // 3. Queue the task for agent processing
    console.log(`Dispatching task using service: ${serviceToUse.id} (${serviceToUse.display_name})`);

    return c.json({
      message: 'Task dispatched successfully.',
      serviceUsed: serviceToUse.id,
      wasDelegated: wasDelegated,
      wasSuspended: wasSuspended,
      cost: cost
    });
    
  } catch (err) {
    console.error('Unexpected error in task dispatch:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});


export default app;