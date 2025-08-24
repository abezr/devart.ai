import os
import json
import pika
from langchain_openai import ChatOpenAI
from langchain.prompts import PromptTemplate
from langchain.chains import LLMChain

# Load environment variables
RABBITMQ_URL = os.getenv('RABBITMQ_URL', 'amqp://localhost')
RABBITMQ_EXCHANGE = os.getenv('RABBITMQ_OPPORTUNITY_EXCHANGE', 'opportunity_exchange')
PARSED_NEWS_QUEUE = os.getenv('RABBITMQ_PARSED_NEWS_QUEUE', 'parsed_news_queue')
CLASSIFIED_OPS_QUEUE = os.getenv('RABBITMQ_CLASSIFIED_OPS_QUEUE', 'classified_ops_queue')
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')

# Initialize the LLM
llm = ChatOpenAI(
    model="gpt-3.5-turbo",
    temperature=0,
    openai_api_key=OPENAI_API_KEY
)

# Define the prompt template for classification
classification_prompt = PromptTemplate(
    input_variables=["title", "content"],
    template="""
You are an AI assistant that classifies articles about technology opportunities.
Based on the title and content provided, classify the opportunity into one of the following categories:

1. FREE_TIER: Free service tiers or freemium offerings
2. TRIAL: Free trial offers or limited-time promotions
3. PARTNERSHIP_LEAD: Potential partnership opportunities or collaboration prospects
4. OTHER: Not relevant to our interests

Title: {title}
Content: {content}

Respond with ONLY the category name (FREE_TIER, TRIAL, PARTNERSHIP_LEAD, or OTHER) and nothing else.
"""
)

# Create the classification chain
classification_chain = LLMChain(llm=llm, prompt=classification_prompt)

def classify_opportunity(title, content):
    """Classify an opportunity using the LLM."""
    try:
        # If content is too long, truncate it to avoid token limits
        if len(content) > 3000:
            content = content[:3000] + "..."
            
        result = classification_chain.invoke({
            "title": title,
            "content": content
        })
        
        classification = result["text"].strip().upper()
        
        # Validate the classification
        valid_classifications = ["FREE_TIER", "TRIAL", "PARTNERSHIP_LEAD", "OTHER"]
        if classification in valid_classifications:
            return classification
        else:
            return "OTHER"
            
    except Exception as e:
        print(f"Error classifying opportunity: {e}")
        return "OTHER"

def publish_to_rabbitmq(message):
    """Publish a message to RabbitMQ."""
    try:
        connection = pika.BlockingConnection(pika.URLParameters(RABBITMQ_URL))
        channel = connection.channel()
        
        # Declare exchange and queue
        channel.exchange_declare(exchange=RABBITMQ_EXCHANGE, exchange_type='direct', durable=True)
        channel.queue_declare(queue=CLASSIFIED_OPS_QUEUE, durable=True)
        channel.queue_bind(exchange=RABBITMQ_EXCHANGE, queue=CLASSIFIED_OPS_QUEUE, routing_key=CLASSIFIED_OPS_QUEUE)
        
        # Publish message
        channel.basic_publish(
            exchange=RABBITMQ_EXCHANGE,
            routing_key=CLASSIFIED_OPS_QUEUE,
            body=json.dumps(message),
            properties=pika.BasicProperties(
                delivery_mode=2,  # Make message persistent
            )
        )
        
        connection.close()
        print(f"Published classified opportunity to {CLASSIFIED_OPS_QUEUE}")
        return True
    except Exception as e:
        print(f"Error publishing to RabbitMQ: {e}")
        return False

def process_message(ch, method, properties, body):
    """Process a message from the parsed news queue."""
    try:
        # Parse the message
        message = json.loads(body)
        url = message.get('url', '')
        title = message.get('title', '')
        clean_text = message.get('clean_text', '')
        source = message.get('source', '')
        timestamp = message.get('timestamp', '')
        
        print(f"Classifying opportunity: {url}")
        
        # Classify the opportunity
        opportunity_type = classify_opportunity(title, clean_text)
        
        # Only proceed if it's not classified as OTHER
        if opportunity_type != "OTHER":
            # Create enriched message
            enriched_message = {
                "url": url,
                "title": title,
                "clean_text": clean_text,
                "source": source,
                "timestamp": timestamp,
                "opportunity_type": opportunity_type
            }
            
            # Publish to classified opportunities queue
            if publish_to_rabbitmq(enriched_message):
                # Acknowledge the message
                ch.basic_ack(delivery_tag=method.delivery_tag)
                print(f"Successfully classified and published: {url} as {opportunity_type}")
            else:
                # Reject and requeue the message
                ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)
                print(f"Failed to publish, requeuing: {url}")
        else:
            # Acknowledge the message as we don't need to process it further
            ch.basic_ack(delivery_tag=method.delivery_tag)
            print(f"Opportunity classified as OTHER, discarding: {url}")
            
    except Exception as e:
        print(f"Error processing message: {e}")
        # Reject and requeue the message
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)

def main():
    """Main function to run the classifier agent."""
    print("Starting Classifier Agent...")
    
    # Check if OpenAI API key is available
    if not OPENAI_API_KEY:
        print("Error: OPENAI_API_KEY environment variable is not set.")
        return
    
    try:
        # Connect to RabbitMQ
        connection = pika.BlockingConnection(pika.URLParameters(RABBITMQ_URL))
        channel = connection.channel()
        
        # Declare exchange and queue
        channel.exchange_declare(exchange=RABBITMQ_EXCHANGE, exchange_type='direct', durable=True)
        channel.queue_declare(queue=PARSED_NEWS_QUEUE, durable=True)
        channel.queue_bind(exchange=RABBITMQ_EXCHANGE, queue=PARSED_NEWS_QUEUE, routing_key=PARSED_NEWS_QUEUE)
        
        # Set up consumer
        channel.basic_qos(prefetch_count=1)
        channel.basic_consume(queue=PARSED_NEWS_QUEUE, on_message_callback=process_message)
        
        print("Waiting for messages. To exit press CTRL+C")
        channel.start_consuming()
        
    except KeyboardInterrupt:
        print("Classifier Agent stopped by user.")
        if 'connection' in locals():
            connection.close()
    except Exception as e:
        print(f"Error in main loop: {e}")
        if 'connection' in locals():
            connection.close()

if __name__ == "__main__":
    main()