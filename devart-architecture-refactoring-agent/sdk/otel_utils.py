import os
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource

def initialize_opentelemetry():
    """Initialize OpenTelemetry tracing for the agent."""
    # Create a resource with service name
    resource = Resource.create({
        "service.name": "devart-architecture-refactoring-agent",
        "service.version": "1.0.0"
    })
    
    # Create a tracer provider
    provider = TracerProvider(resource=resource)
    
    # Configure OTLP exporter if endpoint is provided
    otlp_endpoint = os.getenv('OTEL_EXPORTER_OTLP_ENDPOINT')
    if otlp_endpoint:
        exporter = OTLPSpanExporter(endpoint=otlp_endpoint)
        processor = BatchSpanProcessor(exporter)
        provider.add_span_processor(processor)
    
    # Set the tracer provider
    trace.set_tracer_provider(provider)
    
    return provider

def get_tracer():
    """Get a tracer instance for creating spans."""
    return trace.get_tracer("devart-architecture-refactoring-agent")