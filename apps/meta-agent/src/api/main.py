"""
Meta-Agent API Endpoints

This module implements the API endpoints for the Meta-Agent System,
allowing external triggering of roadmap analysis and task generation.
"""

from flask import Flask, request, jsonify
import os
from src.analysis.document_ingestion import RoadmapDocumentIngestion
from src.orchestration.meta_agent import MetaAgent
from src.utils.opentelemetry import initialize_opentelemetry
from src.utils.security import require_api_key, rate_limit


app = Flask(__name__)

# Initialize OpenTelemetry
initialize_opentelemetry(app)

# Initialize components
openai_api_key = os.getenv("OPENAI_API_KEY")
db_connection_string = os.getenv("DATABASE_URL")
api_base_url = os.getenv("API_BASE_URL", "http://localhost:8787")
meta_agent_api_key = os.getenv("META_AGENT_API_KEY")

# Initialize the document ingestion system
document_ingestion = RoadmapDocumentIngestion(
    openai_api_key=openai_api_key,
    db_connection_string=db_connection_string
)

# Initialize the meta-agent
meta_agent = MetaAgent(
    api_base_url=api_base_url,
    api_key=meta_agent_api_key
)


@app.route('/api/meta-agent/status', methods=['GET'])
@require_api_key
@rate_limit(max_requests=100, window=3600)  # 100 requests per hour
def get_meta_agent_status():
    """Get the current status of the meta-agent system."""
    return jsonify({
        "status": "running",
        "version": "1.0.0",
        "components": {
            "document_ingestion": "active",
            "task_generation": "active",
            "agent_assignment": "active"
        }
    })


@app.route('/api/meta-agent/analyze-roadmap', methods=['POST'])
@require_api_key
@rate_limit(max_requests=50, window=3600)  # 50 requests per hour
def analyze_roadmap():
    """Trigger roadmap analysis and task generation."""
    try:
        data = request.get_json()
        query = data.get('query', 'What are the next features to implement?')
        similarity_threshold = data.get('similarity_threshold', 0.7)
        
        # Query the roadmap knowledge base
        results = document_ingestion.query_roadmap(query, similarity_threshold)
        
        return jsonify({
            "status": "success",
            "query": query,
            "results": results
        })
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


@app.route('/api/meta-agent/generate-tasks', methods=['POST'])
@require_api_key
@rate_limit(max_requests=20, window=3600)  # 20 requests per hour
def generate_tasks():
    """Generate tasks based on roadmap analysis."""
    try:
        data = request.get_json()
        roadmap_query = data.get('roadmap_query', 'What are the next features to implement?')
        
        # Process roadmap and generate tasks
        task_ids = meta_agent.process_roadmap_and_generate_tasks(roadmap_query)
        
        return jsonify({
            "status": "success",
            "created_tasks": task_ids,
            "count": len(task_ids)
        })
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


@app.route('/api/meta-agent/ingest-documents', methods=['POST'])
@require_api_key
@rate_limit(max_requests=10, window=3600)  # 10 requests per hour
def ingest_documents():
    """Ingest new roadmap documents into the knowledge base."""
    try:
        data = request.get_json()
        documents_path = data.get('documents_path', './roadmaps')
        
        # Ingest documents
        result = document_ingestion.ingest_documents(documents_path)
        
        return jsonify(result)
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)