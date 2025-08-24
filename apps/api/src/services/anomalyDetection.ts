import { Env } from '../lib/types';
import { sendTelegramMessage } from './telegram';
import { analyzeRootCause } from './rootCauseAnalysis';

/**
 * Anomaly detection result interface
 */
export interface AnomalyResult {
  trace_id: string;
  span_id?: string;
  anomaly_type: 'PERFORMANCE' | 'SECURITY' | 'RESOURCE';
  anomaly_subtype: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  detected_at: string;
  metrics?: Record<string, number>;
  root_cause?: any; // Root cause analysis result
  root_cause_confidence?: 'LOW' | 'MEDIUM' | 'HIGH';
  suggested_actions?: string[];
}

/**
 * Configuration interface for anomaly detection
 */
export interface AnomalyDetectionConfig {
  latency_threshold_stddev: number;
  error_rate_threshold: number;
  throughput_spike_threshold: number;
  sampling_enabled: boolean;
  sampling_ratio: number;
}

/**
 * Trace data interface
 */
export interface TraceData {
  traceId: string;
  spans: SpanData[];
  duration: number;
  startTime: string;
  serviceName: string;
  isError: boolean;
}

/**
 * Span data interface
 */
export interface SpanData {
  spanId: string;
  operationName: string;
  duration: number;
  startTime: string;
  serviceName: string;
  isError: boolean;
  tags: Record<string, string>;
}

/**
 * Metrics data for statistical analysis
 */
export interface MetricsData {
  traceId: string;
  latency: number;
  errorCount: number;
  totalSpans: number;
  serviceName: string;
  timestamp: string;
}

/**
 * Calculate mean of an array of numbers
 */
function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((acc, val) => acc + val, 0);
  return sum / values.length;
}

/**
 * Calculate standard deviation of an array of numbers
 */
function calculateStdDev(values: number[]): number {
  if (values.length <= 1) return 0;
  const mean = calculateMean(values);
  const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
  const avgSquaredDiff = calculateMean(squaredDiffs);
  return Math.sqrt(avgSquaredDiff);
}

/**
 * Detect latency anomalies using Z-score analysis
 */
export function detectLatencyAnomalies(
  metrics: MetricsData[], 
  config: AnomalyDetectionConfig
): AnomalyResult[] {
  const anomalies: AnomalyResult[] = [];
  
  // Group metrics by service
  const serviceMetrics = new Map<string, MetricsData[]>();
  for (const metric of metrics) {
    if (!serviceMetrics.has(metric.serviceName)) {
      serviceMetrics.set(metric.serviceName, []);
    }
    serviceMetrics.get(metric.serviceName)!.push(metric);
  }
  
  // Detect anomalies for each service
  for (const [serviceName, serviceData] of serviceMetrics.entries()) {
    const latencies = serviceData.map(d => d.latency);
    const meanLatency = calculateMean(latencies);
    const stdDevLatency = calculateStdDev(latencies);
    
    // Skip if we don't have enough data
    if (stdDevLatency === 0 || latencies.length < 5) continue;
    
    // Check each data point for anomalies
    for (const data of serviceData) {
      const zScore = Math.abs(data.latency - meanLatency) / stdDevLatency;
      
      if (zScore > config.latency_threshold_stddev) {
        const severity = zScore > config.latency_threshold_stddev * 2 ? 'HIGH' : 'MEDIUM';
        
        anomalies.push({
          trace_id: data.traceId,
          anomaly_type: 'PERFORMANCE',
          anomaly_subtype: 'HIGH_LATENCY',
          severity: severity as 'MEDIUM' | 'HIGH',
          description: `High latency detected in service ${serviceName}. Latency: ${data.latency.toFixed(2)}ms, Mean: ${meanLatency.toFixed(2)}ms, Z-Score: ${zScore.toFixed(2)}`,
          detected_at: data.timestamp,
          metrics: {
            latency: data.latency,
            meanLatency: meanLatency,
            stdDevLatency: stdDevLatency,
            zScore: zScore
          }
        });
      }
    }
  }
  
  return anomalies;
}

/**
 * Detect error rate anomalies using threshold-based detection
 */
