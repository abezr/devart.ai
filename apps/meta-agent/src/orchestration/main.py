"""
Main Orchestration Script for Meta-Agent System

This script initializes the three specialized agents and implements the orchestration logic:
1. SupervisorAgent (Meta-Agent) - Main orchestrator that determines the next feature to build
2. SpecWriterAgent - Produces detailed technical specifications from high-level goals
3. TaskGeneratorAgent - Breaks specifications into engineering tasks for devart.ai
"""

import os
from src.orchestration.meta_agent import MetaAgent
from src.orchestration.specialized_agents import SpecWriterAgent, TaskGeneratorAgent


def initialize_agents():
    """
    Initialize all three specialized agents.
    
    Returns:
        Tuple of (meta_agent, spec_writer_agent, task_generator_agent)
    """
    # Get configuration from environment variables
    api_base_url = os.getenv("API_BASE_URL", "http://localhost:8787")
    meta_agent_api_key = os.getenv("META_AGENT_API_KEY")
    
    # Initialize the Meta-Agent (Supervisor)
    meta_agent = MetaAgent(
        api_base_url=api_base_url,
        api_key=meta_agent_api_key
    )
    
    # Initialize the Spec-Writer Agent
    spec_writer_agent = SpecWriterAgent(name="Spec-Writer")
    
    # Initialize the Task-Generator Agent
    task_generator_agent = TaskGeneratorAgent(
        api_base_url=api_base_url,
        api_key=meta_agent_api_key,
        name="Task-Generator"
    )
    
    return meta_agent, spec_writer_agent, task_generator_agent


def orchestrate_roadmap_analysis():
    """
    Orchestrate the complete roadmap analysis and task generation workflow.
    
    This function implements the main orchestration logic:
    1. SupervisorAgent queries the Knowledge Core and orchestrates workflow
    2. SpecWriterAgent receives findings and produces technical specifications
    3. TaskGeneratorAgent receives specifications and generates engineering tasks
    """
    # Initialize all agents
    meta_agent, spec_writer_agent, task_generator_agent = initialize_agents()
    
    print("Meta-Agent System Orchestration Started")
    print("=" * 50)
    
    # Step 1: SupervisorAgent queries the Knowledge Core
    print("Step 1: SupervisorAgent querying Knowledge Core for next strategic priority...")
    next_priority_result = meta_agent.analyze_roadmap("What are the next features to implement?")
    print(f"Next priority identified: {next_priority_result}")
    
    # Step 2: SupervisorAgent asks SpecWriterAgent to draft a technical spec
    print("\nStep 2: SupervisorAgent requesting technical specification...")
    technical_spec = meta_agent.generate_technical_specification(next_priority_result)
    print(f"Technical specification generated for: {technical_spec.feature_name}")
    print(f"Overview: {technical_spec.overview}")
    
    # Step 3: SupervisorAgent asks TaskGeneratorAgent to break spec into engineering tasks
    print("\nStep 3: SupervisorAgent requesting task generation...")
    tasks = meta_agent.generate_tasks_from_specification(technical_spec)
    print(f"Generated {len(tasks)} engineering tasks")
    
    # Step 4: SupervisorAgent asks TaskGeneratorAgent to create evaluation tasks
    print("\nStep 4: SupervisorAgent requesting evaluation task generation...")
    evaluation_tasks = meta_agent.generate_evaluation_tasks(technical_spec.feature_name)
    print(f"Generated {len(evaluation_tasks)} evaluation tasks")
    
    # Combine all tasks
    all_tasks = tasks + evaluation_tasks
    
    # Step 5: SupervisorAgent creates tasks in devart.ai system
    print("\nStep 5: SupervisorAgent creating tasks in devart.ai system...")
    created_task_ids = []
    
    # Get available agents for assignment
    available_agents = meta_agent.get_available_agents()
    print(f"Found {len(available_agents)} available agents")
    
    # Create and assign tasks
    for task in all_tasks:
        print(f"\nProcessing task: {task.title}")
        
        # Match agent to task
        assigned_agent = meta_agent.match_agent_to_task(task, available_agents)
        assigned_agent_id = assigned_agent.id if assigned_agent else None
        
        if assigned_agent:
            print(f"  Assigned to agent: {assigned_agent.alias}")
        else:
            print("  No suitable agent found, task will be unassigned")
        
        # Create task in system
        task_id = meta_agent.create_task_in_system(task, assigned_agent_id)
        if task_id:
            created_task_ids.append(task_id)
            print(f"  Created task with ID: {task_id}")
        else:
            print("  Failed to create task")
    
    print("\n" + "=" * 50)
    print("Meta-Agent System Orchestration Completed")
    print(f"Total tasks created: {len(created_task_ids)}")
    print(f"Task IDs: {created_task_ids}")
    
    return created_task_ids


def main():
    """Main entry point for the orchestration system."""
    try:
        # Validate configuration
        required_env_vars = ["META_AGENT_API_KEY"]
        missing_vars = [var for var in required_env_vars if not os.getenv(var)]
        
        if missing_vars:
            print(f"Error: Missing required environment variables: {', '.join(missing_vars)}")
            print("Please set these variables and try again.")
            return 1
        
        # Run the orchestration workflow
        task_ids = orchestrate_roadmap_analysis()
        
        print(f"\nOrchestration completed successfully. Created {len(task_ids)} tasks.")
        return 0
        
    except Exception as e:
        print(f"Error during orchestration: {str(e)}")
        return 1


if __name__ == "__main__":
    exit(main())