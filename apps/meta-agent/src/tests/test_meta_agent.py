"""
Test module for the Meta-Agent System
"""

import unittest
from unittest.mock import patch, MagicMock
import sys
import os

# Add src directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from src.orchestration.meta_agent import MetaAgent, TaskSpecification, AgentInfo


class TestMetaAgent(unittest.TestCase):
    """Test cases for the MetaAgent class."""

    def setUp(self):
        """Set up test fixtures."""
        self.meta_agent = MetaAgent(
            api_base_url="http://localhost:8787",
            api_key="test-api-key"
        )

    def test_init(self):
        """Test MetaAgent initialization."""
        self.assertEqual(self.meta_agent.api_base_url, "http://localhost:8787")
        self.assertEqual(self.meta_agent.api_key, "test-api-key")
        self.assertIsNotNone(self.meta_agent.agent)

    def test_generate_tasks(self):
        """Test task generation from roadmap analysis."""
        # Mock the agent response
        with patch.object(self.meta_agent.agent, 'llm_response') as mock_response:
            mock_response.return_value.content = '''[
                {
                    "title": "Test Task",
                    "description": "Test task description",
                    "priority": "MEDIUM",
                    "required_capabilities": ["python", "testing"],
                    "estimated_effort": "SMALL"
                }
            ]'''
            
            tasks = self.meta_agent.generate_tasks("Test roadmap analysis")
            
            self.assertEqual(len(tasks), 1)
            self.assertEqual(tasks[0].title, "Test Task")
            self.assertEqual(tasks[0].priority, "MEDIUM")
            self.assertIn("python", tasks[0].required_capabilities)

    def test_match_agent_to_task(self):
        """Test matching agents to tasks based on capabilities."""
        # Create test task
        task = TaskSpecification(
            title="Test Task",
            description="Test task description",
            priority="MEDIUM",
            required_capabilities=["python", "testing"],
            estimated_effort="SMALL"
        )
        
        # Create test agents
        agents = [
            AgentInfo(
                id="agent-1",
                alias="Python Expert",
                capabilities=["python", "django", "flask"],
                status="IDLE",
                is_active=True
            ),
            AgentInfo(
                id="agent-2",
                alias="Full Stack Developer",
                capabilities=["python", "react", "testing"],
                status="IDLE",
                is_active=True
            ),
            AgentInfo(
                id="agent-3",
                alias="Frontend Developer",
                capabilities=["react", "vue", "css"],
                status="IDLE",
                is_active=True
            )
        ]
        
        # Find best match
        matched_agent = self.meta_agent.match_agent_to_task(task, agents)
        
        # Agent 2 should be the best match as it has both python and testing capabilities
        self.assertIsNotNone(matched_agent)
        self.assertEqual(matched_agent.id, "agent-2")
        self.assertEqual(matched_agent.alias, "Full Stack Developer")

    def test_match_agent_to_task_no_match(self):
        """Test matching when no agent has required capabilities."""
        # Create test task
        task = TaskSpecification(
            title="Test Task",
            description="Test task description",
            priority="MEDIUM",
            required_capabilities=["cobol", "fortran"],
            estimated_effort="SMALL"
        )
        
        # Create test agents
        agents = [
            AgentInfo(
                id="agent-1",
                alias="Python Expert",
                capabilities=["python", "django", "flask"],
                status="IDLE",
                is_active=True
            ),
            AgentInfo(
                id="agent-2",
                alias="Full Stack Developer",
                capabilities=["python", "react", "testing"],
                status="IDLE",
                is_active=True
            )
        ]
        
        # Find best match
        matched_agent = self.meta_agent.match_agent_to_task(task, agents)
        
        # No agent should match
        self.assertIsNone(matched_agent)


if __name__ == '__main__':
    unittest.main()