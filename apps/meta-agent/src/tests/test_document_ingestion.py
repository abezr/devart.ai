"""
Test module for the Document Ingestion module
"""

import unittest
from unittest.mock import patch, MagicMock
import sys
import os

# Add src directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from src.analysis.document_ingestion import RoadmapDocumentIngestion


class TestDocumentIngestion(unittest.TestCase):
    """Test cases for the RoadmapDocumentIngestion class."""

    def setUp(self):
        """Set up test fixtures."""
        self.ingestion = RoadmapDocumentIngestion(
            openai_api_key="test-openai-key",
            db_connection_string="postgresql://user:pass@localhost:5432/testdb"
        )

    def test_init(self):
        """Test RoadmapDocumentIngestion initialization."""
        self.assertEqual(self.ingestion.openai_api_key, "test-openai-key")
        self.assertEqual(self.ingestion.db_connection_string, "postgresql://user:pass@localhost:5432/testdb")

    @patch('src.analysis.document_ingestion.SimpleDirectoryReader')
    @patch('src.analysis.document_ingestion.VectorStoreIndex')
    def test_ingest_documents_success(self, mock_index, mock_reader):
        """Test successful document ingestion."""
        # Mock the reader and index
        mock_reader_instance = MagicMock()
        mock_reader.return_value = mock_reader_instance
        mock_reader_instance.load_data.return_value = ["doc1", "doc2"]
        
        mock_index_instance = MagicMock()
        mock_index.from_documents.return_value = mock_index_instance
        
        # Test ingestion
        result = self.ingestion.ingest_documents("/test/path")
        
        # Assertions
        self.assertEqual(result["status"], "success")
        self.assertEqual(result["documents_processed"], 2)
        mock_reader.assert_called_once_with("/test/path")
        mock_index.from_documents.assert_called_once()

    @patch('src.analysis.document_ingestion.SimpleDirectoryReader')
    def test_ingest_documents_failure(self, mock_reader):
        """Test document ingestion failure."""
        # Mock the reader to raise an exception
        mock_reader.side_effect = Exception("Test error")
        
        # Test ingestion
        result = self.ingestion.ingest_documents("/test/path")
        
        # Assertions
        self.assertEqual(result["status"], "error")
        self.assertIn("Failed to ingest documents", result["message"])

    @patch('src.analysis.document_ingestion.VectorStoreIndex')
    def test_query_roadmap_success(self, mock_index_class):
        """Test successful roadmap querying."""
        # Mock the index and query engine
        mock_index_instance = MagicMock()
        mock_index_class.from_vector_store.return_value = mock_index_instance
        
        mock_query_engine = MagicMock()
        mock_index_instance.as_query_engine.return_value = mock_query_engine
        
        # Mock response with source nodes
        mock_response = MagicMock()
        mock_node = MagicMock()
        mock_node.score = 0.8
        mock_node.node.text = "Test content"
        mock_node.node.metadata = {"file_name": "test.md"}
        mock_response.source_nodes = [mock_node]
        mock_query_engine.query.return_value = mock_response
        
        # Test querying
        results = self.ingestion.query_roadmap("test query")
        
        # Assertions
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["content"], "Test content")
        self.assertEqual(results[0]["source"], "test.md")
        self.assertEqual(results[0]["similarity"], 0.8)

    @patch('src.analysis.document_ingestion.VectorStoreIndex')
    def test_query_roadmap_failure(self, mock_index_class):
        """Test roadmap querying failure."""
        # Mock the index to raise an exception
        mock_index_class.from_vector_store.side_effect = Exception("Test error")
        
        # Test querying
        results = self.ingestion.query_roadmap("test query")
        
        # Assertions
        self.assertEqual(results, [])  # Should return empty list on error


if __name__ == '__main__':
    unittest.main()