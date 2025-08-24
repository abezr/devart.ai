"""
Configuration utilities for the Meta-Agent System
"""

import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


class Config:
    """Configuration class for the Meta-Agent System."""
    
    # OpenAI Configuration
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    
    # Database Configuration
    DATABASE_URL = os.getenv("DATABASE_URL")
    
    # API Configuration
    API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8787")
    META_AGENT_API_KEY = os.getenv("META_AGENT_API_KEY")
    
    # LlamaIndex Configuration
    CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "1024"))
    CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "20"))
    EMBEDDING_DIM = int(os.getenv("EMBEDDING_DIM", "1536"))
    
    # Langroid Configuration
    META_AGENT_NAME = os.getenv("META_AGENT_NAME", "Meta-Agent")
    
    # Security Configuration
    SECRET_KEY = os.getenv("SECRET_KEY", "devart-meta-agent-secret-key")
    
    @classmethod
    def validate_config(cls):
        """Validate that all required configuration values are present."""
        required_vars = [
            "OPENAI_API_KEY",
            "DATABASE_URL",
            "META_AGENT_API_KEY"
        ]
        
        missing_vars = []
        for var in required_vars:
            if not getattr(cls, var):
                missing_vars.append(var)
        
        if missing_vars:
            raise ValueError(f"Missing required environment variables: {', '.join(missing_vars)}")
        
        return True


# Validate configuration on import
try:
    Config.validate_config()
    config_valid = True
except ValueError as e:
    print(f"Configuration error: {e}")
    config_valid = False