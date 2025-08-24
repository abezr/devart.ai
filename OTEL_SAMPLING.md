# OpenTelemetry Sampling Strategy

This document describes the sampling strategies implemented in the devart.ai platform to optimize performance while maintaining observability.

## Sampling Strategies

### 1. Always On Sampling
- **Description**: All traces are sampled and exported
- **Environment Variable**: `OTEL_SAMPLING_STRATEGY=always_on`
- **Use Case**: Development and testing environments where full visibility is needed
- **Performance Impact**: Highest overhead but complete trace data

### 2. Always Off Sampling
- **Description**: No traces are sampled or exported
- **Environment Variable**: `OTEL_SAMPLING_STRATEGY=always_off`
- **Use Case**: Disabling tracing for performance testing or when tracing is not needed
- **Performance Impact**: No overhead, no trace data

### 3. Trace ID Ratio Sampling
- **Description**: A percentage of traces are sampled based on trace ID
- **Environment Variable**: `OTEL_SAMPLING_STRATEGY=trace_id_ratio`
- **Additional Variable**: `OTEL_SAMPLING_RATIO` (default: 0.1 for 10%)
- **Use Case**: Production environments where full tracing is not needed but some visibility is required
- **Performance Impact**: Configurable overhead based on sampling ratio

## Configuration by Component

### Backend API (Hono/Cloudflare Workers)
- **Default Strategy**: Always On
- **Environment Variables**:
  - `OTEL_SAMPLING_STRATEGY` - Sampling strategy to use
  - `OTEL_SAMPLING_RATIO` - Ratio for trace ID ratio sampling

### Frontend (Next.js)
- **Default Strategy**: Always On
- **Environment Variables**:
  - `NEXT_PUBLIC_OTEL_SAMPLING_STRATEGY` - Sampling strategy to use
  - `NEXT_PUBLIC_OTEL_SAMPLING_RATIO` - Ratio for trace ID ratio sampling

### Agent Services (Python)
- **Default Strategy**: Always On
- **Environment Variables**:
  - `OTEL_SAMPLING_STRATEGY` - Sampling strategy to use
  - `OTEL_SAMPLING_RATIO` - Ratio for trace ID ratio sampling

## Performance Optimization

### Memory and CPU Overhead
- Sampling reduces the memory and CPU overhead of tracing
- Batch processing minimizes the impact of trace exporting
- Asynchronous export prevents blocking operations

### Network Considerations
- Trace data is efficiently serialized to minimize network usage
- Compression can be enabled for trace export
- Local buffering handles network issues gracefully

## Recommendations

### Development Environment
- Use Always On sampling for full visibility during development
- Monitor performance impact during development

### Production Environment
- Start with 10% trace ID ratio sampling
- Adjust ratio based on volume and performance requirements
- Use Always Off sampling for performance testing

### High-Traffic Services
- Use lower sampling ratios (1-5%)
- Monitor for critical error traces even with low sampling
- Consider adaptive sampling for variable traffic patterns