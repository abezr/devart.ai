import os
import json
import pika
import trafilatura
from bs4 import BeautifulSoup

# Load environment variables
RABBITMQ_URL = os.getenv('RABBITMQ_URL', 'amqp://localhost')
RABBITMQ_EXCHANGE = os.getenv('RABBITMQ_OPPORTUNITY_EXCHANGE', 'opportunity_exchange')
RAW_NEWS_QUEUE = os.getenv('RABBITMQ_RAW_NEWS_QUEUE', 'raw_news_queue')
PARSED_NEWS_QUEUE = os.getenv('RABBITMQ_PARSED_NEWS_QUEUE', 'parsed_news_queue')

def extract_text_with_trafilatura(html_content):
    """Extract clean text content using trafilatura."""
    try:
        extracted = trafilatura.extract(html_content, include_comments=False, include_tables=True)
        return extracted if extracted else ""
    except Exception as e:
        print(f"Error extracting text with trafilatura: {e}")
        return ""

def extract_text_with_beautifulsoup(html_content):
    """Extract clean text content using BeautifulSoup as fallback."""
    try:
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Remove script and style elements
        for script in soup(["script", "style"]):
            script.decompose()
        
        # Get text content
        text = soup.get_text()
        
        # Break into lines and remove leading and trailing space on each
        lines = (line.strip() for line in text.splitlines())
        # Break multi-headlines into a line each
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        # Drop blank lines
        text = ' '.join(chunk for chunk in chunks if chunk)
        
        return text
    except Exception as e:
        print(f"Error extracting text with BeautifulSoup: {e}")
        return ""

def publish_to_rabbitmq(message):
    """Publish a message to RabbitMQ."""
    try:
        connection = pika.BlockingConnection(pika.URLParameters(RABBITMQ_URL))
        channel = connection.channel()
        
        # Declare exchange and queue
        channel.exchange_declare(exchange=RABBITMQ_EXCHANGE, exchange_type='direct', durable=True)
        channel.queue_declare(queue=PARSED_NEWS_QUEUE, durable=True)
        channel.queue_bind(exchange=RABBITMQ_EXCHANGE, queue=PARSED_NEWS_QUEUE, routing_key=PARSED_NEWS_QUEUE)
        
        # Publish message
        channel.basic_publish(
            exchange=RABBITMQ_EXCHANGE,
            routing_key=PARSED_NEWS_QUEUE,
            body=json.dumps(message),
            properties=pika.BasicProperties(
                delivery_mode=2,  # Make message persistent
            )
        )
        
        connection.close()
        print(f"Published parsed content to {PARSED_NEWS_QUEUE}")
        return True
    except Exception as e:
        print(f"Error publishing to RabbitMQ: {e}")
        return False

def process_message(ch, method, properties, body):
    """Process a message from the raw news queue."""
    try:
        # Parse the message
        message = json.loads(body)
        url = message.get('url', '')
        raw_html = message.get('raw_html', '')
        title = message.get('title', '')
        source = message.get('source', '')
        timestamp = message.get('timestamp', '')
        
        print(f"Processing article: {url}")
        
        # Extract clean text content
        clean_text = extract_text_with_trafilatura(raw_html)
        
        # Fallback to BeautifulSoup if trafilatura fails
        if not clean_text:
            clean_text = extract_text_with_beautifulsoup(raw_html)
        
        # Create enriched message
        enriched_message = {
            "url": url,
            "title": title,
            "clean_text": clean_text,
            "source": source,
            "timestamp": timestamp
        }
        
        # Publish to parsed news queue
        if publish_to_rabbitmq(enriched_message):
            # Acknowledge the message
            ch.basic_ack(delivery_tag=method.delivery_tag)
            print(f"Successfully processed and published: {url}")
        else:
            # Reject and requeue the message
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)
            print(f"Failed to publish, requeuing: {url}")
            
    except Exception as e:
        print(f"Error processing message: {e}")
        # Reject and requeue the message
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)

def main():
    """Main function to run the parser agent."""
    print("Starting Parser Agent...")
    
    try:
        # Connect to RabbitMQ
        connection = pika.BlockingConnection(pika.URLParameters(RABBITMQ_URL))
        channel = connection.channel()
        
        # Declare exchange and queue
        channel.exchange_declare(exchange=RABBITMQ_EXCHANGE, exchange_type='direct', durable=True)
        channel.queue_declare(queue=RAW_NEWS_QUEUE, durable=True)
        channel.queue_bind(exchange=RABBITMQ_EXCHANGE, queue=RAW_NEWS_QUEUE, routing_key=RAW_NEWS_QUEUE)
        
        # Set up consumer
        channel.basic_qos(prefetch_count=1)
        channel.basic_consume(queue=RAW_NEWS_QUEUE, on_message_callback=process_message)
        
        print("Waiting for messages. To exit press CTRL+C")
        channel.start_consuming()
        
    except KeyboardInterrupt:
        print("Parser Agent stopped by user.")
        if 'connection' in locals():
            connection.close()
    except Exception as e:
        print(f"Error in main loop: {e}")
        if 'connection' in locals():
            connection.close()

if __name__ == "__main__":
    main()