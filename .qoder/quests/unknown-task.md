# Phase 10: Ecosystem and Enterprise Scalability - Implementation Design

## Overview

This document outlines the detailed implementation design for Phase 10 of the devart.ai platform. The focus is on five key areas:

1. **Marketplace Implementation**: Enhancing the agent and workflow marketplace with robust filtering, validation, and access control
2. **Workflow Performance Data Collection**: Improving data collection for workflow analytics and optimization
3. **Error Handling and Retry Mechanism**: Implementing a sophisticated retry system with exponential backoff
4. **Production Sandbox Orchestration**: Completing the Kubernetes integration for secure agent execution
5. **Advanced Job Queue**: Enhancing the RabbitMQ-based task distribution system

## 1. Marketplace Implementation Enhancements

### Current State
The marketplace endpoints exist but lack filtering capabilities and proper validation.

### Enhancements Needed

#### GET /api/marketplace Endpoint
- Add filtering by tags, type, and other metadata
- Add pagination support
- Add sorting capabilities

#### POST /api/marketplace Endpoint
- Add comprehensive validation logic
- Prevent duplicate name/version combinations
- Add proper RBAC protection

### Implementation Plan

```
// Enhanced GET endpoint with filtering
app.get('/api/marketplace', async (c) => {
  const { type, tags, page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'desc' } = c.req.query();
  
  const supabase = createSupabaseClient(c.env);
  let query = supabase.from('marketplace_items').select('*');
  
  // Apply filters
  if (type) {
    query = query.eq('item_type', type);
  }
  
  if (tags) {
    // Filter by tags (assuming tags is a JSONB array)
    query = query.contains('tags', tags.split(','));
  }
  
  // Apply pagination
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  query = query.range(from, to);
  
  // Apply sorting
  query = query.order(sortBy, { ascending: sortOrder === 'asc' });
  
  const { data, error } = await query;
  
  if (error) return c.json({ error: 'Could not fetch marketplace items' }, 500);
  return c.json(data);
});

// Enhanced validation for POST endpoint
app.post('/api/marketplace', async (c) => {
  // RBAC check - only supervisors and admins can publish
  const userRole = getUserRole(c); // Implementation needed
  if (!['supervisor', 'admin'].includes(userRole)) {
    return c.json({ error: 'Insufficient permissions' }, 403);
  }
  
  const { item_type, name, description, version, tags, repository_url } = await c.req.json();
  
  // Validation
  if (!item_type || !name || !version) {
    return c.json({ error: 'Missing required fields: item_type, name, and version are required' }, 400);
  }
  
  // Validate item_type
  if (!['agent', 'workflow'].includes(item_type)) {
    return c.json({ error: 'Invalid item_type. Must be either "agent" or "workflow"' }, 400);
  }
  
  // Validate version format (semantic versioning)
  const semverRegex = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
  if (!semverRegex.test(version)) {
    return c.json({ error: 'Invalid version format. Must follow semantic versioning (e.g., 1.0.0)' }, 400);
  }
  
  const supabase = createSupabaseClient(c.env);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return c.json({ error: 'Authentication required' }, 401);

  // Check for duplicate name/version combination
  const { data: existingItem, error: fetchError } = await supabase
    .from('marketplace_items')
    .select('id')
    .eq('name', name)
    .eq('version', version)
    .single();
    
  if (existingItem) {
    return c.json({ error: 'An item with this name and version already exists' }, 409);
  }

  const { data: newItem, error: insertError } = await supabase
    .from('marketplace_items')
    .insert({ 
      item_type, 
      name, 
      description, 
      version, 
      tags, 
      repository_url, 
      publisher_id: user.id 
    })
    .select()
    .single();

  if (insertError) return c.json({ error: 'Failed to publish item' }, 500);
  return c.json(newItem, 201);
});
```

## 2. Workflow Performance Data Collection

### Current State
The workflow_runs table exists and the trigger endpoint creates workflow run records. However, the completion detection logic could be improved by using the PostgreSQL function.

### Enhancements Needed

#### Use PostgreSQL Function for Workflow Completion
Replace the current completion detection logic with a call to the `check_workflow_completion` PostgreSQL function.

### Implementation Plan

```
// Enhanced workflow completion detection in task status update endpoint
if (newStatus === 'DONE' || newStatus === 'QUARANTINED') {
  // ... existing agent update code ...
  
  // 4. If the task belongs to a workflow, check if the workflow is complete using PostgreSQL function
  if (task.workflow_run_id) {
    try {
      const { data: result, error: rpcError } = await supabase.rpc('check_workflow_completion', {
        workflow_run_id: task.workflow_run_id
      });
      
      if (rpcError) {
        console.error(`Failed to check workflow completion:`, rpcError);
      } else if (result) {
        console.log(`Workflow run ${task.workflow_run_id} completed`);
      }
    } catch (error) {
      console.error(`Error calling check_workflow_completion function:`, error);
    }
  }
}
```

