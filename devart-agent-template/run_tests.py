#!/usr/bin/env python3
"""
Test runner script for the Agent SDK tests.
"""

import unittest
import sys
import os
import argparse

# Add the tests directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'tests'))

def run_tests(pattern='test_*.py'):
    """Run tests matching the specified pattern."""
    loader = unittest.TestLoader()
    start_dir = os.path.join(os.path.dirname(__file__), 'tests')
    suite = loader.discover(start_dir, pattern=pattern)
    
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    return result.wasSuccessful()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Run Agent SDK tests')
    parser.add_argument('--performance', action='store_true', 
                        help='Run performance tests only')
    parser.add_argument('--all', action='store_true', 
                        help='Run all tests including performance tests')
    
    args = parser.parse_args()
    
    if args.performance:
        # Run performance tests only
        success = run_tests('test_*performance*.py')
    elif args.all:
        # Run all tests
        success = run_tests('test_*.py')
    else:
        # Run regular tests only (exclude performance tests)
        loader = unittest.TestLoader()
        start_dir = os.path.join(os.path.dirname(__file__), 'tests')
        
        # Load all test cases except performance tests
        suite = unittest.TestSuite()
        all_tests = loader.discover(start_dir, pattern='test_*.py')
        
        for test_group in all_tests:
            if hasattr(test_group, '__iter__'):
                for test_suite in test_group:
                    if hasattr(test_suite, '__iter__'):
                        for test in test_suite:
                            if 'performance' not in test.__class__.__name__.lower():
                                suite.addTest(test)
                    elif 'performance' not in test_suite.__class__.__name__.lower():
                        suite.addTest(test_suite)
            elif 'performance' not in test_group.__class__.__name__.lower():
                suite.addTest(test_group)
        
        runner = unittest.TextTestRunner(verbosity=2)
        result = runner.run(suite)
        success = result.wasSuccessful()
    
    # Exit with error code if tests failed
    sys.exit(0 if success else 1)