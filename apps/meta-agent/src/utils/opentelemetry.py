"""
OpenTelemetry configuration for the Meta-Agent System
"""

from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.instrumentation.flask import FlaskInstrumentor
from opentelemetry.instrumentation.requests import RequestsInstrumentor
import os


def initialize_opentelemetry(app=None):
    """
    Initialize OpenTelemetry tracing for the Meta-Agent System.
    
    Args:
        app: Flask application instance (optional)
    """
    # Create a resource with service information
    resource = Resource.create({
        "service.name": "meta-agent",
        "service.version": "1.0.0",
        "service.instance.id": os.getenv("INSTANCE_ID", "meta-agent-001")
    })
    
    # Create a tracer provider
    tracer_provider = TracerProvider(resource=resource)
    
    # Configure OTLP exporter
    otlp_endpoint = os.getenv("OTLP_ENDPOINT", "http://localhost:4317")
    otlp_exporter = OTLPSpanExporter(endpoint=otlp_endpoint)
    
    # Add the exporter to the tracer provider
    span_processor = BatchSpanProcessor(otlp_exporter)
    tracer_provider.add_span_processor(span_processor)
    
    # Set the tracer provider
    trace.set_tracer_provider(tracer_provider)
    
    # Instrument Flask application if provided
    if app:
        FlaskInstrumentor().instrument_app(app)
    
    # Instrument requests library
    RequestsInstrumentor().instrument()
    
    print(f"OpenTelemetry initialized with endpoint: {otlp_endpoint}")
    return tracer_provider


def get_tracer():
    """
    Get a tracer instance for creating spans.
    
    Returns:
        Tracer instance
    """
    return trace.get_tracer("meta-agent")


# Example usage in the main application
if __name__ == "__main__":
    # Initialize OpenTelemetry
    tracer_provider = initialize_opentelemetry()
    
    # Get a tracer
    tracer = get_tracer()
    
    # Create a sample span
    with tracer.start_as_current_span("test-span"):
        print("This operation is being traced")