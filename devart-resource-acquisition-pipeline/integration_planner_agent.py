import os
import json
import pika
import requests
from supabase import create_client, Client
from langchain_openai import ChatOpenAI
from langchain.prompts import PromptTemplate
from langchain.chains import LLMChain

# Load environment variables
RABBITMQ_URL = os.getenv('RABBITMQ_URL', 'amqp://localhost')
RABBITMQ_EXCHANGE = os.getenv('RABBITMQ_OPPORTUNITY_EXCHANGE', 'opportunity_exchange')
INTEGRATION_PLANNING_QUEUE = os.getenv('RABBITMQ_INTEGRATION_PLANNING_QUEUE', 'integration_planning_queue')
DEVART_API_BASE_URL = os.getenv('DEVART_API_BASE_URL', 'http://localhost:8787')
DEVART_API_KEY = os.getenv('DEVART_API_KEY')
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY')

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Initialize the LLM
llm = ChatOpenAI(
    model="gpt-3.5-turbo",
    temperature=0,
    openai_api_key=OPENAI_API_KEY
)

# Define the prompt template for generating integration tasks
integration_prompt = PromptTemplate(
    input_variables=["provider_name", "opportunity_type", "key_features", "api_key_available"],
    template="""
You are an AI assistant that generates engineering tasks for integrating new services into devart.ai.
Based on the provider information, generate a list of tasks required for integration.

Provider: {provider_name}
Opportunity Type: {opportunity_type}
Key Features: {key_features}
API Key Available: {api_key_available}

Generate a JSON array of tasks with the following structure:
[
  {{
    "title": "Task title",
    "description": "Detailed task description",
    "priority": "HIGH|MEDIUM|LOW",
    "required_capabilities": ["capability1", "capability2"]
  }},
  ...
]

The tasks should cover:
1. Creating an SDK for the new service (if it's a service with an API)
2. Adding the new service to the Budget Supervisor (if it has costs)
3. Updating agent tools with the new SDK
4. Configuring monitoring and alerting
5. Updating documentation

Respond ONLY with valid JSON array and nothing else.
"""
)

# Create the integration planning chain
integration_chain = LLMChain(llm=llm, prompt=integration_prompt)

def get_opportunity_details(opportunity_id):
    """Get opportunity details from the database."""
    try:
        response = supabase.table("opportunities").select("*").eq("id", opportunity_id).execute()
        if response.data:
            return response.data[0]
        else:
            print(f"No opportunity found with ID: {opportunity_id}")
            return None
    except Exception as e:
        print(f"Error fetching opportunity details: {e}")
        return None

def generate_integration_tasks(opportunity_details):
    """Generate engineering tasks for integrating the new service."""
    try:
        provider_name = opportunity_details.get("provider_name", "")
        opportunity_type = opportunity_details.get("opportunity_type", "")
        key_features = opportunity_details.get("extracted_attributes", {}).get("key_features", [])
        api_key_available = "api_key" in opportunity_details.get("extracted_attributes", {})
        
        # Convert key features to a string
        features_str = ", ".join(key_features) if key_features else "No features specified"
        
        result = integration_chain.invoke({
            "provider_name": provider_name,
            "opportunity_type": opportunity_type,
            "key_features": features_str,
            "api_key_available": api_key_available
        })
        
        # Parse the JSON response
        tasks = json.loads(result["text"])
        return tasks
            
    except Exception as e:
        print(f"Error generating integration tasks: {e}")
        return []

def create_devart_task(task_data):
    """Create a task in devart.ai via API."""
    try:
        url = f"{DEVART_API_BASE_URL}/api/tasks"
        headers = {"Authorization": f"Bearer {DEVART_API_KEY}"}
        
        # Add default values if not present
        if "priority" not in task_data:
            task_data["priority"] = "MEDIUM"
            
        if "required_capabilities" not in task_data:
            task_data["required_capabilities"] = ["python"]
        
        response = requests.post(url, headers=headers, json=task_data)
        if response.status_code == 200:
            task_response = response.json()
            task_id = task_response.get("id")
            print(f"Created devart task with ID: {task_id}")
            return task_id
        else:
            print(f"Failed to create devart task: {response.status_code} - {response.text}")
            return None
            
    except Exception as e:
        print(f"Error creating devart task: {e}")
        return None

