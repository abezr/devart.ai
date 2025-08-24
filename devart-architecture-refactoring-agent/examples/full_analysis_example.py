#!/usr/bin/env python3
"""
Example script demonstrating how to use all Architecture Refactoring Agent components together
"""

import os
import sys
import time
from pathlib import Path

# Add the sdk directory to the path
sdk_path = Path(__file__).parent.parent / 'sdk'
sys.path.insert(0, str(sdk_path))

from codebase_analyzer import CodebaseAnalyzer
from refactoring_suggester import RefactoringSuggester
from refactoring_executor import RefactoringExecutor

def run_full_analysis_example():
    """Run a full example of architecture analysis and refactoring."""
    print("=== Architecture Refactoring Agent Full Analysis Example ===\n")
    
    # Initialize components
    print("1. Initializing components...")
    analyzer = CodebaseAnalyzer()
    suggester = RefactoringSuggester()
    executor = RefactoringExecutor()
    
    # For this example, we'll simulate a repository analysis
    # In a real scenario, you would use a real repository URL
    
    # Simulate findings (in a real scenario, these would come from the analyzer)
    example_findings = [
        {
            "id": "finding-1",
            "type": "god_class",
            "severity": "CRITICAL",
            "description": "UserManager class has too many responsibilities",
            "file_path": "src/user/manager.py",
            "line_number": 15,
            "impact_score": 0.9,
            "confidence_score": 0.85
        },
        {
            "id": "finding-2",
            "type": "circular_dependency",
            "severity": "HIGH",
            "description": "Circular dependency between order and payment modules",
            "file_path": "src/order/service.py",
            "line_number": 42,
            "impact_score": 0.8,
            "confidence_score": 0.9
        },
        {
            "id": "finding-3",
            "type": "long_function",
            "severity": "MEDIUM",
            "description": "process_order function is too long",
            "file_path": "src/order/processor.py",
            "line_number": 120,
            "impact_score": 0.6,
            "confidence_score": 0.7
        }
    ]
    
    print(f"2. Generated {len(example_findings)} example findings:")
    for i, finding in enumerate(example_findings, 1):
        print(f"   {i}. {finding['type']}: {finding['description']}")
    
    # Generate suggestions
    print("\n3. Generating refactoring suggestions...")
    suggestions = suggester.generate_suggestions(example_findings, {
        'repository_url': 'https://github.com/example/repo',
        'branch': 'main'
    })
    
    print(f"   Generated {len(suggestions)} suggestions:")
    for i, suggestion in enumerate(suggestions, 1):
        print(f"   {i}. {suggestion['title']} (Priority: {suggestion['priority']}, Complexity: {suggestion['complexity']})")
    
    # Prioritize suggestions
    print("\n4. Prioritizing suggestions...")
    prioritized_suggestions = suggester.prioritize_suggestions(suggestions)
    scored_suggestions = suggester.score_suggestions(prioritized_suggestions)
    
    print("   Prioritized suggestions:")
    for i, suggestion in enumerate(scored_suggestions[:3], 1):  # Show top 3
        print(f"   {i}. {suggestion['title']} (Score: {suggestion.get('score', 'N/A')})")
    
    # Simulate executing the top suggestion
    if scored_suggestions:
        print("\n5. Executing top refactoring suggestion...")
        top_suggestion = scored_suggestions[0]
        
        # Provision sandbox
        sandbox_result = executor.provision_sandbox('https://github.com/example/repo', 'main')
        print(f"   Sandbox provisioned: {sandbox_result['sandbox_id']}")
        
        # Execute refactoring
        execution_result = executor.execute_refactoring(
            top_suggestion, 
            'https://github.com/example/repo', 
            'main'
        )
        
        if execution_result['success']:
            print("   ✅ Refactoring executed successfully!")
            print(f"   Changes applied: {len(execution_result.get('changes', []))}")
            print(f"   Tests passed: {execution_result.get('test_results', {}).get('passed', 0)}")
            
            # Show performance improvement if available
            perf_comparison = execution_result.get('performance_comparison', {})
            if perf_comparison:
                improvement = perf_comparison.get('improvement', {})
                if improvement:
                    print("   Performance improvements:")
                    for metric, value in improvement.items():
                        print(f"     - {metric}: {value}")
        else:
            print(f"   ❌ Refactoring failed: {execution_result.get('error', 'Unknown error')}")
    
    print("\n=== Analysis Complete ===")

def main():
    """Main function to run the example."""
    try:
        run_full_analysis_example()
    except Exception as e:
        print(f"Error running example: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()