## 3. Error Handling and Retry Mechanism

### Current State
The retry mechanism is implemented with the report-failure endpoint and task table columns, but could be enhanced with better configuration and monitoring.

### Enhancements Needed

#### Configurable Retry Logic
- Make max_retries configurable per task or globally
- Add exponential backoff for retries
- Add better error categorization

### Implementation Plan

```
// Enhanced retry mechanism with exponential backoff
app.post('/api/tasks/:taskId/report-failure', async (c) => {
  const taskId = c.req.param('taskId');
  const { agentId, errorMessage } = await c.req.json<{ agentId: string; errorMessage: string }>();

  const supabase = createSupabaseClient(c.env);

  // 1. Fetch the task to check its current state and max_retries
  const { data: task, error: fetchError } = await supabase
    .from('tasks')
    .select('retry_count, max_retries')
    .eq('id', taskId)
    .eq('agent_id', agentId)
    .single();

  if (fetchError || !task) {
    return c.json({ error: 'Task not found or agent not authorized.' }, 404);
  }

  const newRetryCount = task.retry_count + 1;
  let nextStatus = 'TODO'; // Re-queue for another attempt

  // 2. If max retries are exceeded, move to quarantine
  if (newRetryCount >= task.max_retries) {
    nextStatus = 'QUARANTINED';
  }

  // 3. Update the task and reset the agent's status
  const { data: updatedTask, error: updateError } = await supabase
    .from('tasks')
    .update({
      status: nextStatus,
      retry_count: newRetryCount,
      last_error: errorMessage,
      agent_id: null, // Unassign the task
    })
    .eq('id', taskId)
    .select()
    .single();
  
  // Reset the failing agent to IDLE so it can pick up new work
  await supabase.from('agents').update({ status: 'IDLE' }).eq('id', agentId);

  if (updateError) return c.json({ error: 'Failed to update task status.' }, 500);
  
  // 4. If the task is being re-queued, republish it to RabbitMQ with exponential backoff delay
  if (nextStatus === 'TODO') {
    try {
      // Calculate exponential backoff delay: baseDelay * 2^retryCount
      const baseDelay = 5000; // 5 seconds base delay
      const delayMs = baseDelay * Math.pow(2, task.retry_count);
      const maxDelay = 300000; // Maximum 5 minutes delay
      const finalDelay = Math.min(delayMs, maxDelay);
      
      await republishTaskWithDelay(taskId, finalDelay);
    } catch (publishError) {
      console.error('Failed to republish task to RabbitMQ:', publishError);
    }
  }

  return c.json(updatedTask);
});
```

## 4. Production Sandbox Orchestration

### Current State
Placeholder logic exists but needs to be replaced with actual Kubernetes integration.

### Enhancements Needed

#### Complete Kubernetes Integration
- Implement actual sandbox provisioning using Kubernetes API
- Implement proper resource cleanup
- Add monitoring and status checking capabilities

### Implementation Plan

