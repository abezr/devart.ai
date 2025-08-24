"""
Document Ingestion Module for Meta-Agent System

This module handles the ingestion of roadmap documents using LlamaIndex,
including chunking, metadata extraction, and vector embedding.
"""

import os
from typing import List, Dict, Any
from llama_index.core import (
    SimpleDirectoryReader,
    VectorStoreIndex,
    StorageContext,
    ServiceContext
)
from llama_index.core.node_parser import SentenceSplitter
from llama_index.vector_stores.postgres import PGVectorStore
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.core import Settings
import psycopg2
from psycopg2.extras import RealDictCursor


class RoadmapDocumentIngestion:
    """Handles ingestion of roadmap documents into the knowledge base."""

    def __init__(self, openai_api_key: str, db_connection_string: str):
        """
        Initialize the document ingestion system.
        
        Args:
            openai_api_key: OpenAI API key for embeddings
            db_connection_string: PostgreSQL connection string
        """
        self.openai_api_key = openai_api_key
        self.db_connection_string = db_connection_string
        
        # Set up LlamaIndex settings
        Settings.embed_model = OpenAIEmbedding(
            api_key=openai_api_key,
            model="text-embedding-ada-002"
        )
        
        # Set up node parser
        Settings.node_parser = SentenceSplitter(chunk_size=1024, chunk_overlap=20)
        
        # Initialize database connection
        self._init_db()

    def _init_db(self):
        """Initialize the PostgreSQL vector store."""
        # Parse connection string
        # Format: postgresql://user:password@host:port/database
        parts = self.db_connection_string.split("://")[1].split("@")
        user_pass, host_port_db = parts[0], parts[1]
        user, password = user_pass.split(":")
        host_port, database = host_port_db.split("/")
        host, port = host_port.split(":")
        
        self.vector_store = PGVectorStore.from_params(
            database=database,
            host=host,
            password=password,
            port=port,
            user=user,
            table_name="knowledge_base",
            embed_dim=1536,  # OpenAI ada-002 embedding dimension
        )
        
        self.storage_context = StorageContext.from_defaults(
            vector_store=self.vector_store
        )

    def ingest_documents(self, documents_path: str) -> Dict[str, Any]:
        """
        Ingest documents from a directory into the knowledge base.
        
        Args:
            documents_path: Path to directory containing roadmap documents
            
        Returns:
            Dictionary with ingestion results
        """
        try:
            # Load documents
            reader = SimpleDirectoryReader(documents_path)
            documents = reader.load_data()
            
            # Create index
            index = VectorStoreIndex.from_documents(
                documents,
                storage_context=self.storage_context,
                show_progress=True
            )
            
            return {
                "status": "success",
                "documents_processed": len(documents),
                "message": f"Successfully ingested {len(documents)} documents"
            }
        except Exception as e:
            return {
                "status": "error",
                "message": f"Failed to ingest documents: {str(e)}"
            }

    def query_roadmap(self, query: str, similarity_threshold: float = 0.7) -> List[Dict[str, Any]]:
        """
        Query the roadmap knowledge base for relevant information.
        
        Args:
            query: Query string
            similarity_threshold: Minimum similarity threshold
            
        Returns:
            List of relevant documents with similarity scores
        """
        try:
            # Create a query engine
            index = VectorStoreIndex.from_vector_store(self.vector_store)
            query_engine = index.as_query_engine(similarity_top_k=5)
            
            # Execute query
            response = query_engine.query(query)
            
            # Extract relevant information
            results = []
            if hasattr(response, 'source_nodes'):
                for node in response.source_nodes:
                    if node.score >= similarity_threshold:
                        results.append({
                            "content": node.node.text,
                            "source": getattr(node.node, 'metadata', {}).get('file_name', 'Unknown'),
                            "similarity": node.score
                        })
            
            return results
        except Exception as e:
            print(f"Error querying roadmap: {str(e)}")
            return []


# Example usage
if __name__ == "__main__":
    # Example usage (would require actual API keys and DB connection)
    # ingestion = RoadmapDocumentIngestion(
    #     openai_api_key=os.getenv("OPENAI_API_KEY"),
    #     db_connection_string=os.getenv("DATABASE_URL")
    # )
    # result = ingestion.ingest_documents("./roadmaps")
    # print(result)
    pass