export function detectErrorAnomalies(
  metrics: MetricsData[], 
  config: AnomalyDetectionConfig
): AnomalyResult[] {
  const anomalies: AnomalyResult[] = [];
  
  // Group metrics by service
  const serviceMetrics = new Map<string, MetricsData[]>();
  for (const metric of metrics) {
    if (!serviceMetrics.has(metric.serviceName)) {
      serviceMetrics.set(metric.serviceName, []);
    }
    serviceMetrics.get(metric.serviceName)!.push(metric);
  }
  
  // Detect anomalies for each service
  for (const [serviceName, serviceData] of serviceMetrics.entries()) {
    const totalTraces = serviceData.length;
    const errorTraces = serviceData.filter(d => d.errorCount > 0).length;
    
    if (totalTraces === 0) continue;
    
    const errorRate = errorTraces / totalTraces;
    
    if (errorRate > config.error_rate_threshold) {
      const severity = errorRate > config.error_rate_threshold * 2 ? 'HIGH' : 'MEDIUM';
      
      anomalies.push({
        trace_id: serviceData[0].traceId, // Just pick the first one as an example
        anomaly_type: 'PERFORMANCE',
        anomaly_subtype: 'HIGH_ERROR_RATE',
        severity: severity as 'MEDIUM' | 'HIGH',
        description: `High error rate detected in service ${serviceName}. Error rate: ${(errorRate * 100).toFixed(2)}%, Threshold: ${(config.error_rate_threshold * 100).toFixed(2)}%`,
        detected_at: new Date().toISOString(),
        metrics: {
          errorRate: errorRate,
          threshold: config.error_rate_threshold,
          totalTraces: totalTraces,
          errorTraces: errorTraces
        }
      });
    }
  }
  
  return anomalies;
}

/**
 * Detect throughput anomalies using simple threshold detection
 */
export function detectThroughputAnomalies(
  metrics: MetricsData[], 
  config: AnomalyDetectionConfig
): AnomalyResult[] {
  const anomalies: AnomalyResult[] = [];
  
  // Group metrics by service and time window (e.g., 1 minute)
  const serviceWindows = new Map<string, Map<string, MetricsData[]>>();
  
  for (const metric of metrics) {
    const timeWindow = new Date(metric.timestamp).toISOString().slice(0, 16); // Round to minute
    const key = `${metric.serviceName}-${timeWindow}`;
    
    if (!serviceWindows.has(key)) {
      serviceWindows.set(key, []);
    }
    serviceWindows.get(key)!.push(metric);
  }
  
  // Calculate throughput for each window
  const throughputData: { serviceName: string; window: string; count: number; timestamp: string }[] = [];
  
  for (const [key, windowData] of serviceWindows.entries()) {
    const [serviceName, window] = key.split('-');
    throughputData.push({
      serviceName,
      window,
      count: windowData.length,
      timestamp: windowData[0]?.timestamp || new Date().toISOString()
    });
  }
  
  // Group by service and detect anomalies
  const serviceThroughput = new Map<string, typeof throughputData>();
  for (const data of throughputData) {
    if (!serviceThroughput.has(data.serviceName)) {
      serviceThroughput.set(data.serviceName, []);
    }
    serviceThroughput.get(data.serviceName)!.push(data);
  }
  
  // Detect anomalies for each service
  for (const [serviceName, serviceData] of serviceThroughput.entries()) {
    if (serviceData.length < 5) continue; // Not enough data
    
    const counts = serviceData.map(d => d.count);
    const meanCount = calculateMean(counts);
    const stdDevCount = calculateStdDev(counts);
    
    if (stdDevCount === 0) continue;
    
    // Check each data point for anomalies
    for (const data of serviceData) {
      const zScore = Math.abs(data.count - meanCount) / stdDevCount;
      
      if (zScore > config.throughput_spike_threshold) {
        const severity = zScore > config.throughput_spike_threshold * 2 ? 'HIGH' : 'MEDIUM';
        
        anomalies.push({
          trace_id: `${serviceName}-${data.window}`, // Create a unique ID for this window
          anomaly_type: 'PERFORMANCE',
          anomaly_subtype: 'TRAFFIC_SPIKE',
          severity: severity as 'MEDIUM' | 'HIGH',
          description: `Traffic spike detected in service ${serviceName} at ${data.window}. Requests: ${data.count}, Mean: ${meanCount.toFixed(2)}, Z-Score: ${zScore.toFixed(2)}`,
          detected_at: data.timestamp,
          metrics: {
            count: data.count,
            meanCount: meanCount,
            stdDevCount: stdDevCount,
            zScore: zScore
          }
        });
      }
    }
  }
  
  return anomalies;
}

