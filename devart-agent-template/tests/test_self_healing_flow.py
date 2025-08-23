import unittest
from unittest.mock import patch, MagicMock
import sys
import os

# Add the sdk directory to the path so we can import the AgentSDK
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'sdk'))

from agent_sdk import AgentSDK

class TestSelfHealingFlow(unittest.TestCase):
    
    def setUp(self):
        """Set up test fixtures before each test method."""
        self.agent_id = "test-agent-001"
        self.api_key = "test-api-key"
        self.api_base_url = "http://localhost:8000"
        self.agent_sdk = AgentSDK(self.agent_id, self.api_key, self.api_base_url)
    
    @patch('agent_sdk.AgentSDK.query_knowledge_base')
    @patch('agent_sdk.AgentSDK.apply_solution')
    @patch('agent_sdk.AgentSDK.report_error')
    def test_execute_task_with_self_healing_success(self, mock_report_error, mock_apply_solution, mock_query_knowledge_base):
        """Test successful self-healing flow."""
        # Mock the knowledge base to return a solution
        mock_query_knowledge_base.return_value = [
            {
                "id": "sol-001",
                "content": "Increase timeout value to 30 seconds and retry with exponential backoff",
                "source": "API_CONNECTION_TROUBLESHOOTING.md",
                "similarity": 0.92
            }
        ]
        
        # Mock successful solution application
        mock_apply_solution.return_value = True
        
        # Mock task execution callback that fails the first time and succeeds after healing
        call_count = 0
        def task_callback(task):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                # First call fails
                raise Exception("Connection timeout when accessing external API")
            else:
                # Second call succeeds
                return True
        
        # Create a task
        task = {
            "id": "task-001",
            "title": "Test Task",
            "description": "A test task for self-healing",
            "last_error": "Connection timeout when accessing external API"
        }
        
        # Execute the task with self-healing
        result = self.agent_sdk._execute_task_with_self_healing(task, task_callback)
        
        # Assertions
        self.assertTrue(result)
        mock_report_error.assert_called_once()
        mock_query_knowledge_base.assert_called_once_with("Connection timeout when accessing external API")
        mock_apply_solution.assert_called_once_with("task-001", mock_query_knowledge_base.return_value[0])
    
    @patch('agent_sdk.AgentSDK.query_knowledge_base')
    @patch('agent_sdk.AgentSDK.apply_solution')
    @patch('agent_sdk.AgentSDK.report_error')
    def test_execute_task_with_self_healing_no_solutions(self, mock_report_error, mock_apply_solution, mock_query_knowledge_base):
        """Test self-healing flow when no solutions are found."""
        # Mock the knowledge base to return no solutions
        mock_query_knowledge_base.return_value = []
        
        # Mock task execution callback that always fails
        def task_callback(task):
            raise Exception("Connection timeout when accessing external API")
        
        # Create a task
        task = {
            "id": "task-001",
            "title": "Test Task",
            "description": "A test task for self-healing",
            "last_error": "Connection timeout when accessing external API"
        }
        
        # Execute the task with self-healing
        result = self.agent_sdk._execute_task_with_self_healing(task, task_callback)
        
        # Assertions
        self.assertFalse(result)
        mock_report_error.assert_called_once()
        mock_query_knowledge_base.assert_called_once_with("Connection timeout when accessing external API")
        mock_apply_solution.assert_not_called()
    
    @patch('agent_sdk.AgentSDK.query_knowledge_base')
    @patch('agent_sdk.AgentSDK.apply_solution')
    @patch('agent_sdk.AgentSDK.report_error')
    def test_execute_task_with_self_healing_solution_application_fails(self, mock_report_error, mock_apply_solution, mock_query_knowledge_base):
        """Test self-healing flow when solution application fails."""
        # Mock the knowledge base to return a solution
        mock_query_knowledge_base.return_value = [
            {
                "id": "sol-001",
                "content": "Increase timeout value to 30 seconds and retry with exponential backoff",
                "source": "API_CONNECTION_TROUBLESHOOTING.md",
                "similarity": 0.92
            }
        ]
        
        # Mock failed solution application
        mock_apply_solution.return_value = False
        
        # Mock task execution callback that always fails
        def task_callback(task):
            raise Exception("Connection timeout when accessing external API")
        
        # Create a task
        task = {
            "id": "task-001",
            "title": "Test Task",
            "description": "A test task for self-healing",
            "last_error": "Connection timeout when accessing external API"
        }
        
        # Execute the task with self-healing
        result = self.agent_sdk._execute_task_with_self_healing(task, task_callback)
        
        # Assertions
        self.assertFalse(result)
        mock_report_error.assert_called_once()
        mock_query_knowledge_base.assert_called_once_with("Connection timeout when accessing external API")
        mock_apply_solution.assert_called_once_with("task-001", mock_query_knowledge_base.return_value[0])
    
    @patch('agent_sdk.AgentSDK.query_knowledge_base')
    @patch('agent_sdk.AgentSDK.apply_solution')
    @patch('agent_sdk.AgentSDK.report_error')
    def test_execute_task_with_self_healing_task_still_fails_after_healing(self, mock_report_error, mock_apply_solution, mock_query_knowledge_base):
        """Test self-healing flow when task still fails after applying solution."""
        # Mock the knowledge base to return a solution
        mock_query_knowledge_base.return_value = [
            {
                "id": "sol-001",
                "content": "Increase timeout value to 30 seconds and retry with exponential backoff",
                "source": "API_CONNECTION_TROUBLESHOOTING.md",
                "similarity": 0.92
            }
        ]
        
        # Mock successful solution application
        mock_apply_solution.return_value = True
        
        # Mock task execution callback that always fails
        def task_callback(task):
            raise Exception("Connection timeout when accessing external API")
        
        # Create a task
        task = {
            "id": "task-001",
            "title": "Test Task",
            "description": "A test task for self-healing",
            "last_error": "Connection timeout when accessing external API"
        }
        
        # Execute the task with self-healing
        result = self.agent_sdk._execute_task_with_self_healing(task, task_callback)
        
        # Assertions
        self.assertFalse(result)
        mock_report_error.assert_called_once()
        mock_query_knowledge_base.assert_called_once_with("Connection timeout when accessing external API")
        mock_apply_solution.assert_called_once_with("task-001", mock_query_knowledge_base.return_value[0])

if __name__ == '__main__':
    unittest.main()