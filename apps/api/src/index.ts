import { Hono } from 'hono';
import { cors } from 'hono/cors';

// This is the Cloudflare environment, which includes secrets
export type Env = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
};

const app = new Hono<{ Bindings: Env }>();

// Add CORS middleware to allow requests from our UI
app.use('/api/*', cors({
  origin: ['http://localhost:3000', 'https://devart.ai'], // Add your production UI URL here
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));


// Placeholder for the Budget Supervisor logic
const checkBudget = async (c: any, serviceId: string, cost: number) => {
  console.log(`Checking budget for ${serviceId} with cost ${cost}...`);
  // In a real implementation, you would query Supabase here
  // and enforce the budget rules we designed.
  return { ok: true, message: "Budget OK" };
};

// --- API Routes ---

app.get('/api', (c) => {
  return c.json({ message: 'Welcome to the devart.ai Supervisor API!' });
});

// Example route to get all tasks
app.get('/api/tasks', async (c) => {
  // In a real app, you would initialize the Supabase client here
  // const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
  // const { data, error } = await supabase.from('tasks').select('*');
  // if (error) return c.json({ error: error.message }, 500);
  // return c.json(data);

  // For now, return mock data
  return c.json([
    { id: 1, title: 'Setup Initial Project Structure', status: 'DONE' },
    { id: 2, title: 'Implement User Authentication', status: 'IN_PROGRESS' },
  ]);
});

// Example route showing a budget check
app.post('/api/tasks/dispatch', async (c) => {
  const { serviceId, cost } = await c.req.json();
  
  const budgetCheck = await checkBudget(c, serviceId, cost);

  if (!budgetCheck.ok) {
    return c.json({ error: 'Budget exceeded or service suspended' }, 402); // 402 Payment Required
  }

  // Proceed to dispatch the task to the agent...
  return c.json({ message: `Task dispatched successfully using ${serviceId}` });
});


export default app;