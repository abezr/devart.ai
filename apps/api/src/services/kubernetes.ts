import * as k8s from '@kubernetes/client-node';
import { trace, SpanStatusCode } from '@opentelemetry/api';

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
  const tracer = trace.getTracer('kubernetes-service');
  
  return tracer.startActiveSpan('provisionSandbox', {
    attributes: {
      'task.id': taskId,
      'kubernetes.namespace': process.env.K8S_NAMESPACE || 'default',
    }
  }, async (span) => {
    const jobName = `sandbox-${taskId.toLowerCase().substring(0, 8)}`;
    const namespace = process.env.K8S_NAMESPACE || 'default';
    const containerImage = process.env.AGENT_CONTAINER_IMAGE || 'devart-agent:latest';
    const agentId = process.env.AGENT_ID || 'devart-agent';

    // Define the Job specification with proper sandboxing
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
                // Configure the container with necessary environment variables
                env: [
                  {
                    name: 'TASK_ID',
                    value: taskId
                  },
                  {
                    name: 'DEVART_AGENT_ID',
                    value: agentId
                  },
                  {
                    name: 'SANDBOX_MODE',
                    value: 'true'
                  }
                ],
                // Resource limits for sandboxing
                resources: {
                  limits: {
                    cpu: process.env.SANDBOX_CPU_LIMIT || '1',
                    memory: process.env.SANDBOX_MEMORY_LIMIT || '1Gi'
                  },
                  requests: {
                    cpu: process.env.SANDBOX_CPU_REQUEST || '500m',
                    memory: process.env.SANDBOX_MEMORY_REQUEST || '512Mi'
                  }
                },
                // Security context for additional sandboxing
                securityContext: {
                  readOnlyRootFilesystem: true,
                  runAsNonRoot: true,
                  runAsUser: 1000,
                  allowPrivilegeEscalation: false
                }
              }
            ],
            // Security context for the pod
            securityContext: {
              runAsNonRoot: true,
              runAsUser: 1000
            },
            restartPolicy: 'Never', // Jobs should not restart automatically
            // Service account for restricted permissions
            serviceAccountName: process.env.SANDBOX_SERVICE_ACCOUNT || 'default'
          }
        }
      }
    };

    try {
      // Create the Job in the specified namespace
      const createResponse = await k8sBatchApi.createNamespacedJob({
        namespace: namespace,
        body: jobSpec
      });
      
      // Wait for the pod to be running and get connection details
      const connectionDetails = await waitForPodRunningAndGetConnectionDetails(jobName, namespace);
      
      span.setAttribute('kubernetes.job.name', jobName);
      span.setAttribute('kubernetes.container.id', jobName);
      span.setAttribute('kubernetes.provisioning.success', true);
      
      return {
        containerId: jobName,
        connectionDetails
      };
    } catch (error) {
      console.error('Failed to create Kubernetes Job:', error);
      span.recordException(error as Error);
      span.setAttribute('kubernetes.provisioning.success', false);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: `Failed to provision sandbox for task ${taskId}: ${error}`
      });
      throw new Error(`Failed to provision sandbox for task ${taskId}: ${error}`);
    } finally {
      span.end();
    }
  });
}

/**
 * Terminate a sandbox by deleting the Kubernetes Job
 * @param containerId The ID of the container/job to terminate
 */
export async function terminateSandbox(containerId: string): Promise<void> {
  const tracer = trace.getTracer('kubernetes-service');
  
  return tracer.startActiveSpan('terminateSandbox', {
    attributes: {
      'kubernetes.container.id': containerId,
      'kubernetes.namespace': process.env.K8S_NAMESPACE || 'default',
    }
  }, async (span) => {
    const namespace = process.env.K8S_NAMESPACE || 'default';

    try {
      // Delete the Job (which will also delete associated pods)
      await k8sBatchApi.deleteNamespacedJob({
        name: containerId,
        namespace: namespace,
        body: {
          propagationPolicy: 'Foreground' // Ensure all child resources are deleted
        }
      });
      
      span.setAttribute('kubernetes.termination.success', true);
    } catch (error: any) {
      // If the job doesn't exist, that's fine - it may have already been cleaned up
      if (error && error.response && error.response.statusCode !== 404) {
        console.error('Failed to delete Kubernetes Job:', error);
        span.recordException(error);
        span.setAttribute('kubernetes.termination.success', false);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: `Failed to terminate sandbox ${containerId}: ${error}`
        });
        throw new Error(`Failed to terminate sandbox ${containerId}: ${error}`);
      }
    } finally {
      span.end();
    }
  });
}

/**
 * Get the status of a sandbox
 * @param containerId The ID of the container/job to check
 * @returns The status of the sandbox
 */
export async function getSandboxStatus(containerId: string): Promise<string> {
  const tracer = trace.getTracer('kubernetes-service');
  
  return tracer.startActiveSpan('getSandboxStatus', {
    attributes: {
      'kubernetes.container.id': containerId,
      'kubernetes.namespace': process.env.K8S_NAMESPACE || 'default',
    }
  }, async (span) => {
    const namespace = process.env.K8S_NAMESPACE || 'default';

    try {
      const response: any = await k8sBatchApi.readNamespacedJob({
        name: containerId,
        namespace: namespace
      });
      const job = response.body;
      
      // Check if the job is complete
      let status = 'RUNNING';
      if (job.status && job.status.succeeded && job.status.succeeded > 0) {
        status = 'COMPLETED';
      } else if (job.status && job.status.failed && job.status.failed > 0) {
        status = 'FAILED';
      }
      
      span.setAttribute('kubernetes.sandbox.status', status);
      return status;
    } catch (error: any) {
      if (error && error.response && error.response.statusCode === 404) {
        span.setAttribute('kubernetes.sandbox.status', 'NOT_FOUND');
        return 'NOT_FOUND';
      }
      console.error('Failed to get Kubernetes Job status:', error);
      span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: `Failed to get sandbox status for ${containerId}: ${error}`
      });
      throw new Error(`Failed to get sandbox status for ${containerId}: ${error}`);
    } finally {
      span.end();
    }
  });
}

/**
 * Wait for a pod to be running and get connection details
 * @param jobName The name of the job
 * @param namespace The namespace of the job
 * @returns Connection details for the pod
 */
async function waitForPodRunningAndGetConnectionDetails(jobName: string, namespace: string): Promise<object> {
  const maxAttempts = 30;
  const interval = 2000; // 2 seconds
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // List pods associated with the job
      const podListResponse: any = await k8sApi.listNamespacedPod({
        namespace: namespace,
        labelSelector: `job-name=${jobName}`
      });
      
      const pods = podListResponse.body.items;
      
      if (pods.length > 0) {
        const pod = pods[0];
        const phase = pod.status?.phase;
        
        if (phase === 'Running') {
          // Pod is running, return connection details
          return {
            podName: pod.metadata?.name,
            podIP: pod.status?.podIP,
            // ... rest of the function remains the same ...