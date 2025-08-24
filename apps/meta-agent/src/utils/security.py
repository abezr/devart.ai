"""
Security utilities for the Meta-Agent System
"""

import hashlib
import secrets
import os
from functools import wraps
from flask import request, jsonify
import jwt


class SecurityManager:
    """Manages security for the Meta-Agent System."""
    
    def __init__(self, secret_key: str = None):
        """
        Initialize the security manager.
        
        Args:
            secret_key: Secret key for JWT token generation
        """
        self.secret_key = secret_key or os.getenv("SECRET_KEY", "devart-meta-agent-secret-key")
    
    def generate_api_key(self) -> str:
        """
        Generate a secure API key.
        
        Returns:
            Generated API key
        """
        return f"meta_{secrets.token_urlsafe(32)}"
    
    def hash_api_key(self, api_key: str) -> str:
        """
        Hash an API key for secure storage.
        
        Args:
            api_key: API key to hash
            
        Returns:
            Hashed API key
        """
        return hashlib.sha256(api_key.encode()).hexdigest()
    
    def generate_jwt_token(self, payload: dict, expires_in: int = 3600) -> str:
        """
        Generate a JWT token.
        
        Args:
            payload: Data to include in the token
            expires_in: Token expiration time in seconds
            
        Returns:
            JWT token
        """
        import time
        payload['exp'] = time.time() + expires_in
        return jwt.encode(payload, self.secret_key, algorithm='HS256')
    
    def verify_jwt_token(self, token: str) -> dict:
        """
        Verify a JWT token.
        
        Args:
            token: JWT token to verify
            
        Returns:
            Decoded token payload
            
        Raises:
            jwt.InvalidTokenError: If token is invalid or expired
        """
        return jwt.decode(token, self.secret_key, algorithms=['HS256'])


def require_api_key(f):
    """
    Decorator to require API key authentication for Flask routes.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Get API key from Authorization header
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': 'Missing Authorization header'}), 401
        
        try:
            # Extract API key from Bearer token
            if not auth_header.startswith('Bearer '):
                return jsonify({'error': 'Invalid Authorization header format'}), 401
            
            api_key = auth_header.split('Bearer ')[1]
            
            # In a real implementation, you would verify the API key against a database
            # For now, we'll just check if it matches the expected key from environment
            expected_key = os.getenv("META_AGENT_API_KEY")
            if not expected_key or api_key != expected_key:
                return jsonify({'error': 'Invalid API key'}), 401
                
        except Exception as e:
            return jsonify({'error': 'Invalid API key'}), 401
        
        # If authentication is successful, proceed with the route
        return f(*args, **kwargs)
    
    return decorated_function


def rate_limit(max_requests: int = 100, window: int = 3600):
    """
    Decorator to implement rate limiting for Flask routes.
    
    Args:
        max_requests: Maximum number of requests allowed
        window: Time window in seconds
    """
    # In a real implementation, you would use Redis or similar for tracking requests
    # For now, we'll implement a simple in-memory rate limiter
    clients = {}
    
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            import time
            
            client_ip = request.remote_addr
            current_time = time.time()
            
            # Initialize client tracking if needed
            if client_ip not in clients:
                clients[client_ip] = []
            
            # Remove requests outside the time window
            clients[client_ip] = [
                req_time for req_time in clients[client_ip] 
                if current_time - req_time < window
            ]
            
            # Check if rate limit exceeded
            if len(clients[client_ip]) >= max_requests:
                return jsonify({
                    'error': 'Rate limit exceeded',
                    'message': f'Maximum {max_requests} requests per {window} seconds allowed'
                }), 429
            
            # Record this request
            clients[client_ip].append(current_time)
            
            # Proceed with the route
            return f(*args, **kwargs)
        
        return decorated_function
    
    return decorator


# Example usage
if __name__ == "__main__":
    # Example of generating and hashing an API key
    security_manager = SecurityManager()
    api_key = security_manager.generate_api_key()
    hashed_key = security_manager.hash_api_key(api_key)
    
    print(f"Generated API Key: {api_key}")
    print(f"Hashed API Key: {hashed_key}")