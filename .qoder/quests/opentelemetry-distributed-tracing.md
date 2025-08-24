# OpenTelemetry Distributed Tracing Implementation Design

## 1. Overview

This document outlines the design for implementing comprehensive distributed tracing across all services in the devart.ai platform using OpenTelemetry. The implementation will provide enterprise-grade observability by tracking requests as they flow through the system's various components, enabling performance monitoring, debugging, and optimization.

The design covers backend API services (Hono on Cloudflare Workers), frontend application (Next.js), agent services (Python), external service integrations (GitHub, OpenAI, Telegram, RabbitMQ, Kubernetes), and database operations (Supabase PostgreSQL).

## 2. Architecture

### 2.1 System Components Overview
The devart.ai platform consists of several key components that will be instrumented with distributed tracing:

1. **Frontend (Next.js)**: User interface running on Cloudflare Pages
2. **Backend API (Hono/Cloudflare Workers)**: REST API handling business logic
3. **Agent Services (Python)**: Autonomous AI agents processing tasks
4. **Message Queue (RabbitMQ)**: Task distribution system
5. **Container Orchestration (Kubernetes)**: Sandbox environments for agent execution
6. **Database (Supabase PostgreSQL)**: Data persistence layer
7. **External Services**: GitHub, OpenAI, Telegram integrations

### 2.2 Tracing Architecture Diagram
The tracing architecture will follow a distributed model where traces propagate through all system components. The frontend UI will initiate traces that flow through the Cloudflare Worker API, which in turn interacts with the Supabase Database, RabbitMQ, external services, and Kubernetes sandboxes. All components will be instrumented to propagate trace context and create spans for their operations.

### 2.3 OpenTelemetry Components
The implementation will utilize the following OpenTelemetry components:
- **API**: Standardized interfaces for telemetry generation
- **SDK**: Implementation of the API with processing and exporting capabilities
- **Exporter**: Components that send telemetry data to backends (e.g., Grafana Tempo)
- **Collector**: Standalone service that receives, processes, and exports telemetry data
- **Instrumentation Libraries**: Language-specific libraries for automatic instrumentation

## 3. Technology Stack & Dependencies

### 3.1 Backend (TypeScript/Node.js)
- `@opentelemetry/sdk-node`: OpenTelemetry Node.js SDK
- `@opentelemetry/exporter-trace-otlp-http`: OTLP HTTP exporter for traces
- `@opentelemetry/instrumentation-hono`: Hono framework instrumentation
- `@opentelemetry/instrumentation-pg`: PostgreSQL instrumentation
- `@opentelemetry/instrumentation-amqplib`: RabbitMQ instrumentation
- `@opentelemetry/instrumentation-http`: HTTP instrumentation
- `@opentelemetry/instrumentation-express`: Express instrumentation (if needed)
- `@opentelemetry/resources`: Resource detection
- `@opentelemetry/semantic-conventions`: Semantic conventions

### 3.2 Frontend (TypeScript/React)
- `@opentelemetry/sdk-trace-web`: Web SDK for browser tracing
- `@opentelemetry/exporter-trace-otlp-http`: OTLP HTTP exporter
- `@opentelemetry/instrumentation-fetch`: Fetch API instrumentation
- `@opentelemetry/instrumentation-xml-http-request`: XMLHttpRequest instrumentation
- `@opentelemetry/context-zone`: Zone.js context manager for Angular-style apps

### 3.3 Agent Services (Python)
- `opentelemetry-sdk`: OpenTelemetry Python SDK
- `opentelemetry-exporter-otlp`: OTLP exporter
- `opentelemetry-instrumentation-requests`: HTTP requests instrumentation
- `opentelemetry-instrumentation-pika`: RabbitMQ (pika) instrumentation
- `opentelemetry-instrumentation-psycopg2`: PostgreSQL instrumentation
- `opentelemetry-instrumentation-logging`: Logging instrumentation

### 3.4 Infrastructure
- **OpenTelemetry Collector**: Standalone service for receiving and processing telemetry data
- **Grafana Tempo**: Distributed tracing backend
- **Grafana**: Visualization platform for traces
- **Prometheus**: Metrics collection (optional integration)

## 4. Implementation Plan

### 4.1 Backend API Instrumentation (Hono/Cloudflare Workers)

#### 4.1.1 Initialization
The OpenTelemetry SDK will be initialized in the main entry point of the API using the Node.js SDK with auto-instrumentation for common libraries. The SDK will be configured with a service name of 'devart-api' and an OTLP HTTP exporter that sends trace data to a configurable endpoint.

#### 4.1.2 Hono Middleware
Custom middleware will be added to Hono to create spans for each incoming request. The middleware will capture HTTP method, URL, host, and status code as span attributes. Error information will be recorded for failed requests.

#### 4.1.3 Service Layer Instrumentation
Each service function in the backend will be wrapped with spans to track execution. Spans will include attributes specific to the business logic being executed, such as service IDs and charge amounts for budget operations. Error information will be captured for failed operations.

### 4.2 Frontend Instrumentation (Next.js)

#### 4.2.1 Initialization
OpenTelemetry will be initialized in the frontend application using the Web SDK with auto-instrumentation for browser APIs. The SDK will be configured with a service name of 'devart-frontend' and an OTLP HTTP exporter that sends trace data to a configurable endpoint. Instrumentation will be enabled for fetch and XMLHttpRequest APIs.

