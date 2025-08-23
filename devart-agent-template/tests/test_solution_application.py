import unittest
from unittest.mock import patch, MagicMock
import sys
import os
import time

# Add the sdk directory to the path so we can import the AgentSDK
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'sdk'))

from agent_sdk import AgentSDK

class TestSolutionApplication(unittest.TestCase):
    
    def setUp(self):
        """Set up test fixtures before each test method."""
        self.agent_id = "test-agent-001"
        self.api_key = "test-api-key"
        self.api_base_url = "http://localhost:8000"
        self.agent_sdk = AgentSDK(self.agent_id, self.api_key, self.api_base_url)
    
    def test_apply_solution_success(self):
        """Test successful solution application."""
        # Create a mock solution
        solution = {
            "id": "sol-001",
            "content": "Increase timeout value to 30 seconds and retry with exponential backoff",
            "source": "API_CONNECTION_TROUBLESHOOTING.md",
            "similarity": 0.92
        }
        
        # Call the method
        task_id = "task-001"
        result = self.agent_sdk.apply_solution(task_id, solution)
        
        # Assertions
        self.assertTrue(result)
        
        # Check that the attempt was logged
        self.assertIn(task_id, self.agent_sdk.solution_attempts)
        self.assertEqual(len(self.agent_sdk.solution_attempts[task_id]), 1)
        attempt = self.agent_sdk.solution_attempts[task_id][0]
        self.assertEqual(attempt['solution_id'], "sol-001")
        self.assertEqual(attempt['content'], solution['content'])
        self.assertIn('timestamp', attempt)
    
    def test_apply_solution_multiple_attempts(self):
        """Test applying multiple solutions to the same task."""
        # Create mock solutions
        solution1 = {
            "id": "sol-001",
            "content": "Increase timeout value to 30 seconds and retry with exponential backoff",
            "source": "API_CONNECTION_TROUBLESHOOTING.md",
            "similarity": 0.92
        }
        
        solution2 = {
            "id": "sol-002",
            "content": "Check network connectivity and firewall settings",
            "source": "NETWORK_TROUBLESHOOTING.md",
            "similarity": 0.78
        }
        
        # Apply both solutions
        task_id = "task-001"
        self.agent_sdk.apply_solution(task_id, solution1)
        self.agent_sdk.apply_solution(task_id, solution2)
        
        # Assertions
        self.assertIn(task_id, self.agent_sdk.solution_attempts)
        self.assertEqual(len(self.agent_sdk.solution_attempts[task_id]), 2)
        self.assertEqual(self.agent_sdk.solution_attempts[task_id][0]['solution_id'], "sol-001")
        self.assertEqual(self.agent_sdk.solution_attempts[task_id][1]['solution_id'], "sol-002")
    
    @patch('agent_sdk.requests.post')
    def test_report_solution_application_success(self, mock_post):
        """Test successful reporting of solution application."""
        # Mock the response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"message": "Solution application reported successfully"}
        mock_post.return_value = mock_response
        
        # Call the method
        task_id = "task-001"
        solution_id = "sol-001"
        self.agent_sdk._report_solution_application(task_id, solution_id, True)
        
        # Verify the request was made correctly
        mock_post.assert_called_once()
        call_args = mock_post.call_args
        self.assertEqual(call_args[0][0], f"{self.api_base_url}/api/tasks/{task_id}/solution-applied")
        self.assertEqual(call_args[1]['headers'], {"Authorization": f"Bearer {self.api_key}"})
        self.assertEqual(call_args[1]['json'], {
            "agentId": self.agent_id,
            "solutionId": solution_id,
            "success": True
        })
    
    @patch('agent_sdk.requests.post')
    def test_report_solution_application_request_exception(self, mock_post):
        """Test solution application reporting when request exception occurs."""
        # Mock the request exception
        mock_post.side_effect = Exception("Network error")
        
        # Call the method
        task_id = "task-001"
        solution_id = "sol-001"
        result = self.agent_sdk._report_solution_application(task_id, solution_id, True)
        
        # Assertions
        self.assertIsNone(result)
        mock_post.assert_called_once()

if __name__ == '__main__':
    unittest.main()