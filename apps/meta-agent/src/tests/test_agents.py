"""
Unit tests for the agent components of the Meta-Agent System.
"""

import unittest
from unittest.mock import patch, MagicMock
import json
from src.orchestration.meta_agent import MetaAgent, TaskSpecification, AgentInfo
from src.orchestration.specialized_agents import SpecWriterAgent, TaskGeneratorAgent, TechnicalSpecification


class TestSpecWriterAgent(unittest.TestCase):
    """Test cases for the SpecWriterAgent class."""

    def setUp(self):
        """Set up test fixtures before each test method."""
        self.spec_writer = SpecWriterAgent(name="Test-Spec-Writer")

    def test_init(self):
        """Test initialization of SpecWriterAgent."""
        self.assertEqual(self.spec_writer.agent.config.name, "Test-Spec-Writer")
        self.assertIn("Spec-Writer Agent responsible", self.spec_writer.agent.config.system_message)

    @patch('src.orchestration.specialized_agents.ChatAgent')
    def test_create_specification(self, mock_chat_agent):
        """Test creating a technical specification."""
        # Mock the LLM response
        mock_response = MagicMock()
        mock_response.content = json.dumps({
            "feature_name": "Test Feature",
            "overview": "Test overview",
            "technical_requirements": ["Requirement 1", "Requirement 2"],
            "implementation_steps": ["Step 1", "Step 2"],
            "dependencies": ["Dependency 1"],
            "estimated_complexity": "MEDIUM",
            "required_expertise": ["Python", "AI"]
        })
        mock_chat_agent_instance = MagicMock()
        mock_chat_agent_instance.llm_response.return_value = mock_response
        mock_chat_agent.return_value = mock_chat_agent_instance
        
        # Test the method
        feature_goal = "Implement a test feature"
        result = self.spec_writer.create_specification(feature_goal)
        
        # Verify results
        self.assertIsInstance(result, TechnicalSpecification)
        self.assertEqual(result.feature_name, "Test Feature")
        self.assertEqual(result.overview, "Test overview")
        self.assertEqual(len(result.technical_requirements), 2)
        self.assertEqual(len(result.implementation_steps), 2)
        self.assertEqual(len(result.dependencies), 1)
        self.assertEqual(result.estimated_complexity, "MEDIUM")
        self.assertEqual(len(result.required_expertise), 2)


class TestTaskGeneratorAgent(unittest.TestCase):
    """Test cases for the TaskGeneratorAgent class."""

    def setUp(self):
        """Set up test fixtures before each test method."""
        self.api_base_url = "http://test.api"
        self.api_key = "test-key"
        self.task_generator = TaskGeneratorAgent(
            api_base_url=self.api_base_url,
            api_key=self.api_key,
            name="Test-Task-Generator"
        )

    def test_init(self):
        """Test initialization of TaskGeneratorAgent."""
        self.assertEqual(self.task_generator.api_base_url, self.api_base_url)
        self.assertEqual(self.task_generator.api_key, self.api_key)
        self.assertEqual(self.task_generator.agent.config.name, "Test-Task-Generator")
        self.assertIn("Task-Generator Agent responsible", self.task_generator.agent.config.system_message)

    @patch('src.orchestration.specialized_agents.ChatAgent')
    def test_generate_tasks(self, mock_chat_agent):
        """Test generating tasks from a technical specification."""
        # Mock the LLM response
        mock_response = MagicMock()
        mock_response.content = json.dumps([
            {
                "title": "Test Task",
                "description": "Test task description",
                "priority": "MEDIUM",
                "required_capabilities": ["Python", "AI"],
                "estimated_effort": "MEDIUM"
            }
        ])
        mock_chat_agent_instance = MagicMock()
        mock_chat_agent_instance.llm_response.return_value = mock_response
        mock_chat_agent.return_value = mock_chat_agent_instance
        
        # Create a test specification
        specification = TechnicalSpecification(
            feature_name="Test Feature",
            overview="Test overview",
            technical_requirements=["Requirement 1"],
            implementation_steps=["Step 1"],
            dependencies=["Dependency 1"],
            estimated_complexity="MEDIUM",
            required_expertise=["Python"]
        )
        
        # Test the method
        result = self.task_generator.generate_tasks(specification)
        
        # Verify results
        self.assertIsInstance(result, list)
        self.assertEqual(len(result), 1)
        self.assertIsInstance(result[0], TaskSpecification)
        self.assertEqual(result[0].title, "Test Task")
        self.assertEqual(result[0].priority, "MEDIUM")
        self.assertEqual(len(result[0].required_capabilities), 2)
        self.assertEqual(result[0].estimated_effort, "MEDIUM")

    @patch('src.orchestration.specialized_agents.requests.post')
    def test_create_task_in_system(self, mock_requests_post):
        """Test creating a task in the devart.ai system."""
        # Mock the API response
        mock_response = MagicMock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = {"id": "task-123"}
        mock_requests_post.return_value = mock_response
        
        # Create a test task specification
        task_spec = TaskSpecification(
            title="Test Task",
            description="Test task description",
            priority="MEDIUM",
            required_capabilities=["Python"],
            estimated_effort="MEDIUM"
        )
        
        # Test the method
        result = self.task_generator.create_task_in_system(task_spec)
        
        # Verify results
        self.assertEqual(result, "task-123")
        mock_requests_post.assert_called_once()
        expected_url = f"{self.api_base_url}/api/tasks"
        self.assertEqual(mock_requests_post.call_args[0][0], expected_url)

    def test_generate_evaluation_tasks(self):
        """Test generating evaluation tasks."""
        # Test the method
        result = self.task_generator.generate_evaluation_tasks("Test Feature")
        
        # Verify results
        self.assertIsInstance(result, list)
        self.assertEqual(len(result), 3)  # Should generate 3 evaluation tasks
        for task in result:
            self.assertIsInstance(task, TaskSpecification)
            self.assertIn("Evaluate Test Feature", task.title)
            self.assertEqual(task.priority, "HIGH")  # First two should be HIGH priority
            self.assertEqual(task.estimated_effort, "MEDIUM")


