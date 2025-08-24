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
from llama_index.core.node_parser import SentenceWindowNodeParser
from llama_index.vector_stores.postgres import PGVectorStore
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.core import Settings
import psycopg2
from psycopg2.extras import RealDictCursor
import pytesseract
from pdf2image import convert_from_path
import tempfile
from PIL import Image
import io
from src.analysis.knowledge_graph import RoadmapKnowledgeGraph


class RoadmapDocumentIngestion:
    """Handles ingestion of roadmap documents into the knowledge base."""

    def __init__(self, openai_api_key: str, db_connection_string: str, use_advanced_chunking: bool = True):
        """
        Initialize the document ingestion system.
        
        Args:
            openai_api_key: OpenAI API key for embeddings
            db_connection_string: PostgreSQL connection string
            use_advanced_chunking: Whether to use advanced chunking (SentenceWindowNodeParser)
        """
        self.openai_api_key = openai_api_key
        self.db_connection_string = db_connection_string
        self.use_advanced_chunking = use_advanced_chunking
        
        # Set up LlamaIndex settings
        Settings.embed_model = OpenAIEmbedding(
            api_key=openai_api_key,
            model="text-embedding-ada-002"
        )
        
        # Set up node parser based on configuration
        if use_advanced_chunking:
            # Use advanced chunking with SentenceWindowNodeParser
            Settings.node_parser = SentenceWindowNodeParser.from_defaults(
                window_size=3,  # Number of sentences to include before and after each sentence
                window_metadata_key="window",
                original_text_metadata_key="original_text",
            )
        else:
            # Use standard chunking
            Settings.node_parser = SentenceSplitter(chunk_size=1024, chunk_overlap=20)
        
        # Initialize database connection
        self._init_db()
        
        # Initialize knowledge graph
        self.knowledge_graph = RoadmapKnowledgeGraph(
            openai_api_key=openai_api_key,
            db_connection_string=db_connection_string
        )

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

    def _extract_text_from_image(self, image_path: str) -> str:
        """
        Extract text from an image using OCR.
        
        Args:
            image_path: Path to the image file
            
        Returns:
            Extracted text
        """
        try:
            # Use pytesseract to extract text from image
            text = pytesseract.image_to_string(Image.open(image_path))
            return text.strip()
        except Exception as e:
            print(f"Error extracting text from image {image_path}: {str(e)}")
            return ""

    def _process_pdf_with_images(self, pdf_path: str) -> str:
        """
        Process a PDF file and extract text from both text and image content.
        
        Args:
            pdf_path: Path to the PDF file
            
        Returns:
            Combined text from PDF and images
        """
        try:
            # Convert PDF to images
            images = convert_from_path(pdf_path)
            
            # Extract text from each image
            extracted_text = []
            
            # First, try to get text directly from PDF (for text-based PDFs)
            try:
                from PyPDF2 import PdfReader
                reader = PdfReader(pdf_path)
                for page in reader.pages:
                    text = page.extract_text()
                    if text:
                        extracted_text.append(text)
            except Exception as e:
                print(f"Error extracting text directly from PDF: {str(e)}")
            
            # Then, extract text from images using OCR
            with tempfile.TemporaryDirectory() as temp_dir:
                for i, image in enumerate(images):
                    image_path = os.path.join(temp_dir, f"page_{i}.png")
                    image.save(image_path, "PNG")
                    image_text = self._extract_text_from_image(image_path)
                    if image_text:
                        extracted_text.append(image_text)
            
            return "\n".join(extracted_text)
        except Exception as e:
            print(f"Error processing PDF with images {pdf_path}: {str(e)}")
            return ""

    def ingest_documents(self, documents_path: str) -> Dict[str, Any]:
        """
        Ingest documents from a directory into the knowledge base.
        
        Args:
            documents_path: Path to directory containing roadmap documents
            
        Returns:
            Dictionary with ingestion results
        """
        try:
            # Load documents with custom processing for PDFs with images
            reader = SimpleDirectoryReader(
                documents_path,
                file_extractor={
                    ".pdf": self._process_pdf_with_images
                }
            )
            documents = reader.load_data()
            
            # Create index
            index = VectorStoreIndex.from_documents(
                documents,
                storage_context=self.storage_context,
                show_progress=True
            )
            
            # Add documents to knowledge graph
            kg_results = []
            for i, doc in enumerate(documents):
                # Get document source if available
                source = getattr(doc, 'metadata', {}).get('file_name', f'document_{i}')
                
                # Add to knowledge graph
                kg_result = self.knowledge_graph.add_document_to_knowledge_graph(
                    text=doc.text,
                    document_source=source
                )
                kg_results.append(kg_result)
            
            return {
                "status": "success",
                "documents_processed": len(documents),
                "knowledge_graph_results": kg_results,
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