"""
Specialized Agents for Meta-Agent System

This module implements the specialized agents as defined in the Langroid orchestration layer:
1. SpecWriterAgent - Produces detailed technical specifications from high-level goals
2. TaskGeneratorAgent - Breaks specifications into engineering tasks for devart.ai
"""

from typing import List, Dict, Any, Optional
from langroid import ChatAgent, ChatDocument
from langroid.agent.special.llm_response import LLMResponse
from pydantic import BaseModel
import json
import requests


class TechnicalSpecification(BaseModel):
    """Data model for a technical specification."""
    feature_name: str
    overview: str
    technical_requirements: List[str]
    implementation_steps: List[str]
    dependencies: List[str]
    estimated_complexity: str  # LOW, MEDIUM, HIGH
    required_expertise: List[str]


class TaskSpecification(BaseModel):
    """Data model for a task specification."""
    title: str
    description: str
    priority: str  # LOW, MEDIUM, HIGH, CRITICAL
    required_capabilities: List[str]
    estimated_effort: str  # SMALL, MEDIUM, LARGE


class SpecWriterAgent:
    """Agent responsible for producing detailed technical specifications from high-level goals."""

    def __init__(self, name: str = "Spec-Writer"):
        """
        Initialize the SpecWriterAgent.
        
        Args:
            name: Name of the agent
        """
        self.agent = ChatAgent(
            config=ChatAgent.Config(
                name=name,
                system_message="""
                You are a Spec-Writer Agent responsible for converting high-level feature goals
                into detailed technical specifications. You will:
                1. Analyze the high-level feature description
                2. Identify technical requirements and constraints
                3. Define implementation steps
                4. List dependencies and required expertise
                5. Estimate complexity
                
                Always respond in JSON format with the TechnicalSpecification structure.
                """,
            )
        )

    def create_specification(self, feature_goal: str) -> TechnicalSpecification:
        """
        Create a detailed technical specification from a high-level feature goal.
        
        Args:
            feature_goal: High-level feature goal description
            
        Returns:
            Technical specification
        """
        prompt = f"""
        Create a detailed technical specification for the following feature goal:
        {feature_goal}
        
        Provide your response in JSON format with the following structure:
        {{
            "feature_name": "Name of the feature",
            "overview": "Brief overview of the feature",
            "technical_requirements": ["List of technical requirements"],
            "implementation_steps": ["Step 1", "Step 2", "..."],
            "dependencies": ["List of dependencies"],
            "estimated_complexity": "LOW|MEDIUM|HIGH",
            "required_expertise": ["List of required expertise areas"]
        }}
        """
        
        doc = ChatDocument(content=prompt)
        response = self.agent.llm_response(doc)
        
        try:
            # Parse the JSON response
            spec_data = json.loads(response.content)
            return TechnicalSpecification(**spec_data)
        except json.JSONDecodeError:
            # If JSON parsing fails, create a default specification
            return TechnicalSpecification(
                feature_name="Default Feature",
                overview=feature_goal,
                technical_requirements=["Define technical requirements based on feature goal"],
                implementation_steps=["Analyze requirements", "Design solution", "Implement feature"],
                dependencies=["Core platform services"],
                estimated_complexity="MEDIUM",
                required_expertise=["Software engineering"]
            )


