# OpenTelemetry Monitoring and Alerting

This document describes the monitoring and alerting setup for traces in the devart.ai platform.

## Trace-Based Metrics

### 1. Request Latency Distributions
- **Metric**: Request duration histograms
- **Dimensions**: Service name, operation name, status code
- **Visualization**: Heatmaps and percentiles (50th, 95th, 99th)
- **Purpose**: Identify performance bottlenecks and degradation

### 2. Error Rates by Service
- **Metric**: Error count and rate
- **Dimensions**: Service name, operation name, error type
- **Visualization**: Time series graphs
- **Purpose**: Detect service health issues and error spikes

### 3. Throughput Metrics
- **Metric**: Requests per second
- **Dimensions**: Service name, operation name
- **Visualization**: Time series graphs
- **Purpose**: Monitor service load and capacity

### 4. Database Query Performance
- **Metric**: Query duration and count
- **Dimensions**: Database, query type, table
- **Visualization**: Histograms and time series
- **Purpose**: Optimize database performance

## Alerting Rules

### 1. High Error Rates
- **Condition**: Error rate > 5% for 5 minutes
- **Severity**: Critical
- **Action**: Page on-call engineer
- **Purpose**: Detect service outages and major issues

### 2. Increased Latency
- **Condition**: 95th percentile latency > 2x baseline for 10 minutes
- **Severity**: Warning
- **Action**: Create ticket for investigation
- **Purpose**: Identify performance degradation

### 3. Missing Traces
- **Condition**: No traces received from service for 15 minutes
- **Severity**: Critical
- **Action**: Page on-call engineer
- **Purpose**: Detect service outages or tracing issues

### 4. Collector Health
- **Condition**: Collector error rate > 10% for 5 minutes
- **Severity**: Warning
- **Action**: Create ticket for investigation
- **Purpose**: Monitor tracing infrastructure health

## Grafana Dashboard Configuration

### Dashboard 1: Service Overview
- **Panels**:
  - Overall request rate
  - Overall error rate
  - Latency percentiles
  - Top slowest operations
- **Purpose**: High-level service health monitoring

### Dashboard 2: Service Details
- **Panels**:
  - Request rate by operation
  - Error rate by operation
  - Latency distribution
  - Traces sample
- **Purpose**: Detailed service performance analysis

### Dashboard 3: Database Performance
- **Panels**:
  - Query rate by database
  - Query latency by database
  - Slow query analysis
  - Connection pool metrics
- **Purpose**: Database performance monitoring

### Dashboard 4: RabbitMQ Monitoring
- **Panels**:
  - Message publish rate
  - Message processing latency
  - Queue depth
  - Error rates
- **Purpose**: Message queue performance monitoring

## Implementation

### Grafana Tempo Configuration
- **Storage**: Object storage (S3/GCS) for trace retention
- **Query Frontend**: Enable for scalable querying
- **Metrics Generation**: Enable automatic metrics from traces
- **Retention**: 72 hours for traces, 30 days for metrics

### Prometheus Integration
- **Metrics Endpoint**: Tempo metrics endpoint
- **Alertmanager**: Configure for alert routing
- **Recording Rules**: Pre-compute common metrics
- **Service Discovery**: Automatic discovery of Tempo instances

## Best Practices

### Alert Tuning
- Start with conservative thresholds
- Adjust based on historical data
- Use multi-dimensional alerting
- Implement alert suppression for known issues

### Dashboard Design
- Focus on actionable metrics
- Use consistent time ranges
- Include context and documentation
- Regular review and cleanup

### Performance Considerations
- Limit trace retention based on storage capacity
- Use sampling to reduce storage requirements
- Monitor collector resource usage
- Scale collectors based on trace volume