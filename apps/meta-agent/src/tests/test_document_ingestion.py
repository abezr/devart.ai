"""
Unit tests for the document ingestion components of the Meta-Agent System.
"""

import unittest
from unittest.mock import patch, MagicMock
import tempfile
import os
from src.analysis.document_ingestion import RoadmapDocumentIngestion


class TestRoadmapDocumentIngestion(unittest.TestCase):
    """Test cases for the RoadmapDocumentIngestion class."""

    def setUp(self):
        """Set up test fixtures before each test method."""
        self.openai_api_key = "test-key"
        self.db_connection_string = "postgresql://user:pass@localhost:5432/testdb"
        self.ingestion = RoadmapDocumentIngestion(
            openai_api_key=self.openai_api_key,
            db_connection_string=self.db_connection_string
        )

    def test_init(self):
        """Test initialization of RoadmapDocumentIngestion."""
        self.assertEqual(self.ingestion.openai_api_key, self.openai_api_key)
        self.assertEqual(self.ingestion.db_connection_string, self.db_connection_string)
        self.assertTrue(self.ingestion.use_advanced_chunking)

    @patch('src.analysis.document_ingestion.PGVectorStore')
    def test_init_db(self, mock_pgvector_store):
        """Test database initialization."""
        # Mock the PGVectorStore.from_params method
        mock_vector_store = MagicMock()
        mock_pgvector_store.from_params.return_value = mock_vector_store
        
        # Reinitialize to trigger _init_db
        ingestion = RoadmapDocumentIngestion(
            openai_api_key=self.openai_api_key,
            db_connection_string=self.db_connection_string
        )
        
        # Verify PGVectorStore was called with correct parameters
        mock_pgvector_store.from_params.assert_called_once()
        self.assertEqual(ingestion.vector_store, mock_vector_store)

    @patch('src.analysis.document_ingestion.pytesseract')
    def test_extract_text_from_image(self, mock_pyteesseract):
        """Test text extraction from image."""
        # Mock pytesseract.image_to_string to return test text
        mock_pyteesseract.image_to_string.return_value = "Test text from image"
        
        # Create a temporary file to simulate an image
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp_file:
            tmp_file_path = tmp_file.name
        
        try:
            # Test the method
            result = self.ingestion._extract_text_from_image(tmp_file_path)
            self.assertEqual(result, "Test text from image")
        finally:
            # Clean up the temporary file
            os.unlink(tmp_file_path)

    @patch('src.analysis.document_ingestion.pytesseract')
    def test_extract_text_from_image_error(self, mock_pyteesseract):
        """Test text extraction from image when an error occurs."""
        # Mock pytesseract.image_to_string to raise an exception
        mock_pyteesseract.image_to_string.side_effect = Exception("OCR error")
        
        # Create a temporary file to simulate an image
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp_file:
            tmp_file_path = tmp_file.name
        
        try:
            # Test the method
            result = self.ingestion._extract_text_from_image(tmp_file_path)
            self.assertEqual(result, "")
        finally:
            # Clean up the temporary file
            os.unlink(tmp_file_path)

    def test_process_pdf_with_images(self):
        """Test PDF processing with images."""
        # This test would require actual PDF files and OCR setup
        # For now, we'll just verify the method exists
        self.assertTrue(hasattr(self.ingestion, '_process_pdf_with_images'))

    @patch('src.analysis.document_ingestion.SimpleDirectoryReader')
    @patch('src.analysis.document_ingestion.VectorStoreIndex')
    def test_ingest_documents(self, mock_vector_store_index, mock_simple_directory_reader):
        """Test document ingestion."""
        # Mock the reader and index
        mock_reader = MagicMock()
        mock_simple_directory_reader.return_value = mock_reader
        
        mock_index = MagicMock()
        mock_vector_store_index.from_documents.return_value = mock_index
        
        # Mock documents
        mock_documents = [MagicMock()]
        mock_documents[0].text = "Test document content"
        mock_documents[0].metadata = {"file_name": "test.pdf"}
        mock_reader.load_data.return_value = mock_documents
        
        # Mock knowledge graph result
        mock_kg_result = {
            "status": "success",
            "message": "Added 1 relationships to knowledge graph"
        }
        self.ingestion.knowledge_graph.add_document_to_knowledge_graph.return_value = mock_kg_result
        
        # Test the method
        result = self.ingestion.ingest_documents("/test/path")
        
        # Verify results
        self.assertEqual(result["status"], "success")
        self.assertEqual(result["documents_processed"], 1)
        self.assertIn("knowledge_graph_results", result)

    @patch('src.analysis.document_ingestion.VectorStoreIndex')
    def test_query_roadmap(self, mock_vector_store_index):
        """Test roadmap querying."""
        # Mock the index and query engine
        mock_index = MagicMock()
        mock_vector_store_index.from_vector_store.return_value = mock_index
        
        mock_query_engine = MagicMock()
        mock_index.as_query_engine.return_value = mock_query_engine
        
        # Mock response
        mock_response = MagicMock()
        mock_response.source_nodes = []
        mock_query_engine.query.return_value = mock_response
        
        # Test the method
        result = self.ingestion.query_roadmap("test query")
        
        # Verify results
        self.assertIsInstance(result, list)
        mock_vector_store_index.from_vector_store.assert_called_once()
        mock_index.as_query_engine.assert_called_once()
        mock_query_engine.query.assert_called_once_with("test query")


if __name__ == '__main__':
    unittest.main()