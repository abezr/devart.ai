# Meta-Agent System API Documentation

## Overview

The Meta-Agent System provides API endpoints for autonomous platform evolution by analyzing roadmap documents, generating tasks, and assigning them to appropriate agents.

## Base URL

```
http://localhost:5000/api/meta-agent
```

## Authentication

All endpoints require a valid API key in the `Authorization` header:

```
Authorization: Bearer YOUR_META_AGENT_API_KEY
```

## Endpoints

### Get Meta-Agent Status

Get the current status of the meta-agent system.

```
GET /api/meta-agent/status
```

**Response:**
```json
{
  "status": "running",
  "version": "1.0.0",
  "components": {
    "document_ingestion": "active",
    "task_generation": "active",
    "agent_assignment": "active"
  }
}
```

### Analyze Roadmap

Trigger roadmap analysis to identify upcoming features.

```
POST /api/meta-agent/analyze-roadmap
```

**Request Body:**
```json
{
  "query": "What are the next features to implement?",
  "similarity_threshold": 0.7
}
```

**Response:**
```json
{
  "status": "success",
  "query": "What are the next features to implement?",
  "results": [
    {
      "content": "Implement real-time collaboration features for agents",
      "source": "Q3_2025_Roadmap.md",
      "similarity": 0.85
    }
  ]
}
```

### Generate Tasks

Generate tasks based on roadmap analysis.

```
POST /api/meta-agent/generate-tasks
```

**Request Body:**
```json
{
  "roadmap_query": "What are the next features to implement?"
}
```

**Response:**
```json
{
  "status": "success",
  "created_tasks": ["task-id-1", "task-id-2"],
  "count": 2
}
```

### Ingest Documents

Ingest new roadmap documents into the knowledge base.

```
POST /api/meta-agent/ingest-documents
```

**Request Body:**
```json
{
  "documents_path": "./roadmaps"
}
```

**Response:**
```json
{
  "status": "success",
  "documents_processed": 5,
  "message": "Successfully ingested 5 documents"
}
```