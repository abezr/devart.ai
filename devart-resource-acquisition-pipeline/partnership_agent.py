import os
import json
import pika
import requests
from supabase import create_client, Client
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
import time
import uuid

# Load environment variables
RABBITMQ_URL = os.getenv('RABBITMQ_URL', 'amqp://localhost')
RABBITMQ_EXCHANGE = os.getenv('RABBITMQ_OPPORTUNITY_EXCHANGE', 'opportunity_exchange')
NEW_OPPORTUNITY_QUEUE = os.getenv('RABBITMQ_NEW_OPPORTUNITY_QUEUE', 'new_opportunity_queue')
INTEGRATION_PLANNING_QUEUE = os.getenv('RABBITMQ_INTEGRATION_PLANNING_QUEUE', 'integration_planning_queue')
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY')
DEVART_API_BASE_URL = os.getenv('DEVART_API_BASE_URL', 'http://localhost:8787')
DEVART_API_KEY = os.getenv('DEVART_API_KEY')

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

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

def create_approval_task(opportunity_details):
    """Create an approval task in devart.ai UI."""
    try:
        # Prepare task data
        opportunity_type = opportunity_details.get("opportunity_type", "")
        provider_name = opportunity_details.get("provider_name", "")
        summary = opportunity_details.get("summary", "")
        
        task_title = f"Review {opportunity_type} Opportunity: {provider_name}"
        task_description = f"""
Opportunity Type: {opportunity_type}
Provider: {provider_name}
Summary: {summary}

Please review this opportunity and approve or reject the automated action.
If approved, the system will proceed with registration or outreach.
"""
        
        # Create task via devart.ai API
        url = f"{DEVART_API_BASE_URL}/api/tasks"
        headers = {"Authorization": f"Bearer {DEVART_API_KEY}"}
        payload = {
            "title": task_title,
            "description": task_description,
            "priority": "MEDIUM",
            "required_capabilities": ["supervisor"]
        }
        
        response = requests.post(url, headers=headers, json=payload)
        if response.status_code == 200:
            task_data = response.json()
            task_id = task_data.get("id")
            print(f"Created approval task with ID: {task_id}")
            return task_id
        else:
            print(f"Failed to create approval task: {response.status_code} - {response.text}")
            return None
            
    except Exception as e:
        print(f"Error creating approval task: {e}")
        return None

def wait_for_approval(task_id):
    """Wait for human approval of the task."""
    try:
        url = f"{DEVART_API_BASE_URL}/api/tasks/{task_id}"
        headers = {"Authorization": f"Bearer {DEVART_API_KEY}"}
        
        while True:
            response = requests.get(url, headers=headers)
            if response.status_code == 200:
                task_data = response.json()
                status = task_data.get("status", "")
                
                if status == "DONE":
                    print(f"Task {task_id} approved")
                    return True
                elif status == "QUARANTINED":
                    print(f"Task {task_id} rejected")
                    return False
                else:
                    print(f"Task {task_id} status: {status}. Waiting for approval...")
                    time.sleep(30)  # Check every 30 seconds
            else:
                print(f"Error checking task status: {response.status_code}")
                time.sleep(30)
                
    except Exception as e:
        print(f"Error waiting for approval: {e}")
        return False

def register_for_free_tier_or_trial(opportunity_details):
    """Automate registration for free tier or trial opportunities."""
    try:
        # This is a simplified example. In practice, you would need to:
        # 1. Navigate to the registration page
        # 2. Fill out the registration form
        # 3. Submit the form
        # 4. Extract the API key or confirmation
        
        # Set up Selenium WebDriver (you may need to adjust this based on your setup)
        chrome_options = Options()
        chrome_options.add_argument("--headless")  # Run in headless mode
        driver = webdriver.Chrome(options=chrome_options)
        
        # Example registration process (this would need to be customized for each service)
        registration_url = opportunity_details.get("source_url", "")
        driver.get(registration_url)
        
        # Wait for page to load
        WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.TAG_NAME, "body")))
        
        # This is a placeholder - actual implementation would depend on the specific service
        # You would need to find the appropriate form elements and fill them out
        print(f"Attempting registration at: {registration_url}")
        
        # Simulate registration process
        time.sleep(5)  # Wait for page to load
        
        # Close the browser
        driver.quit()
        
        # In a real implementation, you would extract the API key here
        api_key = f"simulated-api-key-{uuid.uuid4()}"
        return api_key
        
    except Exception as e:
        print(f"Error during registration: {e}")
        return None

def send_partnership_email(opportunity_details):
    """Send partnership outreach email."""
    try:
        # This is a simplified example. In practice, you would use an email service API
        # like SendGrid, Mailgun, or SMTP to send the actual email.
        
        provider_name = opportunity_details.get("provider_name", "")
        contact_info = opportunity_details.get("extracted_attributes", {}).get("contact_info", "")
        summary = opportunity_details.get("summary", "")
        
        email_content = f"""
Subject: Partnership Opportunity with devart.ai

Dear {provider_name} Team,

I hope this email finds you well. I'm reaching out from devart.ai, an autonomous AI platform for software development.

We've identified {provider_name} as a potential valuable partner for our platform. {summary}

We would love to explore potential collaboration opportunities between our platforms.

Best regards,
devart.ai Partnership Team
"""
        
        print(f"Sending partnership email to: {contact_info}")
        print(f"Email content:\n{email_content}")
        
        # In a real implementation, you would send the email via an email service API
        return True
        
    except Exception as e:
        print(f"Error sending partnership email: {e}")
        return False

