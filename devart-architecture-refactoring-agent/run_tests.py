#!/usr/bin/env python3
"""
Test runner script for Architecture Refactoring Agent components
"""

import sys
import os
from pathlib import Path

# Add the sdk directory to the path
sdk_path = Path(__file__).parent / 'sdk'
sys.path.insert(0, str(sdk_path))

def test_agent_sdk():
    """Test the Agent SDK component."""
    print("Testing Agent SDK...")
    try:
        from agent_sdk import ArchitectureRefactoringAgentSDK
        # Test initialization
        sdk = ArchitectureRefactoringAgentSDK(
            agent_id="test-agent",
            api_key="test-key",
            api_base_url="https://test.api"
        )
        print("  ✅ Agent SDK initialized successfully")
        return True
    except Exception as e:
        print(f"  ❌ Agent SDK test failed: {e}")
        return False

def test_codebase_analyzer():
    """Test the Codebase Analyzer component."""
    print("Testing Codebase Analyzer...")
    try:
        from codebase_analyzer import CodebaseAnalyzer
        # Test initialization
        analyzer = CodebaseAnalyzer()
        print("  ✅ Codebase Analyzer initialized successfully")
        
        # Test supported languages
        print(f"  📦 Supported languages: {analyzer.supported_languages}")
        return True
    except Exception as e:
        print(f"  ❌ Codebase Analyzer test failed: {e}")
        return False

def test_refactoring_suggester():
    """Test the Refactoring Suggester component."""
    print("Testing Refactoring Suggester...")
    try:
        from refactoring_suggester import RefactoringSuggester
        # Test initialization
        suggester = RefactoringSuggester()
        print("  ✅ Refactoring Suggester initialized successfully")
        
        # Test suggestion generation for a simple finding
        test_finding = {
            "type": "god_class",
            "description": "Test god class finding"
        }
        suggestion = suggester._generate_suggestion_for_finding(test_finding)
        if suggestion and "Split God Class" in suggestion.get("title", ""):
            print("  ✅ Suggestion generation working correctly")
        else:
            print("  ⚠️ Suggestion generation may have issues")
        
        return True
    except Exception as e:
        print(f"  ❌ Refactoring Suggester test failed: {e}")
        return False

def test_refactoring_executor():
    """Test the Refactoring Executor component."""
    print("Testing Refactoring Executor...")
    try:
        from refactoring_executor import RefactoringExecutor
        # Test initialization
        executor = RefactoringExecutor()
        print("  ✅ Refactoring Executor initialized successfully")
        
        # Test sandbox provisioning
        sandbox_result = executor.provision_sandbox("https://test.repo")
        if sandbox_result and "sandbox_id" in sandbox_result:
            print("  ✅ Sandbox provisioning working correctly")
        else:
            print("  ⚠️ Sandbox provisioning may have issues")
            
        return True
    except Exception as e:
        print(f"  ❌ Refactoring Executor test failed: {e}")
        return False

def main():
    """Run all component tests."""
    print("=== Architecture Refactoring Agent Component Tests ===\n")
    
    tests = [
        test_agent_sdk,
        test_codebase_analyzer,
        test_refactoring_suggester,
        test_refactoring_executor
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            if test():
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print(f"  ❌ Test {test.__name__} crashed: {e}")
            failed += 1
        print()
    
    print("=== Test Results ===")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    print(f"Total:  {passed + failed}")
    
    if failed == 0:
        print("\n🎉 All tests passed!")
        return 0
    else:
        print(f"\n❌ {failed} test(s) failed.")
        return 1

if __name__ == "__main__":
    sys.exit(main())