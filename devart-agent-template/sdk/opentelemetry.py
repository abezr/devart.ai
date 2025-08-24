import os
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.semconv.resource import ResourceAttributes
from opentelemetry.sdk.trace.sampling import ALWAYS_ON, ALWAYS_OFF, TraceIdRatioBased

# Initialize OpenTelemetry
def initialize_opentelemetry():
    """
    Initialize OpenTelemetry SDK for the Python agent
    """
    # Create a resource with service information
    service_name = os.getenv("OTEL_SERVICE_NAME", "devart-agent")
    resource = Resource(attributes={
        ResourceAttributes.SERVICE_NAME: service_name,
        ResourceAttributes.SERVICE_VERSION: "1.0.0",
    })

    # Configure sampling strategy
    sampling_strategy = os.getenv("OTEL_SAMPLING_STRATEGY", "always_on")
    
    if sampling_strategy == "always_off":
        sampler = ALWAYS_OFF
    elif sampling_strategy == "trace_id_ratio":
        ratio = float(os.getenv("OTEL_SAMPLING_RATIO", "0.1"))
        sampler = TraceIdRatioBased(ratio)
    else:  # "always_on" or default
        sampler = ALWAYS_ON

    # Create a tracer provider
    provider = TracerProvider(resource=resource, sampler=sampler)
    
    # Create an OTLP exporter
    otlp_endpoint = os.getenv("OTLP_EXPORTER_ENDPOINT", "http://localhost:4318/v1/traces")
    exporter = OTLPSpanExporter(endpoint=otlp_endpoint)
    
    # Create a batch span processor
    span_processor = BatchSpanProcessor(
        exporter,
        max_queue_size=100,
        max_export_batch_size=10,
        schedule_delay_millis=5000,
        export_timeout_millis=30000
    )
    
    # Add the span processor to the provider
    provider.add_span_processor(span_processor)
    
    # Set the tracer provider
    trace.set_tracer_provider(provider)
    
    return provider

# Get tracer for instrumentation
def get_tracer():
    """
    Get a tracer for creating spans
    """
    return trace.get_tracer(__name__)