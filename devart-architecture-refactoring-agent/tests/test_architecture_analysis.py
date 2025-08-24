import unittest
from unittest.mock import patch, MagicMock
import sys
import os

# Add the sdk directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'sdk'))

from codebase_analyzer import CodebaseAnalyzer
from refactoring_suggester import RefactoringSuggester
from refactoring_executor import RefactoringExecutor

class TestCodebaseAnalyzer(unittest.TestCase):
    def setUp(self):
        self.analyzer = CodebaseAnalyzer()
        
    def test_init(self):
        self.assertIsInstance(self.analyzer, CodebaseAnalyzer)
        self.assertEqual(self.analyzer.findings, [])
        
    def test_analyze_python_file_god_class(self):
        # This is a simplified test - in reality, we would test with actual files
        pass
        
    def test_analyze_python_file_long_function(self):
        # This is a simplified test - in reality, we would test with actual files
        pass

class TestRefactoringSuggester(unittest.TestCase):
    def setUp(self):
        self.suggester = RefactoringSuggester()
        
    def test_init(self):
        self.assertIsInstance(self.suggester, RefactoringSuggester)
        self.assertEqual(self.suggester.suggestions, [])
        
    def test_suggest_god_class_refactoring(self):
        finding = {
            "type": "god_class",
            "file_path": "src/models/UserManager.py",
            "id": "finding-1"
        }
        
        suggestion = self.suggester._suggest_god_class_refactoring(finding)
        
        self.assertEqual(suggestion["title"], "Split God Class")
        self.assertEqual(suggestion["complexity"], "HIGH")
        self.assertEqual(suggestion["impact"], "HIGH")
        self.assertEqual(suggestion["priority"], "CRITICAL")
        self.assertIn("Identify distinct responsibilities", suggestion["implementation_plan"][0])
        
    def test_suggest_circular_dependency_refactoring(self):
        finding = {
            "type": "circular_dependency",
            "id": "finding-2"
        }
        
        suggestion = self.suggester._suggest_circular_dependency_refactoring(finding)
        
        self.assertEqual(suggestion["title"], "Break Circular Dependency")
        self.assertEqual(suggestion["complexity"], "MEDIUM")
        self.assertEqual(suggestion["impact"], "HIGH")
        self.assertEqual(suggestion["priority"], "HIGH")
        
    def test_suggest_long_function_refactoring(self):
        finding = {
            "type": "long_function",
            "id": "finding-3"
        }
        
        suggestion = self.suggester._suggest_long_function_refactoring(finding)
        
        self.assertEqual(suggestion["title"], "Extract Method")
        self.assertEqual(suggestion["complexity"], "LOW")
        self.assertEqual(suggestion["impact"], "MEDIUM")
        self.assertEqual(suggestion["priority"], "MEDIUM")
        
    def test_prioritize_suggestions(self):
        suggestions = [
            {
                "title": "Low Priority",
                "priority": "LOW",
                "impact": "LOW",
                "complexity": "LOW"
            },
            {
                "title": "High Priority",
                "priority": "HIGH",
                "impact": "HIGH",
                "complexity": "LOW"
            },
            {
                "title": "Critical Priority",
                "priority": "CRITICAL",
                "impact": "HIGH",
                "complexity": "HIGH"
            }
        ]
        
        prioritized = self.suggester.prioritize_suggestions(suggestions)
        
        self.assertEqual(prioritized[0]["title"], "Critical Priority")
        self.assertEqual(prioritized[1]["title"], "High Priority")
        self.assertEqual(prioritized[2]["title"], "Low Priority")

class TestRefactoringExecutor(unittest.TestCase):
    def setUp(self):
        self.executor = RefactoringExecutor()
        
    def test_init(self):
        self.assertIsInstance(self.executor, RefactoringExecutor)
        self.assertIsNone(self.executor.sandbox_url)
        self.assertIsNone(self.executor.sandbox_id)
        
    def test_provision_sandbox(self):
        result = self.executor.provision_sandbox("https://github.com/example/repo")
        
        self.assertIn("sandbox_id", result)
        self.assertIn("sandbox_url", result)
        self.assertEqual(result["status"], "PROVISIONING")
        
    def test_execute_refactoring(self):
        suggestion = {
            "title": "Test Refactoring",
            "implementation_plan": [
                "Step 1: Do something",
                "Step 2: Do something else"
            ]
        }
        
        # Mock the internal methods
        self.executor._clone_repository_in_sandbox = MagicMock(return_value={"success": True})
        self.executor._apply_refactoring_step = MagicMock(return_value={"success": True})
        self.executor._run_tests = MagicMock(return_value={"success": True})
        self.executor._generate_performance_comparison = MagicMock(return_value={})
        
        result = self.executor.execute_refactoring(suggestion, "https://github.com/example/repo")
        
        self.assertTrue(result["success"])
        self.assertIn("sandbox_id", result)
        self.assertIn("changes", result)
        self.assertIn("test_results", result)

if __name__ == '__main__':
    unittest.main()