```
// Enhanced Kubernetes service implementation
// File: apps/api/src/services/kubernetes.ts

import { KubeConfig, CoreV1Api, V1Pod, V1ObjectMeta, V1PodSpec, V1Container } from '@kubernetes/client-node';

const kc = new KubeConfig();
// Load from default location or environment variable
if (process.env.KUBE_CONFIG_DATA) {
  kc.loadFromString(Buffer.from(process.env.KUBE_CONFIG_DATA, 'base64').toString());
} else {
  kc.loadFromDefault();
}

const k8sApi = kc.makeApiClient(CoreV1Api);
const namespace = process.env.K8S_NAMESPACE || 'default';
const agentImage = process.env.AGENT_CONTAINER_IMAGE || 'devart-agent:latest';

export async function provisionSandbox(taskId: string): Promise<{ containerId: string; connectionDetails: any }> {
  try {
    const podName = `agent-sandbox-${taskId.toLowerCase().substring(0, 8)}`;
    
    const pod: V1Pod = {
      metadata: {
        name: podName,
        labels: {
          'devart/task-id': taskId,
          'devart/sandbox': 'true'
        }
      },
      spec: {
        containers: [
          {
            name: 'agent',
            image: agentImage,
            env: [
              { name: 'TASK_ID', value: taskId },
              { name: 'SANDBOX_MODE', value: 'true' }
            ],
            resources: {
              limits: {
                cpu: '1',
                memory: '1Gi'
              },
              requests: {
                cpu: '0.5',
                memory: '512Mi'
              }
            }
          }
        ],
        restartPolicy: 'Never'
      }
    };

    const response = await k8sApi.createNamespacedPod(namespace, pod);
    const containerId = response.body.metadata?.uid || '';
    
    // Wait for pod to be running
    await waitForPodRunning(podName);
    
    // Get connection details
    const connectionDetails = await getConnectionDetails(podName);
    
    return {
      containerId,
      connectionDetails
    };
  } catch (error) {
    console.error('Failed to provision sandbox:', error);
    throw new Error(`Failed to provision sandbox: ${error}`);
  }
}

export async function terminateSandbox(containerId: string): Promise<void> {
  try {
    await k8sApi.deleteNamespacedPod(containerId, namespace);
  } catch (error) {
    console.error('Failed to terminate sandbox:', error);
    throw new Error(`Failed to terminate sandbox: ${error}`);
  }
}

async function waitForPodRunning(podName: string): Promise<void> {
  const maxAttempts = 30;
  const interval = 2000; // 2 seconds
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await k8sApi.readNamespacedPod(podName, namespace);
      const phase = response.body.status?.phase;
      
      if (phase === 'Running') {
        return;
      }
      
      if (phase === 'Failed' || phase === 'Unknown') {
        throw new Error(`Pod entered failed state: ${phase}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, interval));
    } catch (error) {
      console.error(`Error checking pod status (attempt ${attempt + 1}):`, error);
      throw error;
    }
  }
  
  throw new Error('Pod failed to reach Running state within timeout');
}

async function getConnectionDetails(podName: string): Promise<any> {
  try {
    const response = await k8sApi.readNamespacedPod(podName, namespace);
    const podIP = response.body.status?.podIP;
    
    return {
      host: podIP,
      port: 22 // SSH port, adjust as needed
    };
  } catch (error) {
    console.error('Failed to get connection details:', error);
    return {};
  }
}
```

## 5. Advanced Job Queue Implementation

### Current State
Basic RabbitMQ integration exists but needs enhancements for production use.

### Enhancements Needed

#### Improved RabbitMQ Integration
- Add proper error handling and reconnection logic
- Implement delayed message exchange for retry delays
- Add dead letter queue configuration

### Implementation Plan

```
// Enhanced RabbitMQ service with delayed message exchange
// File: apps/api/src/services/rabbitmq.ts

import amqp from 'amqplib';

let connection: amqp.Connection | null = null;
let channel: amqp.Channel | null = null;

async function getRabbitMQConnection() {
  if (!connection || !channel) {
    const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://localhost';
    connection = await amqp.connect(rabbitmqUrl);
    
    // Handle connection errors
    connection.on('error', (err) => {
      console.error('RabbitMQ connection error:', err);
      connection = null;
      channel = null;
    });
    
    connection.on('close', () => {
      console.log('RabbitMQ connection closed');
      connection = null;
      channel = null;
    });
    
    channel = await connection.createChannel();
    
    // Assert the main tasks queue
    const queueName = process.env.RABBITMQ_TASKS_QUEUE || 'tasks.todo';
    await channel.assertQueue(queueName, { 
      durable: true,
      deadLetterExchange: 'tasks.dlx' // Dead letter exchange for failed messages
    });
    
    // Assert delayed message exchange if using the plugin
    if (process.env.RABBITMQ_DELAYED_EXCHANGE === 'true') {
      await channel.assertExchange('tasks.delayed', 'x-delayed-message', {
        durable: true,
        arguments: { 'x-delayed-type': 'direct' }
      });
      
      // Bind the delayed exchange to the main queue
      await channel.bindQueue(queueName, 'tasks.delayed', 'task');
    }
    
    // Assert dead letter queue
    await channel.assertQueue('tasks.dead-letter', { durable: true });
  }
  
  return { connection, channel };
}

export async function publishTask(taskId: string): Promise<void> {
  try {
    const { channel } = await getRabbitMQConnection();
    const queueName = process.env.RABBITMQ_TASKS_QUEUE || 'tasks.todo';
    
    channel.sendToQueue(queueName, Buffer.from(taskId), {
      persistent: true
    });
    
    console.log(`Published task ${taskId} to queue ${queueName}`);
  } catch (error) {
    console.error('Failed to publish task to RabbitMQ:', error);
    throw new Error(`Failed to publish task ${taskId} to RabbitMQ: ${error}`);
  }
}