class TaskGeneratorAgent:
    """Agent responsible for breaking specifications into engineering tasks for devart.ai."""

    def __init__(self, api_base_url: str, api_key: str, name: str = "Task-Generator"):
        """
        Initialize the TaskGeneratorAgent.
        
        Args:
            api_base_url: Base URL for the devart.ai API
            api_key: API key for authentication
            name: Name of the agent
        """
        self.api_base_url = api_base_url
        self.api_key = api_key
        self.headers = {"Authorization": f"Bearer {api_key}"}
        
        self.agent = ChatAgent(
            config=ChatAgent.Config(
                name=name,
                system_message="""
                You are a Task-Generator Agent responsible for breaking technical specifications
                into small, well-defined engineering tasks for the devart.ai system. You will:
                1. Analyze the technical specification
                2. Break it into small, actionable tasks
                3. Prioritize tasks based on dependencies
                4. Identify required capabilities for each task
                5. Estimate effort for each task
                
                Always respond in JSON format with a list of TaskSpecification objects.
                """,
            )
        )

    def generate_tasks(self, specification: TechnicalSpecification) -> List[TaskSpecification]:
        """
        Generate engineering tasks from a technical specification.
        
        Args:
            specification: Technical specification
            
        Returns:
            List of task specifications
        """
        prompt = f"""
        Break the following technical specification into engineering tasks for devart.ai:
        Feature: {specification.feature_name}
        Overview: {specification.overview}
        Requirements: {', '.join(specification.technical_requirements)}
        Implementation Steps: {', '.join(specification.implementation_steps)}
        Dependencies: {', '.join(specification.dependencies)}
        Complexity: {specification.estimated_complexity}
        Required Expertise: {', '.join(specification.required_expertise)}
        
        Generate a list of specific development tasks that need to be implemented.
        For each task, provide:
        - Title: A concise title
        - Description: Detailed description of what needs to be done
        - Priority: One of LOW, MEDIUM, HIGH, CRITICAL
        - Required_capabilities: List of skills needed (e.g., ["python", "react", "kubernetes"])
        - Estimated_effort: One of SMALL, MEDIUM, LARGE
        
        Respond in JSON format as a list of task objects:
        [
            {{
                "title": "Task title",
                "description": "Task description",
                "priority": "MEDIUM",
                "required_capabilities": ["skill1", "skill2"],
                "estimated_effort": "MEDIUM"
            }},
            ...
        ]
        """
        
        doc = ChatDocument(content=prompt)
        response = self.agent.llm_response(doc)
        
        try:
            # Parse the JSON response
            tasks_data = json.loads(response.content)
            tasks = [TaskSpecification(**task) for task in tasks_data]
            return tasks
        except json.JSONDecodeError:
            # If JSON parsing fails, create a default task
            return [
                TaskSpecification(
                    title=f"Implement {specification.feature_name}",
                    description=f"Implementation of {specification.feature_name} based on the provided specification",
                    priority="MEDIUM",
                    required_capabilities=specification.required_expertise,
                    estimated_effort=specification.estimated_complexity
                )
            ]

    def create_task_in_system(self, task: TaskSpecification) -> Optional[str]:
        """
        Create a task in the devart.ai system.
        
        Args:
            task: Task specification
            
        Returns:
            Task ID if successful, None otherwise
        """
        try:
            payload = {
                "title": task.title,
                "description": task.description,
                "priority": task.priority,
                "required_capabilities": task.required_capabilities
            }
            
            response = requests.post(
                f"{self.api_base_url}/api/tasks",
                headers=self.headers,
                json=payload
            )
            response.raise_for_status()
            task_data = response.json()
            
            return task_data["id"]
        except Exception as e:
            print(f"Error creating task: {str(e)}")
            return None

    def generate_evaluation_tasks(self, feature_name: str) -> List[TaskSpecification]:
        """
        Generate evaluation tasks for measuring feature success.
        
        Args:
            feature_name: Name of the feature to evaluate
            
        Returns:
            List of evaluation task specifications
        """
        evaluation_tasks = [
            TaskSpecification(
                title=f"Evaluate {feature_name} - Performance Testing",
                description=f"Conduct performance testing for the {feature_name} feature to ensure it meets performance benchmarks.",
                priority="HIGH",
                required_capabilities=["testing", "performance-analysis"],
                estimated_effort="MEDIUM"
            ),
            TaskSpecification(
                title=f"Evaluate {feature_name} - User Acceptance Testing",
                description=f"Conduct user acceptance testing for the {feature_name} feature to ensure it meets user requirements.",
                priority="HIGH",
                required_capabilities=["testing", "user-research"],
                estimated_effort="MEDIUM"
            ),
            TaskSpecification(
                title=f"Evaluate {feature_name} - Security Assessment",
                description=f"Conduct security assessment for the {feature_name} feature to identify potential vulnerabilities.",
                priority="MEDIUM",
                required_capabilities=["security", "penetration-testing"],
                estimated_effort="MEDIUM"
            )
        ]
        
        return evaluation_tasks


# Example usage
if __name__ == "__main__":
    # Example usage
    # spec_writer = SpecWriterAgent()
    # task_generator = TaskGeneratorAgent(
    #     api_base_url="http://localhost:8787",
    #     api_key="your-api-key"
    # )
    pass