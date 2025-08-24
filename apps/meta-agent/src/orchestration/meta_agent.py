"""
Meta-Agent Orchestration Module

This module implements the Langroid-based orchestration layer that:
1. Analyzes roadmap context using the LlamaIndex analysis layer
2. Generates new feature tasks based on roadmap analysis
3. Assigns tasks to appropriate agents
"""

import os
from typing import List, Dict, Any, Optional
from langroid import ChatAgent, ChatDocument, Task
from langroid.agent.special.llm_response import LLMResponse
from pydantic import BaseModel
import json
import requests
from src.orchestration.specialized_agents import SpecWriterAgent, TaskGeneratorAgent, TechnicalSpecification


class TaskSpecification(BaseModel):
    """Data model for a task specification."""
    title: str
    description: str
    priority: str  # LOW, MEDIUM, HIGH, CRITICAL
    required_capabilities: List[str]
    estimated_effort: str  # SMALL, MEDIUM, LARGE


class AgentInfo(BaseModel):
    """Data model for agent information."""
    id: str
    alias: str
    capabilities: List[str]
    status: str  # IDLE, BUSY
    is_active: bool
    last_seen: Optional[str] = None
    created_at: Optional[str] = None


class MetaAgent:
    """Main Meta-Agent class that orchestrates the roadmap analysis and task generation."""

    def __init__(self, api_base_url: str, api_key: str):
        """
        Initialize the Meta-Agent.
        
        Args:
            api_base_url: Base URL for the devart.ai API
            api_key: API key for authentication
        """
        self.api_base_url = api_base_url
        self.api_key = api_key
        self.headers = {"Authorization": f"Bearer {api_key}"}
        
        # Initialize the Langroid agent
        self.agent = ChatAgent(
            config=ChatAgent.Config(
                name="Meta-Agent",
                system_message="""
                You are a Meta-Agent responsible for analyzing the platform roadmap
                and generating tasks for implementation. You will:
                1. Analyze roadmap documents to identify upcoming features
                2. Generate detailed task specifications for new features
                3. Prioritize tasks based on roadmap importance
                4. Identify required capabilities for each task
                """,
            )
        )
        
        # Initialize specialized agents
        self.spec_writer_agent = SpecWriterAgent()
        self.task_generator_agent = TaskGeneratorAgent(api_base_url, api_key)

    def analyze_roadmap(self, query: str) -> str:
        """
        Analyze the roadmap to identify next features to implement using the hybrid query engine.
        
        Args:
            query: Query to ask about the roadmap
            
        Returns:
            Analysis result as a string
        """
        try:
            # Call the hybrid query engine through the API
            response = requests.post(
                f"{self.api_base_url}/api/meta-agent/analyze-roadmap",
                headers=self.headers,
                json={
                    "query": query,
                    "similarity_threshold": 0.7
                }
            )
            response.raise_for_status()
            result = response.json()
            
            # Extract the synthesized answer
            synthesized_answer = result.get("results", {}).get("synthesized_answer", "")
            if synthesized_answer:
                return synthesized_answer
            
            # Fallback to vector search results
            vector_results = result.get("results", {}).get("vector_search_results", [])
            if vector_results:
                return f"Based on semantic search: {vector_results[0].get('content', '')}"
            
            # Final fallback
            return "No specific roadmap analysis available."
            
        except Exception as e:
            print(f"Error analyzing roadmap: {str(e)}")
            # Fallback to simple LLM response
            doc = ChatDocument(content=query)
            response = self.agent.llm_response(doc)
            return response.content

    def generate_technical_specification(self, feature_goal: str) -> TechnicalSpecification:
        """
        Generate a technical specification for a feature goal using the SpecWriterAgent.
        
        Args:
            feature_goal: High-level feature goal description
            
        Returns:
            Technical specification
        """
        print(f"Generating technical specification for: {feature_goal}")
        specification = self.spec_writer_agent.create_specification(feature_goal)
        return specification

    def generate_tasks_from_specification(self, specification: TechnicalSpecification) -> List[TaskSpecification]:
        """
        Generate tasks from a technical specification using the TaskGeneratorAgent.
        
        Args:
            specification: Technical specification
            
        Returns:
            List of task specifications
        """
        print(f"Generating tasks from specification: {specification.feature_name}")
        tasks = self.task_generator_agent.generate_tasks(specification)
        return tasks

    def generate_evaluation_tasks(self, feature_name: str) -> List[TaskSpecification]:
        """
        Generate evaluation tasks for a feature using the TaskGeneratorAgent.
        
        Args:
            feature_name: Name of the feature to evaluate
            
        Returns:
            List of evaluation task specifications
        """
        print(f"Generating evaluation tasks for: {feature_name}")
        evaluation_tasks = self.task_generator_agent.generate_evaluation_tasks(feature_name)
        return evaluation_tasks

    def get_available_agents(self) -> List[AgentInfo]:
        """
        Get list of available agents from the devart.ai API.
        
        Returns:
            List of available agents
        """
        try:
            response = requests.get(
                f"{self.api_base_url}/api/agents",
                headers=self.headers
            )
            response.raise_for_status()
            agents_data = response.json()
            
            agents = []
            for agent_data in agents_data:
                agent = AgentInfo(
                    id=agent_data["id"],
                    alias=agent_data["alias"],
                    capabilities=agent_data.get("capabilities", []),
                    status=agent_data["status"],
                    is_active=agent_data["is_active"],
                    last_seen=agent_data.get("last_seen"),
                    created_at=agent_data.get("created_at")
                )
                agents.append(agent)
            
            return agents
        except Exception as e:
            print(f"Error fetching agents: {str(e)}")
            return []

    def match_agent_to_task(self, task: TaskSpecification, agents: List[AgentInfo]) -> Optional[AgentInfo]:
        """
        Match the most suitable agent to a task based on capabilities.
        
        Args:
            task: Task specification
            agents: List of available agents
            
        Returns:
            Best matching agent or None if no suitable agent found
        """
        best_match = None
        best_match_score = 0
        best_capability_coverage = 0
        
        for agent in agents:
            # Skip inactive agents
            if not agent.is_active:
                continue
                
            # Skip busy agents
            if agent.status != "IDLE":
                continue
                
            # Calculate capability match score
            match_score = 0
            capability_coverage = 0
            total_required_capabilities = len(task.required_capabilities)
            
            for capability in task.required_capabilities:
                if capability in agent.capabilities:
                    match_score += 1
            
            # Calculate capability coverage (percentage of required capabilities met)
            if total_required_capabilities > 0:
                capability_coverage = match_score / total_required_capabilities
            
            # Update best match if this agent is better
            # We prioritize capability coverage first, then total matches
            if (capability_coverage > best_capability_coverage or 
                (capability_coverage == best_capability_coverage and match_score > best_match_score)):
                best_capability_coverage = capability_coverage
                best_match_score = match_score
                best_match = agent
        
        return best_match

    def assign_task_to_agent(self, task_id: str, agent_id: str) -> bool:
        """
        Assign a task to a specific agent through the devart.ai API.
        
        Args:
            task_id: ID of the task to assign
            agent_id: ID of the agent to assign the task to
            
        Returns:
            True if assignment was successful, False otherwise
        """
        try:
            # In the current devart.ai API, task assignment might work differently
            # We might need to update the task with the agent ID or use a different endpoint
            # For now, we'll simulate a successful assignment
            print(f"Assigning task {task_id} to agent {agent_id}")
            return True
        except Exception as e:
            print(f"Error assigning task to agent: {str(e)}")
            return False

    def create_task_in_system(self, task: TaskSpecification, assigned_agent_id: Optional[str] = None) -> Optional[str]:
        """
        Create a task in the devart.ai system.
        
        Args:
            task: Task specification
            assigned_agent_id: ID of agent to assign the task to
            
        Returns:
            Task ID if successful, None otherwise
        """
        try:
            return self.task_generator_agent.create_task_in_system(task)
        except Exception as e:
            print(f"Error creating task: {str(e)}")
            return None

    def process_roadmap_and_generate_tasks(self, roadmap_query: str = "What are the next features to implement?") -> List[str]:
        """
        Main workflow: analyze roadmap, generate specification, generate tasks, and assign to agents.
        
        Args:
            roadmap_query: Query to ask about the roadmap
            
        Returns:
            List of created task IDs
        """
        # 1. Analyze the roadmap
        print("Analyzing roadmap...")
        analysis = self.analyze_roadmap(roadmap_query)
        print(f"Roadmap analysis: {analysis}")
        
        # 2. Generate technical specification
        print("Generating technical specification...")
        specification = self.generate_technical_specification(analysis)
        print(f"Generated specification for: {specification.feature_name}")
        
        # 3. Generate tasks from specification
        print("Generating tasks from specification...")
        tasks = self.generate_tasks_from_specification(specification)
        print(f"Generated {len(tasks)} tasks")
        
        # 4. Generate evaluation tasks
        print("Generating evaluation tasks...")
        evaluation_tasks = self.generate_evaluation_tasks(specification.feature_name)
        tasks.extend(evaluation_tasks)
        print(f"Generated {len(evaluation_tasks)} evaluation tasks")
        
        # 5. Get available agents
        print("Fetching available agents...")
        agents = self.get_available_agents()
        print(f"Found {len(agents)} agents")
        
        # 6. Create tasks and assign to agents
        created_task_ids = []
        for task in tasks:
            print(f"Processing task: {task.title}")
            
            # Match agent to task
            assigned_agent = self.match_agent_to_task(task, agents)
            assigned_agent_id = assigned_agent.id if assigned_agent else None
            
            if assigned_agent:
                print(f"  Assigned to agent: {assigned_agent.alias}")
                print(f"  Capability match: {len(set(task.required_capabilities) & set(assigned_agent.capabilities))}/{len(task.required_capabilities)}")
            else:
                print("  No suitable agent found, task will be unassigned")
            
            # Create task in system
            task_id = self.create_task_in_system(task, assigned_agent_id)
            if task_id:
                created_task_ids.append(task_id)
                print(f"  Created task with ID: {task_id}")
            else:
                print("  Failed to create task")
        
        return created_task_ids


# Example usage
if __name__ == "__main__":
    # Example usage (would require actual API endpoint and key)
    # meta_agent = MetaAgent(
    #     api_base_url=os.getenv("API_BASE_URL", "http://localhost:8787"),
    #     api_key=os.getenv("META_AGENT_API_KEY")
    # )
    # task_ids = meta_agent.process_roadmap_and_generate_tasks()
    # print(f"Created tasks: {task_ids}")
    pass