#### 4.2.2 Component Instrumentation
React components will be instrumented to track user interactions. Spans will be created for key user actions such as updating task status, with attributes capturing relevant context like task IDs and status values. Error information will be recorded for failed operations.

### 4.3 Agent Service Instrumentation (Python)

#### 4.3.1 Initialization
OpenTelemetry will be initialized in the agent's main module using the Python SDK. The SDK will be configured with a service name of 'devart-agent' and an OTLP HTTP exporter that sends trace data to a configurable endpoint. A batch span processor will be used to efficiently export spans.

#### 4.3.2 Task Processing Instrumentation
Agent task processing will be instrumented with spans using Python context managers. Each task processing operation will create a span with attributes capturing the task ID and title. The span will record the result of the operation (success or error) and any exceptions that occur.

### 4.4 External Service Integration

#### 4.4.1 RabbitMQ Instrumentation
RabbitMQ operations will be traced using the amqplib instrumentation. Each publish operation will create a span with attributes capturing the messaging system, destination queue, and task ID. Error information will be recorded for failed publish operations.

#### 4.4.2 Kubernetes Sandbox Instrumentation
Kubernetes operations will be traced with spans that capture attributes such as agent ID, task ID, and namespace. Provisioning operations will record the container ID and success status. Error information will be captured for failed operations.

### 4.5 Database Instrumentation
Database operations will be automatically traced using the PostgreSQL instrumentation. Client creation and database queries will be traced with attributes capturing the database system and connection information. Error information will be recorded for failed operations.

## 5. Data Models & Trace Structure

### 5.1 Trace Context Propagation
Trace context will be propagated across service boundaries using W3C Trace Context headers:
- `traceparent`: Contains trace ID, parent span ID, and trace flags
- `tracestate`: Vendor-specific trace information

### 5.2 Span Attributes
Common span attributes will include:
- Service identifiers
- Operation names
- Error information
- Business context (task IDs, agent IDs, etc.)
- Performance metrics (duration, latency)

### 5.3 Span Events
Key events will be recorded:
- Task creation
- Service calls
- Error occurrences
- State transitions

## 6. Business Logic Layer

### 6.1 Task Processing Trace Flow
Task processing traces will follow a flow from the frontend UI through the API, database, message queue, agent services, and back. Each component will create spans that capture the relevant operations and propagate trace context to maintain continuity.

### 6.2 Budget Supervision Trace Flow
Budget supervision traces will capture the flow of checking service budgets, suspending services when limits are exceeded, and sending alerts through Telegram. Each step will be represented as a span with relevant attributes.

## 7. Middleware & Interceptors

### 7.1 Cloudflare Worker Middleware
Custom middleware will be implemented to:
- Initialize trace context for incoming requests
- Propagate trace context to downstream services
- Capture HTTP request/response attributes
- Handle error scenarios

### 7.2 Python Agent Interceptors
Interceptors will be added to:
- Automatically trace HTTP requests
- Trace RabbitMQ message processing
- Capture database query information
- Handle exception tracing

## 8. Testing Strategy

### 8.1 Unit Testing
Unit tests will verify:
- Span creation and attribute setting
- Context propagation between services
- Error handling and exception recording
- Integration with existing business logic

### 8.2 Integration Testing
Integration tests will validate:
- End-to-end trace propagation
- Correct span relationships
- External service tracing
- Performance impact assessment

### 8.3 Observability Testing
Observability tests will ensure:
- Traces are correctly exported to the backend
- All critical paths are traced
- Sufficient context is captured for debugging
- Metrics are properly collected

## 9. Deployment & Configuration

### 9.1 Environment Variables
Required environment variables:
- `OTLP_EXPORTER_ENDPOINT`: OTLP collector endpoint
- `OTEL_SERVICE_NAME`: Service name for identification
- `OTEL_RESOURCE_ATTRIBUTES`: Additional resource attributes

### 9.2 OpenTelemetry Collector Configuration
Collector configuration for receiving and processing traces will include OTLP receivers for both HTTP and gRPC protocols, batch processors for efficient handling of telemetry data, and OTLP exporters to send traces to Grafana Tempo. The configuration will be defined in a YAML file that specifies the data flow from receivers through processors to exporters.

### 9.3 Grafana Tempo Integration
Configuration for Tempo to store and query traces:
- Storage backend setup (S3, GCS, or local storage)
- Query frontend configuration
- Metrics generation from traces

## 10. Security Considerations

### 10.1 Data Protection
- Sensitive information will be excluded from traces
- PII will be masked or omitted from tracing data
- Authentication tokens will not be traced

### 10.2 Transport Security
- OTLP communication will use HTTPS
- mTLS can be configured for additional security
- Network policies will restrict collector access

### 10.3 Access Control
- Tempo query access will be restricted
- Grafana dashboard access will follow RBAC
- Audit logging for trace access

## 11. Performance Considerations

### 11.1 Sampling Strategy
- Head-based sampling to reduce data volume
- Tail-based sampling for error analysis
- Adaptive sampling based on service traffic

### 11.2 Resource Usage
- Memory and CPU overhead monitoring
- Batch processing to minimize impact
- Asynchronous export to avoid blocking operations

### 11.3 Network Considerations
- Efficient trace data serialization
- Compression for trace export
- Local buffering to handle network issues

## 12. Monitoring & Alerting

### 12.1 Trace-Based Metrics
- Request latency distributions
- Error rates by service
- Throughput metrics
- Database query performance

### 12.2 Alerting Rules
- High error rates in traces
- Increased latency for critical operations
- Missing traces for expected operations
- Collector health monitoring

