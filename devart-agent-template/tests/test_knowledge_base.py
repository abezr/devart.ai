import unittest
from unittest.mock import patch, MagicMock
import sys
import os

# Add the sdk directory to the path so we can import the AgentSDK
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'sdk'))

from agent_sdk import AgentSDK

class TestKnowledgeBaseQuerying(unittest.TestCase):
    
    def setUp(self):
        """Set up test fixtures before each test method."""
        self.agent_id = "test-agent-001"
        self.api_key = "test-api-key"
        self.api_base_url = "http://localhost:8000"
        self.agent_sdk = AgentSDK(self.agent_id, self.api_key, self.api_base_url)
    
    @patch('agent_sdk.requests.post')
    def test_query_knowledge_base_success(self, mock_post):
        """Test successful knowledge base query."""
        # Mock the response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = [
            {
                "id": "sol-001",
                "content": "Increase timeout value to 30 seconds and retry with exponential backoff",
                "source": "API_CONNECTION_TROUBLESHOOTING.md",
                "similarity": 0.92
            },
            {
                "id": "sol-002",
                "content": "Check network connectivity and firewall settings",
                "source": "NETWORK_TROUBLESHOOTING.md",
                "similarity": 0.78
            }
        ]
        mock_post.return_value = mock_response
        
        # Call the method
        error_message = "Connection timeout when accessing external API"
        results = self.agent_sdk.query_knowledge_base(error_message)
        
        # Assertions
        self.assertEqual(len(results), 2)
        self.assertEqual(results[0]["id"], "sol-001")
        self.assertEqual(results[0]["similarity"], 0.92)
        self.assertEqual(results[1]["id"], "sol-002")
        self.assertEqual(results[1]["similarity"], 0.78)
        
        # Verify the request was made correctly
        mock_post.assert_called_once()
        call_args = mock_post.call_args
        self.assertEqual(call_args[0][0], f"{self.api_base_url}/api/knowledge/search")
        self.assertEqual(call_args[1]['headers'], {"Authorization": f"Bearer {self.api_key}"})
        self.assertEqual(call_args[1]['json'], {
            "query": error_message,
            "threshold": 0.7,
            "limit": 10
        })
    
    @patch('agent_sdk.requests.post')
    def test_query_knowledge_base_with_custom_params(self, mock_post):
        """Test knowledge base query with custom threshold and limit."""
        # Mock the response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = [
            {
                "id": "sol-001",
                "content": "Increase timeout value to 30 seconds and retry with exponential backoff",
                "source": "API_CONNECTION_TROUBLESHOOTING.md",
                "similarity": 0.92
            }
        ]
        mock_post.return_value = mock_response
        
        # Call the method with custom parameters
        error_message = "Connection timeout when accessing external API"
        results = self.agent_sdk.query_knowledge_base(error_message, threshold=0.8, limit=5)
        
        # Assertions
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["id"], "sol-001")
        
        # Verify the request was made with custom parameters
        mock_post.assert_called_once()
        call_args = mock_post.call_args
        self.assertEqual(call_args[1]['json'], {
            "query": error_message,
            "threshold": 0.8,
            "limit": 5
        })
    
    @patch('agent_sdk.requests.post')
    def test_query_knowledge_base_request_exception(self, mock_post):
        """Test knowledge base query when request exception occurs."""
        # Mock the request exception
        mock_post.side_effect = Exception("Network error")
        
        # Call the method
        error_message = "Connection timeout when accessing external API"
        results = self.agent_sdk.query_knowledge_base(error_message)
        
        # Assertions
        self.assertEqual(results, [])
        mock_post.assert_called_once()
    
    @patch('agent_sdk.requests.post')
    def test_query_knowledge_base_http_error(self, mock_post):
        """Test knowledge base query when HTTP error occurs."""
        # Mock the HTTP error response
        mock_response = MagicMock()
        mock_response.raise_for_status.side_effect = Exception("HTTP Error")
        mock_post.return_value = mock_response
        
        # Call the method
        error_message = "Connection timeout when accessing external API"
        results = self.agent_sdk.query_knowledge_base(error_message)
        
        # Assertions
        self.assertEqual(results, [])
        mock_post.assert_called_once()

if __name__ == '__main__':
    unittest.main()