def update_opportunity_status(opportunity_id, status):
    """Update the status of an opportunity in the database."""
    try:
        response = supabase.table("opportunities").update({"status": status}).eq("id", opportunity_id).execute()
        if response.data:
            print(f"Updated opportunity {opportunity_id} status to {status}")
            return True
        else:
            print(f"Failed to update opportunity {opportunity_id} status")
            return False
            
    except Exception as e:
        print(f"Error updating opportunity status: {e}")
        return False

def process_message(ch, method, properties, body):
    """Process a message from the integration planning queue."""
    try:
        # Parse the message
        message = json.loads(body)
        opportunity_id = message.get('opportunity_id', '')
        url = message.get('url', '')
        opportunity_type = message.get('opportunity_type', '')
        api_key = message.get('api_key', None)
        
        print(f"Planning integration for opportunity: {opportunity_id}")
        
        # Get opportunity details from database
        opportunity_details = get_opportunity_details(opportunity_id)
        if not opportunity_details:
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)
            print(f"Failed to get opportunity details, requeuing: {opportunity_id}")
            return
        
        # Generate integration tasks
        tasks = generate_integration_tasks(opportunity_details)
        
        if tasks:
            # Create tasks in devart.ai
            created_tasks = []
            for task_data in tasks:
                task_id = create_devart_task(task_data)
                if task_id:
                    created_tasks.append(task_id)
            
            if created_tasks:
                # Update opportunity status to INTEGRATED
                update_opportunity_status(opportunity_id, "INTEGRATED")
                
                # Acknowledge the message
                ch.basic_ack(delivery_tag=method.delivery_tag)
                print(f"Successfully created {len(created_tasks)} integration tasks for opportunity: {opportunity_id}")
            else:
                # Reject and requeue the message
                ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)
                print(f"Failed to create integration tasks, requeuing: {opportunity_id}")
        else:
            # Update opportunity status to INTEGRATED (no tasks needed)
            update_opportunity_status(opportunity_id, "INTEGRATED")
            
            # Acknowledge the message
            ch.basic_ack(delivery_tag=method.delivery_tag)
            print(f"No integration tasks generated for opportunity: {opportunity_id}")
            
    except Exception as e:
        print(f"Error processing message: {e}")
        # Reject and requeue the message
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)

def main():
    """Main function to run the integration planner agent."""
    print("Starting Integration Planner Agent...")
    
    # Check if required environment variables are available
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Error: SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables must be set.")
        return
        
    if not DEVART_API_BASE_URL or not DEVART_API_KEY:
        print("Error: DEVART_API_BASE_URL and DEVART_API_KEY environment variables must be set.")
        return
        
    if not OPENAI_API_KEY:
        print("Error: OPENAI_API_KEY environment variable is not set.")
        return
    
    try:
        # Connect to RabbitMQ
        connection = pika.BlockingConnection(pika.URLParameters(RABBITMQ_URL))
        channel = connection.channel()
        
        # Declare exchange and queue
        channel.exchange_declare(exchange=RABBITMQ_EXCHANGE, exchange_type='direct', durable=True)
        channel.queue_declare(queue=INTEGRATION_PLANNING_QUEUE, durable=True)
        channel.queue_bind(exchange=RABBITMQ_EXCHANGE, queue=INTEGRATION_PLANNING_QUEUE, routing_key=INTEGRATION_PLANNING_QUEUE)
        
        # Set up consumer
        channel.basic_qos(prefetch_count=1)
        channel.basic_consume(queue=INTEGRATION_PLANNING_QUEUE, on_message_callback=process_message)
        
        print("Waiting for messages. To exit press CTRL+C")
        channel.start_consuming()
        
    except KeyboardInterrupt:
        print("Integration Planner Agent stopped by user.")
        if 'connection' in locals():
            connection.close()
    except Exception as e:
        print(f"Error in main loop: {e}")
        if 'connection' in locals():
            connection.close()

if __name__ == "__main__":
    main()