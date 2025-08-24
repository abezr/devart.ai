"""
Security utilities for the Meta-Agent System
"""

import hashlib
import secrets
import os
import time
import jwt
from functools import wraps
from flask import request, jsonify
import redis


class SecurityManager:
    """Manages security for the Meta-Agent System."""
    
    def __init__(self, secret_key: str = None):
        """
        Initialize the security manager.
        
        Args:
            secret_key: Secret key for JWT token generation
        """
        self.secret_key = secret_key or os.getenv("SECRET_KEY", "devart-meta-agent-secret-key")
        # Initialize Redis for rate limiting if available
        try:
            redis_host = os.getenv("REDIS_HOST", "localhost")
            redis_port = int(os.getenv("REDIS_PORT", "6379"))
            self.redis_client = redis.Redis(host=redis_host, port=redis_port, decode_responses=True)
        except:
            self.redis_client = None
    
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

    def encrypt_data(self, data: str, password: str) -> str:
        """
        Encrypt sensitive data.
        
        Args:
            data: Data to encrypt
            password: Password for encryption
            
        Returns:
            Encrypted data
        """
        try:
            from cryptography.fernet import Fernet
            from cryptography.hazmat.primitives import hashes
            from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
            import base64
            
            # Derive key from password
            salt = b'meta_agent_salt_16_chars'  # In production, use a random salt
            kdf = PBKDF2HMAC(
                algorithm=hashes.SHA256(),
                length=32,
                salt=salt,
                iterations=100000,
            )
            key = base64.urlsafe_b64encode(kdf.derive(password.encode()))
            
            # Encrypt data
            f = Fernet(key)
            encrypted_data = f.encrypt(data.encode())
            return base64.urlsafe_b64encode(encrypted_data).decode()
        except Exception as e:
            raise Exception(f"Encryption failed: {str(e)}")

    def decrypt_data(self, encrypted_data: str, password: str) -> str:
        """
        Decrypt sensitive data.
        
        Args:
            encrypted_data: Data to decrypt
            password: Password for decryption
            
        Returns:
            Decrypted data
        """
        try:
            from cryptography.fernet import Fernet
            from cryptography.hazmat.primitives import hashes
            from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
            import base64
            
            # Derive key from password
            salt = b'meta_agent_salt_16_chars'  # In production, use the same random salt
            kdf = PBKDF2HMAC(
                algorithm=hashes.SHA256(),
                length=32,
                salt=salt,
                iterations=100000,
            )
            key = base64.urlsafe_b64encode(kdf.derive(password.encode()))
            
            # Decrypt data
            f = Fernet(key)
            encrypted_bytes = base64.urlsafe_b64decode(encrypted_data.encode())
            decrypted_data = f.decrypt(encrypted_bytes)
            return decrypted_data.decode()
        except Exception as e:
            raise Exception(f"Decryption failed: {str(e)}")


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
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            client_ip = request.remote_addr
            current_time = time.time()
            
            # Use Redis for distributed rate limiting if available
            if hasattr(rate_limit, 'redis_client') and rate_limit.redis_client:
                try:
                    # Create a unique key for this client and route
                    route_key = f"rate_limit:{request.endpoint}:{client_ip}"
                    
                    # Use Redis atomic operations for rate limiting
                    pipe = rate_limit.redis_client.pipeline()
                    pipe.zadd(route_key, {str(current_time): current_time})
                    pipe.zremrangebyscore(route_key, 0, current_time - window)
                    pipe.zcard(route_key)
                    pipe.expire(route_key, window)
                    results = pipe.execute()
                    
                    request_count = results[2]
                    
                    if request_count > max_requests:
                        return jsonify({
                            'error': 'Rate limit exceeded',
                            'message': f'Maximum {max_requests} requests per {window} seconds allowed'
                        }), 429
                    
                except Exception as e:
                    # Fallback to in-memory rate limiting if Redis fails
                    return _in_memory_rate_limit(f, max_requests, window, client_ip, current_time)(*args, **kwargs)
            else:
                # Use in-memory rate limiting if Redis is not available
                return _in_memory_rate_limit(f, max_requests, window, client_ip, current_time)(*args, **kwargs)
            
            # Proceed with the route
            return f(*args, **kwargs)
        
        return decorated_function
    
    # Initialize Redis client if not already done
    try:
        if not hasattr(rate_limit, 'redis_client'):
            redis_host = os.getenv("REDIS_HOST", "localhost")
            redis_port = int(os.getenv("REDIS_PORT", "6379"))
            rate_limit.redis_client = redis.Redis(host=redis_host, port=redis_port, decode_responses=True)
    except:
        rate_limit.redis_client = None
    
    return decorator


def _in_memory_rate_limit(f, max_requests, window, client_ip, current_time):
    """
    In-memory rate limiting implementation as fallback.
    
    Args:
        f: Function to decorate
        max_requests: Maximum number of requests allowed
        window: Time window in seconds
        client_ip: Client IP address
        current_time: Current timestamp
    """
    # Initialize clients dictionary if not exists
    if not hasattr(_in_memory_rate_limit, 'clients'):
        _in_memory_rate_limit.clients = {}
    
    # Initialize client tracking if needed
    if client_ip not in _in_memory_rate_limit.clients:
        _in_memory_rate_limit.clients[client_ip] = []
    
    # Remove requests outside the time window
    _in_memory_rate_limit.clients[client_ip] = [
        req_time for req_time in _in_memory_rate_limit.clients[client_ip] 
        if current_time - req_time < window
    ]
    
    # Check if rate limit exceeded
    if len(_in_memory_rate_limit.clients[client_ip]) >= max_requests:
        return jsonify({
            'error': 'Rate limit exceeded',
            'message': f'Maximum {max_requests} requests per {window} seconds allowed'
        }), 429
    
    # Record this request
    _in_memory_rate_limit.clients[client_ip].append(current_time)
    
    # Return the original function
    return f


# Example usage
if __name__ == "__main__":
    # Example of generating and hashing an API key
    security_manager = SecurityManager()
    api_key = security_manager.generate_api_key()
    hashed_key = security_manager.hash_api_key(api_key)
    
    print(f"Generated API Key: {api_key}")
    print(f"Hashed API Key: {hashed_key}")