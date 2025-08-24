import os
import requests
from typing import List, Dict, Any

class RefactoringSuggester:
    """Generates AI-driven refactoring suggestions based on analysis findings."""
    
    def __init__(self, openai_api_key: str = None):
        self.openai_api_key = openai_api_key or os.getenv('OPENAI_API_KEY')
        self.suggestions = []
        # Initialize OpenAI integration if API key is provided
        if self.openai_api_key:
            try:
                from .openai_integration import OpenAIIntegration
                self.openai = OpenAIIntegration(self.openai_api_key)
            except ImportError:
                # Fallback if module is not available
                self.openai = None
                print("Warning: OpenAI integration module not available")
        else:
            self.openai = None
            
    def generate_suggestions(self, findings: List[Dict], repository_context: Dict = None) -> List[Dict]:
        """
        Generate refactoring suggestions based on analysis findings.
        
        Args:
            findings: List of architectural findings
            repository_context: Additional context about the repository
            
        Returns:
            List of refactoring suggestions
        """
        self.suggestions = []
        
        # If OpenAI integration is available, use it to generate AI-driven suggestions
        if self.openai:
            return self._generate_ai_suggestions(findings, repository_context)
        
        # Generate suggestions for each finding
        for finding in findings:
            suggestion = self._generate_suggestion_for_finding(finding, repository_context)
            if suggestion:
                self.suggestions.append(suggestion)
                
        # Generate additional general suggestions
        general_suggestions = self._generate_general_suggestions(findings, repository_context)
        self.suggestions.extend(general_suggestions)
        
        return self.suggestions
        
    def _generate_ai_suggestions(self, findings: List[Dict], repository_context: Dict = None) -> List[Dict]:
        """
        Generate AI-driven refactoring suggestions using OpenAI.
        
        Args:
            findings: List of architectural findings
            repository_context: Additional context about the repository
            
        Returns:
            List of AI-generated refactoring suggestions
        """
        ai_suggestions = []
        
        # Generate suggestions for each finding using OpenAI
        for finding in findings:
            # Get code context for the finding
            code_context = self._get_code_context(finding, repository_context)
            
            # Generate AI-driven suggestion
            ai_suggestion = self.openai.generate_refactoring_suggestion(finding, code_context)
            if ai_suggestion:
                # Add reference to the original finding
                ai_suggestion['related_finding_id'] = finding.get('id')
                ai_suggestions.append(ai_suggestion)
                
        # Generate additional general suggestions
        general_suggestions = self._generate_general_suggestions(findings, repository_context)
        ai_suggestions.extend(general_suggestions)
        
        return ai_suggestions
        
    def _get_code_context(self, finding: Dict, repository_context: Dict = None) -> str:
        """
        Get code context for a finding to provide better suggestions.
        
        Args:
            finding: The architectural finding
            repository_context: Additional context about the repository
            
        Returns:
            Code context as string
        """
        # This is a simplified implementation
        # In a real implementation, you would fetch actual code snippets
        file_path = finding.get('file_path', 'unknown')
        return f"File: {file_path}\nIssue: {finding.get('description', 'Unknown issue')}"
        
    def _generate_suggestion_for_finding(self, finding: Dict, repository_context: Dict = None) -> Dict:
        """Generate a specific suggestion for a finding."""
        finding_type = finding.get('type')
        
        if finding_type == 'god_class':
            return self._suggest_god_class_refactoring(finding)
        elif finding_type == 'circular_dependency':
            return self._suggest_circular_dependency_refactoring(finding)
        elif finding_type == 'long_function':
            return self._suggest_long_function_refactoring(finding)
        elif finding_type == 'large_module':
            return self._suggest_large_module_refactoring(finding)
        elif finding_type == 'utility_class_overload':
            return self._suggest_utility_class_refactoring(finding)
        else:
            # For unknown finding types, generate a generic suggestion
            return self._generate_generic_suggestion(finding)
            
    def _suggest_god_class_refactoring(self, finding: Dict) -> Dict:
        """Generate suggestion for god class refactoring."""
        class_name = finding.get('file_path', 'unknown').split('/')[-1].replace('.py', '')
        
        return {
            "title": "Split God Class",
            "description": f"Break down the {class_name} class into smaller, focused classes",
            "complexity": "HIGH",
            "impact": "HIGH",
            "priority": "CRITICAL",
            "implementation_plan": [
                "Identify distinct responsibilities in the class",
                "Create new classes for each responsibility",
                "Move related methods and properties to new classes",
                "Update existing code to use new classes",
                "Update tests and documentation"
            ],
            "estimated_effort_hours": 12.0,
            "related_finding_id": finding.get('id')
        }
        
    def _suggest_circular_dependency_refactoring(self, finding: Dict) -> Dict:
        """Generate suggestion for circular dependency refactoring."""
        return {
            "title": "Break Circular Dependency",
            "description": "Refactor to eliminate circular dependency between modules",
            "complexity": "MEDIUM",
            "impact": "HIGH",
            "priority": "HIGH",
            "implementation_plan": [
                "Create a new common module for shared functionality",
                "Move shared functions to the new module",
                "Update import statements in both modules",
                "Verify that the circular dependency is resolved"
            ],
            "estimated_effort_hours": 4.5,
            "related_finding_id": finding.get('id')
        }
        
    def _suggest_long_function_refactoring(self, finding: Dict) -> Dict:
        """Generate suggestion for long function refactoring."""
        return {
            "title": "Extract Method",
            "description": "Break down long function into smaller, more manageable methods",
            "complexity": "LOW",
            "impact": "MEDIUM",
            "priority": "MEDIUM",
            "implementation_plan": [
                "Identify logical sections within the function",
                "Extract each section into a separate method",
                "Pass necessary parameters to the new methods",
                "Replace original code with calls to new methods",
                "Update tests if necessary"
            ],
            "estimated_effort_hours": 2.0,
            "related_finding_id": finding.get('id')
        }
        
    def _suggest_large_module_refactoring(self, finding: Dict) -> Dict:
        """Generate suggestion for large module refactoring."""
        module_name = finding.get('file_path', 'unknown').split('/')[-1]
        
        return {
            "title": "Split Large Module",
            "description": f"Break down the large {module_name} module into smaller, focused modules",
            "complexity": "HIGH",
            "impact": "HIGH",
            "priority": "HIGH",
            "implementation_plan": [
                "Identify logical groupings of functionality",
                "Create new modules for each group",
                "Move related code to new modules",
                "Update import statements throughout the codebase",
                "Verify that all functionality still works correctly"
            ],
            "estimated_effort_hours": 16.0,
            "related_finding_id": finding.get('id')
        }
        
    def _suggest_utility_class_refactoring(self, finding: Dict) -> Dict:
        """Generate suggestion for utility class refactoring."""
        return {
            "title": "Organize Utility Functions",
            "description": "Reorganize utility functions into logically grouped modules",
            "complexity": "MEDIUM",
            "impact": "MEDIUM",
            "priority": "MEDIUM",
            "implementation_plan": [
                "Categorize utility functions by purpose",
                "Create new modules for each category",
                "Move functions to appropriate modules",
                "Update import statements throughout the codebase",
                "Remove the overloaded utility file"
            ],
            "estimated_effort_hours": 6.0,
            "related_finding_id": finding.get('id')
        }
        
    def _generate_generic_suggestion(self, finding: Dict) -> Dict:
        """Generate a generic suggestion for unknown finding types."""
        finding_type = finding.get('type', 'unknown')
        
        return {
            "title": f"Address {finding_type.replace('_', ' ').title()}",
            "description": finding.get('description', 'Refactor to improve code quality'),
            "complexity": "MEDIUM",
            "impact": "MEDIUM",
            "priority": finding.get('severity', 'MEDIUM'),
            "implementation_plan": [
                "Analyze the issue in detail",
                "Design an appropriate solution",
                "Implement the solution",
                "Test the changes",
                "Update documentation if necessary"
            ],
            "estimated_effort_hours": 4.0,
            "related_finding_id": finding.get('id')
        }
        
    def _generate_general_suggestions(self, findings: List[Dict], repository_context: Dict = None) -> List[Dict]:
        """Generate general architectural improvement suggestions."""
        suggestions = []
        
        # Suggestion for adding tests
        suggestions.append({
            "title": "Improve Test Coverage",
            "description": "Add comprehensive tests to ensure code quality and prevent regressions",
            "complexity": "MEDIUM",
            "impact": "HIGH",
            "priority": "HIGH",
            "implementation_plan": [
                "Identify areas with low test coverage",
                "Write unit tests for critical functions",
                "Add integration tests for key workflows",
                "Set up continuous integration to run tests automatically",
                "Monitor test coverage metrics"
            ],
            "estimated_effort_hours": 20.0
        })
        
        # Suggestion for documentation
        suggestions.append({
            "title": "Enhance Documentation",
            "description": "Improve code documentation to make it easier for developers to understand and maintain",
            "complexity": "LOW",
            "impact": "MEDIUM",
            "priority": "MEDIUM",
            "implementation_plan": [
                "Add docstrings to all classes and functions",
                "Create README files for each module",
                "Document the architecture and design decisions",
                "Set up automated documentation generation",
                "Regularly update documentation as code changes"
            ],
            "estimated_effort_hours": 8.0
        })
        
        return suggestions
        
    def prioritize_suggestions(self, suggestions: List[Dict]) -> List[Dict]:
        """
        Prioritize refactoring suggestions based on impact, complexity, and risk.
        
        Args:
            suggestions: List of refactoring suggestions
            
        Returns:
            Prioritized list of suggestions
        """
        # If OpenAI integration is available, use it for AI-driven prioritization
        if self.openai:
            try:
                return self.openai.prioritize_suggestions(suggestions)
            except Exception as e:
                print(f"Error prioritizing suggestions with OpenAI: {e}")
                # Fall back to manual prioritization
                pass
                
        # Manual prioritization based on priority field
        priority_order = {"CRITICAL": 4, "HIGH": 3, "MEDIUM": 2, "LOW": 1}
        
        def get_priority_score(suggestion):
            priority = suggestion.get('priority', 'MEDIUM')
            return priority_order.get(priority, 2)
            
        return sorted(suggestions, key=get_priority_score, reverse=True)
        
    def score_suggestions(self, suggestions: List[Dict], codebase_context: Dict = None) -> List[Dict]:
        """
        Score refactoring suggestions based on impact, complexity, and risk.
        
        Args:
            suggestions: List of refactoring suggestions
            codebase_context: Additional context about the codebase
            
        Returns:
            Scored list of suggestions
        """
        scored_suggestions = []
        
        # If OpenAI integration is available, use it for AI-driven scoring
        if self.openai:
            for suggestion in suggestions:
                try:
                    scored_suggestion = self.openai.score_suggestion(suggestion, codebase_context)
                    scored_suggestions.append(scored_suggestion)
                except Exception as e:
                    print(f"Error scoring suggestion with OpenAI: {e}")
                    # Add default scores if AI scoring fails
                    suggestion_with_scores = suggestion.copy()
                    suggestion_with_scores.update({
                        "impact_score": 0.5,
                        "complexity_score": 0.5,
                        "risk_score": 0.5,
                        "confidence_score": 0.7
                    })
                    scored_suggestions.append(suggestion_with_scores)
            return scored_suggestions
            
        # Manual scoring if OpenAI is not available
        for suggestion in suggestions:
            suggestion_with_scores = suggestion.copy()
            suggestion_with_scores.update({
                "impact_score": 0.5,
                "complexity_score": 0.5,
                "risk_score": 0.5,
                "confidence_score": 0.7
            })
            scored_suggestions.append(suggestion_with_scores)
            
        return scored_suggestions
