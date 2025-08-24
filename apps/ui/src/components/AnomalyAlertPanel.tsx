import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';

interface Anomaly {
  id: string;
  trace_id: string;
  anomaly_type: 'PERFORMANCE' | 'SECURITY' | 'RESOURCE';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  detected_at: string;
  resolved: boolean;
}

const AnomalyAlertPanel: React.FC = () => {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    fetchCriticalAnomalies();
    
    // Set up real-time subscription for new anomalies
    const channel = supabase
      .channel('critical-anomalies')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'trace_anomalies',
          filter: 'severity=IN (CRITICAL,HIGH)',
        },
        (payload) => {
          // Add the new critical/high anomaly to the list
          const newAnomaly = payload.new as Anomaly;
          setAnomalies(prev => [newAnomaly, ...prev.slice(0, 4)]); // Keep only the 5 most recent
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchCriticalAnomalies = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('trace_anomalies')
        .select('*')
        .in('severity', ['CRITICAL', 'HIGH'])
        .eq('resolved', false)
        .order('detected_at', { ascending: false })
        .limit(5);

      if (error) {
        throw error;
      }

      setAnomalies(data || []);
    } catch (err) {
      setError('Failed to fetch critical anomalies');
      console.error('Error fetching critical anomalies:', err);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'HIGH':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'PERFORMANCE':
        return (
          <svg className="h-5 w-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
          </svg>
        );
      case 'SECURITY':
        return (
          <svg className="h-5 w-5 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
        );
      case 'RESOURCE':
        return (
          <svg className="h-5 w-5 text-indigo-500" fill="currentColor" viewBox="0 0 20 20">
            <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
            <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
          </svg>
        );
      default:
        return (
          <svg className="h-5 w-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Anomaly Alerts</h3>
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
        </div>
        <div className="text-gray-500">Loading critical anomalies...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Anomaly Alerts</h3>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error loading anomalies</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-5 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Anomaly Alerts</h3>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            {anomalies.length} Critical
          </span>
        </div>
      </div>
      <div className="divide-y divide-gray-200">
        {anomalies.length === 0 ? (
          <div className="px-6 py-4">
            <div className="text-center">
              <svg className="mx-auto h-12 w-12 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No critical anomalies</h3>
              <p className="mt-1 text-sm text-gray-500">System is operating normally.</p>
            </div>
          </div>
        ) : (
          anomalies.map((anomaly) => (
            <div key={anomaly.id} className="px-6 py-4 hover:bg-gray-50">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  {getTypeIcon(anomaly.anomaly_type)}
                </div>
                <div className="ml-3 flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-gray-900">{anomaly.trace_id}</h4>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getSeverityColor(anomaly.severity)}`}>
                      {anomaly.severity}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-gray-500">
                    <p>{anomaly.description}</p>
                  </div>
                  <div className="mt-2 text-xs text-gray-400">
                    {new Date(anomaly.detected_at).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="px-6 py-4 bg-gray-50 text-sm text-center">
        <a href="/anomaly-dashboard" className="font-medium text-indigo-600 hover:text-indigo-500">
          View all anomalies
        </a>
      </div>
    </div>
  );
};

export default AnomalyAlertPanel;