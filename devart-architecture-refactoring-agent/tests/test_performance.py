#!/usr/bin/env python3
"""
Performance tests for the Architecture Refactoring Agent
"""

import unittest
import sys
import os
import tempfile
import shutil
import time
from pathlib import Path

# Add the sdk directory to the path
sdk_path = Path(__file__).parent.parent / 'sdk'
sys.path.insert(0, str(sdk_path))

from codebase_analyzer import CodebaseAnalyzer
from refactoring_suggester import RefactoringSuggester

class TestPerformance(unittest.TestCase):
    def setUp(self):
        """Set up test fixtures before each test method."""
        self.test_repo_dir = None
        
    def tearDown(self):
        """Clean up after each test method."""
        if self.test_repo_dir and os.path.exists(self.test_repo_dir):
            shutil.rmtree(self.test_repo_dir)
            
    def create_large_test_repository(self, num_files=100):
        """Create a large test repository structure."""
        self.test_repo_dir = tempfile.mkdtemp()
        
        # Create a hierarchical structure
        src_dir = os.path.join(self.test_repo_dir, 'src')
        os.makedirs(src_dir, exist_ok=True)
        
        # Create multiple modules
        modules = ['auth', 'payment', 'notification', 'reporting', 'user', 'admin']
        
        file_count = 0
        for module in modules:
            module_dir = os.path.join(src_dir, module)
            os.makedirs(module_dir, exist_ok=True)
            
            # Create multiple files in each module
            files_in_module = min(20, num_files // len(modules))
            for i in range(files_in_module):
                if file_count >= num_files:
                    break
                    
                # Create a Python file with some content
                file_content = f'''
class {module.capitalize()}Service{i}:
    """Service class for {module} functionality."""
    
    def __init__(self):
        self.data = []
        
    def process_data(self, data):
        """Process some data."""
        result = []
        for item in data:
            result.append(self._transform_item(item))
        return result
        
    def _transform_item(self, item):
        """Transform an individual item."""
        return {{'id': item.get('id'), 'processed': True, 'timestamp': time.time()}}
        
    def validate_input(self, data):
        """Validate input data."""
        if not isinstance(data, list):
            raise ValueError("Data must be a list")
        return True
        
    def save_to_database(self, data):
        """Save data to database."""
        # Simulate database operation
        pass
        
    def get_from_database(self, id):
        """Retrieve data from database."""
        # Simulate database operation
        return {{'id': id}}
'''
                
                with open(os.path.join(module_dir, f'{module}_service_{i}.py'), 'w') as f:
                    f.write(file_content)
                file_count += 1
                
        # Create some dependency files
        with open(os.path.join(self.test_repo_dir, 'requirements.txt'), 'w') as f:
            f.write('django==3.2.0\nrequests==2.25.1\nflask==2.0.0\nsqlalchemy==1.4.0\n')
            
        with open(os.path.join(self.test_repo_dir, 'package.json'), 'w') as f:
            f.write('''
{
    "name": "test-project",
    "version": "1.0.0",
    "dependencies": {
        "express": "^4.17.1",
        "lodash": "^4.17.21",
        "react": "^17.0.2"
    }
}
''')
            
        return self.test_repo_dir
        
    def test_analysis_performance_small_repo(self):
        """Test analysis performance on a small repository."""
        # Create a small repository (20 files)
        repo_path = self.create_large_test_repository(20)
        
        analyzer = CodebaseAnalyzer()
        
        # Measure analysis time
        start_time = time.time()
        findings = analyzer.analyze_codebase(repo_path)
        end_time = time.time()
        
        analysis_time = end_time - start_time
        
        # Performance assertions
        self.assertLess(analysis_time, 5.0, "Analysis should complete in under 5 seconds for small repo")
        self.assertIsInstance(findings, list)
        
        print(f"Small repo analysis time: {analysis_time:.2f} seconds")
        
    def test_analysis_performance_medium_repo(self):
        """Test analysis performance on a medium repository."""
        # Create a medium repository (100 files)
        repo_path = self.create_large_test_repository(100)
        
        analyzer = CodebaseAnalyzer()
        
        # Measure analysis time
        start_time = time.time()
        findings = analyzer.analyze_codebase(repo_path)
        end_time = time.time()
        
        analysis_time = end_time - start_time
        
        # Performance assertions
        self.assertLess(analysis_time, 15.0, "Analysis should complete in under 15 seconds for medium repo")
        self.assertIsInstance(findings, list)
        
        print(f"Medium repo analysis time: {analysis_time:.2f} seconds")
        
    def test_suggestion_generation_performance(self):
        """Test suggestion generation performance."""
        # Create test findings
        findings = []
        for i in range(50):
            finding = {
                "type": "god_class" if i % 3 == 0 else "large_module" if i % 3 == 1 else "circular_dependency",
                "description": f"Test finding {i}",
                "severity": "HIGH" if i % 2 == 0 else "MEDIUM",
                "file_path": f"src/module/file_{i}.py",
                "impact_score": 0.8,
                "confidence_score": 0.9
            }
            findings.append(finding)
            
        suggester = RefactoringSuggester()
        
        # Measure suggestion generation time
        start_time = time.time()
        suggestions = suggester.generate_suggestions(findings)
        end_time = time.time()
        
        generation_time = end_time - start_time
        
        # Performance assertions
        self.assertLess(generation_time, 3.0, "Suggestion generation should complete in under 3 seconds")
        self.assertIsInstance(suggestions, list)
        self.assertGreaterEqual(len(suggestions), len(findings))
        
        print(f"Suggestion generation time: {generation_time:.2f} seconds for {len(findings)} findings")
        
    def test_memory_usage_during_analysis(self):
        """Test memory usage during analysis (simplified)."""
        # Create a repository
        repo_path = self.create_large_test_repository(50)
        
        import psutil
        import os as os_utils
        
        # Get process info
        process = psutil.Process(os_utils.getpid())
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB
        
        analyzer = CodebaseAnalyzer()
        findings = analyzer.analyze_codebase(repo_path)
        
        final_memory = process.memory_info().rss / 1024 / 1024  # MB
        memory_increase = final_memory - initial_memory
        
        # Memory usage assertions
        self.assertLess(memory_increase, 100, "Memory usage should not increase by more than 100MB")
        
        print(f"Memory usage: {initial_memory:.2f} MB -> {final_memory:.2f} MB (increase: {memory_increase:.2f} MB)")
        
    def test_concurrent_analysis_simulation(self):
        """Simulate concurrent analysis requests."""
        # Create multiple repositories
        repos = []
        for i in range(3):
            repo_path = self.create_large_test_repository(30)
            repos.append(repo_path)
            
        analyzer = CodebaseAnalyzer()
        results = []
        
        # Process repositories sequentially (simulating concurrent processing)
        start_time = time.time()
        for repo_path in repos:
            findings = analyzer.analyze_codebase(repo_path)
            results.append(findings)
        end_time = time.time()
        
        total_time = end_time - start_time
        
        # Performance assertions
        self.assertLess(total_time, 20.0, "Processing 3 repositories should complete in under 20 seconds")
        self.assertEqual(len(results), 3)
        
        print(f"Sequential processing of 3 repositories: {total_time:.2f} seconds")
        
    def test_analysis_scalability(self):
        """Test how analysis scales with repository size."""
        sizes = [10, 50, 100]
        times = []
        
        for size in sizes:
            repo_path = self.create_large_test_repository(size)
            
            analyzer = CodebaseAnalyzer()
            
            start_time = time.time()
            findings = analyzer.analyze_codebase(repo_path)
            end_time = time.time()
            
            analysis_time = end_time - start_time
            times.append(analysis_time)
            
            print(f"Repository size: {size} files, Analysis time: {analysis_time:.2f} seconds")
            
        # Check that time doesn't increase exponentially
        # For a well-implemented analyzer, time should roughly scale linearly
        if len(times) >= 2:
            # Check that the time for 50 files is not more than 5x the time for 10 files
            self.assertLess(times[1], times[0] * 5, "Analysis time should scale reasonably with repository size")
            
        if len(times) >= 3:
            # Check that the time for 100 files is not more than 3x the time for 50 files
            self.assertLess(times[2], times[1] * 3, "Analysis time should scale reasonably with repository size")

class TestResourceConsumption(unittest.TestCase):
    def test_cpu_usage_during_analysis(self):
        """Test CPU usage during analysis."""
        # This is a simplified test - in a real scenario, you would use
        # more sophisticated profiling tools
        
        import time
        test_dir = tempfile.mkdtemp()
        
        try:
            # Create a moderate-sized repository
            src_dir = os.path.join(test_dir, 'src')
            os.makedirs(src_dir, exist_ok=True)
            
            for i in range(20):
                with open(os.path.join(src_dir, f'service_{i}.py'), 'w') as f:
                    f.write(f'''
class Service{i}:
    def method1(self):
        pass
    def method2(self):
        pass
    def method3(self):
        pass
''')
                    
            analyzer = CodebaseAnalyzer()
            
            # In a real test, you would monitor CPU usage during this call
            start_time = time.time()
            findings = analyzer.analyze_codebase(test_dir)
            end_time = time.time()
            
            analysis_time = end_time - start_time
            print(f"CPU usage test - Analysis completed in {analysis_time:.2f} seconds")
            
            # Basic assertion that analysis completed
            self.assertIsInstance(findings, list)
            
        finally:
            shutil.rmtree(test_dir)

if __name__ == '__main__':
    # Run performance tests
    unittest.main()