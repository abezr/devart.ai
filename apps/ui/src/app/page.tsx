import { createClient } from '@supabase/supabase-js';
import TaskBoard from '../components/TaskBoard';
import ServiceStatusPanel from '../components/ServiceStatusPanel';

/**
 * Interface matching the Task database table structure
 */
interface Task {
  id: string;
  title: string;
  description: string | null;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'QUARANTINED' | 'PENDING_BUDGET_APPROVAL';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  agent_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Interface matching the Service database table structure
 */
interface Service {
  id: string;
  display_name: string;
  api_endpoint: string;
  monthly_budget_usd: number;
  current_usage_usd: number;
  status: 'ACTIVE' | 'SUSPENDED';
  substitutor_service_id: string | null;
  created_at: string;
}

/**
 * Fetches initial tasks on the server for SEO and performance
 * This runs during server-side rendering and provides initial data
 */
async function getInitialTasks(): Promise<Task[]> {
  try {
    // Create a temporary server-side client using public credentials
    // This is safe because we're only reading public data
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching initial tasks:', error);
      return [];
    }
    
    return data || [];
  } catch (err) {
    console.error('Unexpected error fetching initial tasks:', err);
    return [];
  }
}

/**
 * Fetches initial services on the server for SEO and performance
 * This runs during server-side rendering and provides initial data
 */
async function getInitialServices(): Promise<Service[]> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    const { data, error } = await supabase
      .from('service_registry')
      .select('*')
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('Error fetching initial services:', error);
      return [];
    }
    
    return data || [];
  } catch (err) {
    console.error('Unexpected error fetching initial services:', err);
    return [];
  }
}

export default async function HomePage() {
  const initialTasks = await getInitialTasks();
  const initialServices = await getInitialServices(); // Fetch services



  return (
    <main className="container mx-auto p-8">
      <header className="mb-8">
        <h1 className="text-4xl font-bold">devart.ai Dashboard</h1>
        <p className="text-gray-400">Live Status of AI Development Team</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Task Board Column - now using the real-time component */}
        <div className="md:col-span-2">
          <TaskBoard initialTasks={initialTasks} />
        </div>

        {/* Service Status Column */}
        <ServiceStatusPanel initialServices={initialServices} />
      </div>
    </main>
  );
}