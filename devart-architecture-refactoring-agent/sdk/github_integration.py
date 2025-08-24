import os
import requests
from typing import Dict, Any, Optional
import base64
import time

class GitHubIntegration:
    """Integrates with GitHub API for repository access and management."""
    
    def __init__(self, github_token: str = None):
        self.github_token = github_token or os.getenv('GITHUB_TOKEN')
        self.base_url = "https://api.github.com"
        self.headers = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "devart-architecture-refactoring-agent"
        }
        if self.github_token:
            self.headers["Authorization"] = f"token {self.github_token}"
        
    def get_repository_info(self, owner: str, repo: str) -> Optional[Dict]:
        """
        Get information about a GitHub repository.
        
        Args:
            owner: Repository owner
            repo: Repository name
            
        Returns:
            Repository information or None if failed
        """
        url = f"{self.base_url}/repos/{owner}/{repo}"
        try:
            response = requests.get(url, headers=self.headers)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            print(f"Error fetching repository info: {e}")
            return None
            
    def get_file_content(self, owner: str, repo: str, path: str, ref: str = "main") -> Optional[str]:
        """
        Get the content of a file from a GitHub repository.
        
        Args:
            owner: Repository owner
            repo: Repository name
            path: Path to the file
            ref: Git reference (branch, tag, or commit SHA)
            
        Returns:
            File content as string or None if failed
        """
        url = f"{self.base_url}/repos/{owner}/{repo}/contents/{path}"
        params = {"ref": ref}
        try:
            response = requests.get(url, headers=self.headers, params=params)
            response.raise_for_status()
            data = response.json()
            
            # Decode base64 content
            content = base64.b64decode(data["content"]).decode("utf-8")
            return content
        except requests.RequestException as e:
            print(f"Error fetching file content: {e}")
            return None
            
    def get_repository_tree(self, owner: str, repo: str, ref: str = "main") -> Optional[Dict]:
        """
        Get the file tree of a GitHub repository.
        
        Args:
            owner: Repository owner
            repo: Repository name
            ref: Git reference (branch, tag, or commit SHA)
            
        Returns:
            Repository tree or None if failed
        """
        url = f"{self.base_url}/repos/{owner}/{repo}/git/trees/{ref}"
        params = {"recursive": "true"}
        try:
            response = requests.get(url, headers=self.headers, params=params)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            print(f"Error fetching repository tree: {e}")
            return None
            
    def create_branch(self, owner: str, repo: str, branch_name: str, base_sha: str) -> Optional[Dict]:
        """
        Create a new branch in a GitHub repository.
        
        Args:
            owner: Repository owner
            repo: Repository name
            branch_name: Name of the new branch
            base_sha: SHA of the commit to base the branch on
            
        Returns:
            Branch information or None if failed
        """
        url = f"{self.base_url}/repos/{owner}/{repo}/git/refs"
        payload = {
            "ref": f"refs/heads/{branch_name}",
            "sha": base_sha
        }
        try:
            response = requests.post(url, headers=self.headers, json=payload)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            print(f"Error creating branch: {e}")
            return None
            
    def create_commit(self, owner: str, repo: str, message: str, tree_sha: str, parent_sha: str) -> Optional[Dict]:
        """
        Create a new commit in a GitHub repository.
        
        Args:
            owner: Repository owner
            repo: Repository name
            message: Commit message
            tree_sha: SHA of the tree for the commit
            parent_sha: SHA of the parent commit
            
        Returns:
            Commit information or None if failed
        """
        url = f"{self.base_url}/repos/{owner}/{repo}/git/commits"
        payload = {
            "message": message,
            "tree": tree_sha,
            "parents": [parent_sha]
        }
        try:
            response = requests.post(url, headers=self.headers, json=payload)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            print(f"Error creating commit: {e}")
            return None
            
    def create_pull_request(self, owner: str, repo: str, title: str, head: str, base: str, body: str = "") -> Optional[Dict]:
        """
        Create a new pull request in a GitHub repository.
        
        Args:
            owner: Repository owner
            repo: Repository name
            title: Pull request title
            head: Name of the branch where your changes are implemented
            base: Name of the branch you want the changes pulled into
            body: Pull request description
            
        Returns:
            Pull request information or None if failed
        """
        url = f"{self.base_url}/repos/{owner}/{repo}/pulls"
        payload = {
            "title": title,
            "head": head,
            "base": base,
            "body": body
        }
        try:
            response = requests.post(url, headers=self.headers, json=payload)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            print(f"Error creating pull request: {e}")
            return None
            
    def get_rate_limit(self) -> Optional[Dict]:
        """
        Get the current rate limit status.
        
        Returns:
            Rate limit information or None if failed
        """
        url = f"{self.base_url}/rate_limit"
        try:
            response = requests.get(url, headers=self.headers)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            print(f"Error fetching rate limit: {e}")
            return None
            
    def handle_rate_limiting(self):
        """Handle rate limiting by waiting if necessary."""
        rate_limit = self.get_rate_limit()
        if rate_limit and "resources" in rate_limit:
            core_limit = rate_limit["resources"]["core"]
            remaining = core_limit["remaining"]
            reset_time = core_limit["reset"]
            
            if remaining < 10:  # If we're running low on requests
                current_time = time.time()
                sleep_time = max(0, reset_time - current_time) + 1
                print(f"Rate limit approaching, sleeping for {sleep_time} seconds")
                time.sleep(sleep_time)