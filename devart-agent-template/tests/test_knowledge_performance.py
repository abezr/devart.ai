import unittest
import time
from unittest.mock import patch, MagicMock
import sys
import os

# Add the sdk directory to the path so we can import the AgentSDK
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'sdk'))

from agent_sdk import AgentSDK

class TestKnowledgeBasePerformance(unittest.TestCase):
    
    def setUp(self):
        """Set up test fixtures before each test method."""
        self.agent_id = "test-agent-001"
        self.api_key = "test-api-key"
        self.api_base_url = "http://localhost:8000"
        self.agent_sdk = AgentSDK(self.agent_id, self.api_key, self.api_base_url)
    
    @patch('agent_sdk.requests.post')
    def test_query_knowledge_base_response_time(self, mock_post):
        """Test that knowledge base queries respond within acceptable time."""
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
        
        # Measure response time
        start_time = time.time()
        
        error_message = "Connection timeout when accessing external API"
        results = self.agent_sdk.query_knowledge_base(error_message)
        
        end_time = time.time()
        response_time = end_time - start_time
        
        # Assertions
        self.assertEqual(len(results), 1)
        # Check that response time is under 1 second (acceptable for this test)
        self.assertLess(response_time, 1.0)
        
        # Verify the request was made correctly
        mock_post.assert_called_once()
    
    @patch('agent_sdk.requests.post')
    def test_multiple_concurrent_queries(self, mock_post):
        """Test handling of multiple concurrent knowledge base queries."""
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
        
        # Simulate multiple concurrent queries
        queries = []
        start_time = time.time()
        
        for i in range(10):
            error_message = f"Connection timeout when accessing external API - {i}"
            results = self.agent_sdk.query_knowledge_base(error_message)
            queries.append(results)
        
        end_time = time.time()
        total_time = end_time - start_time
        
        # Assertions
        self.assertEqual(len(queries), 10)
        for results in queries:
            self.assertEqual(len(results), 1)
        
        # Check that total time is reasonable (should be under 5 seconds for 10 queries)
        self.assertLess(total_time, 5.0)
        
        # Verify the requests were made correctly
        self.assertEqual(mock_post.call_count, 10)
    
    @patch('agent_sdk.requests.post')
    def test_large_result_set_performance(self, mock_post):
        """Test performance with large result sets."""
        # Mock a large response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = [
            {
                "id": f"sol-{i:03d}",
                "content": f"Solution content for item {i}" * 10,  # Make content longer
                "source": f"SOURCE_{i}.md",
                "similarity": 0.9 - (i * 0.01)
            } for i in range(100)  # 100 results
        ]
        mock_post.return_value = mock_response
        
        # Measure response time for large result set
        start_time = time.time()
        
        error_message = "Connection timeout when accessing external API"
        results = self.agent_sdk.query_knowledge_base(error_message, limit=100)
        
        end_time = time.time()
        response_time = end_time - start_time
        
        # Assertions
        self.assertEqual(len(results), 100)
        # Check that response time is still reasonable (under 2 seconds)
        self.assertLess(response_time, 2.0)
        
        # Verify the request was made correctly
        mock_post.assert_called_once()

if __name__ == '__main__':
    unittest.main()