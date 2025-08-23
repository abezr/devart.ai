#!/usr/bin/env node
/**
 * Test script for the Kubernetes sandbox orchestrator.
 * This script tests the sandbox provisioning and termination functionality.
 */

import { provisionSandbox, terminateSandbox, getSandboxStatus } from './apps/api/src/services/kubernetes';

async function testKubernetesSandbox() {
  console.log('Testing Kubernetes sandbox orchestrator...');
  
  const testTaskId = 'test-task-001';
  
  try {
    // Test sandbox provisioning
    console.log('Provisioning sandbox...');
    const { containerId, connectionDetails } = await provisionSandbox(testTaskId);
    console.log(`Sandbox provisioned with container ID: ${containerId}`);
    console.log(`Connection details:`, connectionDetails);
    
    // Test sandbox status
    console.log('Checking sandbox status...');
    const status = await getSandboxStatus(containerId);
    console.log(`Sandbox status: ${status}`);
    
    // Wait a bit
    console.log('Waiting 10 seconds...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Test sandbox termination
    console.log('Terminating sandbox...');
    await terminateSandbox(containerId);
    console.log('Sandbox terminated successfully');
    
    console.log('Kubernetes sandbox test completed successfully');
  } catch (error) {
    console.error('Error during Kubernetes sandbox test:', error);
  }
}

// Run the test
testKubernetesSandbox();