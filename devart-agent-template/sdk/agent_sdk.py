import os
import requests
import time
import pika
import json
import threading
from typing import Callable, Dict, Any, List
from functools import wraps
from otel_utils import get_tracer
from opentelemetry.instrumentation.pika import PikaInstrumentor

class AgentSDK:
    def __init__(self, agent_id: str, api_key: str, api_base_url: str):
        if not all([agent_id, api_key, api_base_url]):
            raise ValueError("agent_id, api_key, and api_base_url are required.")
        self.agent_id = agent_id
        self.api_base_url = api_base_url
        self.headers = {"Authorization": f"Bearer {api_key}"}
        self.rabbitmq_connection = None
        self.rabbitmq_channel = None
        self.consumer_thread = None
        self.running = False
        self.solution_attempts = {}  # Track solution application attempts
        
        # Initialize OpenTelemetry instrumentation for RabbitMQ
        self.pika_instrumentor = PikaInstrumentor()
        self.pika_instrumentor.instrument()

    def _connect_to_rabbitmq(self):
        """Establish a connection to RabbitMQ."""
        if not self.rabbitmq_connection:
            # Get RabbitMQ connection parameters from environment variables
            rabbitmq_url = os.getenv('RABBITMQ_URL', 'amqp://localhost')
            self.rabbitmq_connection = pika.BlockingConnection(pika.URLParameters(rabbitmq_url))
            self.rabbitmq_channel = self.rabbitmq_connection.channel()
            
            # Declare the queue to ensure it exists
            queue_name = os.getenv('RABBITMQ_TASKS_QUEUE', 'tasks.todo')
            self.rabbitmq_channel.queue_declare(queue=queue_name, durable=True)

    def start_consuming(self, callback: Callable[[Dict[str, Any]], bool]):
        """
        Start consuming tasks from the RabbitMQ queue.
        
        Args:
            callback: A function that takes a task dictionary as an argument and returns a boolean indicating success
        """
        self._connect_to_rabbitmq()
        
        def consume():
            self.running = True
            
            def on_message(channel, method, properties, body):
                # Create a span for message processing
                tracer = get_tracer()
                with tracer.start_as_current_span("process_rabbitmq_message", attributes={
                    "messaging.system": "rabbitmq",
                    "messaging.destination": method.routing_key,
                    "messaging.operation": "receive",
                }) as span:
                    if not self.running:
                        return
                        
                    try:
                        # Parse the task ID or task data from the message
                        message_data = body.decode('utf-8')
                        
                        # Add message attributes to the span
                        span.set_attribute("messaging.message_payload_size", len(message_data))
                        
                        # Check if it's a JSON message with delay information
                        try:
                            message_obj = json.loads(message_data)
                            task_id = message_obj.get('taskId')
                            delay_until = message_obj.get('delayUntil')
                            
                            # Add task attributes to the span
                            if task_id:
                                span.set_attribute("task.id", task_id)
                            
                            # If there's a delay, check if it's time to process
                            if delay_until and delay_until > time.time() * 1000:
                                # Requeue the message with the remaining delay
                                remaining_delay = int(delay_until - time.time() * 1000)
                                if remaining_delay > 0:
                                    # Republish with delay (this would work with RabbitMQ delayed message exchange)
                                    channel.basic_publish(
                                        exchange='',
                                        routing_key=method.routing_key,
                                        body=body,
                                        properties=pika.BasicProperties(
                                            headers={'x-delay': remaining_delay},
                                            delivery_mode=2  # Make message persistent
                                        )
                                    )
                                    channel.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
                                    return
                        except json.JSONDecodeError:
                            # If it's not JSON, treat it as a simple task ID
                            task_id = message_data
                            span.set_attribute("task.id", task_id)
                        
                        # Get the full task details from the API
                        task = self.get_task_details(task_id)
                        if task:
                            # Try to execute the task with self-healing
                            success = self._execute_task_with_self_healing(task, callback)
                            
                            if success:
                                # Acknowledge the message if processing was successful
                                channel.basic_ack(delivery_tag=method.delivery_tag)
                            else:
                                # Reject and requeue the message if processing failed
                                channel.basic_nack(delivery_tag=method.delivery_tag, requeue=True)
                        else:
                            # If we couldn't get task details, reject and requeue
                            print(f"Could not get details for task {task_id}")
                            channel.basic_nack(delivery_tag=method.delivery_tag, requeue=True)
                    except Exception as e:
                        print(f"Error processing message: {e}")
                        # Record the exception in the span
                        span.record_exception(e)
                        span.set_status(trace.Status(trace.StatusCode.ERROR, str(e)))
                        # Reject and requeue the message
                        channel.basic_nack(delivery_tag=method.delivery_tag, requeue=True)
            
            queue_name = os.getenv('RABBITMQ_TASKS_QUEUE', 'tasks.todo')
            self.rabbitmq_channel.basic_qos(prefetch_count=1)  # Process one message at a time
            self.rabbitmq_channel.basic_consume(queue=queue_name, on_message_callback=on_message)
            
            try:
                self.rabbitmq_channel.start_consuming()
            except Exception as e:
                if self.running:  # Only log if we weren't intentionally stopping
                    print(f"Error in consumer: {e}")
            finally:
                if self.rabbitmq_connection and self.rabbitmq_connection.is_open:
                    self.rabbitmq_connection.close()

        # Start consuming in a separate thread
        self.consumer_thread = threading.Thread(target=consume, daemon=True)
        self.consumer_thread.start()

    def stop_consuming(self):
        """Stop consuming tasks from the RabbitMQ queue."""
        print("Stopping consumer...")
        self.running = False
        if self.rabbitmq_channel and self.rabbitmq_channel.is_open:
            try:
                self.rabbitmq_channel.stop_consuming()
            except Exception as e:
                print(f"Error stopping consumer: {e}")
        if self.rabbitmq_connection and self.rabbitmq_connection.is_open:
            try:
                self.rabbitmq_connection.close()
            except Exception as e:
                print(f"Error closing connection: {e}")
        if self.consumer_thread:
            self.consumer_thread.join(timeout=5)  # Wait up to 5 seconds for thread to finish

    def get_task_details(self, task_id: str):
        """Get the full details of a task by ID."""
        url = f"{self.api_base_url}/api/tasks/{task_id}"
        try:
            response = requests.get(url, headers=self.headers)
            if response.status_code == 200:
                return response.json()
            else:
                print(f"Error fetching task details: {response.status_code} - {response.text}")
                return None
        except requests.RequestException as e:
            print(f"Error fetching task details: {e}")
            return None

    # DEPRECATED: This method is deprecated in favor of the RabbitMQ-based task distribution system
    # def claim_task(self):
    #     """Claims the next available task from the queue."""
    #     url = f"{self.api_base_url}/api/agents/{self.agent_id}/claim-task"
    #     try:
    #         response = requests.post(url, headers=self.headers)
    #         if response.status_code == 200:
    #             return response.json()
    #         if response.status_code == 404:
    #             return None # No tasks available
    #         response.raise_for_status()
    #     except requests.RequestException as e:
    #         print(f"Error claiming task: {e}")
    #         return None

    def update_task_status(self, task_id: str, status: str):
        """Updates the status of the current task."""
        url = f"{self.api_base_url}/api/tasks/{task_id}/status"
        payload = {"agentId": self.agent_id, "newStatus": status}
        try:
            response = requests.put(url, headers=self.headers, json=payload)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            print(f"Error updating task status: {e}")
            return None
    
    def report_error(self, task_id: str, error_message: str):
        """Report an error to the API and update task status."""
        url = f"{self.api_base_url}/api/tasks/{task_id}/error"
        payload = {"agentId": self.agent_id, "errorMessage": error_message}
        try:
            response = requests.put(url, headers=self.headers, json=payload)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            print(f"Error reporting task error: {e}")
            return None
    
    def query_knowledge_base(self, error_message: str, threshold: float = 0.7, limit: int = 10) -> List[Dict]:
        """Query the knowledge base for solutions to the error."""
        url = f"{self.api_base_url}/api/knowledge/search"
        payload = {
            "query": error_message,
            "threshold": threshold,
            "limit": limit
        }
        try:
            response = requests.post(url, headers=self.headers, json=payload)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            print(f"Error querying knowledge base: {e}")
            return []
    
    def apply_solution(self, task_id: str, solution: Dict) -> bool:
        """Apply a solution to a task before retrying."""
        # Log the solution application attempt
        if task_id not in self.solution_attempts:
            self.solution_attempts[task_id] = []
        
        attempt = {
            'solution_id': solution.get('id'),
            'timestamp': time.time(),
            'content': solution.get('content')
        }
        self.solution_attempts[task_id].append(attempt)
        
        # This is a placeholder implementation. In a real implementation,
        # this would apply the solution to the task.
        print(f"Applying solution for task {task_id}: {solution.get('content', 'No content')}")
        print(f"Solution source: {solution.get('source', 'Unknown')}")
        
        # Report solution application to the API
        self._report_solution_application(task_id, solution.get('id'), True)
        
        # For now, we'll just return True to indicate success
        return True
    
    def _report_solution_application(self, task_id: str, solution_id: str, success: bool):
        """Report solution application outcome to the API."""
        url = f"{self.api_base_url}/api/tasks/{task_id}/solution-applied"
        payload = {
            "agentId": self.agent_id,
            "solutionId": solution_id,
            "success": success
        }
        try:
            response = requests.post(url, headers=self.headers, json=payload)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            print(f"Error reporting solution application: {e}")
            return None
    
    def _execute_task_with_self_healing(self, task: Dict[str, Any], callback: Callable[[Dict[str, Any]], bool]) -> bool:
        """
        Execute a task with self-healing capabilities.
        
        Args:
            task: The task dictionary
            callback: The task execution callback function
            
        Returns:
            bool: True if task was successful, False otherwise
        """
        task_id = task.get('id')
        print(f"Executing task {task_id} with self-healing capabilities")
        
        try:
            # Try to execute the task
            success = callback(task)
            
            if success:
                print(f"Task {task_id} completed successfully")
                return True
            else:
                # Task failed, try to heal
                return self._attempt_self_healing(task, callback)
        except Exception as e:
            error_message = str(e)
            print(f"Task {task_id} failed with error: {error_message}")
            
            # Report the error
            self.report_error(task_id, error_message)
            
            # Try to heal
            return self._attempt_self_healing(task, callback)
    
    def _attempt_self_healing(self, task: Dict[str, Any], callback: Callable[[Dict[str, Any]], bool]) -> bool:
        """
        Attempt to heal a failed task by querying the knowledge base for solutions.
        
        Args:
            task: The task dictionary
            callback: The task execution callback function
            
        Returns:
            bool: True if task was successfully healed, False otherwise
        """
        task_id = task.get('id')
        last_error = task.get('last_error', 'Unknown error')
        
        print(f"Attempting self-healing for task {task_id} with error: {last_error}")
        
        # Query the knowledge base for solutions
        solutions = self.query_knowledge_base(last_error)
        
        if solutions:
            print(f"Found {len(solutions)} potential solutions for task {task_id}")
            
            # Try the most relevant solution first
            best_solution = solutions[0]
            print(f"Applying best solution: {best_solution.get('content', 'No content')}")
            
            # Apply the solution
            if self.apply_solution(task_id, best_solution):
                # Try to execute the task again
                try:
                    success = callback(task)
                    if success:
                        print(f"Task {task_id} healed successfully with solution")
                        return True
                    else:
                        print(f"Task {task_id} still failed after applying solution")
                        return False
                except Exception as e:
                    print(f"Task {task_id} still failed after applying solution: {e}")
                    return False
            else:
                print(f"Failed to apply solution for task {task_id}")
                return False
        else:
            print(f"No solutions found for task {task_id}")
            return False

    # =====================================================
    # Generative Remediation Methods
    # =====================================================

    def request_generative_remediation(self, anomaly_id: str, root_cause_analysis: Dict) -> Dict:
        """
        Request generative remediation from the API.
        
        Args:
            anomaly_id: The ID of the anomaly
            root_cause_analysis: The RCA findings
            
        Returns:
            Dict: The generated remediation script
        """
        url = f"{self.api_base_url}/api/generative-remediation/generate"
        payload = {
            "anomaly_id": anomaly_id,
            "root_cause_analysis": root_cause_analysis
        }
        
        try:
            response = requests.post(url, headers=self.headers, json=payload)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            print(f"Error requesting generative remediation: {e}")
            return {}

    def validate_script(self, script_id: str) -> Dict:
        """
        Validate a generated script.
        
        Args:
            script_id: The ID of the script to validate
            
        Returns:
            Dict: Validation result
        """
        url = f"{self.api_base_url}/api/generative-remediation/scripts/{script_id}/validate"
        
        try:
            response = requests.post(url, headers=self.headers)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            print(f"Error validating script: {e}")
            return {}

    def execute_script(self, script_id: str) -> Dict:
        """
        Execute a validated script.
        
        Args:
            script_id: The ID of the script to execute
            
        Returns:
            Dict: Execution result
        """
        url = f"{self.api_base_url}/api/generative-remediation/scripts/{script_id}/execute"
        
        try:
            response = requests.post(url, headers=self.headers)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            print(f"Error executing script: {e}")
            return {}

    def get_approved_scripts(self) -> List[Dict]:
        """
        Get approved scripts for execution.
        
        Returns:
            List[Dict]: List of approved scripts
        """
        url = f"{self.api_base_url}/api/generative-remediation/scripts"
        params = {"approval_status": "APPROVED"}
        
        try:
            response = requests.get(url, headers=self.headers, params=params)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            print(f"Error fetching approved scripts: {e}")
            return []

    # Add other methods like `log_usage`, `create_successor`, etc.