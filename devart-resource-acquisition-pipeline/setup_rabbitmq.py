import os
import pika

# Load environment variables
RABBITMQ_URL = os.getenv('RABBITMQ_URL', 'amqp://localhost')
RABBITMQ_EXCHANGE = os.getenv('RABBITMQ_OPPORTUNITY_EXCHANGE', 'opportunity_exchange')
QUEUES = [
    os.getenv('RABBITMQ_RAW_NEWS_QUEUE', 'raw_news_queue'),
    os.getenv('RABBITMQ_PARSED_NEWS_QUEUE', 'parsed_news_queue'),
    os.getenv('RABBITMQ_CLASSIFIED_OPS_QUEUE', 'classified_ops_queue'),
    os.getenv('RABBITMQ_NEW_OPPORTUNITY_QUEUE', 'new_opportunity_queue'),
    os.getenv('RABBITMQ_INTEGRATION_PLANNING_QUEUE', 'integration_planning_queue')
]

def setup_rabbitmq():
    """Set up RabbitMQ exchanges and queues for the opportunity pipeline."""
    try:
        # Connect to RabbitMQ
        connection = pika.BlockingConnection(pika.URLParameters(RABBITMQ_URL))
        channel = connection.channel()
        
        # Declare the exchange
        channel.exchange_declare(exchange=RABBITMQ_EXCHANGE, exchange_type='direct', durable=True)
        print(f"Declared exchange: {RABBITMQ_EXCHANGE}")
        
        # Declare queues and bind them to the exchange
        for queue_name in QUEUES:
            channel.queue_declare(queue=queue_name, durable=True)
            channel.queue_bind(exchange=RABBITMQ_EXCHANGE, queue=queue_name, routing_key=queue_name)
            print(f"Declared and bound queue: {queue_name}")
        
        # Close the connection
        connection.close()
        print("RabbitMQ setup completed successfully!")
        
    except Exception as e:
        print(f"Error setting up RabbitMQ: {e}")

if __name__ == "__main__":
    setup_rabbitmq()