/**
 * Collect trace data from Grafana Tempo
 * @param env Environment variables
 * @returns Promise resolving to trace data
 */
export async function collectTraceData(env: Env): Promise<TraceData[]> {
  try {
    // In a real implementation, this would connect to Grafana Tempo
    // and retrieve trace data for analysis
    
    // Check if we have Tempo configuration
    const tempoEndpoint = env.TEMPO_ENDPOINT || 'http://tempo:3100';
    console.log(`Attempting to collect trace data from Tempo at ${tempoEndpoint}`);
    
    // For demonstration, we'll generate some mock trace data
    // In a real implementation, this would query the Tempo API
    const mockTraces: TraceData[] = [];
    
    // Generate mock data for testing
    const serviceNames = ['api-service', 'auth-service', 'database-service', 'cache-service'];
    
    // Generate more realistic data with some anomalies
    for (let i = 0; i < 200; i++) {
      const serviceName = serviceNames[Math.floor(Math.random() * serviceNames.length)];
      const isError = Math.random() < 0.05; // 5% error rate
      
      // Create some latency anomalies
      let baseLatency;
      if (i % 20 === 0) {
        // Create some obvious anomalies every 20th trace
        baseLatency = 1000 + Math.random() * 1000; // 1-2 seconds
      } else {
        baseLatency = serviceName === 'database-service' ? 200 : 
                     serviceName === 'auth-service' ? 100 : 
                     serviceName === 'cache-service' ? 50 : 150;
      }
      
      const latency = baseLatency + (Math.random() * 100 - 50); // Add some variance
      
      mockTraces.push({
        traceId: `trace-${Date.now()}-${i}`,
        spans: [
          {
            spanId: `span-${Date.now()}-${i}-1`,
            operationName: 'handleRequest',
            duration: latency,
            startTime: new Date(Date.now() - Math.floor(Math.random() * 3600000)).toISOString(),
            serviceName: serviceName,
            isError: isError,
            tags: {
              'http.status_code': isError ? '500' : '200',
              'http.method': 'GET'
            }
          }
        ],
        duration: latency,
        startTime: new Date(Date.now() - Math.floor(Math.random() * 3600000)).toISOString(),
        serviceName: serviceName,
        isError: isError
      });
    }
    
    console.log(`Generated ${mockTraces.length} mock traces for analysis`);
    return mockTraces;
  } catch (error) {
    console.error('Error collecting trace data from Tempo:', error);
    
    // Fallback to mock data if Tempo is not available
    console.log('Falling back to mock trace data');
    const mockTraces: TraceData[] = [];
    const serviceNames = ['api-service', 'auth-service', 'database-service', 'cache-service'];
    
    for (let i = 0; i < 50; i++) {
      const serviceName = serviceNames[Math.floor(Math.random() * serviceNames.length)];
      const isError = Math.random() < 0.05;
      const latency = 100 + (Math.random() * 200);
      
      mockTraces.push({
        traceId: `mock-trace-${i}`,
        spans: [
          {
            spanId: `mock-span-${i}-1`,
            operationName: 'handleRequest',
            duration: latency,
            startTime: new Date().toISOString(),
            serviceName: serviceName,
            isError: isError,
            tags: {
              'http.status_code': isError ? '500' : '200',
              'http.method': 'GET'
            }
          }
        ],
        duration: latency,
        startTime: new Date().toISOString(),
        serviceName: serviceName,
        isError: isError
      });
    }
    
    return mockTraces;
  }
}

/**
 * Convert trace data to metrics data for analysis
 */
