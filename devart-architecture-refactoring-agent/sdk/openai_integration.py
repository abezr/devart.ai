import os
import openai
from typing import Dict, Any, Optional, List
import json

class OpenAIIntegration:
    """Integrates with OpenAI API for generating AI-driven refactoring suggestions."""
    
    def __init__(self, api_key: str = None, model: str = "gpt-3.5-turbo"):
        self.api_key = api_key or os.getenv('OPENAI_API_KEY')
        self.model = model
        
        if not self.api_key:
            raise ValueError("OpenAI API key is required")
            
        openai.api_key = self.api_key
        
    def generate_refactoring_suggestion(self, finding: Dict, code_context: str = "") -> Optional[Dict]:
        """
        Generate a refactoring suggestion for a specific architectural finding.
        
        Args:
            finding: The architectural finding to address
            code_context: Additional code context for better suggestions
            
        Returns:
            Refactoring suggestion or None if failed
        """
        finding_type = finding.get("type", "unknown")
        description = finding.get("description", "")
        file_path = finding.get("file_path", "")
        
        prompt = f"""
        As a senior software architect, analyze the following architectural issue and provide a detailed refactoring suggestion:

        Issue Type: {finding_type}
        Description: {description}
        File Path: {file_path}
        
        Code Context:
        {code_context}

        Please provide:
        1. A clear title for the refactoring
        2. A detailed description of the problem and solution
        3. Implementation complexity (LOW/MEDIUM/HIGH)
        4. Business impact (LOW/MEDIUM/HIGH)
        5. Priority level (LOW/MEDIUM/HIGH/CRITICAL)
        6. Step-by-step implementation plan
        7. Estimated effort in hours
        8. Potential risks and mitigation strategies

        Format your response as a JSON object.
        """
        
        try:
            response = openai.ChatCompletion.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a senior software architect and technical advisor."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=1000
            )
            
            suggestion_text = response.choices[0].message.content
            # Try to parse as JSON
            try:
                suggestion = json.loads(suggestion_text)
                return suggestion
            except json.JSONDecodeError:
                # If JSON parsing fails, create a structured response
                return {
                    "title": f"Refactor {finding_type.replace('_', ' ').title()}",
                    "description": suggestion_text,
                    "complexity": "MEDIUM",
                    "impact": "MEDIUM",
                    "priority": "MEDIUM",
                    "implementation_plan": [
                        "Analyze the issue in detail",
                        "Design an appropriate solution",
                        "Implement the solution",
                        "Test the changes"
                    ],
                    "estimated_effort_hours": 4.0
                }
                
        except Exception as e:
            print(f"Error generating refactoring suggestion: {e}")
            return None
            
    def prioritize_suggestions(self, suggestions: List[Dict]) -> List[Dict]:
        """
        Use AI to prioritize refactoring suggestions based on impact, complexity, and risk.
        
        Args:
            suggestions: List of refactoring suggestions
            
        Returns:
            Prioritized list of suggestions
        """
        suggestions_json = json.dumps(suggestions, indent=2)
        
        prompt = f"""
        As a project manager, prioritize the following refactoring suggestions based on:
        1. Business impact (HIGH/MEDIUM/LOW)
        2. Implementation complexity (HIGH/MEDIUM/LOW)
        3. Risk level (HIGH/MEDIUM/LOW)
        4. Estimated effort (hours)

        Suggestions:
        {suggestions_json}

        For each suggestion, provide a priority score (1-10) where 10 is highest priority.
        Return the suggestions sorted by priority score in descending order.
        Maintain the original structure but add a "priority_score" field to each suggestion.
        """
        
        try:
            response = openai.ChatCompletion.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are an experienced project manager and technical lead."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=2000
            )
            
            prioritized_text = response.choices[0].message.content
            try:
                prioritized_suggestions = json.loads(prioritized_text)
                return prioritized_suggestions
            except json.JSONDecodeError:
                # If JSON parsing fails, return original suggestions
                return suggestions
                
        except Exception as e:
            print(f"Error prioritizing suggestions: {e}")
            return suggestions
            
    def generate_code_review(self, code_snippet: str, file_path: str) -> Optional[Dict]:
        """
        Generate a code review for a specific code snippet.
        
        Args:
            code_snippet: The code to review
            file_path: Path to the file containing the code
            
        Returns:
            Code review feedback or None if failed
        """
        prompt = f"""
        As a senior software engineer, review the following code and provide feedback:

        File: {file_path}

        Code:
        {code_snippet}

        Please provide:
        1. Code quality assessment
        2. Potential issues or bugs
        3. Performance considerations
        4. Security concerns
        5. Best practices recommendations
        6. Suggested improvements

        Format your response as a JSON object.
        """
        
        try:
            response = openai.ChatCompletion.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a senior software engineer and code reviewer."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.5,
                max_tokens=1500
            )
            
            review_text = response.choices[0].message.content
            try:
                review = json.loads(review_text)
                return review
            except json.JSONDecodeError:
                return {
                    "code_quality": "UNKNOWN",
                    "issues": [],
                    "performance": "No specific feedback",
                    "security": "No specific concerns",
                    "recommendations": [review_text]
                }
                
        except Exception as e:
            print(f"Error generating code review: {e}")
            return None
            
    def score_suggestion(self, suggestion: Dict, codebase_context: Dict = None) -> Dict:
        """
        Use AI to score a refactoring suggestion based on impact, complexity, and risk.
        
        Args:
            suggestion: The refactoring suggestion to score
            codebase_context: Additional context about the codebase
            
        Returns:
            Scored suggestion with impact, complexity, and risk scores
        """
        suggestion_json = json.dumps(suggestion, indent=2)
        context_json = json.dumps(codebase_context or {}, indent=2)
        
        prompt = f"""
        As a technical architect, score the following refactoring suggestion on a scale of 0.0 to 1.0:

        Suggestion:
        {suggestion_json}

        Codebase Context:
        {context_json}

        Please provide scores for:
        1. Impact Score (0.0-1.0): How much will this improve the architecture?
        2. Complexity Score (0.0-1.0): How difficult is this to implement?
        3. Risk Score (0.0-1.0): How risky is this change?
        4. Confidence Score (0.0-1.0): How confident are you in this assessment?

        Return a JSON object with these scores.
        """
        
        try:
            response = openai.ChatCompletion.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a technical architect and risk assessor."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=500
            )
            
            scores_text = response.choices[0].message.content
            try:
                scores = json.loads(scores_text)
                # Merge scores with original suggestion
                scored_suggestion = suggestion.copy()
                scored_suggestion.update(scores)
                return scored_suggestion
            except json.JSONDecodeError:
                # If JSON parsing fails, return original suggestion with default scores
                scored_suggestion = suggestion.copy()
                scored_suggestion.update({
                    "impact_score": 0.5,
                    "complexity_score": 0.5,
                    "risk_score": 0.5,
                    "confidence_score": 0.7
                })
                return scored_suggestion
                
        except Exception as e:
            print(f"Error scoring suggestion: {e}")
            # Return original suggestion with default scores
            scored_suggestion = suggestion.copy()
            scored_suggestion.update({
                "impact_score": 0.5,
                "complexity_score": 0.5,
                "risk_score": 0.5,
                "confidence_score": 0.7
            })
            return scored_suggestion