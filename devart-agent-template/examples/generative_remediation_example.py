#!/usr/bin/env python3
"""
Example script demonstrating how to use the generative remediation functionality
in the Agent SDK.
"""

import sys
import os
import time

# Add the sdk directory to the path so we can import the AgentSDK
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'sdk'))

from agent_sdk import AgentSDK

def main():
    # Initialize the Agent SDK
    # In a real implementation, these would come from environment variables or config
    agent_id = os.getenv('AGENT_ID', 'example-agent-123')
    api_key = os.getenv('API_KEY', 'example-api-key')
    api_base_url = os.getenv('API_BASE_URL', 'http://localhost:8000')
    
    agent = AgentSDK(agent_id, api_key, api_base_url)
    
    print("Agent SDK initialized successfully")
    
    # Simulate detecting an anomaly and performing RCA
    print("\n1. Simulating anomaly detection and RCA...")
    anomaly_id = "anomaly-example-001"
    root_cause_analysis = {
        "root_cause_category": "Configuration",
        "root_cause_details": "Missing configuration file for database connection",
        "confidence_score": "HIGH",
        "suggested_actions": [
            "Create missing configuration file",
            "Verify database connection parameters",
            "Restart affected service"
        ]
    }
    
    print(f"   Anomaly ID: {anomaly_id}")
    print(f"   Root Cause: {root_cause_analysis['root_cause_category']}")
    print(f"   Details: {root_cause_analysis['root_cause_details']}")
    
    # Request generative remediation
    print("\n2. Requesting generative remediation...")
    try:
        script_response = agent.request_generative_remediation(anomaly_id, root_cause_analysis)
        
        if not script_response:
            print("   Failed to generate remediation script")
            return
            
        script_id = script_response.get('id')
        print(f"   Generated script ID: {script_id}")
        print(f"   Confidence score: {script_response.get('confidence_score', 0) * 100:.1f}%")
        
        # In a real implementation, a supervisor would review and approve the script
        # For this example, we'll simulate approval through the API
        print("\n3. Simulating script approval by supervisor...")
        # This would normally be done through the UI or API by a supervisor
        
        # Validate the script
        print("\n4. Validating the generated script...")
        validation_result = agent.validate_script(script_id)
        
        if validation_result and validation_result.get('validation', {}).get('isValid'):
            print("   Script validation passed")
            
            # Execute the script
            print("\n5. Executing the validated script...")
            execution_result = agent.execute_script(script_id)
            
            if execution_result and execution_result.get('status') == 'SUCCESS':
                print("   Script executed successfully!")
                print(f"   Result: {execution_result.get('result')}")
            else:
                print("   Script execution failed")
                print(f"   Error: {execution_result.get('result', {}).get('error', 'Unknown error')}")
        else:
            print("   Script validation failed")
            validation_errors = validation_result.get('validation', {}).get('errors', [])
            for error in validation_errors:
                print(f"   - {error}")
                
    except Exception as e:
        print(f"   Error during generative remediation: {e}")
        return
    
    print("\n6. Checking for approved scripts...")
    try:
        approved_scripts = agent.get_approved_scripts()
        print(f"   Found {len(approved_scripts)} approved scripts")
        
        for script in approved_scripts:
            print(f"   - Script {script['id']} for {script.get('target_system', 'unknown system')}")
            
    except Exception as e:
        print(f"   Error fetching approved scripts: {e}")

if __name__ == '__main__':
    main()