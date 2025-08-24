"""
Unit tests for the knowledge graph functionality of the Meta-Agent System.
"""

import unittest
from unittest.mock import patch, MagicMock
import uuid
from src.analysis.knowledge_graph import RoadmapKnowledgeGraph, KnowledgeGraphEntry


class TestRoadmapKnowledgeGraph(unittest.TestCase):
    """Test cases for the RoadmapKnowledgeGraph class."""

    def setUp(self):
        """Set up test fixtures before each test method."""
        self.openai_api_key = "test-key"
        self.db_connection_string = "postgresql://user:pass@localhost:5432/testdb"
        self.kg = RoadmapKnowledgeGraph(
            openai_api_key=self.openai_api_key,
            db_connection_string=self.db_connection_string
        )

    def test_init(self):
        """Test initialization of RoadmapKnowledgeGraph."""
        self.assertEqual(self.kg.openai_api_key, self.openai_api_key)
        self.assertEqual(self.kg.db_connection_string, self.db_connection_string)
        self.assertIsNotNone(self.kg.openai_client)

    @patch('src.analysis.knowledge_graph.psycopg2.connect')
    def test_init_db(self, mock_psycopg2_connect):
        """Test database initialization."""
        # Mock database connection and cursor
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_psycopg2_connect.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cursor
        
        # Reinitialize to trigger _init_db
        kg = RoadmapKnowledgeGraph(
            openai_api_key=self.openai_api_key,
            db_connection_string=self.db_connection_string
        )
        
        # Verify database connection was called
        mock_psycopg2_connect.assert_called_once()
        mock_conn.cursor.assert_called_once()
        mock_cursor.execute.assert_called_once()
        mock_conn.commit.assert_called_once()
        mock_cursor.close.assert_called_once()
        mock_conn.close.assert_called_once()

    @patch('src.analysis.knowledge_graph.OpenAI')
    def test_extract_entities_and_relationships(self, mock_openai):
        """Test entity and relationship extraction."""
        # Mock OpenAI client and response
        mock_client = MagicMock()
        mock_openai.return_value = mock_client
        
        mock_response = MagicMock()
        mock_choice = MagicMock()
        mock_message = MagicMock()
        mock_message.content = '''[
            {
                "source_entity": "Platform",
                "relationship": "should implement",
                "target_entity": "real-time collaboration",
                "confidence_score": 0.9
            }
        ]'''
        mock_choice.message = mock_message
        mock_response.choices = [mock_choice]
        mock_client.chat.completions.create.return_value = mock_response
        
        # Test the method
        text = "The platform should implement real-time collaboration features for agents"
        result = self.kg._extract_entities_and_relationships(text, "test.pdf")
        
        # Verify results
        self.assertIsInstance(result, list)
        self.assertEqual(len(result), 1)
        self.assertIn("source_entity", result[0])
        self.assertIn("relationship", result[0])
        self.assertIn("target_entity", result[0])
        self.assertIn("confidence_score", result[0])
        self.assertIn("id", result[0])
        self.assertIn("document_source", result[0])
        self.assertIn("created_at", result[0])

    @patch('src.analysis.knowledge_graph.psycopg2.connect')
    def test_add_document_to_knowledge_graph(self, mock_psycopg2_connect):
        """Test adding document to knowledge graph."""
        # Mock the _extract_entities_and_relationships method
        with patch.object(self.kg, '_extract_entities_and_relationships') as mock_extract:
            mock_extract.return_value = [
                {
                    "id": str(uuid.uuid4()),
                    "source_entity": "Platform",
                    "relationship": "should implement",
                    "target_entity": "real-time collaboration",
                    "document_source": "test.pdf",
                    "confidence_score": 0.9,
                    "created_at": "2023-01-01T00:00:00"
                }
            ]
            
            # Mock database connection and cursor
            mock_conn = MagicMock()
            mock_cursor = MagicMock()
            mock_psycopg2_connect.return_value = mock_conn
            mock_conn.cursor.return_value = mock_cursor
            
            # Test the method
            text = "The platform should implement real-time collaboration features for agents"
            result = self.kg.add_document_to_knowledge_graph(text, "test.pdf")
            
            # Verify results
            self.assertEqual(result["status"], "success")
            self.assertIn("relationships_added", result)
            mock_extract.assert_called_once()
            mock_psycopg2_connect.assert_called_once()
            mock_cursor.execute.assert_called_once()
            mock_conn.commit.assert_called_once()

    @patch('src.analysis.knowledge_graph.psycopg2.connect')
    def test_add_document_to_knowledge_graph_no_relationships(self, mock_psycopg2_connect):
        """Test adding document to knowledge graph when no relationships are extracted."""
        # Mock the _extract_entities_and_relationships method to return empty list
        with patch.object(self.kg, '_extract_entities_and_relationships') as mock_extract:
            mock_extract.return_value = []
            
            # Test the method
            text = "Test document with no extractable relationships"
            result = self.kg.add_document_to_knowledge_graph(text, "test.pdf")
            
            # Verify results
            self.assertEqual(result["status"], "warning")
            self.assertIn("No relationships extracted", result["message"])
            self.assertEqual(result["relationships_added"], 0)
            mock_extract.assert_called_once()

    @patch('src.analysis.knowledge_graph.psycopg2.connect')
    def test_query_knowledge_graph(self, mock_psycopg2_connect):
        """Test querying the knowledge graph."""
        # Mock database connection and cursor
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_psycopg2_connect.return_value = mock_conn
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
        mock_cursor.fetchall.return_value = [mock_row]
        
        # Test the method
        result = self.kg.query_knowledge_graph("real-time collaboration")
        
        # Verify results
        self.assertIsInstance(result, list)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]['source_entity'], 'Platform')
        self.assertEqual(result[0]['relationship'], 'should implement')
        self.assertEqual(result[0]['target_entity'], 'real-time collaboration')
        mock_psycopg2_connect.assert_called_once()
        mock_conn.cursor.assert_called_once()
        mock_cursor.execute.assert_called_once()
        mock_conn.close.assert_called_once()

    @patch('src.analysis.knowledge_graph.psycopg2.connect')
    def test_add_evaluation_result_to_knowledge_graph(self, mock_psycopg2_connect):
        """Test adding evaluation result to knowledge graph."""
        # Mock the add_document_to_knowledge_graph method
        with patch.object(self.kg, 'add_document_to_knowledge_graph') as mock_add:
            mock_add.return_value = {
                "status": "success",
                "message": "Added 1 relationships to knowledge graph",
                "relationships_added": 1
            }
            
            # Test data
            evaluation_data = {
                "metrics": {"accuracy": 0.95, "performance": "good"},
                "feedback": "Great feature implementation"
            }
            
            # Test the method
            result = self.kg.add_evaluation_result_to_knowledge_graph(
                evaluation_data, 
                "task-123", 
                "Real-time Collaboration"
            )
            
            # Verify results
            self.assertEqual(result["status"], "success")
            mock_add.assert_called_once()


if __name__ == '__main__':
    unittest.main()