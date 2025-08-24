#!/usr/bin/env python3
"""
Comprehensive test runner for Architecture Refactoring Agent
"""

import sys
import os
import subprocess
import time
from pathlib import Path

# Add the sdk directory to the path
sdk_path = Path(__file__).parent / 'sdk'
sys.path.insert(0, str(sdk_path))

def run_unit_tests():
    """Run unit tests."""
    print("=== Running Unit Tests ===")
    try:
        result = subprocess.run([
            sys.executable, '-m', 'unittest', 
            'tests.test_architecture_analysis', '-v'
        ], cwd=Path(__file__).parent, capture_output=True, text=True)
        
        print(result.stdout)
        if result.stderr:
            print("STDERR:", result.stderr)
            
        return result.returncode == 0
    except Exception as e:
        print(f"Error running unit tests: {e}")
        return False

def run_component_tests():
    """Run component tests."""
    print("=== Running Component Tests ===")
    try:
        result = subprocess.run([
            sys.executable, 'run_tests.py'
        ], cwd=Path(__file__).parent, capture_output=True, text=True)
        
        print(result.stdout)
        if result.stderr:
            print("STDERR:", result.stderr)
            
        return result.returncode == 0
    except Exception as e:
        print(f"Error running component tests: {e}")
        return False

def run_e2e_tests():
    """Run end-to-end tests."""
    print("=== Running End-to-End Tests ===")
    try:
        result = subprocess.run([
            sys.executable, '-m', 'unittest', 
            'tests.test_e2e_workflow', '-v'
        ], cwd=Path(__file__).parent, capture_output=True, text=True)
        
        print(result.stdout)
        if result.stderr:
            print("STDERR:", result.stderr)
            
        return result.returncode == 0
    except Exception as e:
        print(f"Error running end-to-end tests: {e}")
        return False

def run_performance_tests():
    """Run performance tests."""
    print("=== Running Performance Tests ===")
    try:
        result = subprocess.run([
            sys.executable, '-m', 'unittest', 
            'tests.test_performance', '-v'
        ], cwd=Path(__file__).parent, capture_output=True, text=True)
        
        print(result.stdout)
        if result.stderr:
            print("STDERR:", result.stderr)
            
        return result.returncode == 0
    except Exception as e:
        print(f"Error running performance tests: {e}")
        return False

def run_all_tests():
    """Run all test suites."""
    print("🚀 Starting comprehensive test suite for Architecture Refactoring Agent\n")
    
    start_time = time.time()
    
    # Test results
    results = {
        'unit': False,
        'component': False,
        'e2e': False,
        'performance': False
    }
    
    # Run tests in order of dependency
    print("📋 Test Execution Order:")
    print("1. Unit Tests")
    print("2. Component Tests")
    print("3. End-to-End Tests")
    print("4. Performance Tests\n")
    
    # Run unit tests
    results['unit'] = run_unit_tests()
    print()
    
    # Run component tests
    results['component'] = run_component_tests()
    print()
    
    # Run end-to-end tests
    results['e2e'] = run_e2e_tests()
    print()
    
    # Run performance tests
    results['performance'] = run_performance_tests()
    print()
    
    # Calculate total time
    end_time = time.time()
    total_time = end_time - start_time
    
    # Print summary
    print("=== Test Results Summary ===")
    print(f"Unit Tests: {'✅ PASS' if results['unit'] else '❌ FAIL'}")
    print(f"Component Tests: {'✅ PASS' if results['component'] else '❌ FAIL'}")
    print(f"End-to-End Tests: {'✅ PASS' if results['e2e'] else '❌ FAIL'}")
    print(f"Performance Tests: {'✅ PASS' if results['performance'] else '❌ FAIL'}")
    print(f"Total Execution Time: {total_time:.2f} seconds")
    
    # Calculate overall result
    passed = sum(1 for result in results.values() if result)
    total = len(results)
    
    print(f"\n📊 Overall: {passed}/{total} test suites passed")
    
    if passed == total:
        print("\n🎉 All test suites passed! The Architecture Refactoring Agent is ready for deployment.")
        return 0
    else:
        print(f"\n❌ {total - passed} test suite(s) failed. Please review the output above.")
        return 1

if __name__ == "__main__":
    sys.exit(run_all_tests())