class TestMetaAgent(unittest.TestCase):
    """Test cases for the MetaAgent class."""

    def setUp(self):
        """Set up test fixtures before each test method."""
        self.api_base_url = "http://test.api"
        self.api_key = "test-key"
        self.meta_agent = MetaAgent(
            api_base_url=self.api_base_url,
            api_key=self.api_key
        )

    def test_init(self):
        """Test initialization of MetaAgent."""
        self.assertEqual(self.meta_agent.api_base_url, self.api_base_url)
        self.assertEqual(self.meta_agent.api_key, self.api_key)
        self.assertEqual(self.meta_agent.agent.config.name, "Meta-Agent")
        self.assertIsNotNone(self.meta_agent.spec_writer_agent)
        self.assertIsNotNone(self.meta_agent.task_generator_agent)

    @patch('src.orchestration.meta_agent.requests.post')
    def test_analyze_roadmap(self, mock_requests_post):
        """Test roadmap analysis."""
        # Mock the API response
        mock_response = MagicMock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = {
            "results": {
                "synthesized_answer": "Test analysis result"
            }
        }
        mock_requests_post.return_value = mock_response
        
        # Test the method
        result = self.meta_agent.analyze_roadmap("What are the next features?")
        
        # Verify results
        self.assertEqual(result, "Test analysis result")
        mock_requests_post.assert_called_once()

    def test_generate_evaluation_tasks(self):
        """Test generating evaluation tasks through MetaAgent."""
        # Mock the task generator agent
        with patch.object(self.meta_agent.task_generator_agent, 'generate_evaluation_tasks') as mock_generate:
            mock_generate.return_value = [
                TaskSpecification(
                    title="Test Evaluation Task",
                    description="Test evaluation task description",
                    priority="HIGH",
                    required_capabilities=["testing"],
                    estimated_effort="MEDIUM"
                )
            ]
            
            # Test the method
            result = self.meta_agent.generate_evaluation_tasks("Test Feature")
            
            # Verify results
            self.assertIsInstance(result, list)
            self.assertEqual(len(result), 1)
            self.assertIsInstance(result[0], TaskSpecification)
            self.assertEqual(result[0].title, "Test Evaluation Task")
            mock_generate.assert_called_once_with("Test Feature")

    @patch('src.orchestration.meta_agent.requests.get')
    def test_get_available_agents(self, mock_requests_get):
        """Test getting available agents."""
        # Mock the API response
        mock_response = MagicMock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = [
            {
                "id": "agent-1",
                "alias": "Test Agent",
                "capabilities": ["Python", "AI"],
                "status": "IDLE",
                "is_active": True,
                "last_seen": "2023-01-01T00:00:00",
                "created_at": "2023-01-01T00:00:00"
            }
        ]
        mock_requests_get.return_value = mock_response
        
        # Test the method
        result = self.meta_agent.get_available_agents()
        
        # Verify results
        self.assertIsInstance(result, list)
        self.assertEqual(len(result), 1)
        self.assertIsInstance(result[0], AgentInfo)
        self.assertEqual(result[0].id, "agent-1")
        self.assertEqual(result[0].alias, "Test Agent")
        self.assertTrue(result[0].is_active)
        mock_requests_get.assert_called_once()

    def test_match_agent_to_task(self):
        """Test matching an agent to a task."""
        # Create test data
        task = TaskSpecification(
            title="Test Task",
            description="Test task description",
            priority="MEDIUM",
            required_capabilities=["Python", "AI"],
            estimated_effort="MEDIUM"
        )
        
        agents = [
            AgentInfo(
                id="agent-1",
                alias="Python Expert",
                capabilities=["Python", "JavaScript"],
                status="IDLE",
                is_active=True
            ),
            AgentInfo(
                id="agent-2",
                alias="AI Specialist",
                capabilities=["AI", "Machine Learning"],
                status="IDLE",
                is_active=True
            )
        ]
        
        # Test the method
        result = self.meta_agent.match_agent_to_task(task, agents)
        
        # Verify results - agent-2 should be matched because it has the AI capability
        # and together they cover 100% of required capabilities
        self.assertIsNotNone(result)
        self.assertEqual(result.id, "agent-2")

    def test_match_agent_to_task_no_match(self):
        """Test matching an agent to a task when no suitable agent is available."""
        # Create test data
        task = TaskSpecification(
            title="Test Task",
            description="Test task description",
            priority="MEDIUM",
            required_capabilities=["Quantum Computing"],
            estimated_effort="MEDIUM"
        )
        
        agents = [
            AgentInfo(
                id="agent-1",
                alias="Python Expert",
                capabilities=["Python", "JavaScript"],
                status="IDLE",
                is_active=True
            )
        ]
        
        # Test the method
        result = self.meta_agent.match_agent_to_task(task, agents)
        
        # Verify results - no agent should be matched
        self.assertIsNone(result)


if __name__ == '__main__':
    unittest.main()