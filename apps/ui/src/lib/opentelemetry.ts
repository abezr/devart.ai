import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { getWebAutoInstrumentations } from '@opentelemetry/auto-instrumentations-web';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { AlwaysOnSampler, AlwaysOffSampler, TraceIdRatioBasedSampler } from '@opentelemetry/sdk-trace-base';

let provider: WebTracerProvider | null = null;

/**
 * Initialize OpenTelemetry SDK for the frontend
 */
export function initializeOpenTelemetry() {
  if (provider) {
    // Already initialized
    return;
  }

  const serviceName = process.env.NEXT_PUBLIC_OTEL_SERVICE_NAME || 'devart-frontend';
  
  const resource = new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
    [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
  });

  // Configure sampling strategy
  let sampler;
  const samplingStrategy = process.env.NEXT_PUBLIC_OTEL_SAMPLING_STRATEGY || 'always_on';
  
  switch (samplingStrategy) {
    case 'always_off':
      sampler = new AlwaysOffSampler();
      break;
    case 'trace_id_ratio':
      const ratio = parseFloat(process.env.NEXT_PUBLIC_OTEL_SAMPLING_RATIO || '0.1');
      sampler = new TraceIdRatioBasedSampler(ratio);
      break;
    case 'always_on':
    default:
      sampler = new AlwaysOnSampler();
  }

  provider = new WebTracerProvider({
    resource,
    sampler, // Use the configured sampler
  });

  const traceExporter = new OTLPTraceExporter({
    url: process.env.NEXT_PUBLIC_OTLP_EXPORTER_ENDPOINT || 'http://localhost:4318/v1/traces',
  });

  provider.addSpanProcessor(new BatchSpanProcessor(traceExporter, {
    // The maximum queue size. After the size is reached spans are dropped.
    maxQueueSize: 100,
    // The maximum batch size of every export. It must be smaller or equal to maxQueueSize.
    maxExportBatchSize: 10,
    // The interval between two consecutive exports in milliseconds
    scheduledDelayMillis: 5000,
    // How long the export can run before it is cancelled in milliseconds
    exportTimeoutMillis: 30000,
  }));

  provider.register();

  // Register auto-instrumentations
  registerInstrumentations({
    tracerProvider: provider,
    instrumentations: [
      getWebAutoInstrumentations({
        '@opentelemetry/instrumentation-fetch': {
          enabled: true,
          ignoreUrls: [/localhost:4318\/v1\/traces/], // Ignore OTLP exporter requests
          // Exclude sensitive headers from traces
          requestHook: (span, request) => {
            // Don't capture sensitive headers
            if (request.headers) {
              const headers = new Headers(request.headers);
              headers.delete('authorization');
              headers.delete('x-api-key');
              // Add other sensitive headers as needed
            }
          },
        },
        '@opentelemetry/instrumentation-xml-http-request': {
          enabled: true,
          // Exclude sensitive headers from traces
          requestHook: (span, xhr) => {
            // Don't capture sensitive headers
            xhr.setRequestHeader('authorization', '');
            xhr.setRequestHeader('x-api-key', '');
            // Add other sensitive headers as needed
          },
        },
      }),
    ],
  });

  // Gracefully shutdown the provider on page unload
  window.addEventListener('beforeunload', () => {
    provider?.shutdown().then(
      () => console.log('OpenTelemetry SDK shut down successfully'),
      (err) => console.log('Error shutting down OpenTelemetry SDK', err)
    );
  });
}

/**
 * Get the tracer provider
 */
export function getTracerProvider() {
  return provider;
}