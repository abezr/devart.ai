import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { AlwaysOnSampler, AlwaysOffSampler, TraceIdRatioBasedSampler } from '@opentelemetry/sdk-trace-node';

/**
 * Initialize OpenTelemetry SDK for the backend API
 */
export function initializeOpenTelemetry() {
  const serviceName = process.env.OTEL_SERVICE_NAME || 'devart-api';
  
  const resource = new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
    [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
  });

  const traceExporter = new OTLPTraceExporter({
    url: process.env.OTLP_EXPORTER_ENDPOINT || 'http://localhost:4318/v1/traces',
  });

  // Configure sampling strategy
  let sampler;
  const samplingStrategy = process.env.OTEL_SAMPLING_STRATEGY || 'always_on';
  
  switch (samplingStrategy) {
    case 'always_off':
      sampler = new AlwaysOffSampler();
      break;
    case 'trace_id_ratio':
      const ratio = parseFloat(process.env.OTEL_SAMPLING_RATIO || '0.1');
      sampler = new TraceIdRatioBasedSampler(ratio);
      break;
    case 'always_on':
    default:
      sampler = new AlwaysOnSampler();
  }

  const sdk = new NodeSDK({
    resource,
    traceExporter,
    sampler, // Use the configured sampler
    instrumentations: [
      getNodeAutoInstrumentations({
        // Disable fs instrumentation as it can be noisy
        '@opentelemetry/instrumentation-fs': {
          enabled: false,
        },
      }),
    ],
  });

  // Start the SDK
  sdk.start();

  // Gracefully shutdown the SDK on process exit
  process.on('SIGTERM', () => {
    sdk.shutdown().then(
      () => console.log('OpenTelemetry SDK shut down successfully'),
      (err) => console.log('Error shutting down OpenTelemetry SDK', err)
    );
  });

  return sdk;
}