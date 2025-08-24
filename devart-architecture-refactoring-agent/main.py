import os
import time
import signal
import sys
from sdk.agent_sdk import ArchitectureRefactoringAgentSDK
from sdk.codebase_analyzer import CodebaseAnalyzer
from sdk.refactoring_suggester import RefactoringSuggester
from sdk.refactoring_executor import RefactoringExecutor
from sdk.otel_utils import initialize_opentelemetry, get_tracer
from opentelemetry import trace

# Initialize OpenTelemetry
otel_provider = initialize_opentelemetry()
tracer = get_tracer()

# Global flag for graceful shutdown
shutdown_requested = False

def signal_handler(signum, frame):
    global shutdown_requested
    print("Shutdown signal received...")
    shutdown_requested = True

def process_architecture_analysis(task):
    """Process an architecture analysis task received from the queue."""
    global shutdown_requested
    
    with tracer.start_as_current_span("process_architecture_analysis") as span:
        span.set_attribute("task.id", task.get('id', 'unknown'))
        span.set_attribute("task.title", task.get('title', 'unknown'))
        
        if shutdown_requested:
            span.set_attribute("task.result", "cancelled")
            span.set_status(trace.Status(trace.StatusCode.ERROR, "Task cancelled due to shutdown"))
            return False
            
        print(f"Processing architecture analysis task: {task['id']} - {task['title']}")
        
        try:
            # Update task status to IN_PROGRESS
            sdk.update_analysis_status(task['id'], "IN_PROGRESS")
            
            # Initialize components with integration modules
            github_token = os.getenv('GITHUB_TOKEN')
            analyzer = CodebaseAnalyzer(github_token=github_token)
            
            openai_api_key = os.getenv('OPENAI_API_KEY')
            suggester = RefactoringSuggester(openai_api_key=openai_api_key)
            
            # Clone repository
            repo_path = analyzer.clone_repository(
                task.get('repository_url'), 
                task.get('branch', 'main')
            )
            
            if not repo_path:
                print(f"Failed to clone repository for task {task['id']}")
                sdk.update_analysis_status(task['id'], "ERROR")
                return False
                
            # Analyze codebase
            findings = analyzer.analyze_codebase(
                repo_path, 
                task.get('target_modules')
            )
            
            # Report findings
            if findings:
                sdk.report_findings(task['id'], findings)
            
            # Generate suggestions
            suggestions = suggester.generate_suggestions(findings, {
                'repository_url': task.get('repository_url'),
                'branch': task.get('branch', 'main')
            })
            
            # Prioritize and score suggestions
            prioritized_suggestions = suggester.prioritize_suggestions(suggestions)
            scored_suggestions = suggester.score_suggestions(prioritized_suggestions)
            
            # Report suggestions
            if scored_suggestions:
                sdk.report_suggestions(task['id'], scored_suggestions)
            
            # Clean up cloned repository
            if os.path.exists(repo_path):
                import shutil
                shutil.rmtree(repo_path)
            
            # Mark the task as DONE
            sdk.update_analysis_status(task['id'], "DONE")
            print(f"Architecture analysis task {task['id']} completed.")
            
            # Record success in the span
            span.set_attribute("task.result", "success")
            span.set_attribute("task.status", "DONE")
            span.set_attribute("findings.count", len(findings))
            span.set_attribute("suggestions.count", len(scored_suggestions))
            
            return True
            
        except Exception as e:
            # Record the exception in the span
            span.record_exception(e)
            span.set_status(trace.Status(trace.StatusCode.ERROR, str(e)))
            span.set_attribute("task.result", "error")
            
            print(f"Error processing architecture analysis task {task['id']}: {e}")
            # Update task status to ERROR
            sdk.update_analysis_status(task['id'], "ERROR")
            return False

def execute_refactoring_task(task):
    """Execute an approved refactoring task."""
    with tracer.start_as_current_span("execute_refactoring_task") as span:
        span.set_attribute("task.id", task.get('id', 'unknown'))
        
        try:
            # Initialize executor with integration modules
            kubernetes_config_path = os.getenv('KUBERNETES_CONFIG_PATH')
            github_token = os.getenv('GITHUB_TOKEN')
                
            kubernetes_config = {}
            if kubernetes_config_path:
                kubernetes_config['config_path'] = kubernetes_config_path
                    
            executor = RefactoringExecutor(
                kubernetes_config=kubernetes_config,
                github_token=github_token
            )
            
            # Get suggestion details from task
            suggestion_id = task.get('suggestion_id')
            repository_url = task.get('repository_url')
            branch = task.get('branch', 'main')
            
            # In a real implementation, you would fetch the suggestion details from the API
            # For now, we'll simulate a suggestion
            suggestion = {
                "title": "Sample Refactoring",
                "implementation_plan": [
                    "Step 1: Analyze the code",
                    "Step 2: Make changes",
                    "Step 3: Run tests"
                ]
            }
            
            # Execute refactoring
            result = executor.execute_refactoring(suggestion, repository_url, branch)
            
            # Report execution result
            # In a real implementation, you would report this to the API
            print(f"Refactoring execution result: {result}")
            
            return result.get('success', False)
            
        except Exception as e:
            span.record_exception(e)
            span.set_status(trace.Status(trace.StatusCode.ERROR, str(e)))
            print(f"Error executing refactoring task {task['id']}: {e}")
            return False

def main():
    global shutdown_requested
    
    # Load configuration from environment variables
    AGENT_ID = os.getenv("DEVART_AGENT_ID")
    API_KEY = os.getenv("DEVART_API_KEY")
    API_BASE_URL = os.getenv("DEVART_API_BASE_URL", "https://your-api.workers.dev")
    
    # Validate required configuration
    if not all([AGENT_ID, API_KEY]):
        print("Error: DEVART_AGENT_ID and DEVART_API_KEY environment variables are required")
        sys.exit(1)
    
    # Set up signal handlers for graceful shutdown
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    global sdk
    sdk = ArchitectureRefactoringAgentSDK(agent_id=AGENT_ID, api_key=API_KEY, api_base_url=API_BASE_URL)
    print(f"Architecture Refactoring Agent {AGENT_ID} starting...")
    
    try:
        # Start consuming tasks from RabbitMQ
        print("Starting to consume architecture analysis tasks from RabbitMQ...")
        sdk.start_consuming(process_architecture_analysis)
        
        # Keep the main thread alive
        while not shutdown_requested:
            time.sleep(1)
            
    except KeyboardInterrupt:
        print("Keyboard interrupt received.")
    except Exception as e:
        print(f"Error in main loop: {e}")
    finally:
        print("Shutting down Architecture Refactoring Agent...")
        sdk.stop_consuming()
        print("Architecture Refactoring Agent shutdown complete.")

if __name__ == "__main__":
    main()