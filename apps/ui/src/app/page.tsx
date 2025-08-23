import { createClient } from '@supabase/supabase-js';
import TaskBoard from '../components/TaskBoard';

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

export default async function HomePage() {
  const initialTasks = await getInitialTasks();



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
        <div className="bg-gray-800 p-6 rounded-lg">
          <h2 className="text-2xl font-semibold mb-4">Service Status</h2>
          <div className="space-y-4">
            <div className="bg-gray-700 p-4 rounded-md">
              <h3 className="font-semibold">Premium LLM (GPT-4)</h3>
              <p className="text-sm text-gray-400">Budget: $5.20 / $50.00</p>
              <div className="w-full bg-gray-600 rounded-full h-2.5 mt-2">
                <div className="bg-green-600 h-2.5 rounded-full" style={{ width: '10.4%' }}></div>
              </div>
            </div>
             <div className="bg-gray-700 p-4 rounded-md">
              <h3 className="font-semibold">Free LLM (Groq)</h3>
              <p className="text-sm text-gray-400">Status: Active</p>
              <div className="w-full bg-gray-600 rounded-full h-2.5 mt-2">
                <div className="bg-green-600 h-2.5 rounded-full" style={{ width: '100%' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}