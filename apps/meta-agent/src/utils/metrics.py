"""
Metrics collection for the Meta-Agent System.
"""

import time
import json
from typing import Dict, Any
from collections import defaultdict
from src.utils.logging_config import get_logger


class MetricsCollector:
    """Collects and reports system metrics."""

    def __init__(self):
        """Initialize the MetricsCollector."""
        self.logger = get_logger("metrics")
        self.metrics = defaultdict(list)
        self.counters = defaultdict(int)
        self.gauges = defaultdict(float)
        self.timers = {}

    def increment_counter(self, name: str, value: int = 1):
        """
        Increment a counter metric.
        
        Args:
            name: Name of the counter
            value: Value to increment by
        """
        self.counters[name] += value
        self.logger.debug(f"Counter {name} incremented by {value}, total: {self.counters[name]}")

    def set_gauge(self, name: str, value: float):
        """
        Set a gauge metric.
        
        Args:
            name: Name of the gauge
            value: Value to set
        """
        self.gauges[name] = value
        self.logger.debug(f"Gauge {name} set to {value}")

    def start_timer(self, name: str) -> str:
        """
        Start a timer for measuring duration.
        
        Args:
            name: Name of the timer
            
        Returns:
            Timer ID
        """
        timer_id = f"{name}_{int(time.time() * 1000000)}"
        self.timers[timer_id] = {
            "name": name,
            "start_time": time.time()
        }
        self.logger.debug(f"Timer {name} started with ID {timer_id}")
        return timer_id

    def stop_timer(self, timer_id: str) -> float:
        """
        Stop a timer and record the duration.
        
        Args:
            timer_id: Timer ID returned by start_timer
            
        Returns:
            Duration in seconds
        """
        if timer_id not in self.timers:
            self.logger.warning(f"Timer {timer_id} not found")
            return 0.0
            
        timer_data = self.timers.pop(timer_id)
        duration = time.time() - timer_data["start_time"]
        self.metrics[timer_data["name"]].append(duration)
        self.logger.debug(f"Timer {timer_data['name']} stopped, duration: {duration:.4f}s")
        return duration

    def record_histogram(self, name: str, value: float):
        """
        Record a value in a histogram.
        
        Args:
            name: Name of the histogram
            value: Value to record
        """
        self.metrics[name].append(value)
        self.logger.debug(f"Histogram {name} recorded value: {value}")

    def get_counter(self, name: str) -> int:
        """
        Get the current value of a counter.
        
        Args:
            name: Name of the counter
            
        Returns:
            Current value of the counter
        """
        return self.counters.get(name, 0)

    def get_gauge(self, name: str) -> float:
        """
        Get the current value of a gauge.
        
        Args:
            name: Name of the gauge
            
        Returns:
            Current value of the gauge
        """
        return self.gauges.get(name, 0.0)

    def get_metrics_summary(self) -> Dict[str, Any]:
        """
        Get a summary of all metrics.
        
        Returns:
            Dictionary containing metrics summary
        """
        summary = {
            "counters": dict(self.counters),
            "gauges": dict(self.gauges),
            "histograms": {}
        }
        
        # Calculate histogram statistics
        for name, values in self.metrics.items():
            if values:
                summary["histograms"][name] = {
                    "count": len(values),
                    "min": min(values),
                    "max": max(values),
                    "avg": sum(values) / len(values),
                    "p50": self._percentile(values, 50),
                    "p95": self._percentile(values, 95),
                    "p99": self._percentile(values, 99)
                }
        
        return summary

    def _percentile(self, values: list, percentile: float) -> float:
        """
        Calculate percentile of a list of values.
        
        Args:
            values: List of values
            percentile: Percentile to calculate (0-100)
            
        Returns:
            Percentile value
        """
        if not values:
            return 0.0
            
        sorted_values = sorted(values)
        index = int(len(sorted_values) * percentile / 100)
        index = min(index, len(sorted_values) - 1)
        return sorted_values[index]

    def reset_metrics(self):
        """Reset all metrics."""
        self.metrics.clear()
        self.counters.clear()
        self.gauges.clear()
        self.timers.clear()
        self.logger.info("All metrics reset")


# Global metrics collector instance
metrics_collector = MetricsCollector()


def get_metrics_collector() -> MetricsCollector:
    """
    Get the global metrics collector instance.
    
    Returns:
        MetricsCollector instance
    """
    return metrics_collector


# Context manager for timing operations
class Timer:
    """Context manager for timing operations."""

    def __init__(self, name: str, collector: MetricsCollector = None):
        """
        Initialize the Timer.
        
        Args:
            name: Name of the timer
            collector: MetricsCollector instance (uses global if None)
        """
        self.name = name
        self.collector = collector or get_metrics_collector()
        self.timer_id = None

    def __enter__(self):
        """Start the timer."""
        self.timer_id = self.collector.start_timer(self.name)
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Stop the timer."""
        if self.timer_id:
            duration = self.collector.stop_timer(self.timer_id)
            if exc_type is not None:
                self.collector.increment_counter(f"{self.name}_errors")
            return False


# Example usage
if __name__ == "__main__":
    collector = get_metrics_collector()
    
    # Example of using counters
    collector.increment_counter("requests_processed")
    collector.increment_counter("requests_processed", 5)
    
    # Example of using gauges
    collector.set_gauge("active_connections", 10.0)
    
    # Example of using timers
    timer_id = collector.start_timer("database_query")
    time.sleep(0.1)  # Simulate work
    duration = collector.stop_timer(timer_id)
    print(f"Database query took {duration:.4f} seconds")
    
    # Example of using histograms
    for i in range(100):
        collector.record_histogram("response_time", i * 0.01)
    
    # Example of using context manager
    with Timer("api_request"):
        time.sleep(0.05)  # Simulate API request
    
    # Print metrics summary
    summary = collector.get_metrics_summary()
    print(json.dumps(summary, indent=2))