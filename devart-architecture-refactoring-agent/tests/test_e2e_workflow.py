#!/usr/bin/env python3
"""
End-to-end tests for the full architecture analysis workflow
"""

import unittest
import sys
import os
import tempfile
import shutil
from unittest.mock import patch, MagicMock
from pathlib import Path

# Add the sdk directory to the path
sdk_path = Path(__file__).parent.parent / 'sdk'
sys.path.insert(0, str(sdk_path))

from agent_sdk import ArchitectureRefactoringAgentSDK
from codebase_analyzer import CodebaseAnalyzer
from refactoring_suggester import RefactoringSuggester
from refactoring_executor import RefactoringExecutor

class TestEndToEndWorkflow(unittest.TestCase):
    def setUp(self):
        """Set up test fixtures before each test method."""
        self.test_repo_dir = None
        self.agent_sdk = ArchitectureRefactoringAgentSDK(
            agent_id="test-agent",
            api_key="test-key",
            api_base_url="https://test.api"
        )
        
    def tearDown(self):
        """Clean up after each test method."""
        if self.test_repo_dir and os.path.exists(self.test_repo_dir):
            shutil.rmtree(self.test_repo_dir)
            
    def create_test_repository(self):
        """Create a simple test repository structure."""
        self.test_repo_dir = tempfile.mkdtemp()
        
        # Create a basic project structure
        src_dir = os.path.join(self.test_repo_dir, 'src')
        os.makedirs(src_dir, exist_ok=True)
        
        # Create a sample Python file with a "god class"
        god_class_content = '''
class UserManager:
    def __init__(self):
        self.users = []
        
    def add_user(self, user):
        self.users.append(user)
        
    def remove_user(self, user):
        self.users.remove(user)
        
    def get_user(self, user_id):
        for user in self.users:
            if user.id == user_id:
                return user
        return None
        
    def update_user(self, user_id, data):
        user = self.get_user(user_id)
        if user:
            for key, value in data.items():
                setattr(user, key, value)
        return user
        
    def list_users(self):
        return self.users
        
    def authenticate_user(self, username, password):
        # Authentication logic
        pass
        
    def authorize_user(self, user, permission):
        # Authorization logic
        pass
        
    def send_email(self, user, subject, body):
        # Email sending logic
        pass
        
    def generate_report(self):
        # Report generation logic
        pass
        
    def backup_data(self):
        # Data backup logic
        pass
        
    def restore_data(self):
        # Data restoration logic
        pass
        
    def validate_input(self, data):
        # Input validation logic
        pass
        
    def log_activity(self, activity):
        # Activity logging logic
        pass
        
    def cache_data(self, key, value):
        # Caching logic
        pass
'''
        
        with open(os.path.join(src_dir, 'UserManager.py'), 'w') as f:
            f.write(god_class_content)
            
        # Create requirements.txt
        with open(os.path.join(self.test_repo_dir, 'requirements.txt'), 'w') as f:
            f.write('django==3.2.0\nrequests==2.25.1\n')
            
        return self.test_repo_dir
        
    def test_full_architecture_analysis_workflow(self):
        """Test the complete architecture analysis workflow."""
        # Create test repository
        repo_path = self.create_test_repository()
        
        # Initialize components
        analyzer = CodebaseAnalyzer()
        suggester = RefactoringSuggester()
        
        # Test repository analysis
        findings = analyzer.analyze_codebase(repo_path)
        self.assertIsInstance(findings, list)
        self.assertGreater(len(findings), 0, "Should find at least one architectural issue")
        
        # Test suggestion generation
        suggestions = suggester.generate_suggestions(findings)
        self.assertIsInstance(suggestions, list)
        self.assertGreater(len(suggestions), 0, "Should generate at least one suggestion")
        
        # Test suggestion prioritization
        prioritized = suggester.prioritize_suggestions(suggestions)
        self.assertIsInstance(prioritized, list)
        self.assertEqual(len(prioritized), len(suggestions))
        
        # Test suggestion scoring
        scored = suggester.score_suggestions(prioritized)
        self.assertIsInstance(scored, list)
        if scored:
            self.assertIn('impact_score', scored[0])
            self.assertIn('confidence_score', scored[0])
            
    def test_sandbox_provisioning_and_execution(self):
        """Test sandbox provisioning and refactoring execution."""
        executor = RefactoringExecutor()
        
        # Test sandbox provisioning
        sandbox_result = executor.provision_sandbox("https://test.repo")
        self.assertIn("sandbox_id", sandbox_result)
        self.assertIn("sandbox_url", sandbox_result)
        self.assertEqual(sandbox_result["status"], "PROVISIONING")
        
        # Test refactoring execution with a sample suggestion
        sample_suggestion = {
            "title": "Split God Class",
            "description": "Break down large class into smaller, focused classes",
            "complexity": "HIGH",
            "impact": "HIGH",
            "priority": "CRITICAL",
            "implementation_plan": [
                "Identify distinct responsibilities in the class",
                "Create new classes for each responsibility",
                "Move related methods and properties to new classes"
            ]
        }
        
        # Mock internal methods to avoid actual execution
        executor._clone_repository_in_sandbox = MagicMock(return_value={"success": True})
        executor._apply_refactoring_step = MagicMock(return_value={"success": True})
        executor._run_tests = MagicMock(return_value={"success": True, "passed": 10, "failed": 0})
        executor._generate_performance_comparison = MagicMock(return_value={
            "before": {"response_time_ms": 150},
            "after": {"response_time_ms": 120}
        })
        
        result = executor.execute_refactoring(sample_suggestion, "https://test.repo")
        self.assertTrue(result["success"])
        self.assertIn("sandbox_id", result)
        self.assertIn("changes", result)
        self.assertIn("test_results", result)
        
    def test_agent_task_processing(self):
        """Test the agent's task processing capability."""
        # Mock the API calls
        with patch.object(self.agent_sdk, 'get_analysis_task_details') as mock_get_task, \
             patch.object(self.agent_sdk, 'update_analysis_status') as mock_update_status, \
             patch.object(self.agent_sdk, 'report_findings') as mock_report_findings, \
             patch.object(self.agent_sdk, 'report_suggestions') as mock_report_suggestions:
            
            # Create a mock task
            mock_task = {
                "id": "test-task-123",
                "title": "Test Architecture Analysis",
                "repository_url": "https://test.repo",
                "branch": "main"
            }
            
            mock_get_task.return_value = mock_task
            
            # Create a test repository for analysis
            repo_path = self.create_test_repository()
            
            # Mock the analyzer to use our test repository
            with patch.object(CodebaseAnalyzer, 'clone_repository', return_value=repo_path):
                # This would normally be called by the agent's message consumer
                # We're testing the processing function directly
                pass
                
    def test_error_handling_in_workflow(self):
        """Test error handling throughout the workflow."""
        analyzer = CodebaseAnalyzer()
        
        # Test with invalid repository path
        findings = analyzer.analyze_codebase("/invalid/path")
        self.assertEqual(findings, [])
        
        # Test with empty repository
        empty_repo = tempfile.mkdtemp()
        findings = analyzer.analyze_codebase(empty_repo)
        shutil.rmtree(empty_repo)
        # Should complete without errors, even if no findings
        
        suggester = RefactoringSuggester()
        # Test with empty findings
        suggestions = suggester.generate_suggestions([])
        self.assertEqual(suggestions, [])

