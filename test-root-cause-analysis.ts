import { analyzeRootCause, EnhancedAnomaly } from './apps/api/src/services/rootCauseAnalysis';

// Test data for different types of anomalies
const testAnomalies: EnhancedAnomaly[] = [
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
  },
  {
    id: 'test-4',
    trace_id: 'trace-004',
    anomaly_type: 'PERFORMANCE',
    anomaly_subtype: 'HIGH_ERROR_RATE',
    severity: 'MEDIUM',
    description: 'High error rate detected in service auth-service. Error rate: 15.00%, Threshold: 5.00%',
    detected_at: new Date().toISOString(),
    resolved: false
  }
];

console.log('Testing Root Cause Analysis...\n');

testAnomalies.forEach((anomaly, index) => {
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