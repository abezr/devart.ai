import os
import requests
import time

class AgentSDK:
    def __init__(self, agent_id: str, api_key: str, api_base_url: str):
        if not all([agent_id, api_key, api_base_url]):
            raise ValueError("agent_id, api_key, and api_base_url are required.")
        self.agent_id = agent_id
        self.api_base_url = api_base_url
        self.headers = {"Authorization": f"Bearer {api_key}"}

    def claim_task(self):
        """Claims the next available task from the queue."""
        url = f"{self.api_base_url}/api/agents/{self.agent_id}/claim-task"
        try:
            response = requests.post(url, headers=self.headers)
            if response.status_code == 200:
                return response.json()
            if response.status_code == 404:
                return None # No tasks available
            response.raise_for_status()
        except requests.RequestException as e:
            print(f"Error claiming task: {e}")
            return None

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