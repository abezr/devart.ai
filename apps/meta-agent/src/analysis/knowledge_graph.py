"""
Knowledge Graph Module for Meta-Agent System

This module handles the extraction of entities and relationships from roadmap documents
and stores them in a structured knowledge graph.
"""

import os
import json
import uuid
from typing import List, Dict, Any, Tuple
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor
from openai import OpenAI
from pydantic import BaseModel


class KnowledgeGraphEntry(BaseModel):
    """Data model for a knowledge graph entry."""
    id: str
    source_entity: str
    relationship: str
    target_entity: str
    document_source: str
    confidence_score: float
    created_at: str


class RoadmapKnowledgeGraph:
    """Handles creation and management of the roadmap knowledge graph."""

    def __init__(self, openai_api_key: str, db_connection_string: str):
        """
        Initialize the knowledge graph system.
        
        Args:
            openai_api_key: OpenAI API key for LLM calls
            db_connection_string: PostgreSQL connection string
        """
        self.openai_api_key = openai_api_key
        self.db_connection_string = db_connection_string
        self.openai_client = OpenAI(api_key=openai_api_key)
        
        # Initialize database connection and create table if needed
        self._init_db()

    def _init_db(self):
        """Initialize the PostgreSQL database and create the knowledge graph table."""
        try:
            # Parse connection string
            # Format: postgresql://user:password@host:port/database
            parts = self.db_connection_string.split("://")[1].split("@")
            user_pass, host_port_db = parts[0], parts[1]
            user, password = user_pass.split(":")
            host_port, database = host_port_db.split("/")
            host, port = host_port.split(":")
            
            # Connect to database
            conn = psycopg2.connect(
                database=database,
                host=host,
                password=password,
                port=port,
                user=user
            )
            cursor = conn.cursor()
            
            # Create roadmap_kg table if it doesn't exist
            create_table_query = """
            CREATE TABLE IF NOT EXISTS roadmap_kg (
                id UUID PRIMARY KEY,
                source_entity TEXT NOT NULL,
                relationship TEXT NOT NULL,
                target_entity TEXT NOT NULL,
                document_source TEXT NOT NULL,
                confidence_score NUMERIC NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            """
            
            cursor.execute(create_table_query)
            conn.commit()
            cursor.close()
            conn.close()
            
            print("Knowledge graph table initialized successfully")
        except Exception as e:
            print(f"Error initializing database: {str(e)}")

    def _extract_entities_and_relationships(self, text: str, document_source: str) -> List[Dict[str, Any]]:
        """
        Extract entities and relationships from text using LLM.
        
        Args:
            text: Text to analyze
            document_source: Source document name
            
        Returns:
            List of extracted entities and relationships
        """
        try:
            prompt = f"""
            Extract key entities and relationships from the following roadmap text.
            Format each relationship as a JSON object with these fields:
            - source_entity: The source entity in the relationship
            - relationship: The type of relationship
            - target_entity: The target entity in the relationship
            - confidence_score: Confidence score between 0.0 and 1.0
            
            Text:
            {text}
            
            Respond with a JSON array of relationship objects. Do not include any other text.
            """
            
            response = self.openai_client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are an expert at extracting structured information from documents."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=1000
            )
            
            # Extract JSON from response
            content = response.choices[0].message.content.strip()
            
            # Try to parse as JSON
            try:
                relationships = json.loads(content)
                # Add document source and generate IDs
                for rel in relationships:
                    rel["id"] = str(uuid.uuid4())
                    rel["document_source"] = document_source
                    rel["created_at"] = datetime.now().isoformat()
                return relationships
            except json.JSONDecodeError:
                print(f"Error parsing JSON from LLM response: {content}")
                return []
                
        except Exception as e:
            print(f"Error extracting entities and relationships: {str(e)}")
            return []

    def add_document_to_knowledge_graph(self, text: str, document_source: str) -> Dict[str, Any]:
        """
        Add a document's entities and relationships to the knowledge graph.
        
        Args:
            text: Document text to analyze
            document_source: Source document name
            
        Returns:
            Dictionary with operation results
        """
        try:
            # Extract entities and relationships
            relationships = self._extract_entities_and_relationships(text, document_source)
            
            if not relationships:
                return {
                    "status": "warning",
                    "message": "No relationships extracted from document",
                    "relationships_added": 0
                }
            
            # Connect to database
            parts = self.db_connection_string.split("://")[1].split("@")
            user_pass, host_port_db = parts[0], parts[1]
            user, password = user_pass.split(":")
            host_port, database = host_port_db.split("/")
            host, port = host_port.split(":")
            
            conn = psycopg2.connect(
                database=database,
                host=host,
                password=password,
                port=port,
                user=user
            )
            cursor = conn.cursor()
            
            # Insert relationships into database
            insert_query = """
            INSERT INTO roadmap_kg 
            (id, source_entity, relationship, target_entity, document_source, confidence_score, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """
            
            inserted_count = 0
            for rel in relationships:
                try:
                    cursor.execute(insert_query, (
                        rel["id"],
                        rel["source_entity"],
                        rel["relationship"],
                        rel["target_entity"],
                        rel["document_source"],
                        rel["confidence_score"],
                        rel["created_at"]
                    ))
                    inserted_count += 1
                except Exception as e:
                    print(f"Error inserting relationship {rel}: {str(e)}")
            
            conn.commit()
            cursor.close()
            conn.close()
            
            return {
                "status": "success",
                "message": f"Added {inserted_count} relationships to knowledge graph",
                "relationships_added": inserted_count
            }
            
        except Exception as e:
            return {
                "status": "error",
                "message": f"Failed to add document to knowledge graph: {str(e)}",
                "relationships_added": 0
            }

    def add_evaluation_result_to_knowledge_graph(self, evaluation_data: Dict[str, Any], task_id: str, feature_name: str) -> Dict[str, Any]:
        """
        Add an evaluation result to the knowledge graph.
        
        Args:
            evaluation_data: Evaluation data including metrics and feedback
            task_id: ID of the task being evaluated
            feature_name: Name of the feature being evaluated
            
        Returns:
            Dictionary with operation results
        """
        try:
            # Create a structured text representation of the evaluation data
            metrics_text = "\n".join([f"  - {key}: {value}" for key, value in evaluation_data.get("metrics", {}).items()])
            evaluation_text = f"""
            Evaluation Results for Feature: {feature_name}
            Task ID: {task_id}
            Metrics:
            {metrics_text}
            Feedback: {evaluation_data.get("feedback", "No feedback provided")}
            """
            
            # Add to knowledge graph as a document
            result = self.add_document_to_knowledge_graph(
                text=evaluation_text,
                document_source=f"evaluation_{task_id}"
            )
            
            return result
            
        except Exception as e:
            return {
                "status": "error",
                "message": f"Failed to add evaluation result to knowledge graph: {str(e)}",
                "relationships_added": 0
            }

    def query_knowledge_graph(self, query: str) -> List[Dict[str, Any]]:
        """
        Query the knowledge graph for structured information.
        
        Args:
            query: Query to execute on the knowledge graph
            
        Returns:
            List of matching relationships
        """
        try:
            # Connect to database
            parts = self.db_connection_string.split("://")[1].split("@")
            user_pass, host_port_db = parts[0], parts[1]
            user, password = user_pass.split(":")
            host_port, database = host_port_db.split("/")
            host, port = host_port.split(":")
            
            conn = psycopg2.connect(
                database=database,
                host=host,
                password=password,
                port=port,
                user=user
            )
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            # For now, we'll do a simple search across all fields
            # In a more advanced implementation, we could parse the query and do structured searches
            search_query = """
            SELECT * FROM roadmap_kg 
            WHERE source_entity ILIKE %s 
               OR relationship ILIKE %s 
               OR target_entity ILIKE %s
            ORDER BY confidence_score DESC
            LIMIT 20
            """
            
            search_term = f"%{query}%"
            cursor.execute(search_query, (search_term, search_term, search_term))
            results = cursor.fetchall()
            
            cursor.close()
            conn.close()
            
            return [dict(row) for row in results]
            
        except Exception as e:
            print(f"Error querying knowledge graph: {str(e)}")
            return []

    def get_feedback_for_feature(self, feature_name: str) -> List[Dict[str, Any]]:
        """
        Get feedback and evaluation results for a specific feature.
        
        Args:
            feature_name: Name of the feature to get feedback for
            
        Returns:
            List of evaluation results for the feature
        """
        try:
            # Connect to database
            parts = self.db_connection_string.split("://")[1].split("@")
            user_pass, host_port_db = parts[0], parts[1]
            user, password = user_pass.split(":")
            host_port, database = host_port_db.split("/")
            host, port = host_port.split(":")
            
            conn = psycopg2.connect(
                database=database,
                host=host,
                password=password,
                port=port,
                user=user
            )
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            # Search for evaluation results related to the feature
            search_query = """
            SELECT * FROM roadmap_kg 
            WHERE document_source ILIKE %s 
               OR source_entity ILIKE %s 
               OR target_entity ILIKE %s
            ORDER BY created_at DESC
            """
            
            search_term = f"%{feature_name}%"
            cursor.execute(search_query, (search_term, search_term, search_term))
            results = cursor.fetchall()
            
            cursor.close()
            conn.close()
            
            return [dict(row) for row in results]
            
        except Exception as e:
            print(f"Error getting feedback for feature: {str(e)}")
            return []

    def update_knowledge_from_evaluation(self, feature_name: str, evaluation_results: Dict[str, Any]) -> Dict[str, Any]:
        """
        Update the knowledge base with insights from evaluation results.
        
        Args:
            feature_name: Name of the feature that was evaluated
            evaluation_results: Results from the evaluation
            
        Returns:
            Dictionary with operation results
        """
        try:
            # Extract key insights from evaluation results
            insights_text = f"""
            Insights from evaluation of {feature_name}:
            Performance: {evaluation_results.get('performance', 'Not measured')}
            User Satisfaction: {evaluation_results.get('user_satisfaction', 'Not measured')}
            Issues Identified: {evaluation_results.get('issues', 'None reported')}
            Recommendations: {evaluation_results.get('recommendations', 'None provided')}
            """
            
            # Add insights to knowledge graph
            result = self.add_document_to_knowledge_graph(
                text=insights_text,
                document_source=f"insights_{feature_name}"
            )
            
            return {
                "status": "success",
                "message": "Knowledge base updated with evaluation insights",
                "knowledge_graph_result": result
            }
            
        except Exception as e:
            return {
                "status": "error",
                "message": f"Failed to update knowledge from evaluation: {str(e)}"
            }


# Example usage
if __name__ == "__main__":
    # Example usage (would require actual API keys and DB connection)
    # kg = RoadmapKnowledgeGraph(
    #     openai_api_key=os.getenv("OPENAI_API_KEY"),
    #     db_connection_string=os.getenv("DATABASE_URL")
    # )
    # result = kg.add_document_to_knowledge_graph("The platform should implement real-time collaboration features for agents", "Q3_2025_Roadmap.pdf")
    # print(result)
    pass