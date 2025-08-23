import * as k8s from '@kubernetes/client-node';

/**
 * Load Kubernetes configuration from environment variable
 */
const kc = new k8s.KubeConfig();
// Load configuration from base64 encoded KUBE_CONFIG_DATA environment variable
if (process.env.KUBE_CONFIG_DATA) {
  const kubeConfigData = Buffer.from(process.env.KUBE_CONFIG_DATA, 'base64').toString();
  kc.loadFromString(kubeConfigData);
} else {
  // Fallback to default loading (kubeconfig file or in-cluster config)
  kc.loadFromDefault();
}

const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
const k8sBatchApi = kc.makeApiClient(k8s.BatchV1Api);

/**
 * Provision a sandbox by creating a Kubernetes Job for the task
 * @param taskId The ID of the task for which to create a sandbox
 * @returns Object containing containerId and connectionDetails
 */
export async function provisionSandbox(taskId: string): Promise<{ containerId: string, connectionDetails: object }> {
  const jobName = `sandbox-${taskId}`;
  const namespace = process.env.K8S_NAMESPACE || 'default';
  const containerImage = process.env.AGENT_CONTAINER_IMAGE || 'alpine:latest';

  // Define the Job specification
  const jobSpec: k8s.V1Job = {
    metadata: {
      name: jobName,
      labels: {
        'devart-task-id': taskId,
        'devart-sandbox': 'true'
      }
    },
    spec: {
      ttlSecondsAfterFinished: 300, // Automatically delete job 5 minutes after completion
      template: {
        spec: {
          containers: [
            {
              name: 'agent-sandbox',
              image: containerImage,
              // In a real implementation, you would configure the container
              // with the necessary environment variables, volumes, etc.
              env: [
                {
                  name: 'TASK_ID',
                  value: taskId
                }
              ],
              // Example resource limits
              resources: {
                limits: {
                  cpu: '1',
                  memory: '1Gi'
                },
                requests: {
                  cpu: '500m',
                  memory: '512Mi'
                }
              }
            }
          ],
          restartPolicy: 'Never' // Jobs should not restart automatically
        }
      }
    }
  };

  try {
    // Create the Job in the specified namespace
    await k8sBatchApi.createNamespacedJob(namespace, jobSpec);
    
    // For connection details, in a real implementation you would:
    // 1. Wait for the pod to be running
    // 2. Extract the pod IP or service endpoint
    // 3. Return connection information
    
    return {
      containerId: jobName,
      connectionDetails: {
        // Placeholder connection details
        host: 'localhost',
        port: 2222
      }
    };
  } catch (error) {
    console.error('Failed to create Kubernetes Job:', error);
    throw new Error(`Failed to provision sandbox for task ${taskId}: ${error}`);
  }
}

/**
 * Terminate a sandbox by deleting the Kubernetes Job
 * @param containerId The ID of the container/job to terminate
 */
export async function terminateSandbox(containerId: string): Promise<void> {
  const namespace = process.env.K8S_NAMESPACE || 'default';

  try {
    // Delete the Job (which will also delete associated pods)
    await k8sBatchApi.deleteNamespacedJob(containerId, namespace, undefined, undefined, undefined, undefined, undefined, {
      propagationPolicy: 'Foreground' // Ensure all child resources are deleted
    });
  } catch (error) {
    // If the job doesn't exist, that's fine - it may have already been cleaned up
    if (error && error.response && error.response.statusCode !== 404) {
      console.error('Failed to delete Kubernetes Job:', error);
      throw new Error(`Failed to terminate sandbox ${containerId}: ${error}`);
    }
  }
}

/**
 * Get the status of a sandbox
 * @param containerId The ID of the container/job to check
 * @returns The status of the sandbox
 */
export async function getSandboxStatus(containerId: string): Promise<string> {
  const namespace = process.env.K8S_NAMESPACE || 'default';

  try {
    const response = await k8sBatchApi.readNamespacedJob(containerId, namespace);
    const job = response.body;
    
    // Check if the job is complete
    if (job.status && job.status.succeeded && job.status.succeeded > 0) {
      return 'COMPLETED';
    } else if (job.status && job.status.failed && job.status.failed > 0) {
      return 'FAILED';
    } else {
      return 'RUNNING';
    }
  } catch (error) {
    if (error && error.response && error.response.statusCode === 404) {
      return 'NOT_FOUND';
    }
    console.error('Failed to get Kubernetes Job status:', error);
    throw new Error(`Failed to get sandbox status for ${containerId}: ${error}`);
  }
}