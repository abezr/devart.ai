import os
import json
import time
import hashlib
import requests
import feedparser
import pika
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from datetime import datetime, timedelta

# Load environment variables
RABBITMQ_URL = os.getenv('RABBITMQ_URL', 'amqp://localhost')
RABBITMQ_EXCHANGE = os.getenv('RABBITMQ_OPPORTUNITY_EXCHANGE', 'opportunity_exchange')
RAW_NEWS_QUEUE = os.getenv('RABBITMQ_RAW_NEWS_QUEUE', 'raw_news_queue')

# Simple in-memory storage for processed URLs (in production, use a proper database)
processed_urls = set()

# List of sources to monitor (in production, this should come from a database or config file)
SOURCES = [
    "https://news.ycombinator.com/rss",
    "https://www.reddit.com/r/MachineLearning/.rss",
    "https://www.reddit.com/r/programming/.rss",
    # Add more sources as needed
]

def is_valid_url(url):
    """Check if a URL is valid and has not been processed recently."""
    if url in processed_urls:
        return False
    
    # Simple URL validation
    try:
        result = urlparse(url)
        return all([result.scheme, result.netloc])
    except:
        return False

def fetch_rss_content(url):
    """Fetch and parse RSS feed content."""
    try:
        feed = feedparser.parse(url)
        return feed.entries
    except Exception as e:
        print(f"Error fetching RSS feed {url}: {e}")
        return []

def fetch_webpage_content(url):
    """Fetch and parse webpage content."""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
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
        print(f"Error fetching webpage {url}: {e}")
        return None

def publish_to_rabbitmq(message):
    """Publish a message to RabbitMQ."""
    try:
        connection = pika.BlockingConnection(pika.URLParameters(RABBITMQ_URL))
        channel = connection.channel()
        
        # Declare exchange and queue
        channel.exchange_declare(exchange=RABBITMQ_EXCHANGE, exchange_type='direct', durable=True)
        channel.queue_declare(queue=RAW_NEWS_QUEUE, durable=True)
        channel.queue_bind(exchange=RABBITMQ_EXCHANGE, queue=RAW_NEWS_QUEUE, routing_key=RAW_NEWS_QUEUE)
        
        # Publish message
        channel.basic_publish(
            exchange=RABBITMQ_EXCHANGE,
            routing_key=RAW_NEWS_QUEUE,
            body=json.dumps(message),
            properties=pika.BasicProperties(
                delivery_mode=2,  # Make message persistent
            )
        )
        
        connection.close()
        print(f"Published message to {RAW_NEWS_QUEUE}")
        return True
    except Exception as e:
        print(f"Error publishing to RabbitMQ: {e}")
        return False

def process_source(source_url):
    """Process a single source for new content."""
    print(f"Processing source: {source_url}")
    
    # Determine if it's an RSS feed or a webpage
    if source_url.endswith('.rss') or 'rss' in source_url.lower():
        # Process as RSS feed
        entries = fetch_rss_content(source_url)
        for entry in entries:
            url = getattr(entry, 'link', None)
            if url and is_valid_url(url):
                # Fetch the actual content
                content = fetch_webpage_content(url)
                if content:
                    message = {
                        "url": url,
                        "title": getattr(entry, 'title', ''),
                        "raw_html": content,
                        "source": source_url,
                        "timestamp": datetime.now().isoformat()
                    }
                    
                    if publish_to_rabbitmq(message):
                        processed_urls.add(url)
                        print(f"Published article: {url}")
    else:
        # Process as regular webpage (this is a simplified approach)
        content = fetch_webpage_content(source_url)
        if content:
            message = {
                "url": source_url,
                "title": f"Content from {source_url}",
                "raw_html": content,
                "source": source_url,
                "timestamp": datetime.now().isoformat()
            }
            
            if publish_to_rabbitmq(message):
                processed_urls.add(source_url)
                print(f"Published content from: {source_url}")

def main():
    """Main function to run the scout agent."""
    print("Starting Scout Agent...")
    
    while True:
        try:
            # Process each source
            for source in SOURCES:
                process_source(source)
                # Be respectful to servers - add a small delay
                time.sleep(1)
            
            # Wait before the next cycle
            print("Waiting 300 seconds before next cycle...")
            time.sleep(300)  # 5 minutes
        except KeyboardInterrupt:
            print("Scout Agent stopped by user.")
            break
        except Exception as e:
            print(f"Error in main loop: {e}")
            time.sleep(60)  # Wait 1 minute before retrying

if __name__ == "__main__":
    main()