def update_opportunity_status(opportunity_id, status, api_key=None):
    """Update the status of an opportunity in the database."""
    try:
        update_data = {"status": status}
        if api_key:
            # Store the API key securely (in practice, you would encrypt this)
            update_data["extracted_attributes"] = {
                "api_key": api_key
            }
            
        response = supabase.table("opportunities").update(update_data).eq("id", opportunity_id).execute()
        if response.data:
            print(f"Updated opportunity {opportunity_id} status to {status}")
            return True
        else:
            print(f"Failed to update opportunity {opportunity_id} status")
            return False
            
    except Exception as e:
        print(f"Error updating opportunity status: {e}")
        return False

def publish_to_rabbitmq(message):
    """Publish a message to RabbitMQ."""
    try:
        connection = pika.BlockingConnection(pika.URLParameters(RABBITMQ_URL))
        channel = connection.channel()
        
        # Declare exchange and queue
        channel.exchange_declare(exchange=RABBITMQ_EXCHANGE, exchange_type='direct', durable=True)
        channel.queue_declare(queue=INTEGRATION_PLANNING_QUEUE, durable=True)
        channel.queue_bind(exchange=RABBITMQ_EXCHANGE, queue=INTEGRATION_PLANNING_QUEUE, routing_key=INTEGRATION_PLANNING_QUEUE)
        
        # Publish message
        channel.basic_publish(
            exchange=RABBITMQ_EXCHANGE,
            routing_key=INTEGRATION_PLANNING_QUEUE,
            body=json.dumps(message),
            properties=pika.BasicProperties(
                delivery_mode=2,  # Make message persistent
            )
        )
        
        connection.close()
        print(f"Published secured opportunity to {INTEGRATION_PLANNING_QUEUE}")
        return True
    except Exception as e:
        print(f"Error publishing to RabbitMQ: {e}")
        return False

def process_message(ch, method, properties, body):
    """Process a message from the new opportunity queue."""
    try:
        # Parse the message
        message = json.loads(body)
        opportunity_id = message.get('opportunity_id', '')
        url = message.get('url', '')
        opportunity_type = message.get('opportunity_type', '')
        
        print(f"Processing opportunity: {opportunity_id}")
        
        # Get opportunity details from database
        opportunity_details = get_opportunity_details(opportunity_id)
        if not opportunity_details:
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)
            print(f"Failed to get opportunity details, requeuing: {opportunity_id}")
            return
        
        # Create approval task
        task_id = create_approval_task(opportunity_details)
        if not task_id:
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)
            print(f"Failed to create approval task, requeuing: {opportunity_id}")
            return
        
        # Wait for human approval
        approved = wait_for_approval(task_id)
        if not approved:
            # Update status to CONTACTED (rejected)
            update_opportunity_status(opportunity_id, "CONTACTED")
            ch.basic_ack(delivery_tag=method.delivery_tag)
            print(f"Opportunity {opportunity_id} rejected by supervisor")
            return
        
        # Process based on opportunity type
        api_key = None
        success = False
        
        if opportunity_type in ["FREE_TIER", "TRIAL"]:
            # Register for free tier or trial
            api_key = register_for_free_tier_or_trial(opportunity_details)
            if api_key:
                success = True
                # Update status to SECURED
                update_opportunity_status(opportunity_id, "SECURED", api_key)
        elif opportunity_type == "PARTNERSHIP_LEAD":
            # Send partnership email
            success = send_partnership_email(opportunity_details)
            if success:
                # Update status to CONTACTED
                update_opportunity_status(opportunity_id, "CONTACTED")
        
        if success:
            # Create message for next stage
            next_message = {
                "opportunity_id": opportunity_id,
                "url": url,
                "opportunity_type": opportunity_type,
                "api_key": api_key
            }
            
            # Publish to integration planning queue
            if publish_to_rabbitmq(next_message):
                # Acknowledge the message
                ch.basic_ack(delivery_tag=method.delivery_tag)
                print(f"Successfully processed and published: {opportunity_id}")
            else:
                # Reject and requeue the message
                ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)
                print(f"Failed to publish, requeuing: {opportunity_id}")
        else:
            # Update status to indicate failure
            update_opportunity_status(opportunity_id, "ANALYZED")
            ch.basic_ack(delivery_tag=method.delivery_tag)
            print(f"Failed to process opportunity: {opportunity_id}")
            
    except Exception as e:
        print(f"Error processing message: {e}")
        # Reject and requeue the message
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)

def main():
    """Main function to run the partnership agent."""
    print("Starting Partnership Agent...")
    
    # Check if required environment variables are available
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Error: SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables must be set.")
        return
    
    if not DEVART_API_BASE_URL or not DEVART_API_KEY:
        print("Error: DEVART_API_BASE_URL and DEVART_API_KEY environment variables must be set.")
        return
    
    try:
        # Connect to RabbitMQ
        connection = pika.BlockingConnection(pika.URLParameters(RABBITMQ_URL))
        channel = connection.channel()
        
        # Declare exchange and queue
        channel.exchange_declare(exchange=RABBITMQ_EXCHANGE, exchange_type='direct', durable=True)
        channel.queue_declare(queue=NEW_OPPORTUNITY_QUEUE, durable=True)
        channel.queue_bind(exchange=RABBITMQ_EXCHANGE, queue=NEW_OPPORTUNITY_QUEUE, routing_key=NEW_OPPORTUNITY_QUEUE)
        
        # Set up consumer
        channel.basic_qos(prefetch_count=1)
        channel.basic_consume(queue=NEW_OPPORTUNITY_QUEUE, on_message_callback=process_message)
        
        print("Waiting for messages. To exit press CTRL+C")
        channel.start_consuming()
        
    except KeyboardInterrupt:
        print("Partnership Agent stopped by user.")
        if 'connection' in locals():
            connection.close()
    except Exception as e:
        print(f"Error in main loop: {e}")
        if 'connection' in locals():
            connection.close()

if __name__ == "__main__":
    main()