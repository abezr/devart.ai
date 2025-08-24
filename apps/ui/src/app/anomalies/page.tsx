import { createServerComponentClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AnomalyDashboard from '../../components/AnomalyDashboard';

export default async function AnomaliesPage() {
  // Add authentication check
  const supabase = createServerComponentClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="container mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold">Trace Anomaly Detection</h1>
        <p className="text-gray-400">Monitor and analyze system anomalies detected through distributed tracing</p>
      </div>
      
      <AnomalyDashboard />
    </div>
  );
}