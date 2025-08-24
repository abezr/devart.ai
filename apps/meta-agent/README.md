# Meta-Agent System

The Meta-Agent System is designed to create a fully self-evolving platform that can analyze its own roadmap, generate tasks for new features, and assign them to other agents.

## Architecture Overview

The system follows a two-phase architecture with clear separation between data analysis and task orchestration:

1. **Phase 1: Data Ingestion (LlamaIndex)**
   - Roadmap Documents (PDFs, Markdown, etc.) → LlamaIndex Ingestion Pipeline
   - Chunking & Metadata Extraction → OpenAI Embedding API
   - PGVector Knowledge Base

2. **Phase 2: Agentic Execution (Langroid)**
   - Meta-Agent (Langroid) queries the knowledge base
   - Analyzes roadmap context and generates new feature tasks
   - Task Assigner Agent finds best agent for the job
   - Creates task via devart.ai API

## Components

- **Roadmap Analysis Module**: Ingests and processes platform roadmap documents
- **Task Generation Module**: Creates new tasks based on roadmap analysis
- **Agent Assignment Module**: Assigns tasks to appropriate agents based on capabilities

## System Requirements

- Python 3.8+
- PostgreSQL with pgvector extension
- OpenAI API key
- Access to devart.ai API

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd apps/meta-agent
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. Run the application:
   ```bash
   python main.py
   ```

## Configuration

The Meta-Agent System requires the following environment variables:

- `OPENAI_API_KEY`: OpenAI API key for embeddings and LLM operations
- `DATABASE_URL`: PostgreSQL connection string with pgvector extension
- `API_BASE_URL`: Base URL for the devart.ai API
- `META_AGENT_API_KEY`: API key for authenticating Meta-Agent requests
- `SECRET_KEY`: Secret key for JWT token generation

## API Endpoints

### Get Meta-Agent Status
```
GET /api/meta-agent/status
```

### Analyze Roadmap
```
POST /api/meta-agent/analyze-roadmap
```

### Generate Tasks
```
POST /api/meta-agent/generate-tasks
```

### Ingest Documents
```
POST /api/meta-agent/ingest-documents
```

## Deployment

The Meta-Agent System can be deployed using Docker or directly on a server.

### Docker Deployment

1. Build the Docker image:
   ```bash
   docker build -t meta-agent .
   ```

2. Run the container:
   ```bash
   docker run -p 5000:5000 meta-agent
   ```

### Kubernetes Deployment

Apply the Kubernetes manifests:
```bash
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/deployment.yaml
```

## Monitoring and Observability

The Meta-Agent System includes OpenTelemetry instrumentation for tracing and monitoring. Configure the `OTLP_ENDPOINT` environment variable to send traces to your observability backend.

## Security

The Meta-Agent System implements API key authentication and rate limiting to protect against abuse. All API endpoints require a valid API key in the `Authorization: Bearer` header.

## Testing

Run the test suite:
```bash
python -m pytest src/tests/
```

## Documentation

- [API Documentation](docs/api.md)
- [Architecture Documentation](docs/architecture.md)