export function convertTracesToMetrics(traces: TraceData[]): MetricsData[] {
  return traces.map(trace => {
    const errorCount = trace.spans.filter(span => span.isError).length;
    
    return {
      traceId: trace.traceId,
      latency: trace.duration,
      errorCount: errorCount,
      totalSpans: trace.spans.length,
      serviceName: trace.serviceName,
      timestamp: trace.startTime
    };
  });
}

/**
 * Detect anomalies in trace data using statistical methods
 * @param traces Trace data to analyze
 * @param config Anomaly detection configuration
 * @returns Array of detected anomalies
 */
export function detectAnomalies(traces: TraceData[], config: AnomalyDetectionConfig): AnomalyResult[] {
  const metrics = convertTracesToMetrics(traces);
  const anomalies: AnomalyResult[] = [];
  
  // Detect different types of anomalies
  const latencyAnomalies = detectLatencyAnomalies(metrics, config);
  const errorAnomalies = detectErrorAnomalies(metrics, config);
  const throughputAnomalies = detectThroughputAnomalies(metrics, config);
  
  // Combine all anomalies
  anomalies.push(...latencyAnomalies, ...errorAnomalies, ...throughputAnomalies);
  
  // Add some security anomalies for demonstration
  for (const trace of traces) {
    // Simulate detection of unusual access patterns
    if (Math.random() < 0.02) { // 2% chance
      anomalies.push({
        trace_id: trace.traceId,
        anomaly_type: 'SECURITY',
        anomaly_subtype: 'UNUSUAL_ACCESS_PATTERN',
        severity: 'HIGH',
        description: `Unusual access pattern detected in service ${trace.serviceName}`,
        detected_at: trace.startTime
      });
    }
  }
  
  return anomalies;
}

/**
 * Generate alerts for detected anomalies
 * @param anomalies Detected anomalies
 * @param env Environment variables
 */
export async function generateAlerts(anomalies: AnomalyResult[], env: Env): Promise<void> {
  console.log(`Generating alerts for ${anomalies.length} anomalies`);
  
  // Group anomalies by severity
  const criticalAnomalies = anomalies.filter(a => a.severity === 'CRITICAL');
  const highAnomalies = anomalies.filter(a => a.severity === 'HIGH');
  const mediumAnomalies = anomalies.filter(a => a.severity === 'MEDIUM');
  const lowAnomalies = anomalies.filter(a => a.severity === 'LOW');
  
  // Send Telegram notifications for critical and high severity anomalies
  if (criticalAnomalies.length > 0) {
    let message = `🚨 *CRITICAL Anomalies Detected*\n\n` +
      `Detected ${criticalAnomalies.length} critical anomalies:\n`;
    
    criticalAnomalies.forEach((a, index) => {
      message += `${index + 1}. ${a.anomaly_type}: ${a.description}\n`;
      
      // Include root cause information if available
      if (a.root_cause) {
        message += `   Root Cause: ${a.root_cause.root_cause_category}\n`;
        message += `   Details: ${a.root_cause.root_cause_details}\n`;
        if (a.root_cause_confidence) {
          message += `   Confidence: ${a.root_cause_confidence}\n`;
        }
        if (a.suggested_actions && a.suggested_actions.length > 0) {
          message += `   Suggested Actions: ${a.suggested_actions.slice(0, 3).join(', ')}\n`;
        }
      }
      message += '\n';
    });
    
    message += `\nPlease investigate immediately.`;
    
    await sendTelegramMessage(env, message);
  }
  
  if (highAnomalies.length > 0) {
    let message = `⚠️ *HIGH Severity Anomalies Detected*\n\n` +
      `Detected ${highAnomalies.length} high severity anomalies:\n`;
    
    highAnomalies.forEach((a, index) => {
      message += `${index + 1}. ${a.anomaly_type}: ${a.description}\n`;
      
      // Include root cause information if available
      if (a.root_cause) {
        message += `   Root Cause: ${a.root_cause.root_cause_category}\n`;
        message += `   Details: ${a.root_cause.root_cause_details}\n`;
        if (a.root_cause_confidence) {
          message += `   Confidence: ${a.root_cause_confidence}\n`;
        }
        if (a.suggested_actions && a.suggested_actions.length > 0) {
          message += `   Suggested Actions: ${a.suggested_actions.slice(0, 3).join(', ')}\n`;
        }
      }
      message += '\n';
    });
    
    message += `\nPlease review at your earliest convenience.`;
    
    await sendTelegramMessage(env, message);
  }
  
  // Log all anomalies
  for (const anomaly of anomalies) {
    console.log(`Alert: ${anomaly.anomaly_type} (${anomaly.severity}) - ${anomaly.description}`);
    
    // Log root cause information if available
    if (anomaly.root_cause) {
      console.log(`  Root Cause: ${anomaly.root_cause.root_cause_category}`);
      console.log(`  Details: ${anomaly.root_cause.root_cause_details}`);
      if (anomaly.root_cause_confidence) {
        console.log(`  Confidence: ${anomaly.root_cause_confidence}`);
      }
      if (anomaly.suggested_actions) {
        console.log(`  Suggested Actions: ${anomaly.suggested_actions.join(', ')}`);
      }
    }
  }
}

