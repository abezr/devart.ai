"""
Logging configuration for the Meta-Agent System.
"""

import logging
import os
from logging.handlers import RotatingFileHandler
import json
from datetime import datetime


class MetaAgentLogger:
    """Custom logger for the Meta-Agent System."""

    def __init__(self, name: str = "meta-agent", log_level: str = "INFO"):
        """
        Initialize the MetaAgentLogger.
        
        Args:
            name: Name of the logger
            log_level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        """
        self.logger = logging.getLogger(name)
        self.logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))
        
        # Prevent adding multiple handlers if logger already exists
        if not self.logger.handlers:
            self._setup_handlers()

    def _setup_handlers(self):
        """Set up logging handlers."""
        # Create formatter
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        
        # Console handler
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.INFO)
        console_handler.setFormatter(formatter)
        self.logger.addHandler(console_handler)
        
        # File handler with rotation
        log_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'logs')
        os.makedirs(log_dir, exist_ok=True)
        
        file_handler = RotatingFileHandler(
            os.path.join(log_dir, 'meta-agent.log'),
            maxBytes=10*1024*1024,  # 10MB
            backupCount=5
        )
        file_handler.setLevel(logging.DEBUG)
        file_handler.setFormatter(formatter)
        self.logger.addHandler(file_handler)

    def debug(self, message: str):
        """Log debug message."""
        self.logger.debug(message)

    def info(self, message: str):
        """Log info message."""
        self.logger.info(message)

    def warning(self, message: str):
        """Log warning message."""
        self.logger.warning(message)

    def error(self, message: str):
        """Log error message."""
        self.logger.error(message)

    def critical(self, message: str):
        """Log critical message."""
        self.logger.critical(message)

    def log_task_creation(self, task_id: str, task_title: str, agent_id: str = None):
        """Log task creation event."""
        log_data = {
            "event": "task_created",
            "timestamp": datetime.utcnow().isoformat(),
            "task_id": task_id,
            "task_title": task_title,
            "agent_id": agent_id
        }
        self.info(f"TASK_CREATION: {json.dumps(log_data)}")

    def log_agent_assignment(self, task_id: str, agent_id: str, agent_name: str):
        """Log agent assignment event."""
        log_data = {
            "event": "agent_assigned",
            "timestamp": datetime.utcnow().isoformat(),
            "task_id": task_id,
            "agent_id": agent_id,
            "agent_name": agent_name
        }
        self.info(f"AGENT_ASSIGNMENT: {json.dumps(log_data)}")

    def log_document_processing(self, document_name: str, processing_time: float, status: str):
        """Log document processing event."""
        log_data = {
            "event": "document_processed",
            "timestamp": datetime.utcnow().isoformat(),
            "document_name": document_name,
            "processing_time": processing_time,
            "status": status
        }
        self.info(f"DOCUMENT_PROCESSING: {json.dumps(log_data)}")

    def log_api_call(self, endpoint: str, method: str, response_time: float, status_code: int):
        """Log API call event."""
        log_data = {
            "event": "api_call",
            "timestamp": datetime.utcnow().isoformat(),
            "endpoint": endpoint,
            "method": method,
            "response_time": response_time,
            "status_code": status_code
        }
        self.info(f"API_CALL: {json.dumps(log_data)}")


# Global logger instance
meta_logger = MetaAgentLogger()


def get_logger(name: str = "meta-agent") -> MetaAgentLogger:
    """
    Get a logger instance.
    
    Args:
        name: Name of the logger
        
    Returns:
        MetaAgentLogger instance
    """
    return MetaAgentLogger(name)


# Example usage
if __name__ == "__main__":
    logger = get_logger("test-logger")
    logger.info("This is a test log message")
    logger.log_task_creation("task-123", "Test Task", "agent-456")