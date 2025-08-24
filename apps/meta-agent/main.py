"""
Main entry point for the Meta-Agent System
"""

import os
import sys
from src.utils.config import Config, config_valid
from src.api.main import app


def main():
    """Main entry point for the Meta-Agent System."""
    
    # Validate configuration
    if not config_valid:
        print("Configuration is invalid. Please check your .env file.")
        sys.exit(1)
    
    # Print startup information
    print("Starting Meta-Agent System...")
    print(f"API Base URL: {Config.API_BASE_URL}")
    print(f"Meta-Agent Name: {Config.META_AGENT_NAME}")
    
    # Run the Flask application
    app.run(
        host='0.0.0.0',
        port=int(os.getenv('PORT', 5000)),
        debug=os.getenv('DEBUG', 'False').lower() == 'true'
    )


if __name__ == "__main__":
    main()