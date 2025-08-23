import { createClient } from '@supabase/supabase-js';
import { createServerComponentClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import TaskBoard from '../components/TaskBoard';
import ServiceStatusPanel from '../components/ServiceStatusPanel';
import CreateTaskForm from '../components/CreateTaskForm';
import AgentMonitoringPanel from '../components/AgentMonitoringPanel';
import TaskAnalyticsPanel from '../components/TaskAnalyticsPanel';
import AgentRegistrationPanel from '../components/AgentRegistrationPanel';
import SettingsPanel from '../components/SettingsPanel';
import WorkflowManagementPanel from '../components/WorkflowManagementPanel';
import ActivityFeedPanel from '../components/ActivityFeedPanel';

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
 * Interface matching the Agent database table structure
 */
interface Agent {
  id: string;
  alias: string;
  status: 'IDLE' | 'BUSY';
  capabilities: string[];
  is_active: boolean;
  last_seen: string;
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

/**
 * Fetches initial agents on the server for SEO and performance
 * This runs during server-side rendering and provides initial data
 */
async function getInitialAgents(): Promise<Agent[]> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .order('last_seen', { ascending: false });
    
    if (error) {
      console.error('Error fetching initial agents:', error);
      return [];
    }
    
    return data || [];
  } catch (err) {
    console.error('Unexpected error fetching initial agents:', err);
    return [];
  }
}

export default async function HomePage() {
  // Add authentication check
  const supabase = createServerComponentClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  const initialTasks = await getInitialTasks();
  const initialServices = await getInitialServices();
  const initialAgents = await getInitialAgents();

  return (
    <main className="container mx-auto p-8">
      <header className="mb-8">
        <h1 className="text-4xl font-bold">devart.ai Dashboard</h1>
        <p className="text-gray-400">Live Status of AI Development Team</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column - Task Management */}
        <div className="md:col-span-2 space-y-8">
          <CreateTaskForm />
          <TaskBoard initialTasks={initialTasks} />
        </div>

        {/* Right Column - Monitoring & Management Panels */}
        <div className="space-y-8">
          <ServiceStatusPanel initialServices={initialServices} />
          <AgentMonitoringPanel initialAgents={initialAgents} />
          <TaskAnalyticsPanel />
          <WorkflowManagementPanel />
          <ActivityFeedPanel />
        </div>
      </div>

      {/* Enterprise Governance Section */}
      <div className="mt-12">
        <h2 className="text-3xl font-bold mb-6">Enterprise Governance</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <AgentRegistrationPanel />
          <SettingsPanel />
        </div>
      </div>
    </main>
  );
}