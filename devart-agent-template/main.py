import os
import time
import signal
import sys
from sdk.agent_sdk import AgentSDK

# Global flag for graceful shutdown
shutdown_requested = False

def signal_handler(signum, frame):
    global shutdown_requested
    print("Shutdown signal received...")
    shutdown_requested = True

def process_task(task):
    """Process a task received from the queue."""
    global shutdown_requested
    
    if shutdown_requested:
        return False
        
    print(f"Processing task: {task['id']} - {task['title']}")
    
    # --- AGENT'S CORE LOGIC GOES HERE ---
    print("Processing task...")
    time.sleep(10)  # Simulate work
    print("Processing complete.")
    # --- END OF CORE LOGIC ---

    # Mark the task as done
    sdk.update_task_status(task['id'], "DONE")
    print(f"Task {task['id']} completed.")
    
    return True

def main():
    global shutdown_requested
    
    # Load configuration from environment variables
    AGENT_ID = os.getenv("DEVART_AGENT_ID")
    API_KEY = os.getenv("DEVART_API_KEY")
    API_BASE_URL = os.getenv("DEVART_API_BASE_URL", "https://your-api.workers.dev")
    
    # Set up signal handlers for graceful shutdown
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    sdk = AgentSDK(agent_id=AGENT_ID, api_key=API_KEY, api_base_url=API_BASE_URL)
    print(f"Agent {AGENT_ID} starting...")
    
    try:
        # Start consuming tasks from RabbitMQ
        print("Starting to consume tasks from RabbitMQ...")
        sdk.start_consuming(process_task)
        
        # Keep the main thread alive
        while not shutdown_requested:
            time.sleep(1)
            
    except KeyboardInterrupt:
        print("Keyboard interrupt received.")
    except Exception as e:
        print(f"Error in main loop: {e}")
    finally:
        print("Shutting down agent...")
        sdk.stop_consuming()
        print("Agent shutdown complete.")

if __name__ == "__main__":
    main()