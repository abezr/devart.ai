# OpenTelemetry Environment Variables

This document describes the environment variables used to configure OpenTelemetry across the devart.ai platform.

## Backend API (Hono/Cloudflare Workers)

| Variable | Description | Default Value | Required |
|----------|-------------|---------------|----------|
| `OTLP_EXPORTER_ENDPOINT` | OTLP collector endpoint for traces | `http://localhost:4318/v1/traces` | No |
| `OTEL_SERVICE_NAME` | Service name for identification | `devart-api` | No |

## Frontend (Next.js)

| Variable | Description | Default Value | Required |
|----------|-------------|---------------|----------|
| `NEXT_PUBLIC_OTLP_EXPORTER_ENDPOINT` | OTLP collector endpoint for traces | `http://localhost:4318/v1/traces` | No |
| `NEXT_PUBLIC_OTEL_SERVICE_NAME` | Service name for identification | `devart-frontend` | No |

## Agent Services (Python)

| Variable | Description | Default Value | Required |
|----------|-------------|---------------|----------|
| `OTLP_EXPORTER_ENDPOINT` | OTLP collector endpoint for traces | `http://localhost:4318/v1/traces` | No |
| `OTEL_SERVICE_NAME` | Service name for identification | `devart-agent` | No |

## Collector Configuration

| Variable | Description | Default Value | Required |
|----------|-------------|---------------|----------|
| `TEMPO_ENDPOINT` | Grafana Tempo endpoint | `tempo:4317` | No |

## Security Considerations

When deploying to production, ensure that:

1. OTLP endpoints use HTTPS
2. Authentication is configured for collector endpoints
3. Network policies restrict access to collector endpoints