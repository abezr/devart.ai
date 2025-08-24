#!/usr/bin/env python3
"""
Verification script to check that the generative remediation implementation is correct.
"""

import os
import sys

def check_files_exist():
    """Check that all required files exist."""
    required_files = [
        "supabase/schema.sql",
        "apps/api/src/services/generativeRemediation.ts",
        "apps/api/src/services/generativeRemediation.test.ts",
        "apps/api/src/index.ts",
        "devart-agent-template/sdk/agent_sdk.py",
        "devart-agent-template/tests/test_generative_remediation.py",
        "apps/ui/src/components/GenerativeRemediationDashboard.tsx",
        "apps/ui/src/app/remediation/page.tsx",
        "GENERATIVE_REMEDIATION.md"
    ]
    
    missing_files = []
    for file_path in required_files:
        if not os.path.exists(file_path):
            missing_files.append(file_path)
    
    if missing_files:
        print("❌ Missing files:")
        for file_path in missing_files:
            print(f"  - {file_path}")
        return False
    else:
        print("✅ All required files exist")
        return True

def check_database_schema():
    """Check that the database schema includes the new tables."""
    schema_file = "supabase/schema.sql"
    
    if not os.path.exists(schema_file):
        print("❌ Schema file not found")
        return False
    
    with open(schema_file, 'r') as f:
        content = f.read()
    
    required_tables = [
        "generative_remediation_scripts",
        "generative_remediation_templates"
    ]
    
    missing_tables = []
    for table in required_tables:
        if table not in content:
            missing_tables.append(table)
    
    if missing_tables:
        print("❌ Missing tables in schema:")
        for table in missing_tables:
            print(f"  - {table}")
        return False
    else:
        print("✅ All required tables are in the schema")
        return True

def check_api_endpoints():
    """Check that the API includes the new endpoints."""
    api_file = "apps/api/src/index.ts"
    
    if not os.path.exists(api_file):
        print("❌ API file not found")
        return False
    
    with open(api_file, 'r') as f:
        content = f.read()
    
    required_endpoints = [
        "POST /api/generative-remediation/generate",
        "GET /api/generative-remediation/scripts",
        "GET /api/generative-remediation/scripts/:id",
        "POST /api/generative-remediation/scripts/:id/validate",
        "POST /api/generative-remediation/scripts/:id/approve",
        "POST /api/generative-remediation/scripts/:id/execute",
        "GET /api/generative-remediation/templates",
        "POST /api/generative-remediation/templates",
        "PUT /api/generative-remediation/templates/:id",
        "DELETE /api/generative-remediation/templates/:id"
    ]
    
    missing_endpoints = []
    for endpoint in required_endpoints:
        if endpoint not in content:
            missing_endpoints.append(endpoint)
    
    if missing_endpoints:
        print("❌ Missing endpoints in API:")
        for endpoint in missing_endpoints:
            print(f"  - {endpoint}")
        return False
    else:
        print("✅ All required endpoints are in the API")
        return True

def check_agent_sdk():
    """Check that the agent SDK includes the new methods."""
    sdk_file = "devart-agent-template/sdk/agent_sdk.py"
    
    if not os.path.exists(sdk_file):
        print("❌ Agent SDK file not found")
        return False
    
    with open(sdk_file, 'r') as f:
        content = f.read()
    
    required_methods = [
        "request_generative_remediation",
        "validate_script",
        "execute_script",
        "get_approved_scripts"
    ]
    
    missing_methods = []
    for method in required_methods:
        if method not in content:
            missing_methods.append(method)
    
    if missing_methods:
        print("❌ Missing methods in Agent SDK:")
        for method in missing_methods:
            print(f"  - {method}")
        return False
    else:
        print("✅ All required methods are in the Agent SDK")
        return True

def main():
    """Run all verification checks."""
    print("🔍 Verifying Generative Remediation Implementation\n")
    
    checks = [
        check_files_exist,
        check_database_schema,
        check_api_endpoints,
        check_agent_sdk
    ]
    
    all_passed = True
    for check in checks:
        if not check():
            all_passed = False
        print()
    
    if all_passed:
        print("🎉 All verification checks passed!")
        print("The Generative Remediation implementation is complete and correct.")
    else:
        print("❌ Some verification checks failed.")
        print("Please review the implementation and fix the issues.")
        sys.exit(1)

if __name__ == "__main__":
    main()