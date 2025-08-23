import os
import requests
import time
import pika
import json
import threading
from typing import Callable, Dict, Any

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
                if not self.running:
                    return
                    
                try:
                    # Parse the task ID or task data from the message
                    message_data = body.decode('utf-8')
                    
                    # Check if it's a JSON message with delay information
                    try:
                        message_obj = json.loads(message_data)
                        task_id = message_obj.get('taskId')
                        delay_until = message_obj.get('delayUntil')
                        
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
                    
                    # Get the full task details from the API
                    task = self.get_task_details(task_id)
                    if task:
                        # Call the user's callback function with the task
                        success = callback(task)
                        
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
    
    # Add other methods like `log_usage`, `create_successor`, etc.