import unittest
from unittest.mock import patch, MagicMock
import sys
import os

# Add the sdk directory to the path so we can import the AgentSDK
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'sdk'))

from agent_sdk import AgentSDK

class TestGenerativeRemediation(unittest.TestCase):
    def setUp(self):
        self.agent_id = "test-agent-123"
        self.api_key = "test-api-key"
        self.api_base_url = "http://localhost:8000"
        self.agent = AgentSDK(self.agent_id, self.api_key, self.api_base_url)

    @patch('agent_sdk.requests.post')
    def test_request_generative_remediation(self, mock_post):
        # Mock the response
        mock_response = MagicMock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = {
            "id": "script-123",
            "generated_script": "echo 'Hello World'",
            "confidence_score": 0.95
        }
        mock_post.return_value = mock_response

        # Test data
        anomaly_id = "anomaly-456"
        root_cause_analysis = {
            "root_cause_category": "Configuration",
            "root_cause_details": "Missing configuration file",
            "confidence_score": "HIGH",
            "suggested_actions": ["Create configuration file"]
        }

        # Call the method
        result = self.agent.request_generative_remediation(anomaly_id, root_cause_analysis)

        # Assertions
        self.assertEqual(result["id"], "script-123")
        self.assertEqual(result["generated_script"], "echo 'Hello World'")
        self.assertEqual(result["confidence_score"], 0.95)

        # Verify the request was made correctly
        mock_post.assert_called_once_with(
            f"{self.api_base_url}/api/generative-remediation/generate",
            headers={"Authorization": f"Bearer {self.api_key}"},
            json={
                "anomaly_id": anomaly_id,
                "root_cause_analysis": root_cause_analysis
            }
        )

    @patch('agent_sdk.requests.post')
    def test_validate_script(self, mock_post):
        # Mock the response
        mock_response = MagicMock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = {
            "validation": {
                "isValid": True,
                "errors": []
            }
        }
        mock_post.return_value = mock_response

        # Call the method
        result = self.agent.validate_script("script-123")

        # Assertions
        self.assertTrue(result["validation"]["isValid"])
        self.assertEqual(result["validation"]["errors"], [])

        # Verify the request was made correctly
        mock_post.assert_called_once_with(
            f"{self.api_base_url}/api/generative-remediation/scripts/script-123/validate",
            headers={"Authorization": f"Bearer {self.api_key}"}
        )

    @patch('agent_sdk.requests.post')
    def test_execute_script(self, mock_post):
        # Mock the response
        mock_response = MagicMock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = {
            "status": "SUCCESS",
            "result": "Script executed successfully"
        }
        mock_post.return_value = mock_response

        # Call the method
        result = self.agent.execute_script("script-123")

        # Assertions
        self.assertEqual(result["status"], "SUCCESS")
        self.assertEqual(result["result"], "Script executed successfully")

        # Verify the request was made correctly
        mock_post.assert_called_once_with(
            f"{self.api_base_url}/api/generative-remediation/scripts/script-123/execute",
            headers={"Authorization": f"Bearer {self.api_key}"}
        )

    @patch('agent_sdk.requests.get')
    def test_get_approved_scripts(self, mock_get):
        # Mock the response
        mock_response = MagicMock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = [
            {
                "id": "script-123",
                "approval_status": "APPROVED",
                "generated_script": "echo 'Hello World'"
            }
        ]
        mock_get.return_value = mock_response

        # Call the method
        result = self.agent.get_approved_scripts()

        # Assertions
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["id"], "script-123")
        self.assertEqual(result[0]["approval_status"], "APPROVED")

        # Verify the request was made correctly
        mock_get.assert_called_once_with(
            f"{self.api_base_url}/api/generative-remediation/scripts",
            headers={"Authorization": f"Bearer {self.api_key}"},
            params={"approval_status": "APPROVED"}
        )

    @patch('agent_sdk.requests.post')
    def test_request_generative_remediation_error(self, mock_post):
        # Mock a request exception
        mock_post.side_effect = Exception("Network error")

        # Test data
        anomaly_id = "anomaly-456"
        root_cause_analysis = {
            "root_cause_category": "Configuration",
            "root_cause_details": "Missing configuration file",
            "confidence_score": "HIGH",
            "suggested_actions": ["Create configuration file"]
        }

        # Call the method
        result = self.agent.request_generative_remediation(anomaly_id, root_cause_analysis)

        # Assertions
        self.assertEqual(result, {})
        mock_post.assert_called_once()

if __name__ == '__main__':
    unittest.main()