// Simple test for root cause analysis functionality
const anomalies = [
  {
    id: 'test-1',
    trace_id: 'trace-001',
    anomaly_type: 'PERFORMANCE',
    anomaly_subtype: 'HIGH_LATENCY',
    severity: 'HIGH',
    description: 'High latency detected in database service. Latency: 1500.00ms, Mean: 200.00ms, Z-Score: 4.50',
    detected_at: new Date().toISOString(),
    resolved: false
  },
  {
    id: 'test-2',
    trace_id: 'trace-002',
    anomaly_type: 'SECURITY',
    anomaly_subtype: 'UNUSUAL_ACCESS_PATTERN',
    severity: 'CRITICAL',
    description: 'Unusual access pattern detected in service api-service',
    detected_at: new Date().toISOString(),
    resolved: false
  },
  {
    id: 'test-3',
    trace_id: 'trace-003',
    anomaly_type: 'RESOURCE',
    anomaly_subtype: 'MEMORY_LEAK',
    severity: 'HIGH',
    description: 'Memory leak detected in service cache-service',
    detected_at: new Date().toISOString(),
    resolved: false
  }
];

console.log('Testing Root Cause Analysis...\n');

// Simple root cause analysis function for testing
function analyzeRootCause(anomaly) {
  try {
    if (!anomaly) return null;
    
    switch (anomaly.anomaly_type) {
      case 'PERFORMANCE':
        return {
          root_cause_category: 'Infrastructure',
          root_cause_details: 'Database performance issue detected.',
          confidence_score: 'HIGH',
          suggested_actions: [
            'Review slow query logs',
            'Optimize database indexes'
          ]
        };
      case 'SECURITY':
        return {
          root_cause_category: 'Security',
          root_cause_details: 'Unusual access pattern detected.',
          confidence_score: 'HIGH',
          suggested_actions: [
            'Review access logs',
            'Rotate credentials'
          ]
        };
      case 'RESOURCE':
        return {
          root_cause_category: 'Application',
          root_cause_details: 'Memory leak detected.',
          confidence_score: 'HIGH',
          suggested_actions: [
            'Profile memory usage',
            'Review code for leaks'
          ]
        };
      default:
        return {
          root_cause_category: 'Application',
          root_cause_details: 'General issue detected.',
          confidence_score: 'LOW',
          suggested_actions: [
            'Review system metrics',
            'Consult with experts'
          ]
        };
    }
  } catch (error) {
    console.error('Error analyzing root cause:', error);
    return null;
  }
}

anomalies.forEach((anomaly, index) => {
  console.log(`Test ${index + 1}: ${anomaly.anomaly_type} - ${anomaly.anomaly_subtype}`);
  console.log(`Description: ${anomaly.description}`);
  
  const rootCause = analyzeRootCause(anomaly);
  
  if (rootCause) {
    console.log(`Root Cause Category: ${rootCause.root_cause_category}`);
    console.log(`Root Cause Details: ${rootCause.root_cause_details}`);
    console.log(`Confidence Score: ${rootCause.confidence_score}`);
    console.log(`Suggested Actions: ${rootCause.suggested_actions.join(', ')}`);
  } else {
    console.log('No root cause analysis available');
  }
  
  console.log('---\n');
});