import os
import yaml
from typing import Dict, Any, Optional, List
from kubernetes import client, config
from kubernetes.client.rest import ApiException
import base64
import time

class KubernetesIntegration:
    """Integrates with Kubernetes for sandbox environment provisioning and management."""
    
    def __init__(self, config_path: str = None, context: str = None):
        self.context = context
        
        try:
            if config_path:
                config.load_kube_config(config_file=config_path, context=context)
            else:
                # Try to load in-cluster config first, then kubeconfig
                try:
                    config.load_incluster_config()
                except config.ConfigException:
                    config.load_kube_config(context=context)
        except Exception as e:
            print(f"Warning: Could not load Kubernetes configuration: {e}")
            # Continue without Kubernetes connectivity
            
        self.core_v1 = client.CoreV1Api()
        self.apps_v1 = client.AppsV1Api()
        self.batch_v1 = client.BatchV1Api()
        
    def create_namespace(self, namespace_name: str) -> Optional[client.V1Namespace]:
        """
        Create a new Kubernetes namespace for sandbox environments.
        
        Args:
            namespace_name: Name of the namespace to create
            
        Returns:
            Created namespace object or None if failed
        """
        namespace = client.V1Namespace(
            metadata=client.V1ObjectMeta(
                name=namespace_name,
                labels={
                    "devart.ai/sandbox": "true",
                    "devart.ai/managed": "true"
                }
            )
        )
        
        try:
            api_response = self.core_v1.create_namespace(namespace)
            print(f"Namespace '{namespace_name}' created successfully")
            return api_response
        except ApiException as e:
            if e.status == 409:  # Namespace already exists
                print(f"Namespace '{namespace_name}' already exists")
                return self.core_v1.read_namespace(namespace_name)
            else:
                print(f"Exception when creating namespace: {e}")
                return None
        except Exception as e:
            print(f"Unexpected error when creating namespace: {e}")
            return None
            
    def create_sandbox_deployment(self, namespace: str, repository_url: str, 
                                branch: str = "main", resources: Dict = None) -> Optional[client.V1Deployment]:
        """
        Create a sandbox deployment for refactoring execution.
        
        Args:
            namespace: Namespace to create the deployment in
            repository_url: URL of the repository to clone
            branch: Branch to clone
            resources: Resource limits and requests
            
        Returns:
            Created deployment object or None if failed
        """
        # Default resources if not specified
        if resources is None:
            resources = {
                "requests": {"memory": "512Mi", "cpu": "250m"},
                "limits": {"memory": "1Gi", "cpu": "500m"}
            }
            
        # Generate a unique name for the sandbox
        sandbox_name = f"refactoring-sandbox-{int(time.time())}"
        
        # Define the deployment
        deployment = client.V1Deployment(
            api_version="apps/v1",
            kind="Deployment",
            metadata=client.V1ObjectMeta(
                name=sandbox_name,
                namespace=namespace,
                labels={
                    "app": sandbox_name,
                    "devart.ai/sandbox": "true"
                }
            ),
            spec=client.V1DeploymentSpec(
                replicas=1,
                selector=client.V1LabelSelector(
                    match_labels={"app": sandbox_name}
                ),
                template=client.V1PodTemplateSpec(
                    metadata=client.V1ObjectMeta(
                        labels={"app": sandbox_name}
                    ),
                    spec=client.V1PodSpec(
                        containers=[
                            client.V1Container(
                                name="sandbox",
                                image="python:3.9-slim",
                                command=["sh", "-c"],
                                args=[
                                    "apt-get update && apt-get install -y git && "
                                    "git clone --branch $BRANCH $REPO_URL /workspace && "
                                    "cd /workspace && "
                                    "if [ -f requirements.txt ]; then pip install -r requirements.txt; fi && "
                                    "tail -f /dev/null"  # Keep container running
                                ],
                                env=[
                                    client.V1EnvVar(name="REPO_URL", value=repository_url),
                                    client.V1EnvVar(name="BRANCH", value=branch)
                                ],
                                working_dir="/workspace",
                                volume_mounts=[
                                    client.V1VolumeMount(
                                        name="workspace",
                                        mount_path="/workspace"
                                    )
                                ],
                                resources=client.V1ResourceRequirements(
                                    requests=resources["requests"],
                                    limits=resources["limits"]
                                )
                            )
                        ],
                        volumes=[
                            client.V1Volume(
                                name="workspace",
                                empty_dir=client.V1EmptyDirVolumeSource()
                            )
                        ]
                    )
                )
            )
        )
        
        try:
            api_response = self.apps_v1.create_namespaced_deployment(
                namespace=namespace,
                body=deployment
            )
            print(f"Sandbox deployment '{sandbox_name}' created successfully")
            return api_response
        except ApiException as e:
            print(f"Exception when creating sandbox deployment: {e}")
            return None
        except Exception as e:
            print(f"Unexpected error when creating sandbox deployment: {e}")
            return None
            
    def create_sandbox_service(self, namespace: str, sandbox_name: str) -> Optional[client.V1Service]:
        """
        Create a service for the sandbox deployment.
        
        Args:
            namespace: Namespace to create the service in
            sandbox_name: Name of the sandbox deployment
            
        Returns:
            Created service object or None if failed
        """
        service = client.V1Service(
            api_version="v1",
            kind="Service",
            metadata=client.V1ObjectMeta(
                name=f"{sandbox_name}-service",
                namespace=namespace,
                labels={"devart.ai/sandbox": "true"}
            ),
            spec=client.V1ServiceSpec(
                selector={"app": sandbox_name},
                ports=[
                    client.V1ServicePort(
                        name="http",
                        port=80,
                        target_port=8080
                    )
                ],
                type="ClusterIP"
            )
        )
        
        try:
            api_response = self.core_v1.create_namespaced_service(
                namespace=namespace,
                body=service
            )
            print(f"Sandbox service '{sandbox_name}-service' created successfully")
            return api_response
        except ApiException as e:
            print(f"Exception when creating sandbox service: {e}")
            return None
        except Exception as e:
            print(f"Unexpected error when creating sandbox service: {e}")
            return None
            
    def provision_sandbox_environment(self, repository_url: str, branch: str = "main", 
                                    resources: Dict = None) -> Optional[Dict]:
        """
        Provision a complete sandbox environment for refactoring execution.
        
        Args:
            repository_url: URL of the repository to clone
            branch: Branch to clone
            resources: Resource limits and requests
            
        Returns:
            Sandbox environment information or None if failed
        """
        # Generate a unique namespace name
        namespace_name = f"devart-sandbox-{int(time.time())}"
        
        # Create namespace
        namespace = self.create_namespace(namespace_name)
        if not namespace:
            return None
            
        # Create sandbox deployment
        deployment = self.create_sandbox_deployment(namespace_name, repository_url, branch, resources)
        if not deployment:
            return None
            
        # Create service
        service = self.create_sandbox_service(namespace_name, deployment.metadata.name)
        
        # Wait for deployment to be ready
        if not self.wait_for_deployment_ready(namespace_name, deployment.metadata.name):
            print("Warning: Deployment did not become ready in time")
            
        return {
            "namespace": namespace_name,
            "deployment": deployment.metadata.name,
            "service": service.metadata.name if service else None,
            "status": "PROVISIONED"
        }
        
    def wait_for_deployment_ready(self, namespace: str, deployment_name: str, 
                                timeout: int = 300) -> bool:
        """
        Wait for a deployment to become ready.
        
        Args:
            namespace: Namespace of the deployment
            deployment_name: Name of the deployment
            timeout: Timeout in seconds
            
        Returns:
            True if deployment is ready, False otherwise
        """
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            try:
                deployment = self.apps_v1.read_namespaced_deployment(
                    name=deployment_name,
                    namespace=namespace
                )
                
                if (deployment.status.ready_replicas and 
                    deployment.status.ready_replicas >= 1):
                    return True
                    
                time.sleep(5)
            except ApiException as e:
                print(f"Error checking deployment status: {e}")
                return False
            except Exception as e:
                print(f"Unexpected error checking deployment status: {e}")
                return False
                
        return False
        
    def execute_command_in_sandbox(self, namespace: str, pod_name: str, 
                                 command: List[str]) -> Optional[Dict]:
        """
        Execute a command in a sandbox pod.
        
        Args:
            namespace: Namespace of the pod
            pod_name: Name of the pod
            command: Command to execute
            
        Returns:
            Command execution result or None if failed
        """
        try:
            # Execute command in pod
            exec_response = self.core_v1.connect_get_namespaced_pod_exec(
                name=pod_name,
                namespace=namespace,
                command=command,
                stderr=True,
                stdin=False,
                stdout=True,
                tty=False
            )
            
            return {
                "success": True,
                "output": exec_response
            }
        except ApiException as e:
            print(f"Exception when executing command in pod: {e}")
            return {
                "success": False,
                "error": str(e)
            }
        except Exception as e:
            print(f"Unexpected error when executing command in pod: {e}")
            return {
                "success": False,
                "error": str(e)
            }
            
    def get_sandbox_pod_name(self, namespace: str, deployment_name: str) -> Optional[str]:
        """
        Get the name of the pod for a sandbox deployment.
        
        Args:
            namespace: Namespace of the deployment
            deployment_name: Name of the deployment
            
        Returns:
            Pod name or None if not found
        """
        try:
            pods = self.core_v1.list_namespaced_pod(
                namespace=namespace,
                label_selector=f"app={deployment_name}"
            )
            
            if pods.items:
                return pods.items[0].metadata.name
            else:
                return None
        except ApiException as e:
            print(f"Exception when listing pods: {e}")
            return None
        except Exception as e:
            print(f"Unexpected error when listing pods: {e}")
            return None
            
    def cleanup_sandbox_environment(self, namespace: str) -> bool:
        """
        Clean up a sandbox environment by deleting the namespace.
        
        Args:
            namespace: Name of the namespace to delete
            
        Returns:
            True if cleanup was successful, False otherwise
        """
        try:
            self.core_v1.delete_namespace(name=namespace)
            print(f"Namespace '{namespace}' deletion initiated")
            return True
        except ApiException as e:
            if e.status == 404:  # Namespace not found
                print(f"Namespace '{namespace}' not found")
                return True
            else:
                print(f"Exception when deleting namespace: {e}")
                return False
        except Exception as e:
            print(f"Unexpected error when deleting namespace: {e}")
            return False
            
    def list_sandbox_environments(self) -> Optional[List[Dict]]:
        """
        List all sandbox environments (namespaces with devart.ai labels).
        
        Returns:
            List of sandbox environments or None if failed
        """
        try:
            namespaces = self.core_v1.list_namespace(
                label_selector="devart.ai/sandbox=true"
            )
            
            sandboxes = []
            for ns in namespaces.items:
                sandboxes.append({
                    "name": ns.metadata.name,
                    "creation_timestamp": ns.metadata.creation_timestamp,
                    "status": ns.status.phase
                })
                
            return sandboxes
        except ApiException as e:
            print(f"Exception when listing namespaces: {e}")
            return None
        except Exception as e:
            print(f"Unexpected error when listing namespaces: {e}")
            return None