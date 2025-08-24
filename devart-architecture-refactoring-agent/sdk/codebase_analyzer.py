import os
import subprocess
import tempfile
import shutil
from typing import Dict, List, Any
from pathlib import Path
import ast
import json

class CodebaseAnalyzer:
    """Analyzes codebase structure to identify architectural patterns and anti-patterns."""
    
    def __init__(self, github_token: str = None):
        self.supported_languages = ['python', 'javascript', 'typescript']
        self.findings = []
        # Initialize GitHub integration if token is provided
        if github_token:
            try:
                from .github_integration import GitHubIntegration
                self.github = GitHubIntegration(github_token)
            except ImportError:
                # Fallback if module is not available
                self.github = None
                print("Warning: GitHub integration module not available")
        else:
            self.github = None
            
    def clone_repository(self, repository_url: str, branch: str = 'main') -> str:
        """
        Clone a repository to a temporary directory.
        
        Args:
            repository_url: URL of the repository to clone
            branch: Branch to clone (default: main)
            
        Returns:
            Path to the cloned repository
        """
        # If GitHub integration is available and this is a GitHub URL, try to use it
        if self.github and "github.com" in repository_url:
            return self._clone_from_github(repository_url, branch)
        
        temp_dir = tempfile.mkdtemp()
        try:
            # Clone the repository
            subprocess.run([
                'git', 'clone', '--branch', branch, '--single-branch', 
                repository_url, temp_dir
            ], check=True, capture_output=True, text=True)
            return temp_dir
        except subprocess.CalledProcessError as e:
            print(f"Error cloning repository: {e}")
            shutil.rmtree(temp_dir)
            return None
            
    def _clone_from_github(self, repository_url: str, branch: str = 'main') -> str:
        """
        Clone a repository from GitHub using the GitHub API.
        
        Args:
            repository_url: URL of the GitHub repository
            branch: Branch to clone (default: main)
            
        Returns:
            Path to the cloned repository
        """
        if not self.github:
            # Fall back to git CLI if GitHub integration is not available
            return self.clone_repository(repository_url, branch)
            
        # Parse repository URL to get owner and repo name
        # Example: https://github.com/owner/repo
        try:
            parts = repository_url.strip('/').split('/')
            owner = parts[-2]
            repo = parts[-1]
            if repo.endswith('.git'):
                repo = repo[:-4]
        except Exception as e:
            print(f"Error parsing GitHub URL: {e}")
            return self.clone_repository(repository_url, branch)
            
        temp_dir = tempfile.mkdtemp()
        try:
            # Get repository tree
            tree = self.github.get_repository_tree(owner, repo, branch)
            if not tree:
                print("Failed to get repository tree from GitHub API")
                return self.clone_repository(repository_url, branch)
                
            # Create directory structure and download files
            for item in tree.get('tree', []):
                if item['type'] == 'blob':  # File
                    file_path = Path(temp_dir) / item['path']
                    file_path.parent.mkdir(parents=True, exist_ok=True)
                    
                    # Get file content
                    content = self.github.get_file_content(owner, repo, item['path'], branch)
                    if content is not None:
                        with open(file_path, 'w', encoding='utf-8') as f:
                            f.write(content)
                    else:
                        # Create empty file if content couldn't be fetched
                        file_path.touch()
                        
            return str(temp_dir)
        except Exception as e:
            print(f"Error cloning from GitHub: {e}")
            shutil.rmtree(temp_dir, ignore_errors=True)
            # Fall back to git CLI
            return self.clone_repository(repository_url, branch)
    
    def analyze_codebase(self, repo_path: str, target_modules: List[str] = None) -> List[Dict]:
        """
        Analyze the codebase structure and identify architectural patterns.
        
        Args:
            repo_path: Path to the repository
            target_modules: Specific modules to analyze (optional)
            
        Returns:
            List of findings
        """
        self.findings = []
        
        # Analyze directory structure
        self._analyze_directory_structure(repo_path, target_modules)
        
        # Analyze dependencies
        self._analyze_dependencies(repo_path)
        
        # Analyze code quality
        self._analyze_code_quality(repo_path)
        
        # Analyze architectural patterns
        self._analyze_architectural_patterns(repo_path)
        
        return self.findings
        
    def _analyze_directory_structure(self, repo_path: str, target_modules: List[str] = None):
        """Analyze the directory structure for common patterns."""
        path = Path(repo_path)
        
        # Check for common project structure patterns
        if (path / 'src').exists():
            self._check_for_mvc_pattern(path / 'src')
            self._check_for_microservices_pattern(path)
            
        # If specific modules are targeted, focus on those
        if target_modules:
            for module in target_modules:
                module_path = path / module
                if module_path.exists():
                    self._analyze_module_structure(module_path)
        else:
            # Analyze all modules
            for item in path.iterdir():
                if item.is_dir() and not item.name.startswith('.'):
                    self._analyze_module_structure(item)
                    
    def _analyze_module_structure(self, module_path: Path):
        """Analyze a specific module's structure."""
        # Check for circular dependencies between files
        self._check_circular_dependencies(module_path)
        
        # Check for large modules
        file_count = sum(1 for _ in module_path.rglob('*') if _.is_file())
        if file_count > 100:
            self.findings.append({
                "type": "large_module",
                "severity": "MEDIUM",
                "description": f"Module {module_path.name} contains {file_count} files, which may indicate it's doing too much",
                "file_path": str(module_path.relative_to(module_path.parent.parent)),
                "impact_score": 0.6,
                "confidence_score": 0.8
            })
            
    def _check_circular_dependencies(self, module_path: Path):
        """Check for circular dependencies in Python files."""
        if module_path.suffix == '.py':
            try:
                with open(module_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                tree = ast.parse(content)
                
                # This is a simplified check - a full implementation would be more complex
                # For now, we'll just look for obvious patterns
                imports = [node for node in ast.walk(tree) if isinstance(node, (ast.Import, ast.ImportFrom))]
                for imp in imports:
                    if isinstance(imp, ast.ImportFrom) and imp.module:
                        # Check if this might create a circular dependency
                        # This is a very basic check - a real implementation would be more sophisticated
                        pass
            except Exception as e:
                print(f"Error analyzing {module_path}: {e}")
                
    def _check_for_mvc_pattern(self, src_path: Path):
        """Check if the project follows MVC pattern."""
        mvc_dirs = ['models', 'views', 'controllers']
        found_dirs = [d for d in mvc_dirs if (src_path / d).exists()]
        
        if len(found_dirs) >= 2:
            self.findings.append({
                "type": "mvc_pattern",
                "severity": "INFO",
                "description": f"Project appears to follow MVC pattern with directories: {', '.join(found_dirs)}",
                "file_path": str(src_path.relative_to(src_path.parent.parent)),
                "impact_score": 0.1,
                "confidence_score": 0.9
            })
            
    def _check_for_microservices_pattern(self, repo_path: Path):
        """Check if the project follows microservices pattern."""
        # Look for service directories or docker-compose files
        services_dir = repo_path / 'services'
        docker_compose = repo_path / 'docker-compose.yml'
        
        if services_dir.exists() or docker_compose.exists():
            self.findings.append({
                "type": "microservices_pattern",
                "severity": "INFO",
                "description": "Project appears to follow microservices pattern",
                "file_path": str(repo_path.relative_to(repo_path.parent)),
                "impact_score": 0.1,
                "confidence_score": 0.8
            })
            
    def _analyze_dependencies(self, repo_path: Path):
        """Analyze project dependencies."""
        # Check for requirements.txt (Python)
        requirements_file = repo_path / 'requirements.txt'
        if requirements_file.exists():
            self._analyze_python_dependencies(requirements_file)
            
        # Check for package.json (JavaScript/TypeScript)
        package_file = repo_path / 'package.json'
        if package_file.exists():
            self._analyze_js_dependencies(package_file)
            
    def _analyze_python_dependencies(self, requirements_file: Path):
        """Analyze Python dependencies."""
        try:
            with open(requirements_file, 'r') as f:
                dependencies = f.readlines()
                
            # Check for potentially problematic dependencies
            for dep in dependencies:
                dep = dep.strip()
                if dep and not dep.startswith('#'):
                    # Check for very large frameworks that might indicate monolithic design
                    if 'django' in dep.lower() or 'flask' in dep.lower():
                        self.findings.append({
                            "type": "monolithic_framework",
                            "severity": "LOW",
                            "description": f"Project uses {dep}, which may indicate monolithic design",
                            "file_path": str(requirements_file.relative_to(requirements_file.parent.parent)),
                            "impact_score": 0.3,
                            "confidence_score": 0.7
                        })
        except Exception as e:
            print(f"Error analyzing Python dependencies: {e}")
            
    def _analyze_js_dependencies(self, package_file: Path):
        """Analyze JavaScript/TypeScript dependencies."""
        try:
            with open(package_file, 'r') as f:
                package_data = json.load(f)
                
            dependencies = package_data.get('dependencies', {})
            dev_dependencies = package_data.get('devDependencies', {})
            
            # Check for large frameworks
            large_frameworks = ['react', 'vue', 'angular']
            for framework in large_frameworks:
                if any(framework in dep.lower() for dep in dependencies.keys()):
                    self.findings.append({
                        "type": "frontend_framework",
                        "severity": "INFO",
                        "description": f"Project uses {framework} frontend framework",
                        "file_path": str(package_file.relative_to(package_file.parent.parent)),
                        "impact_score": 0.1,
                        "confidence_score": 0.9
                    })
        except Exception as e:
            print(f"Error analyzing JavaScript dependencies: {e}")
            
    def _analyze_code_quality(self, repo_path: Path):
        """Analyze code quality metrics."""
        # Find all Python files
        python_files = list(repo_path.rglob('*.py'))
        
        for py_file in python_files:
            self._analyze_python_file(py_file)
            
    def _analyze_python_file(self, py_file: Path):
        """Analyze a Python file for code quality issues."""
        try:
            with open(py_file, 'r', encoding='utf-8') as f:
                content = f.read()
                
            # Parse the AST
            tree = ast.parse(content)
            
            # Check for large classes (God classes)
            classes = [node for node in tree.body if isinstance(node, ast.ClassDef)]
            for cls in classes:
                method_count = len([n for n in cls.body if isinstance(n, ast.FunctionDef)])
                if method_count > 10:
                    self.findings.append({
                        "type": "god_class",
                        "severity": "HIGH",
                        "description": f"Class {cls.name} has {method_count} methods, which may indicate it's doing too much",
                        "file_path": str(py_file.relative_to(py_file.parent.parent)),
                        "line_number": cls.lineno,
                        "impact_score": 0.8,
                        "confidence_score": 0.9
                    })
                    
            # Check for long functions
            functions = [node for node in ast.walk(tree) if isinstance(node, ast.FunctionDef)]
            for func in functions:
                if hasattr(func, 'end_lineno') and func.end_lineno:
                    line_count = func.end_lineno - func.lineno
                    if line_count > 50:
                        self.findings.append({
                            "type": "long_function",
                            "severity": "MEDIUM",
                            "description": f"Function {func.name} has {line_count} lines, which may be too long",
                            "file_path": str(py_file.relative_to(py_file.parent.parent)),
                            "line_number": func.lineno,
                            "impact_score": 0.5,
                            "confidence_score": 0.8
                        })
                        
        except Exception as e:
            print(f"Error analyzing Python file {py_file}: {e}")
            
    def _analyze_architectural_patterns(self, repo_path: Path):
        """Analyze for common architectural patterns and anti-patterns."""
        # Check for common anti-patterns
        self._check_for_anti_patterns(repo_path)
        
    def _check_for_anti_patterns(self, repo_path: Path):
        """Check for common architectural anti-patterns."""
        # Look for utility classes that do too much
        python_files = list(repo_path.rglob('*.py'))
        
        for py_file in python_files:
            if 'utils' in py_file.name.lower() or 'helpers' in py_file.name.lower():
                try:
                    with open(py_file, 'r', encoding='utf-8') as f:
                        content = f.read()
                    tree = ast.parse(content)
                    
                    # Count functions in utility files
                    functions = [node for node in ast.walk(tree) if isinstance(node, ast.FunctionDef)]
                    if len(functions) > 20:
                        self.findings.append({
                            "type": "utility_class_overload",
                            "severity": "MEDIUM",
                            "description": f"Utility file {py_file.name} contains {len(functions)} functions, which may indicate it's doing too much",
                            "file_path": str(py_file.relative_to(py_file.parent.parent)),
                            "impact_score": 0.6,
                            "confidence_score": 0.8
                        })
                except Exception as e:
                    print(f"Error analyzing utility file {py_file}: {e}")