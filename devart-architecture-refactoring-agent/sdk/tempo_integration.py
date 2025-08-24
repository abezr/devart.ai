import os
import requests
from typing import Dict, Any, Optional, List
import json

class TempoIntegration:
    """Integrates with Grafana Tempo for retrieving performance trace data."""
    
    def __init__(self, tempo_url: str = None, tempo_username: str = None, tempo_password: str = None):
        self.tempo_url = tempo_url or os.getenv('TEMPO_URL', 'http://localhost:3200')
        self.tempo_username = tempo_username or os.getenv('TEMPO_USERNAME')
        self.tempo_password = tempo_password or os.getenv('TEMPO_PASSWORD')
        
        self.headers = {
            "Accept": "application/json",
            "Content-Type": "application/json"
        }
        
        # Set up authentication if provided
        if self.tempo_username and self.tempo_password:
            self.auth = (self.tempo_username, self.tempo_password)
        else:
            self.auth = None
            
    def search_traces(self, service_name: str = None, operation: str = None, 
                     start_time: int = None, end_time: int = None, 
                     limit: int = 20) -> Optional[List[Dict]]:
        """
        Search for traces in Tempo.
        
        Args:
            service_name: Name of the service to filter by
            operation: Operation name to filter by
            start_time: Start time in Unix nanoseconds
            end_time: End time in Unix nanoseconds
            limit: Maximum number of traces to return
            
        Returns:
            List of traces or None if failed
        """
        url = f"{self.tempo_url}/api/search"
        
        # Build query parameters
        params = {}
        if service_name:
            params["service-name"] = service_name
        if operation:
            params["operation"] = operation
        if start_time:
            params["start"] = start_time
        if end_time:
            params["end"] = end_time
        if limit:
            params["limit"] = limit
            
        try:
            response = requests.get(url, headers=self.headers, params=params, auth=self.auth)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            print(f"Error searching traces: {e}")
            return None
            
    def get_trace_by_id(self, trace_id: str) -> Optional[Dict]:
        """
        Get a specific trace by its ID.
        
        Args:
            trace_id: The ID of the trace to retrieve
            
        Returns:
            Trace data or None if failed
        """
        url = f"{self.tempo_url}/api/traces/{trace_id}"
        
        try:
            response = requests.get(url, headers=self.headers, auth=self.auth)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            print(f"Error fetching trace: {e}")
            return None
            
    def query_trace_data(self, query: str, start_time: int = None, end_time: int = None) -> Optional[List[Dict]]:
        """
        Query trace data using Tempo's query API.
        
        Args:
            query: The query string
            start_time: Start time in Unix nanoseconds
            end_time: End time in Unix nanoseconds
            
        Returns:
            Query results or None if failed
        """
        url = f"{self.tempo_url}/api/search"
        
        # Build query parameters
        params = {"q": query}
        if start_time:
            params["start"] = start_time
        if end_time:
            params["end"] = end_time
            
        try:
            response = requests.get(url, headers=self.headers, params=params, auth=self.auth)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            print(f"Error querying trace data: {e}")
            return None
            
    def get_service_graph(self, service_name: str, start_time: int = None, end_time: int = None) -> Optional[Dict]:
        """
        Get service graph data for a specific service.
        
        Args:
            service_name: Name of the service
            start_time: Start time in Unix nanoseconds
            end_time: End time in Unix nanoseconds
            
        Returns:
            Service graph data or None if failed
        """
        url = f"{self.tempo_url}/api/servicegraph"
        
        # Build query parameters
        params = {"service": service_name}
        if start_time:
            params["start"] = start_time
        if end_time:
            params["end"] = end_time
            
        try:
            response = requests.get(url, headers=self.headers, params=params, auth=self.auth)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            print(f"Error fetching service graph: {e}")
            return None
            
    def identify_performance_bottlenecks(self, service_name: str, duration_threshold: int = 1000000) -> Optional[List[Dict]]:
        """
        Identify performance bottlenecks by analyzing trace durations.
        
        Args:
            service_name: Name of the service to analyze
            duration_threshold: Duration threshold in microseconds for identifying slow operations
            
        Returns:
            List of bottlenecks or None if failed
        """
        # Search for traces with the specified service
        traces = self.search_traces(service_name=service_name, limit=100)
        
        if not traces:
            return None
            
        bottlenecks = []
        
        # Analyze each trace for performance issues
        for trace in traces.get("traces", []):
            trace_id = trace.get("traceID")
            if trace_id:
                # Get detailed trace information
                trace_data = self.get_trace_by_id(trace_id)
                if trace_data:
                    # Analyze spans for slow operations
                    spans = trace_data.get("spans", [])
                    for span in spans:
                        duration = span.get("duration", 0)
                        if duration > duration_threshold:
                            bottlenecks.append({
                                "trace_id": trace_id,
                                "span_id": span.get("spanID"),
                                "operation": span.get("operationName"),
                                "duration": duration,
                                "service": span.get("process", {}).get("serviceName"),
                                "start_time": span.get("startTime")
                            })
                            
        return bottlenecks
        
    def correlate_traces_with_code(self, traces: List[Dict], code_components: List[str]) -> Dict:
        """
        Correlate trace data with code components to identify performance issues.
        
        Args:
            traces: List of trace data
            code_components: List of code components to correlate with
            
        Returns:
            Correlation results
        """
        correlation_results = {}
        
        for trace in traces:
            trace_id = trace.get("traceID")
            if trace_id:
                trace_data = self.get_trace_by_id(trace_id)
                if trace_data:
                    # Look for spans that match our code components
                    spans = trace_data.get("spans", [])
                    for span in spans:
                        operation = span.get("operationName", "")
                        service = span.get("process", {}).get("serviceName", "")
                        
                        # Check if this span relates to any of our code components
                        for component in code_components:
                            if component.lower() in operation.lower() or component.lower() in service.lower():
                                if component not in correlation_results:
                                    correlation_results[component] = []
                                correlation_results[component].append({
                                    "trace_id": trace_id,
                                    "span_id": span.get("spanID"),
                                    "operation": operation,
                                    "service": service,
                                    "duration": span.get("duration", 0),
                                    "start_time": span.get("startTime")
                                })
                                
        return correlation_results