export async function republishTaskWithDelay(taskId: string, delayMs: number = 5000): Promise<void> {
  try {
    const { channel } = await getRabbitMQConnection();
    
    if (process.env.RABBITMQ_DELAYED_EXCHANGE === 'true') {
      // Use delayed message exchange plugin
      channel.publish('tasks.delayed', 'task', Buffer.from(taskId), {
        persistent: true,
        headers: {
          'x-delay': delayMs
        }
      });
    } else {
      // Fallback to simple delayed republishing
      const message = JSON.stringify({
        taskId,
        delayUntil: Date.now() + delayMs
      });
      
      const queueName = process.env.RABBITMQ_TASKS_QUEUE || 'tasks.todo';
      channel.sendToQueue(queueName, Buffer.from(message), {
        persistent: true
      });
    }
    
    console.log(`Republished task ${taskId} with delay ${delayMs}ms`);
  } catch (error) {
    console.error('Failed to republish task to RabbitMQ:', error);
    throw new Error(`Failed to republish task ${taskId} to RabbitMQ: ${error}`);
  }
}
```

## 6. Agent Template Updates

### Current State
The agent template still uses the deprecated claim_task method.

### Enhancements Needed

#### Update Agent Template to Use RabbitMQ Consumer
Replace the polling-based approach with event-driven consumption.

### Implementation Plan

```
# File: devart-agent-template/main.py

import os
import signal
import sys
from sdk.agent_sdk import AgentSDK

# Global flag for graceful shutdown
shutdown_requested = False

def signal_handler(signum, frame):
    global shutdown_requested
    print("Shutdown signal received...")
    shutdown_requested = True

def main():
    # Load configuration from environment variables
    AGENT_ID = os.getenv("DEVART_AGENT_ID")
    API_KEY = os.getenv("DEVART_API_KEY")
    API_BASE_URL = os.getenv("DEVART_API_BASE_URL", "https://your-api.workers.dev")
    
    sdk = AgentSDK(agent_id=AGENT_ID, api_key=API_KEY, api_base_url=API_BASE_URL)
    print(f"Agent {AGENT_ID} starting...")
    
    # Set up signal handlers for graceful shutdown
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)

    def process_task(task):
        """Process a single task"""
        global shutdown_requested
        
        if shutdown_requested:
            return False
            
        print(f"Processing task: {task['id']} - {task['title']}")
        
        # --- AGENT'S CORE LOGIC GOES HERE ---
        print("Processing task...")
        # Simulate work
        import time
        time.sleep(10)
        print("Processing complete.")
        # --- END OF CORE LOGIC ---

        # Mark the task as done
        sdk.update_task_status(task['id'], "DONE")
        print(f"Task {task['id']} completed.")
        return True

    # Start consuming tasks from RabbitMQ
    print("Starting task consumer...")
    try:
        sdk.start_consuming(process_task)
    except KeyboardInterrupt:
        print("Keyboard interrupt received, shutting down...")
    except Exception as e:
        print(f"Error in consumer: {e}")
    finally:
        print("Agent stopped.")

if __name__ == "__main__":
    main()
```

```
# File: devart-agent-template/sdk/agent_sdk.py

import os
import requests
import pika
import json
import time

