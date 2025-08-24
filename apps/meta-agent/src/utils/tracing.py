"""
Distributed tracing for the Meta-Agent System.
"""

import uuid
import time
from typing import Dict, Any, Optional
from dataclasses import dataclass, asdict
from src.utils.logging_config import get_logger
from src.utils.metrics import get_metrics_collector, Timer


@dataclass
class Span:
    """Represents a single unit of work in a trace."""
    trace_id: str
    span_id: str
    parent_span_id: Optional[str]
    name: str
    start_time: float
    end_time: Optional[float] = None
    tags: Dict[str, Any] = None
    logs: list = None

    def __post_init__(self):
        if self.tags is None:
            self.tags = {}
        if self.logs is None:
            self.logs = []

    def finish(self):
        """Mark the span as finished."""
        self.end_time = time.time()

    def set_tag(self, key: str, value: Any):
        """
        Set a tag on the span.
        
        Args:
            key: Tag key
            value: Tag value
        """
        self.tags[key] = value

    def log(self, message: str, timestamp: float = None):
        """
        Add a log entry to the span.
        
        Args:
            message: Log message
            timestamp: Timestamp of the log (defaults to current time)
        """
        if timestamp is None:
            timestamp = time.time()
        self.logs.append({
            "timestamp": timestamp,
            "message": message
        })

    def duration(self) -> float:
        """
        Get the duration of the span.
        
        Returns:
            Duration in seconds
        """
        if self.end_time is None:
            return 0.0
        return self.end_time - self.start_time

    def to_dict(self) -> Dict[str, Any]:
        """
        Convert the span to a dictionary.
        
        Returns:
            Dictionary representation of the span
        """
        return {
            "trace_id": self.trace_id,
            "span_id": self.span_id,
            "parent_span_id": self.parent_span_id,
            "name": self.name,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "duration": self.duration(),
            "tags": self.tags,
            "logs": self.logs
        }


class Tracer:
    """Manages distributed tracing for the Meta-Agent System."""

    def __init__(self, service_name: str = "meta-agent"):
        """
        Initialize the Tracer.
        
        Args:
            service_name: Name of the service being traced
        """
        self.service_name = service_name
        self.logger = get_logger("tracer")
        self.metrics_collector = get_metrics_collector()
        self.active_spans = {}

    def start_span(self, name: str, parent_span: Span = None, trace_id: str = None) -> Span:
        """
        Start a new span.
        
        Args:
            name: Name of the span
            parent_span: Parent span (if any)
            trace_id: Trace ID (if continuing an existing trace)
            
        Returns:
            New Span instance
        """
        if trace_id is None:
            trace_id = str(uuid.uuid4())
            
        parent_span_id = parent_span.span_id if parent_span else None
        
        span = Span(
            trace_id=trace_id,
            span_id=str(uuid.uuid4()),
            parent_span_id=parent_span_id,
            name=name,
            start_time=time.time()
        )
        
        # Store active span
        self.active_spans[span.span_id] = span
        
        # Log span start
        self.logger.debug(f"Started span: {name} (span_id: {span.span_id}, trace_id: {trace_id})")
        
        # Increment counter metric
        self.metrics_collector.increment_counter("spans_started")
        
        return span

    def finish_span(self, span: Span):
        """
        Finish a span and record its data.
        
        Args:
            span: Span to finish
        """
        span.finish()
        
        # Remove from active spans
        if span.span_id in self.active_spans:
            del self.active_spans[span.span_id]
        
        # Log span finish
        self.logger.debug(f"Finished span: {span.name} (duration: {span.duration():.4f}s)")
        
        # Record duration in metrics
        self.metrics_collector.record_histogram("span_durations", span.duration())
        
        # Increment counter metric
        self.metrics_collector.increment_counter("spans_finished")
        
        # Log any errors in the span
        if "error" in span.tags:
            self.metrics_collector.increment_counter("spans_with_errors")

    def get_trace(self, trace_id: str) -> list:
        """
        Get all spans for a given trace ID.
        
        Args:
            trace_id: Trace ID
            
        Returns:
            List of spans in the trace
        """
        spans = []
        for span in self.active_spans.values():
            if span.trace_id == trace_id:
                spans.append(span)
        return spans

    def export_trace(self, trace_id: str) -> Dict[str, Any]:
        """
        Export trace data for external systems.
        
        Args:
            trace_id: Trace ID
            
        Returns:
            Dictionary containing trace data
        """
        spans = self.get_trace(trace_id)
        return {
            "trace_id": trace_id,
            "service_name": self.service_name,
            "spans": [span.to_dict() for span in spans],
            "export_time": time.time()
        }


# Global tracer instance
tracer = Tracer()


def get_tracer() -> Tracer:
    """
    Get the global tracer instance.
    
    Returns:
        Tracer instance
    """
    return tracer


# Context manager for spans
class SpanContext:
    """Context manager for spans."""

    def __init__(self, name: str, tracer: Tracer = None, parent_span: Span = None):
        """
        Initialize the SpanContext.
        
        Args:
            name: Name of the span
            tracer: Tracer instance (uses global if None)
            parent_span: Parent span (if any)
        """
        self.name = name
        self.tracer = tracer or get_tracer()
        self.parent_span = parent_span
        self.span = None

    def __enter__(self) -> Span:
        """Start the span."""
        self.span = self.tracer.start_span(self.name, self.parent_span)
        return self.span

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Finish the span."""
        if self.span:
            if exc_type is not None:
                self.span.set_tag("error", True)
                self.span.set_tag("error_type", exc_type.__name__)
                self.span.log(f"Exception: {str(exc_val)}")
            self.tracer.finish_span(self.span)
        return False


# Decorator for tracing function calls
def trace(name: str = None):
    """
    Decorator for tracing function calls.
    
    Args:
        name: Name of the span (defaults to function name)
    """
    def decorator(func):
        nonlocal name
        if name is None:
            name = func.__name__
            
        def wrapper(*args, **kwargs):
            with SpanContext(name):
                return func(*args, **kwargs)
        return wrapper
    return decorator


# Example usage
if __name__ == "__main__":
    # Example of manual span management
    tracer = get_tracer()
    
    # Start a root span
    root_span = tracer.start_span("process_roadmap")
    root_span.set_tag("document_count", 5)
    
    # Simulate some work
    time.sleep(0.1)
    
    # Start a child span
    child_span = tracer.start_span("analyze_document", parent_span=root_span)
    child_span.set_tag("document_name", "Q3_2025_Roadmap.pdf")
    
    # Simulate more work
    time.sleep(0.05)
    child_span.log("Document analysis 50% complete")
    time.sleep(0.05)
    
    # Finish child span
    tracer.finish_span(child_span)
    
    # Finish root span
    root_span.set_tag("documents_processed", 1)
    tracer.finish_span(root_span)
    
    # Export trace data
    trace_data = tracer.export_trace(root_span.trace_id)
    print(f"Trace data: {trace_data}")
    
    # Example of using context manager
    with SpanContext("generate_tasks") as span:
        span.set_tag("task_count", 10)
        time.sleep(0.1)
        
    # Example of using decorator
    @trace("calculate_priority")
    def calculate_priority():
        time.sleep(0.05)
        return "HIGH"
    
    priority = calculate_priority()
    print(f"Calculated priority: {priority}")