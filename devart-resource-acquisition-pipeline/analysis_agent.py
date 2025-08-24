import os
import json
import pika
from supabase import create_client, Client
from langchain_openai import ChatOpenAI
from langchain.prompts import PromptTemplate
from langchain.chains import LLMChain
import uuid

# Load environment variables
RABBITMQ_URL = os.getenv('RABBITMQ_URL', 'amqp://localhost')
RABBITMQ_EXCHANGE = os.getenv('RABBITMQ_OPPORTUNITY_EXCHANGE', 'opportunity_exchange')
CLASSIFIED_OPS_QUEUE = os.getenv('RABBITMQ_CLASSIFIED_OPS_QUEUE', 'classified_ops_queue')
NEW_OPPORTUNITY_QUEUE = os.getenv('RABBITMQ_NEW_OPPORTUNITY_QUEUE', 'new_opportunity_queue')
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

# Define the prompt template for analysis
analysis_prompt = PromptTemplate(
    input_variables=["title", "content", "opportunity_type"],
    template="""
You are an AI assistant that extracts structured information from articles about technology opportunities.
Based on the title, content, and opportunity type, extract the following information:

1. Provider name: The name of the company or service provider
2. Key features: Main features or capabilities of the service
3. Limitations: Any limitations, restrictions, or constraints
4. Contact information: Email, website, or other contact details
5. Pricing details: Cost information, if available
6. Summary: A brief summary of the opportunity (2-3 sentences)

Opportunity Type: {opportunity_type}
Title: {title}
Content: {content}

Respond in JSON format with the following structure:
{{
  "provider_name": "Provider Name",
  "key_features": ["Feature 1", "Feature 2", "Feature 3"],
  "limitations": ["Limitation 1", "Limitation 2"],
  "contact_info": "Contact information",
  "pricing_details": "Pricing information",
  "summary": "Brief summary of the opportunity"
}}

Respond ONLY with valid JSON and nothing else.
"""
)

# Create the analysis chain
analysis_chain = LLMChain(llm=llm, prompt=analysis_prompt)

def extract_opportunity_data(title, content, opportunity_type):
    """Extract structured data about an opportunity using the LLM."""
    try:
        # If content is too long, truncate it to avoid token limits
        if len(content) > 3000:
            content = content[:3000] + "..."
            
        result = analysis_chain.invoke({
            "title": title,
            "content": content,
            "opportunity_type": opportunity_type
        })
        
        # Parse the JSON response
        extracted_data = json.loads(result["text"])
        return extracted_data
            
    except Exception as e:
        print(f"Error extracting opportunity data: {e}")
        return {}

def insert_opportunity_to_db(opportunity_data):
    """Insert opportunity data into the opportunities table."""
    try:
        # Prepare the data for insertion
        data = {
            "source_url": opportunity_data.get("url", ""),
            "provider_name": opportunity_data.get("provider_name", ""),
            "opportunity_type": opportunity_data.get("opportunity_type", ""),
            "summary": opportunity_data.get("summary", ""),
            "extracted_attributes": {
                "key_features": opportunity_data.get("key_features", []),
                "limitations": opportunity_data.get("limitations", []),
                "contact_info": opportunity_data.get("contact_info", ""),
                "pricing_details": opportunity_data.get("pricing_details", "")
            },
            "status": "ANALYZED"
        }
        
        # Insert into the database
        response = supabase.table("opportunities").insert(data).execute()
        
        if response.data:
            opportunity_id = response.data[0]["id"]
            print(f"Successfully inserted opportunity with ID: {opportunity_id}")
            return opportunity_id
        else:
            print("Failed to insert opportunity into database")
            return None
            
    except Exception as e:
        print(f"Error inserting opportunity to database: {e}")
        return None

