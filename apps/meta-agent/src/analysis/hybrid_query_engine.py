"""
Hybrid Query Engine for Meta-Agent System

This module implements a hybrid query engine that combines vector search
and knowledge graph queries to provide comprehensive roadmap analysis.
"""

from typing import List, Dict, Any, Union
from src.analysis.document_ingestion import RoadmapDocumentIngestion
from src.analysis.knowledge_graph import RoadmapKnowledgeGraph


class HybridQueryEngine:
    """Hybrid query engine that combines vector search and knowledge graph queries."""

    def __init__(self, document_ingestion: RoadmapDocumentIngestion, knowledge_graph: RoadmapKnowledgeGraph):
        """
        Initialize the hybrid query engine.
        
        Args:
            document_ingestion: Document ingestion system for vector search
            knowledge_graph: Knowledge graph system for structured queries
        """
        self.document_ingestion = document_ingestion
        self.knowledge_graph = knowledge_graph

    def query(self, query: str, similarity_threshold: float = 0.7) -> Dict[str, Any]:
        """
        Perform a hybrid query using both vector search and knowledge graph.
        
        Args:
            query: Query string
            similarity_threshold: Minimum similarity threshold for vector search
            
        Returns:
            Dictionary with results from both query methods
        """
        # Perform vector search
        vector_results = self.document_ingestion.query_roadmap(query, similarity_threshold)
        
        # Perform knowledge graph query
        kg_results = self.knowledge_graph.query_knowledge_graph(query)
        
        # Combine and synthesize results
        synthesized_answer = self._synthesize_results(query, vector_results, kg_results)
        
        return {
            "query": query,
            "vector_search_results": vector_results,
            "knowledge_graph_results": kg_results,
            "synthesized_answer": synthesized_answer
        }

    def _synthesize_results(self, query: str, vector_results: List[Dict[str, Any]], 
                          kg_results: List[Dict[str, Any]]) -> str:
        """
        Synthesize results from vector search and knowledge graph queries.
        
        Args:
            query: Original query
            vector_results: Results from vector search
            kg_results: Results from knowledge graph query
            
        Returns:
            Synthesized answer
        """
        try:
            # If we have knowledge graph results, prioritize them as they're more structured
            if kg_results:
                # Format knowledge graph results
                kg_summary = "\n".join([
                    f"- {rel['source_entity']} {rel['relationship']} {rel['target_entity']} (confidence: {rel['confidence_score']})"
                    for rel in kg_results[:5]  # Limit to top 5 results
                ])
                
                return f"Based on the knowledge graph analysis:\n{kg_summary}"
            
            # If we have vector search results, use them
            elif vector_results:
                # Format vector search results
                vector_summary = "\n".join([
                    f"- {result['content']} (source: {result['source']}, similarity: {result['similarity']:.2f})"
                    for result in vector_results[:3]  # Limit to top 3 results
                ])
                
                return f"Based on semantic search of roadmap documents:\n{vector_summary}"
            
            # If no results from either, return a default message
            else:
                return "No relevant information found in the roadmap knowledge base."
                
        except Exception as e:
            print(f"Error synthesizing results: {str(e)}")
            return "Error synthesizing query results."

    def get_next_strategic_priority(self) -> Dict[str, Any]:
        """
        Identify the next strategic priority based on roadmap analysis.
        
        Returns:
            Dictionary with strategic priority information
        """
        # Query for high-priority items
        query_result = self.query("What are the highest priority items in the roadmap?", 0.5)
        
        # Extract key information
        priorities = []
        
        # From knowledge graph results
        for kg_result in query_result.get("knowledge_graph_results", []):
            if kg_result.get("confidence_score", 0) > 0.7:
                priorities.append({
                    "type": "structured",
                    "content": f"{kg_result['source_entity']} {kg_result['relationship']} {kg_result['target_entity']}",
                    "confidence": kg_result["confidence_score"]
                })
        
        # From vector search results
        for vector_result in query_result.get("vector_search_results", []):
            if vector_result.get("similarity", 0) > 0.7:
                priorities.append({
                    "type": "semantic",
                    "content": vector_result["content"],
                    "similarity": vector_result["similarity"]
                })
        
        # Sort by confidence/similarity
        priorities.sort(key=lambda x: x.get("confidence", x.get("similarity", 0)), reverse=True)
        
        return {
            "status": "success",
            "priorities": priorities[:5],  # Top 5 priorities
            "synthesized_answer": query_result.get("synthesized_answer", "")
        }


# Example usage
if __name__ == "__main__":
    # Example usage would require initialized document_ingestion and knowledge_graph objects
    # hybrid_engine = HybridQueryEngine(document_ingestion, knowledge_graph)
    # result = hybrid_engine.query("What are the next features to implement?")
    # print(result)
    pass