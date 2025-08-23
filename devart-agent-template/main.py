import os
import time
from sdk.agent_sdk import AgentSDK

def main():
    # Load configuration from environment variables
    AGENT_ID = os.getenv("DEVART_AGENT_ID")
    API_KEY = os.getenv("DEVART_API_KEY")
    API_BASE_URL = os.getenv("DEVART_API_BASE_URL", "https://your-api.workers.dev")
    
    sdk = AgentSDK(agent_id=AGENT_ID, api_key=API_KEY, api_base_url=API_BASE_URL)
    print(f"Agent {AGENT_ID} starting...")

    while True:
        print("Searching for a new task...")
        task = sdk.claim_task()

        if task:
            print(f"Claimed task: {task['id']} - {task['title']}")
            
            # --- AGENT'S CORE LOGIC GOES HERE ---
            print("Processing task...")
            time.sleep(10) # Simulate work
            print("Processing complete.")
            # --- END OF CORE LOGIC ---

            # Mark the task as done
            sdk.update_task_status(task['id'], "DONE")
            print(f"Task {task['id']} completed.")
        else:
            # No tasks available, wait before polling again
            print("No tasks available. Sleeping for 30 seconds.")
            time.sleep(30)

if __name__ == "__main__":
    main()