"""
Integration tests for the Meta-Agent System end-to-end workflow.
"""

import unittest
from unittest.mock import patch, MagicMock
import json
from src.orchestration.main import initialize_agents, orchestrate_roadmap_analysis


class TestIntegration(unittest.TestCase):
    """Integration tests for the Meta-Agent System."""

    @patch('src.orchestration.main.MetaAgent')
    @patch('src.orchestration.main.SpecWriterAgent')
    @patch('src.orchestration.main.TaskGeneratorAgent')
    def test_initialize_agents(self, mock_task_generator, mock_spec_writer, mock_meta_agent):
        """Test initialization of all agents."""
        # Mock agent instances
        mock_meta_agent_instance = MagicMock()
        mock_spec_writer_instance = MagicMock()
        mock_task_generator_instance = MagicMock()
        
        mock_meta_agent.return_value = mock_meta_agent_instance
        mock_spec_writer.return_value = mock_spec_writer_instance
        mock_task_generator.return_value = mock_task_generator_instance
        
        # Test the function
        meta_agent, spec_writer, task_generator = initialize_agents()
        
        # Verify results
        self.assertEqual(meta_agent, mock_meta_agent_instance)
        self.assertEqual(spec_writer, mock_spec_writer_instance)
        self.assertEqual(task_generator, mock_task_generator_instance)
        mock_meta_agent.assert_called_once()
        mock_spec_writer.assert_called_once()
        mock_task_generator.assert_called_once()

    @patch('src.orchestration.main.initialize_agents')
    @patch('src.orchestration.main.MetaAgent')
    def test_orchestrate_roadmap_analysis(self, mock_meta_agent_class, mock_initialize_agents):
        """Test the complete roadmap analysis and task generation workflow."""
        # Mock agents
        mock_meta_agent = MagicMock()
        mock_spec_writer = MagicMock()
        mock_task_generator = MagicMock()
        
        mock_initialize_agents.return_value = (mock_meta_agent, mock_spec_writer, mock_task_generator)
        
        # Mock meta agent methods
        mock_meta_agent.analyze_roadmap.return_value = "Implement real-time collaboration features"
        
        mock_meta_agent.generate_technical_specification.return_value = MagicMock(
            feature_name="Real-time Collaboration",
            overview="Real-time collaboration features for agents"
        )
        
        mock_meta_agent.generate_tasks_from_specification.return_value = [
            MagicMock(title="Implement WebSocket API"),
            MagicMock(title="Create collaboration UI")
        ]
        
        mock_meta_agent.generate_evaluation_tasks.return_value = [
            MagicMock(title="Evaluate Real-time Collaboration - Performance Testing")
        ]
        
        mock_meta_agent.get_available_agents.return_value = [
            MagicMock(id="agent-1", alias="Backend Developer", capabilities=["Python", "WebSocket"]),
            MagicMock(id="agent-2", alias="Frontend Developer", capabilities=["React", "JavaScript"])
        ]
        
        mock_meta_agent.match_agent_to_task.side_effect = [
            MagicMock(id="agent-1"),  # Match first task to backend developer
            MagicMock(id="agent-2"),  # Match second task to frontend developer
            None  # No match for evaluation task
        ]
        
        mock_meta_agent.create_task_in_system.side_effect = ["task-1", "task-2", "task-3"]
        
        # Test the function
        result = orchestrate_roadmap_analysis()
        
        # Verify results
        self.assertIsInstance(result, list)
        self.assertEqual(len(result), 3)  # Should have created 3 tasks
        self.assertIn("task-1", result)
        self.assertIn("task-2", result)
        self.assertIn("task-3", result)
        
        # Verify method calls
        mock_meta_agent.analyze_roadmap.assert_called_once_with("What are the next features to implement?")
        mock_meta_agent.generate_technical_specification.assert_called_once()
        mock_meta_agent.generate_tasks_from_specification.assert_called_once()
        mock_meta_agent.generate_evaluation_tasks.assert_called_once()
        self.assertEqual(mock_meta_agent.get_available_agents.call_count, 1)
        self.assertEqual(mock_meta_agent.match_agent_to_task.call_count, 3)
        self.assertEqual(mock_meta_agent.create_task_in_system.call_count, 3)

    @patch('src.orchestration.main.os.getenv')
    def test_main_missing_env_vars(self, mock_getenv):
        """Test main function when required environment variables are missing."""
        # Mock getenv to return None for required variables
        mock_getenv.side_effect = lambda key, default=None: None if key == "META_AGENT_API_KEY" else default
        
        # Import main here to avoid issues with environment variable mocking
        from src.orchestration.main import main
        
        # Test the function
        result = main()
        
        # Verify results
        self.assertEqual(result, 1)  # Should return 1 for error

    @patch('src.orchestration.main.os.getenv')
    @patch('src.orchestration.main.orchestrate_roadmap_analysis')
    def test_main_success(self, mock_orchestrate, mock_getenv):
        """Test main function when everything works correctly."""
        # Mock getenv to return required variables
        def getenv_side_effect(key, default=None):
            if key == "META_AGENT_API_KEY":
                return "test-key"
            return default
        mock_getenv.side_effect = getenv_side_effect
        
        # Mock orchestrate_roadmap_analysis to return success
        mock_orchestrate.return_value = ["task-1", "task-2"]
        
        # Import main here to avoid issues with environment variable mocking
        from src.orchestration.main import main
        
        # Test the function
        result = main()
        
        # Verify results
        self.assertEqual(result, 0)  # Should return 0 for success
        mock_orchestrate.assert_called_once()


if __name__ == '__main__':
    unittest.main()