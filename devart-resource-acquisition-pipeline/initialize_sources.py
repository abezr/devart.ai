import json
import os
# This script would typically interact with a sources table in the database
# For now, we'll just create a JSON file with sample sources

# Sample sources for the Scout Agent
sources = [
    "https://news.ycombinator.com/rss",
    "https://www.reddit.com/r/MachineLearning/.rss",
    "https://www.reddit.com/r/programming/.rss",
    "https://feeds.feedburner.com/oreilly/radar",
    "https://aws.amazon.com/blogs/aws/feed/",
    "https://cloud.google.com/feeds/blog.xml",
    "https://azurecomcdn.azureedge.net/en-us/blog/feed/",
    "https://www.docker.com/blog/feed/",
    "https://kubernetes.io/feed.xml"
]

def save_sources():
    """Save sources to a JSON file."""
    try:
        with open('sources.json', 'w') as f:
            json.dump(sources, f, indent=2)
        print("Sources saved to sources.json")
        return True
    except Exception as e:
        print(f"Error saving sources: {e}")
        return False

if __name__ == "__main__":
    save_sources()