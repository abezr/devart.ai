import os
import json
import pika
import time

# Load environment variables
RABBITMQ_URL = os.getenv('RABBITMQ_URL', 'amqp://localhost')
RABBITMQ_EXCHANGE = os.getenv('RABBITMQ_OPPORTUNITY_EXCHANGE', 'opportunity_exchange')
RAW_NEWS_QUEUE = os.getenv('RABBITMQ_RAW_NEWS_QUEUE', 'raw_news_queue')

def send_test_message():
    """Send a test message to the raw news queue."""
    try:
        connection = pika.BlockingConnection(pika.URLParameters(RABBITMQ_URL))
        channel = connection.channel()
        
        # Declare exchange and queue
        channel.exchange_declare(exchange=RABBITMQ_EXCHANGE, exchange_type='direct', durable=True)
        channel.queue_declare(queue=RAW_NEWS_QUEUE, durable=True)
        channel.queue_bind(exchange=RABBITMQ_EXCHANGE, queue=RAW_NEWS_QUEUE, routing_key=RAW_NEWS_QUEUE)
        
        # Create a test message
        test_message = {
            "url": "https://example.com/test-article",
            "title": "Test Article for Resource Acquisition Pipeline",
            "raw_html": "<html><body><h1>Test Article</h1><p>This is a test article for the resource acquisition pipeline.</p></body></html>",
            "source": "test_source",
            "timestamp": time.time()
        }
        
        # Publish message
        channel.basic_publish(
            exchange=RABBITMQ_EXCHANGE,
            routing_key=RAW_NEWS_QUEUE,
            body=json.dumps(test_message),
            properties=pika.BasicProperties(
                delivery_mode=2,  # Make message persistent
            )
        )
        
        connection.close()
        print("Test message sent successfully!")
        return True
    except Exception as e:
        print(f"Error sending test message: {e}")
        return False

if __name__ == "__main__":
    send_test_message()