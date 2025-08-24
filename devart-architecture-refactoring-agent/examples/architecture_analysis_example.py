#!/usr/bin/env python3
"""
Example script demonstrating how to use the Architecture Refactoring Agent
"""

import os
import sys
import time
from sdk.agent_sdk import ArchitectureRefactoringAgentSDK

def example_analysis_callback(task):
    """
    Example callback function that simulates architecture analysis
    """
    print(f"Analyzing architecture for task: {task['id']}")
    print(f"Repository: {task.get('repository_url', 'N/A')}")
    print(f"Branch: {task.get('branch', 'main')}")
    
    # Simulate analysis work
    time.sleep(2)
    
    # Example findings
    findings = [
        {
            "type": "circular_dependency",
            "severity": "HIGH",
            "description": "Circular dependency detected between user and order modules",
            "file_path": "src/user/service.py",
            "line_number": 42,
            "impact_score": 0.8,
            "confidence_score": 0.9
        },
        {
            "type": "god_class",
            "severity": "CRITICAL",
            "description": "OrderManager class has too many responsibilities",
            "file_path": "src/order/manager.py",
            "line_number": 15,
            "impact_score": 0.9,
            "confidence_score": 0.85
        }
    ]
    
    # Example suggestions
    suggestions = [
        {
            "title": "Break Circular Dependency",
            "description": "Refactor to eliminate circular dependency between user and order modules",
            "complexity": "MEDIUM",
            "impact": "HIGH",
            "implementation_plan": [
                "Create a new common module for shared functionality",
                "Move shared functions to the new module",
                "Update import statements in both modules"
            ],
            "estimated_effort_hours": 4.5
        },
        {
            "title": "Split God Class",
            "description": "Break down OrderManager into smaller, focused classes",
            "complexity": "HIGH",
            "impact": "HIGH",
            "implementation_plan": [
                "Identify distinct responsibilities in OrderManager",
                "Create new classes for each responsibility",
                "Refactor existing code to use new classes",
                "Update tests and documentation"
            ],
            "estimated_effort_hours": 12.0
        }
    ]
    
    # In a real implementation, you would:
    # 1. Clone the repository
    # 2. Parse the code structure
    # 3. Identify architectural patterns and anti-patterns
    # 4. Use an LLM to generate detailed refactoring plans
    # 5. Report findings and suggestions to the API
    
    print(f"Analysis complete. Found {len(findings)} issues and generated {len(suggestions)} suggestions.")
    return True

def main():
    # Load configuration from environment variables
    AGENT_ID = os.getenv("DEVART_AGENT_ID", "example-architecture-agent")
    API_KEY = os.getenv("DEVART_API_KEY")
    API_BASE_URL = os.getenv("DEVART_API_BASE_URL", "https://your-api.workers.dev")
    
    if not API_KEY:
        print("Error: DEVART_API_KEY environment variable is required")
        sys.exit(1)
    
    # Initialize the agent SDK
    sdk = ArchitectureRefactoringAgentSDK(
        agent_id=AGENT_ID,
        api_key=API_KEY,
        api_base_url=API_BASE_URL
    )
    
    print(f"Architecture Refactoring Agent {AGENT_ID} initialized")
    print("Starting to consume architecture analysis tasks...")
    
    try:
        # Start consuming tasks
        sdk.start_consuming(example_analysis_callback)
        
        # Keep the script running
        print("Press Ctrl+C to stop the agent")
        while True:
            time.sleep(1)
            
    except KeyboardInterrupt:
        print("\nShutting down agent...")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        sdk.stop_consuming()
        print("Agent shutdown complete.")

if __name__ == "__main__":
    main()