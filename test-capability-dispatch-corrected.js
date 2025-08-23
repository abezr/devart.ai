/**
 * Test script for capability-aware task dispatch functionality
 * This script verifies that the capability matching logic works correctly
 */

// Mock agent and task data for testing
const mockAgents = [
  {
    id: 'agent-1',
    alias: 'Python Developer',
    capabilities: ['python', 'testing', 'code-review']
  },
  {
    id: 'agent-2',
    alias: 'Frontend Developer',
    capabilities: ['react', 'javascript', 'css']
  },
  {
    id: 'agent-3',
    alias: 'Full Stack Developer',
    capabilities: ['python', 'react', 'javascript', 'testing']
  }
];

const mockTasks = [
  {
    id: 'task-1',
    title: 'Python Code Review',
    required_capabilities: ['python', 'code-review']
  },
  {
    id: 'task-2',
    title: 'Frontend Implementation',
    required_capabilities: ['react', 'javascript']
  },
  {
    id: 'task-3',
    title: 'Backend API Development',
    required_capabilities: ['python', 'testing']
  },
  {
    id: 'task-4',
    title: 'General Task',
    required_capabilities: null // No specific requirements
  }
];

/**
 * Mock function to simulate the capability matching logic
 * This replicates the PostgreSQL <@ operator logic
 */
function canAgentHandleTask(agentCapabilities, taskRequirements) {
  // If task has no requirements, any agent can handle it
  if (!taskRequirements || taskRequirements.length === 0) {
    return true;
  }
  
  // Check if all task requirements are contained in agent capabilities
  return taskRequirements.every(req => agentCapabilities.includes(req));
}

/**
 * Test the capability matching logic
 */
function testCapabilityMatching() {
  console.log('Testing capability-aware task dispatch...\n');
  
  // Test each task with each agent
  mockTasks.forEach(task => {
    console.log(`Task: ${task.title}`);
    if (task.required_capabilities) {
      console.log(`Required capabilities: [${task.required_capabilities.join(', ')}]`);
    } else {
      console.log('Required capabilities: None');
    }
    
    const compatibleAgents = mockAgents.filter(agent => 
      canAgentHandleTask(agent.capabilities, task.required_capabilities)
    );
    
    if (compatibleAgents.length > 0) {
      console.log('Compatible agents:');
      compatibleAgents.forEach(agent => {
        console.log(`  - ${agent.alias} [${agent.capabilities.join(', ')}]`);
      });
    } else {
      console.log('No compatible agents found');
    }
    
    console.log('---');
  });
  
  // Test specific scenarios
  console.log('\nSpecific test scenarios:');
  
  // Test that agent with subset of capabilities cannot handle task
  const pythonAgent = mockAgents.find(a => a.id === 'agent-1');
  const frontendTask = mockTasks.find(t => t.id === 'task-2');
  
  if (pythonAgent && frontendTask) {
    const canHandle = canAgentHandleTask(pythonAgent.capabilities, frontendTask.required_capabilities);
    console.log(`Can Python Developer handle Frontend Implementation task? ${canHandle ? 'Yes' : 'No'}`);
  }
  
  // Test that agent with matching capabilities can handle task
  const fullStackAgent = mockAgents.find(a => a.id === 'agent-3');
  const backendTask = mockTasks.find(t => t.id === 'task-3');
  
  if (fullStackAgent && backendTask) {
    const canHandle = canAgentHandleTask(fullStackAgent.capabilities, backendTask.required_capabilities);
    console.log(`Can Full Stack Developer handle Backend API Development task? ${canHandle ? 'Yes' : 'No'}`);
  }
  
  // Test backward compatibility with null requirements
  const generalTask = mockTasks.find(t => t.id === 'task-4');
  
  if (generalTask) {
    console.log(`Can any agent handle General Task (no requirements)? Yes`);
    mockAgents.forEach(agent => {
      const canHandle = canAgentHandleTask(agent.capabilities, generalTask.required_capabilities);
      console.log(`  - ${agent.alias}: ${canHandle ? 'Yes' : 'No'}`);
    });
  }
  
  // Show why Full Stack Developer cannot handle Python Code Review
  const pythonCodeReviewTask = mockTasks.find(t => t.id === 'task-1');
  console.log('\nDebug information:');
  console.log('Full Stack Developer capabilities:', fullStackAgent.capabilities);
  console.log('Python Code Review task requirements:', pythonCodeReviewTask.required_capabilities);
  console.log('Missing capability for Full Stack Developer:', 
    pythonCodeReviewTask.required_capabilities.filter(req => !fullStackAgent.capabilities.includes(req)));
}

// Run the tests
testCapabilityMatching();

module.exports = { canAgentHandleTask };