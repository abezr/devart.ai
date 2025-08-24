import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';

interface Anomaly {
  id: string;
  trace_id: string;
  span_id?: string;
  anomaly_type: 'PERFORMANCE' | 'SECURITY' | 'RESOURCE';
  anomaly_subtype: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  detected_at: string;
  resolved: boolean;
  resolution_notes?: string;
  root_cause?: {
    root_cause_category: string;
    root_cause_details: string;
  };
  root_cause_confidence?: 'LOW' | 'MEDIUM' | 'HIGH';
  suggested_actions?: string[];
}

const AnomalyDashboard: React.FC = () => {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');
  const [filterResolved, setFilterResolved] = useState<string>('UNRESOLVED');
  const [expandedAnomaly, setExpandedAnomaly] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    fetchAnomalies();
    
    // Set up real-time subscription
    const channel = supabase
      .channel('anomalies-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trace_anomalies',
        },
        (payload) => {
          fetchAnomalies();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filterType, filterSeverity, filterResolved]);

  const fetchAnomalies = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('trace_anomalies')
        .select('*')
        .order('detected_at', { ascending: false });

      // Apply filters
      if (filterType !== 'ALL') {
        query = query.eq('anomaly_type', filterType);
      }

      if (filterSeverity !== 'ALL') {
        query = query.eq('severity', filterSeverity);
      }

      if (filterResolved === 'RESOLVED') {
        query = query.eq('resolved', true);
      } else if (filterResolved === 'UNRESOLVED') {
        query = query.eq('resolved', false);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      setAnomalies(data || []);
    } catch (err) {
      setError('Failed to fetch anomalies');
      console.error('Error fetching anomalies:', err);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-red-500';
      case 'HIGH':
        return 'bg-orange-500';
      case 'MEDIUM':
        return 'bg-yellow-500';
      case 'LOW':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'PERFORMANCE':
        return 'bg-blue-500';
      case 'SECURITY':
        return 'bg-purple-500';
      case 'RESOURCE':
        return 'bg-indigo-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'HIGH':
        return 'bg-green-100 text-green-800';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800';
      case 'LOW':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const toggleExpand = (anomalyId: string) => {
    if (expandedAnomaly === anomalyId) {
      setExpandedAnomaly(null);
    } else {
      setExpandedAnomaly(anomalyId);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-4">Anomaly Dashboard</h2>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-4">Anomaly Dashboard</h2>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Anomaly Dashboard</h2>
      
      {/* Filters */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Anomaly Type</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          >
            <option value="ALL">All Types</option>
            <option value="PERFORMANCE">Performance</option>
            <option value="SECURITY">Security</option>
            <option value="RESOURCE">Resource</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            value={filterResolved}
            onChange={(e) => setFilterResolved(e.target.value)}
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          >
            <option value="UNRESOLVED">Unresolved</option>
            <option value="RESOLVED">Resolved</option>
            <option value="ALL">All</option>
          </select>
        </div>
        
        <div className="flex items-end">
          <button
            onClick={fetchAnomalies}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded"
          >
            Refresh
          </button>
        </div>
      </div>
      
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm font-medium text-gray-500">Total Anomalies</div>
          <div className="text-2xl font-bold">{anomalies.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm font-medium text-gray-500">Unresolved</div>
          <div className="text-2xl font-bold">{anomalies.filter(a => !a.resolved).length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm font-medium text-gray-500">Critical</div>
          <div className="text-2xl font-bold">{anomalies.filter(a => a.severity === 'CRITICAL').length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm font-medium text-gray-500">Performance</div>
          <div className="text-2xl font-bold">{anomalies.filter(a => a.anomaly_type === 'PERFORMANCE').length}</div>
        </div>
      </div>
      
      {/* Anomalies Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Subtype
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Severity
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Description
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Detected
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Root Cause
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {anomalies.map((anomaly) => (
              <React.Fragment key={anomaly.id}>
                <tr className={anomaly.resolved ? 'bg-gray-50' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full text-white ${getTypeColor(anomaly.anomaly_type)}`}>
                      {anomaly.anomaly_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {anomaly.anomaly_subtype}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full text-white ${getSeverityColor(anomaly.severity)}`}>
                      {anomaly.severity}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div className="font-medium">{anomaly.trace_id}</div>
                    <div className="text-gray-500">{anomaly.description}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(anomaly.detected_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {anomaly.resolved ? (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        Resolved
                      </span>
                    ) : (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                        Unresolved
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {anomaly.root_cause ? (
                      <div>
                        <div className="font-medium">{anomaly.root_cause.root_cause_category}</div>
                        <div className="text-xs">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getConfidenceColor(anomaly.root_cause_confidence || 'LOW')}`}>
                            {anomaly.root_cause_confidence || 'LOW'} confidence
                          </span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400">Analyzing...</span>
                    )}
                  </td>
                </tr>
                {expandedAnomaly === anomaly.id && (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 bg-gray-50">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-medium text-gray-900 mb-2">Root Cause Analysis</h4>
                          {anomaly.root_cause ? (
                            <div>
                              <div className="mb-2">
                                <span className="font-medium">Category:</span> {anomaly.root_cause.root_cause_category}
                              </div>
                              <div className="mb-2">
                                <span className="font-medium">Details:</span> {anomaly.root_cause.root_cause_details}
                              </div>
                              <div>
                                <span className="font-medium">Confidence:</span> 
                                <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getConfidenceColor(anomaly.root_cause_confidence || 'LOW')}`}>
                                  {anomaly.root_cause_confidence || 'LOW'}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="text-gray-500">No root cause analysis available</div>
                          )}
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900 mb-2">Suggested Actions</h4>
                          {anomaly.suggested_actions && anomaly.suggested_actions.length > 0 ? (
                            <ul className="list-disc pl-5 space-y-1">
                              {anomaly.suggested_actions.map((action, index) => (
                                <li key={index} className="text-gray-700">{action}</li>
                              ))}
                            </ul>
                          ) : (
                            <div className="text-gray-500">No suggested actions available</div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
        
        {anomalies.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-500">No anomalies found matching the current filters</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnomalyDashboard;