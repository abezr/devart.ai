import os
import subprocess
import tempfile
import shutil
from typing import Dict, List, Any
from pathlib import Path
import requests
import time

class RefactoringExecutor:
    """Executes approved refactoring suggestions in sandboxed environments."""
    
    def __init__(self, kubernetes_config: Dict = None, github_token: str = None):
        self.kubernetes_config = kubernetes_config or {}
        self.sandbox_url = None
        self.sandbox_id = None
        self.sandbox_info = None
        
        # Initialize Kubernetes integration if config is provided
        if kubernetes_config:
            try:
                from .kubernetes_integration import KubernetesIntegration
                self.kubernetes = KubernetesIntegration(
                    config_path=kubernetes_config.get('config_path'),
                    context=kubernetes_config.get('context')
                )
            except ImportError:
                # Fallback if module is not available
                self.kubernetes = None
                print("Warning: Kubernetes integration module not available")
        else:
            self.kubernetes = None
            
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
            
    def provision_sandbox(self, repository_url: str, branch: str = 'main') -> Dict:
        """
        Provision a sandboxed environment for refactoring execution.
        
        Args:
            repository_url: URL of the repository to clone
            branch: Branch to clone (default: main)
            
        Returns:
            Sandbox provisioning result
        """
        # If Kubernetes integration is available, use it to provision a real sandbox
        if self.kubernetes:
            return self._provision_kubernetes_sandbox(repository_url, branch)
        
        # In a real implementation, this would interact with Kubernetes to create a sandbox
        # For now, we'll simulate the sandbox provisioning
        self.sandbox_id = f"sandbox-{int(time.time())}"
        self.sandbox_url = f"https://sandbox.devart.ai/{self.sandbox_id}"
        
        return {
            "sandbox_id": self.sandbox_id,
            "sandbox_url": self.sandbox_url,
            "status": "PROVISIONING"
        }
        
    def _provision_kubernetes_sandbox(self, repository_url: str, branch: str = 'main') -> Dict:
        """
        Provision a sandboxed environment using Kubernetes.
        
        Args:
            repository_url: URL of the repository to clone
            branch: Branch to clone (default: main)
            
        Returns:
            Sandbox provisioning result
        """
        if not self.kubernetes:
            return self.provision_sandbox(repository_url, branch)
            
        try:
            # Provision the sandbox environment
            sandbox_info = self.kubernetes.provision_sandbox_environment(
                repository_url=repository_url,
                branch=branch
            )
            
            if sandbox_info:
                self.sandbox_info = sandbox_info
                self.sandbox_id = sandbox_info['namespace']
                self.sandbox_url = f"https://sandbox.devart.ai/{self.sandbox_id}"
                
                return {
                    "sandbox_id": self.sandbox_id,
                    "sandbox_url": self.sandbox_url,
                    "namespace": sandbox_info['namespace'],
                    "deployment": sandbox_info['deployment'],
                    "status": "PROVISIONED"
                }
            else:
                return {
                    "sandbox_id": None,
                    "sandbox_url": None,
                    "status": "FAILED",
                    "error": "Failed to provision Kubernetes sandbox"
                }
        except Exception as e:
            print(f"Error provisioning Kubernetes sandbox: {e}")
            return {
                "sandbox_id": None,
                "sandbox_url": None,
                "status": "FAILED",
                "error": str(e)
            }
        
    def execute_refactoring(self, suggestion: Dict, repository_url: str, branch: str = 'main') -> Dict:
        """
        Execute a refactoring suggestion in the sandbox.
        
        Args:
            suggestion: Refactoring suggestion to execute
            repository_url: URL of the repository
            branch: Branch to work on (default: main)
            
        Returns:
            Execution result
        """
        try:
            # Provision sandbox if not already done
            if not self.sandbox_id:
                sandbox_result = self.provision_sandbox(repository_url, branch)
                if sandbox_result.get('status') != 'PROVISIONING':
                    return {
                        "success": False,
                        "error": "Failed to provision sandbox",
                        "sandbox_id": self.sandbox_id
                    }
                    
            # Clone repository in sandbox
            clone_result = self._clone_repository_in_sandbox(repository_url, branch)
            if not clone_result.get('success'):
                return {
                    "success": False,
                    "error": "Failed to clone repository in sandbox",
                    "sandbox_id": self.sandbox_id
                }
                
            # Apply refactoring steps
            implementation_plan = suggestion.get('implementation_plan', [])
            changes = []
            
            for step in implementation_plan:
                change_result = self._apply_refactoring_step(step)
                if change_result.get('success'):
                    changes.append(change_result)
                else:
                    # Rollback changes if any step fails
                    self._rollback_changes(changes)
                    return {
                        "success": False,
                        "error": f"Failed to apply refactoring step: {step}",
                        "sandbox_id": self.sandbox_id,
                        "changes": changes
                    }
                    
            # Run tests to validate changes
            test_result = self._run_tests()
            if not test_result.get('success'):
                # Rollback changes if tests fail
                self._rollback_changes(changes)
                return {
                    "success": False,
                    "error": "Tests failed after applying refactoring",
                    "sandbox_id": self.sandbox_id,
                    "changes": changes,
                    "test_results": test_result
                }
                
            # Generate performance comparison
            performance_result = self._generate_performance_comparison()
            
            return {
                "success": True,
                "sandbox_id": self.sandbox_id,
                "changes": changes,
                "test_results": test_result,
                "performance_comparison": performance_result
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "sandbox_id": self.sandbox_id
            }
            
    def _clone_repository_in_sandbox(self, repository_url: str, branch: str) -> Dict:
        """
        Clone repository in the sandbox environment.
        
        Args:
            repository_url: URL of the repository to clone
            branch: Branch to clone
            
        Returns:
            Cloning result
        """
        # If Kubernetes sandbox is available, execute in the sandbox
        if self.kubernetes and self.sandbox_info:
            return self._clone_in_kubernetes_sandbox(repository_url, branch)
        
        try:
            # Simulate successful cloning
            return {
                "success": True,
                "message": f"Repository {repository_url} cloned successfully in sandbox"
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to clone repository: {str(e)}"
            }
            
    def _clone_in_kubernetes_sandbox(self, repository_url: str, branch: str) -> Dict:
        """
        Clone repository in the Kubernetes sandbox environment.
        
        Args:
            repository_url: URL of the repository to clone
            branch: Branch to clone
            
        Returns:
            Cloning result
        """
        if not self.kubernetes or not self.sandbox_info:
            return self._clone_repository_in_sandbox(repository_url, branch)
            
        try:
            namespace = self.sandbox_info['namespace']
            deployment = self.sandbox_info['deployment']
            
            # Get the pod name for the deployment
            pod_name = self.kubernetes.get_sandbox_pod_name(namespace, deployment)
            if not pod_name:
                return {
                    "success": False,
                    "error": "Could not find sandbox pod"
                }
                
            # Execute git clone command in the pod
            clone_command = [
                "git", "clone", 
                "--branch", branch, 
                "--single-branch", 
                repository_url, 
                "/workspace"
            ]
            
            result = self.kubernetes.execute_command_in_sandbox(
                namespace=namespace,
                pod_name=pod_name,
                command=clone_command
            )
            
            if result and result.get('success'):
                return {
                    "success": True,
                    "message": f"Repository {repository_url} cloned successfully in Kubernetes sandbox"
                }
            else:
                return {
                    "success": False,
                    "error": result.get('error', 'Unknown error during cloning')
                }
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to clone repository in Kubernetes sandbox: {str(e)}"
            }
            
    def _apply_refactoring_step(self, step: str) -> Dict:
        """
        Apply a single refactoring step.
        
        Args:
            step: Description of the refactoring step
            
        Returns:
            Step application result
        """
        # In a real implementation, this would perform actual code changes
        # For now, we'll simulate the application
        try:
            # Simulate successful step application
            return {
                "success": True,
                "step": step,
                "message": f"Step '{step}' applied successfully"
            }
        except Exception as e:
            return {
                "success": False,
                "step": step,
                "error": f"Failed to apply step: {str(e)}"
            }
            
    def _rollback_changes(self, changes: List[Dict]):
        """
        Rollback applied changes.
        
        Args:
            changes: List of applied changes to rollback
        """
        # In a real implementation, this would rollback the changes
        # For now, we'll just log the rollback
        print(f"Rolling back {len(changes)} changes in sandbox {self.sandbox_id}")
        for change in changes:
            print(f"  Rolling back: {change.get('step', 'unknown step')}")
            
    def _run_tests(self) -> Dict:
        """
        Run tests to validate refactoring.
        
        Returns:
            Test results
        """
        # In a real implementation, this would run actual tests
        # For now, we'll simulate test execution
        try:
            # Simulate test results
            return {
                "success": True,
                "passed": 42,
                "failed": 0,
                "skipped": 3,
                "message": "All tests passed"
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"Tests failed: {str(e)}",
                "passed": 0,
                "failed": 15,
                "skipped": 0
            }
            
    def _generate_performance_comparison(self) -> Dict:
        """
        Generate performance comparison before and after refactoring.
        
        Returns:
            Performance comparison results
        """
        # In a real implementation, this would run performance tests
        # For now, we'll simulate performance comparison
        return {
            "before": {
                "response_time_ms": 150,
                "memory_usage_mb": 128,
                "cpu_usage_percent": 45
            },
            "after": {
                "response_time_ms": 120,
                "memory_usage_mb": 110,
                "cpu_usage_percent": 38
            },
            "improvement": {
                "response_time": "20% improvement",
                "memory_usage": "14% improvement",
                "cpu_usage": "15% improvement"
            }
        }
        
    def commit_changes(self, commit_message: str) -> Dict:
        """
        Commit changes to the repository.
        
        Args:
            commit_message: Commit message
            
        Returns:
            Commit result
        """
        # In a real implementation, this would commit changes to the repository
        # For now, we'll simulate the commit
        try:
            return {
                "success": True,
                "commit_hash": "abc123def456",
                "message": f"Changes committed successfully: {commit_message}"
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to commit changes: {str(e)}"
            }
            
    def create_pull_request(self, title: str, description: str, branch: str = 'refactoring') -> Dict:
        """
        Create a pull request for the refactoring.
        
        Args:
            title: Pull request title
            description: Pull request description
            branch: Branch to create pull request from
            
        Returns:
            Pull request result
        """
        # In a real implementation, this would create a pull request
        # For now, we'll simulate the pull request creation
        try:
            return {
                "success": True,
                "pr_number": 123,
                "pr_url": "https://github.com/example/repo/pull/123",
                "message": f"Pull request created successfully: {title}"
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to create pull request: {str(e)}"
            }
            
    def cleanup_sandbox(self):
        """
        Clean up the sandbox environment.
        """
        # If Kubernetes sandbox is available, clean it up
        if self.kubernetes and self.sandbox_info:
            try:
                self.kubernetes.cleanup_sandbox_environment(self.sandbox_info['namespace'])
                print(f"Kubernetes sandbox {self.sandbox_info['namespace']} cleaned up")
            except Exception as e:
                print(f"Error cleaning up Kubernetes sandbox: {e}")
        
        # In a real implementation, this would clean up the Kubernetes resources
        # For now, we'll just reset the sandbox information
        self.sandbox_id = None
        self.sandbox_url = None
        self.sandbox_info = None
        print("Sandbox environment cleaned up")