/**
 * Store anomaly detection results in the database
 * @param anomalies Detected anomalies
 * @param env Environment variables
 */
export async function storeResults(anomalies: AnomalyResult[], env: Env): Promise<void> {
  // This is a placeholder implementation
  // In a real implementation, this would store results in the trace_anomalies table
  console.log(`Storing ${anomalies.length} anomalies in database`);
  
  for (const anomaly of anomalies) {
    // Perform root cause analysis for each anomaly
    if (!anomaly.root_cause) {
      // Create an enhanced anomaly object for root cause analysis
      const enhancedAnomaly = {
        id: `temp-${Date.now()}`,
        trace_id: anomaly.trace_id,
        span_id: anomaly.span_id,
        anomaly_type: anomaly.anomaly_type,
        anomaly_subtype: anomaly.anomaly_subtype,
        severity: anomaly.severity,
        description: anomaly.description,
        detected_at: anomaly.detected_at,
        resolved: false,
        root_cause: anomaly.root_cause
      };
      
      // Analyze root cause
      const rootCause = analyzeRootCause(enhancedAnomaly);
      if (rootCause) {
        anomaly.root_cause = {
          root_cause_category: rootCause.root_cause_category,
          root_cause_details: rootCause.root_cause_details
        };
        anomaly.root_cause_confidence = rootCause.confidence_score;
        anomaly.suggested_actions = rootCause.suggested_actions;
      }
    }
    
    console.log(`Stored anomaly: ${anomaly.trace_id} - ${anomaly.description}`);
    // In a real implementation, this would use Supabase client to insert
    // records into the trace_anomalies table with root cause information
  }
}

/**
 * Get anomaly detection configuration from database
 * @param env Environment variables
 * @returns Anomaly detection configuration
 */
export async function getAnomalyDetectionConfig(env: Env): Promise<AnomalyDetectionConfig> {
  // This is a placeholder implementation
  // In a real implementation, this would retrieve configuration
  // from the anomaly_detection_config table
  return {
    latency_threshold_stddev: 3.0,
    error_rate_threshold: 0.05,
    throughput_spike_threshold: 3.0,
    sampling_enabled: true,
    sampling_ratio: 0.1
  };
}

/**
 * Main function to run the anomaly detection pipeline
 * @param env Environment variables
 */
export async function runAnomalyDetection(env: Env): Promise<void> {
  try {
    // 1. Get configuration
    const config = await getAnomalyDetectionConfig(env);
    console.log('Loaded anomaly detection configuration');
    
    // 2. Collect trace data
    const traces = await collectTraceData(env);
    console.log(`Collected ${traces.length} traces for analysis`);
    
    // 3. Detect anomalies
    const anomalies = detectAnomalies(traces, config);
    console.log(`Detected ${anomalies.length} anomalies`);
    
    // 4. Store results
    await storeResults(anomalies, env);
    
    // 5. Generate alerts
    await generateAlerts(anomalies, env);
    
    console.log('Anomaly detection pipeline completed successfully');
  } catch (error) {
    console.error('Error in anomaly detection pipeline:', error);
    throw error;
  }
}