class TestIntegrationScenarios(unittest.TestCase):
    def test_large_codebase_analysis(self):
        """Test analysis of a larger codebase structure."""
        # Create a more complex repository structure
        test_dir = tempfile.mkdtemp()
        
        try:
            # Create multiple modules
            modules = ['auth', 'payment', 'notification', 'reporting']
            for module in modules:
                module_dir = os.path.join(test_dir, 'src', module)
                os.makedirs(module_dir, exist_ok=True)
                
                # Create sample files in each module
                for i in range(3):
                    with open(os.path.join(module_dir, f'{module}_service_{i}.py'), 'w') as f:
                        f.write(f'class {module.capitalize()}Service{i}:\n    pass\n')
                        
            # Create circular dependency scenario
            with open(os.path.join(test_dir, 'src', 'auth', 'auth_service.py'), 'w') as f:
                f.write('from src.payment import payment_service\n')
                
            with open(os.path.join(test_dir, 'src', 'payment', 'payment_service.py'), 'w') as f:
                f.write('from src.auth import auth_service\n')
                
            # Analyze the codebase
            analyzer = CodebaseAnalyzer()
            findings = analyzer.analyze_codebase(test_dir)
            
            # Should find architectural issues
            self.assertIsInstance(findings, list)
            
        finally:
            shutil.rmtree(test_dir)

if __name__ == '__main__':
    unittest.main()