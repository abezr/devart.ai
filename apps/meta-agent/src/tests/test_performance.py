"""
Performance tests for the Meta-Agent System.
"""

import unittest
import time
import tempfile
import os
from unittest.mock import patch, MagicMock
from src.analysis.document_ingestion import RoadmapDocumentIngestion
from src.analysis.knowledge_graph import RoadmapKnowledgeGraph


class TestPerformance(unittest.TestCase):
    """Performance tests for the Meta-Agent System."""

    def setUp(self):
        """Set up test fixtures before each test method."""
        self.openai_api_key = "test-key"
        self.db_connection_string = "postgresql://user:pass@localhost:5432/testdb"

    def test_document_ingestion_performance(self):
        """Test performance of document ingestion with large documents."""
        # Initialize the document ingestion system
        ingestion = RoadmapDocumentIngestion(
            openai_api_key=self.openai_api_key,
            db_connection_string=self.db_connection_string
        )
        
        # Create a large test document
        large_document = "This is a test sentence. " * 10000  # 10,000 sentences
        
        # Mock the database operations to avoid actual database calls
        with patch.object(ingestion, '_init_db'), \
             patch('src.analysis.document_ingestion.SimpleDirectoryReader'), \
             patch('src.analysis.document_ingestion.VectorStoreIndex'), \
             patch.object(ingestion.knowledge_graph, 'add_document_to_knowledge_graph'):
            
            # Measure ingestion time
            start_time = time.time()
            result = ingestion.ingest_documents("/test/path")
            end_time = time.time()
            
            # Verify the operation completed
            self.assertIn("status", result)
            
            # Check performance (should complete within a reasonable time)
            execution_time = end_time - start_time
            self.assertLess(execution_time, 10.0)  # Should complete within 10 seconds

    def test_knowledge_graph_query_performance(self):
        """Test performance of knowledge graph queries."""
        # Initialize the knowledge graph system
        kg = RoadmapKnowledgeGraph(
            openai_api_key=self.openai_api_key,
            db_connection_string=self.db_connection_string
        )
        
        # Mock database operations
        with patch('src.analysis.knowledge_graph.psycopg2.connect') as mock_connect:
            # Mock the database connection and cursor
            mock_conn = MagicMock()
            mock_cursor = MagicMock()
            mock_connect.return_value = mock_conn
            mock_conn.cursor.return_value = mock_cursor
            
            # Mock query results
            mock_row = MagicMock()
            mock_row.__getitem__.side_effect = lambda key: {
                'id': 'test-id',
                'source_entity': 'Platform',
                'relationship': 'should implement',
                'target_entity': 'real-time collaboration',
                'document_source': 'test.pdf',
                'confidence_score': 0.9,
                'created_at': '2023-01-01T00:00:00'
            }[key]
            mock_cursor.fetchall.return_value = [mock_row] * 100  # Return 100 rows
            
            # Measure query time
            start_time = time.time()
            result = kg.query_knowledge_graph("real-time collaboration")
            end_time = time.time()
            
            # Verify the operation completed
            self.assertIsInstance(result, list)
            self.assertEqual(len(result), 100)
            
            # Check performance (should complete within a reasonable time)
            execution_time = end_time - start_time
            self.assertLess(execution_time, 5.0)  # Should complete within 5 seconds

    def test_ocr_processing_performance(self):
        """Test performance of OCR processing."""
        # Initialize the document ingestion system
        ingestion = RoadmapDocumentIngestion(
            openai_api_key=self.openai_api_key,
            db_connection_string=self.db_connection_string
        )
        
        # Create a temporary image file for testing
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp_file:
            tmp_file_path = tmp_file.name
        
        try:
            # Mock pytesseract to return a large text
            with patch('src.analysis.document_ingestion.pytesseract') as mock_pyteesseract:
                mock_pyteesseract.image_to_string.return_value = "Test OCR text. " * 1000  # 1,000 phrases
                
                # Measure OCR processing time
                start_time = time.time()
                result = ingestion._extract_text_from_image(tmp_file_path)
                end_time = time.time()
                
                # Verify the operation completed
                self.assertIsInstance(result, str)
                self.assertGreater(len(result), 0)
                
                # Check performance (should complete within a reasonable time)
                execution_time = end_time - start_time
                self.assertLess(execution_time, 5.0)  # Should complete within 5 seconds
        finally:
            # Clean up the temporary file
            os.unlink(tmp_file_path)

    def test_large_document_processing_performance(self):
        """Test performance with processing multiple large documents."""
        # Initialize the document ingestion system
        ingestion = RoadmapDocumentIngestion(
            openai_api_key=self.openai_api_key,
            db_connection_string=self.db_connection_string
        )
        
        # Mock the database operations to avoid actual database calls
        with patch.object(ingestion, '_init_db'), \
             patch('src.analysis.document_ingestion.SimpleDirectoryReader'), \
             patch('src.analysis.document_ingestion.VectorStoreIndex'), \
             patch.object(ingestion.knowledge_graph, 'add_document_to_knowledge_graph'):
            
            # Measure processing time for multiple documents
            start_time = time.time()
            
            # Process 5 large documents
            for i in range(5):
                result = ingestion.ingest_documents(f"/test/path/{i}")
                self.assertIn("status", result)
            
            end_time = time.time()
            
            # Check performance (should complete within a reasonable time)
            execution_time = end_time - start_time
            self.assertLess(execution_time, 30.0)  # Should complete within 30 seconds


if __name__ == '__main__':
    unittest.main()