class AgentSDK:
    def __init__(self, agent_id, api_key, api_base_url):
        self.agent_id = agent_id
        self.api_key = api_key
        self.api_base_url = api_base_url
        self.rabbitmq_url = os.getenv("RABBITMQ_URL", "amqp://localhost")
        
    def _make_api_request(self, method, endpoint, data=None):
        """Make an authenticated request to the devart API"""
        url = f"{self.api_base_url}{endpoint}"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        try:
            if method == "GET":
                response = requests.get(url, headers=headers)
            elif method == "POST":
                response = requests.post(url, headers=headers, json=data)
            elif method == "PUT":
                response = requests.put(url, headers=headers, json=data)
                
            response.raise_for_status()
            return response.json() if response.content else None
        except requests.exceptions.RequestException as e:
            print(f"API request failed: {e}")
            return None

    def update_task_status(self, task_id, status):
        """Update the status of a task"""
        endpoint = f"/api/tasks/{task_id}/status"
        data = {
            "agentId": self.agent_id,
            "apiKey": self.api_key,
            "newStatus": status
        }
        return self._make_api_request("PUT", endpoint, data)
        
    def report_failure(self, task_id, error_message):
        """Report a task failure"""
        endpoint = f"/api/tasks/{task_id}/report-failure"
        data = {
            "agentId": self.agent_id,
            "errorMessage": error_message
        }
        return self._make_api_request("POST", endpoint, data)
        
    def start_consuming(self, callback):
        """Start consuming tasks from RabbitMQ"""
        def process_message(channel, method, properties, body):
            try:
                # Decode the message
                message_str = body.decode('utf-8')
                message_data = json.loads(message_str)
                
                # Handle delayed messages
                if isinstance(message_data, dict) and 'delayUntil' in message_data:
                    delay_until = message_data['delayUntil']
                    if time.time() < delay_until:
                        # Requeue the message with remaining delay
                        remaining_delay = int(delay_until - time.time()) * 1000
                        if remaining_delay > 0:
                            channel.basic_nack(
                                delivery_tag=method.delivery_tag,
                                requeue=False
                            )
                            # Republish with remaining delay
                            # This would need to call the API to republish
                            return
                        
                # Extract task ID (either directly or from structured message)
                task_id = message_data if isinstance(message_data, str) else message_data.get('taskId')
                
                if not task_id:
                    print("Invalid message format, no task ID found")
                    channel.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
                    return
                
                # Fetch task details from API
                task_endpoint = f"/api/tasks/{task_id}"
                task = self._make_api_request("GET", task_endpoint)
                
                if not task:
                    print(f"Failed to fetch task {task_id}")
                    channel.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
                    return
                
                # Process the task
                success = callback(task)
                
                if success:
                    # Acknowledge successful processing
                    channel.basic_ack(delivery_tag=method.delivery_tag)
                else:
                    # Report failure if processing was unsuccessful
                    self.report_failure(task_id, "Agent shutdown requested during processing")
                    channel.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
                    
            except Exception as e:
                print(f"Error processing message: {e}")
                # If we can't process the message, reject it
                channel.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
        
        # Connect to RabbitMQ
        connection = pika.BlockingConnection(pika.URLParameters(self.rabbitmq_url))
        channel = connection.channel()
        
        # Declare the queue
        queue_name = os.getenv("RABBITMQ_TASKS_QUEUE", "tasks.todo")
        channel.queue_declare(queue=queue_name, durable=True)
        
        # Set up consumer
        channel.basic_qos(prefetch_count=1)
        channel.basic_consume(queue=queue_name, on_message_callback=process_message)
        
        print("Waiting for tasks. To exit press CTRL+C")
        try:
            channel.start_consuming()
        except KeyboardInterrupt:
            channel.stop_consuming()
            connection.close()
            print("Consumer stopped.")
```

## Testing Strategy

1. **Unit Tests**:
   - Test marketplace filtering logic with various filter combinations
   - Test retry mechanism with exponential backoff calculations
   - Test workflow completion detection function with different scenarios
   - Test Kubernetes service functions with mocked API responses
   - Test RabbitMQ service functions with mocked connections

2. **Integration Tests**:
   - Test end-to-end marketplace publishing and retrieval with filters
   - Test task reporting and retry flow with actual RabbitMQ integration
   - Test sandbox provisioning and termination with a test Kubernetes cluster
   - Test workflow execution with multiple tasks and completion detection
   - Test agent template with RabbitMQ consumer and task processing

3. **Load Testing**:
   - Validate performance under high task volumes (1000+ concurrent tasks)
   - Test RabbitMQ message throughput and latency
   - Test Kubernetes sandbox provisioning scalability
   - Test database performance with large workflow_runs datasets

4. **Security Testing**:
   - Verify RBAC enforcement on marketplace endpoints
   - Test authentication and authorization flows for all endpoints
   - Validate input sanitization and validation on all API endpoints
   - Test Kubernetes RBAC and network policies for sandbox pods

## Rollout Plan

1. **Phase 1**: Enhance marketplace implementation with filtering and validation
   - Deploy enhanced GET/POST marketplace endpoints
   - Add comprehensive validation and RBAC protection
   - Test with a small group of users

2. **Phase 2**: Improve workflow performance data collection
   - Update task status endpoint to use PostgreSQL function
   - Add monitoring and metrics for workflow completion
   - Validate data accuracy in workflow_runs table

3. **Phase 3**: Enhance error handling and retry mechanisms
   - Deploy enhanced retry mechanism with exponential backoff
   - Add configuration options for retry policies
   - Monitor retry patterns and adjust defaults

4. **Phase 4**: Complete Kubernetes sandbox orchestration
   - Deploy production Kubernetes integration
   - Test sandbox provisioning and termination
   - Add monitoring and alerting for sandbox resources

5. **Phase 5**: Improve RabbitMQ integration and update agent templates
   - Deploy enhanced RabbitMQ service with delayed messaging
   - Update agent templates to use event-driven consumption
   - Monitor message processing and error rates