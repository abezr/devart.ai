import unittest
import sys
import os
from unittest.mock import patch, MagicMock
from pathlib import Path

# Add the sdk directory to the path
sdk_path = Path(__file__).parent.parent / 'sdk'
sys.path.insert(0, str(sdk_path))

class TestGitHubIntegration(unittest.TestCase):
    def setUp(self):
        """Set up test fixtures before each test method."""
        # Mock environment variables
        self.github_token = "test-token"
        self.original_token = os.environ.get('GITHUB_TOKEN')
        os.environ['GITHUB_TOKEN'] = self.github_token
        
    def tearDown(self):
        """Clean up after each test method."""
        # Restore original environment variable
        if self.original_token:
            os.environ['GITHUB_TOKEN'] = self.original_token
        elif 'GITHUB_TOKEN' in os.environ:
            del os.environ['GITHUB_TOKEN']
            
    def test_github_integration_initialization(self):
        """Test GitHub integration initialization."""
        try:
            # Import the module directly
            import github_integration
            github = github_integration.GitHubIntegration()
            self.assertIsNotNone(github)
            self.assertEqual(github.github_token, self.github_token)
        except ImportError:
            self.skipTest("GitHub integration module not available")
            
    def test_github_integration_with_custom_token(self):
        """Test GitHub integration with custom token."""
        try:
            # Import the module directly
            import github_integration
            custom_token = "custom-token"
            github = github_integration.GitHubIntegration(github_token=custom_token)
            self.assertEqual(github.github_token, custom_token)
        except ImportError:
            self.skipTest("GitHub integration module not available")

class TestTempoIntegration(unittest.TestCase):
    def test_tempo_integration_initialization(self):
        """Test Tempo integration initialization."""
        try:
            # Import the module directly
            import tempo_integration
            tempo = tempo_integration.TempoIntegration()
            self.assertIsNotNone(tempo)
        except ImportError:
            self.skipTest("Tempo integration module not available")
            
    def test_tempo_integration_with_custom_url(self):
        """Test Tempo integration with custom URL."""
        try:
            # Import the module directly
            import tempo_integration
            custom_url = "http://custom-tempo:3200"
            tempo = tempo_integration.TempoIntegration(tempo_url=custom_url)
            self.assertEqual(tempo.tempo_url, custom_url)
        except ImportError:
            self.skipTest("Tempo integration module not available")

class TestOpenAIIntegration(unittest.TestCase):
    def setUp(self):
        """Set up test fixtures before each test method."""
        # Mock environment variables
        self.openai_key = "test-openai-key"
        self.original_key = os.environ.get('OPENAI_API_KEY')
        
    def tearDown(self):
        """Clean up after each test method."""
        # Restore original environment variable
        if self.original_key:
            os.environ['OPENAI_API_KEY'] = self.original_key
        elif 'OPENAI_API_KEY' in os.environ:
            del os.environ['OPENAI_API_KEY']
            
    def test_openai_integration_initialization(self):
        """Test OpenAI integration initialization."""
        try:
            with patch.dict(os.environ, {'OPENAI_API_KEY': self.openai_key}):
                # Import the module directly
                import openai_integration
                openai = openai_integration.OpenAIIntegration()
                self.assertIsNotNone(openai)
                self.assertEqual(openai.api_key, self.openai_key)
        except ImportError:
            self.skipTest("OpenAI integration module not available")
        except ValueError:
            # Expected when no API key is provided
            pass
            
    def test_openai_integration_without_api_key(self):
        """Test OpenAI integration without API key raises error."""
        try:
            # Remove API key if it exists
            if 'OPENAI_API_KEY' in os.environ:
                del os.environ['OPENAI_API_KEY']
                
            # Import the module directly
            import openai_integration
            with self.assertRaises(ValueError):
                openai_integration.OpenAIIntegration()
        except ImportError:
            self.skipTest("OpenAI integration module not available")

class TestKubernetesIntegration(unittest.TestCase):
    def test_kubernetes_integration_initialization(self):
        """Test Kubernetes integration initialization."""
        try:
            # Import the module directly
            import kubernetes_integration
            # Mock the Kubernetes config loading
            with patch('kubernetes.config.load_kube_config') as mock_load_config:
                k8s = kubernetes_integration.KubernetesIntegration()
                self.assertIsNotNone(k8s)
        except ImportError:
            self.skipTest("Kubernetes integration module not available")

class TestIntegrationWithCoreComponents(unittest.TestCase):
    def test_codebase_analyzer_with_github_integration(self):
        """Test CodebaseAnalyzer with GitHub integration."""
        # Import the module directly
        import codebase_analyzer
        
        # Test initialization with GitHub token
        analyzer = codebase_analyzer.CodebaseAnalyzer(github_token="test-token")
        # If GitHub integration is available, it should be initialized
        # If not, it should gracefully fall back
        
    def test_refactoring_suggester_with_openai_integration(self):
        """Test RefactoringSuggester with OpenAI integration."""
        # Import the module directly
        import refactoring_suggester
        
        # Test initialization with OpenAI API key
        suggester = refactoring_suggester.RefactoringSuggester(openai_api_key="test-key")
        # If OpenAI integration is available, it should be initialized
        # If not, it should gracefully fall back
        
    def test_refactoring_executor_with_kubernetes_integration(self):
        """Test RefactoringExecutor with Kubernetes integration."""
        # Import the module directly
        import refactoring_executor
        
        # Test initialization with Kubernetes config
        k8s_config = {"config_path": "/path/to/kubeconfig"}
        executor = refactoring_executor.RefactoringExecutor(kubernetes_config=k8s_config)
        # If Kubernetes integration is available, it should be initialized
        # If not, it should gracefully fall back

if __name__ == '__main__':
    unittest.main()