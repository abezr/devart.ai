#!/usr/bin/env python3
"""
Test script for the agent template with RabbitMQ consumer pattern.
This script tests the new RabbitMQ-based consumer implementation.
"""

import os
import sys
import time
import threading
from devart-agent-template.sdk.agent_sdk import AgentSDK

def test_process_task(task):
    """Test task processing function."""
    print(f"Processing task: {task['id']} - {task['title']}")
    # Simulate work
    time.sleep(2)
    print(f"Task {task['id']} processed successfully")
    return True

def test_agent_consumer():
    """Test the agent consumer functionality."""
    print("Testing agent with RabbitMQ consumer pattern...")
    
    # Set up test environment variables
    os.environ["DEVART_AGENT_ID"] = "test-agent-001"
    os.environ["DEVART_API_KEY"] = "test-api-key"
    os.environ["DEVART_API_BASE_URL"] = "http://localhost:8787"
    os.environ["RABBITMQ_URL"] = "amqp://localhost"
    os.environ["RABBITMQ_TASKS_QUEUE"] = "tasks.todo"
    
    # Create agent SDK instance
    sdk = AgentSDK(
        agent_id=os.getenv("DEVART_AGENT_ID"),
        api_key=os.getenv("DEVART_API_KEY"),
        api_base_url=os.getenv("DEVART_API_BASE_URL")
    )
    
    try:
        # Start consuming tasks
        print("Starting consumer...")
        sdk.start_consuming(test_process_task)
        
        # Run for 30 seconds
        time.sleep(30)
        
    except KeyboardInterrupt:
        print("Test interrupted by user")
    except Exception as e:
        print(f"Error during test: {e}")
    finally:
        print("Stopping consumer...")
        sdk.stop_consuming()
        print("Test completed")

if __name__ == "__main__":
    test_agent_consumer()