def publish_to_rabbitmq(message):
    """Publish a message to RabbitMQ."""
    try:
        connection = pika.BlockingConnection(pika.URLParameters(RABBITMQ_URL))
        channel = connection.channel()
        
        # Declare exchange and queue
        channel.exchange_declare(exchange=RABBITMQ_EXCHANGE, exchange_type='direct', durable=True)
        channel.queue_declare(queue=NEW_OPPORTUNITY_QUEUE, durable=True)
        channel.queue_bind(exchange=RABBITMQ_EXCHANGE, queue=NEW_OPPORTUNITY_QUEUE, routing_key=NEW_OPPORTUNITY_QUEUE)
        
        # Publish message
        channel.basic_publish(
            exchange=RABBITMQ_EXCHANGE,
            routing_key=NEW_OPPORTUNITY_QUEUE,
            body=json.dumps(message),
            properties=pika.BasicProperties(
                delivery_mode=2,  # Make message persistent
            )
        )
        
        connection.close()
        print(f"Published new opportunity to {NEW_OPPORTUNITY_QUEUE}")
        return True
    except Exception as e:
        print(f"Error publishing to RabbitMQ: {e}")
        return False

def process_message(ch, method, properties, body):
    """Process a message from the classified opportunities queue."""
    try:
        # Parse the message
        message = json.loads(body)
        url = message.get('url', '')
        title = message.get('title', '')
        clean_text = message.get('clean_text', '')
        source = message.get('source', '')
        timestamp = message.get('timestamp', '')
        opportunity_type = message.get('opportunity_type', '')
        
        print(f"Analyzing opportunity: {url}")
        
        # Extract structured data
        extracted_data = extract_opportunity_data(title, clean_text, opportunity_type)
        
        if extracted_data:
            # Add URL and other metadata to the extracted data
            extracted_data["url"] = url
            extracted_data["title"] = title
            extracted_data["source"] = source
            extracted_data["timestamp"] = timestamp
            extracted_data["opportunity_type"] = opportunity_type
            
            # Insert into database
            opportunity_id = insert_opportunity_to_db(extracted_data)
            
            if opportunity_id:
                # Create message for next stage
                next_message = {
                    "opportunity_id": opportunity_id,
                    "url": url,
                    "opportunity_type": opportunity_type
                }
                
                # Publish to new opportunity queue
                if publish_to_rabbitmq(next_message):
                    # Acknowledge the message
                    ch.basic_ack(delivery_tag=method.delivery_tag)
                    print(f"Successfully analyzed and published: {url}")
                else:
                    # Reject and requeue the message
                    ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)
                    print(f"Failed to publish, requeuing: {url}")
            else:
                # Reject and requeue the message
                ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)
                print(f"Failed to insert into database, requeuing: {url}")
        else:
            # Reject and requeue the message
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)
            print(f"Failed to extract data, requeuing: {url}")
            
    except Exception as e:
        print(f"Error processing message: {e}")
        # Reject and requeue the message
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)

def main():
    """Main function to run the analysis agent."""
    print("Starting Analysis Agent...")
    
    # Check if required environment variables are available
    if not OPENAI_API_KEY:
        print("Error: OPENAI_API_KEY environment variable is not set.")
        return
        
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Error: SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables must be set.")
        return
    
    try:
        # Connect to RabbitMQ
        connection = pika.BlockingConnection(pika.URLParameters(RABBITMQ_URL))
        channel = connection.channel()
        
        # Declare exchange and queue
        channel.exchange_declare(exchange=RABBITMQ_EXCHANGE, exchange_type='direct', durable=True)
        channel.queue_declare(queue=CLASSIFIED_OPS_QUEUE, durable=True)
        channel.queue_bind(exchange=RABBITMQ_EXCHANGE, queue=CLASSIFIED_OPS_QUEUE, routing_key=CLASSIFIED_OPS_QUEUE)
        
        # Set up consumer
        channel.basic_qos(prefetch_count=1)
        channel.basic_consume(queue=CLASSIFIED_OPS_QUEUE, on_message_callback=process_message)
        
        print("Waiting for messages. To exit press CTRL+C")
        channel.start_consuming()
        
    except KeyboardInterrupt:
        print("Analysis Agent stopped by user.")
        if 'connection' in locals():
            connection.close()
    except Exception as e:
        print(f"Error in main loop: {e}")
        if 'connection' in locals():
            connection.close()

if __name__ == "__main__":
    main()