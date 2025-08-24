# Architecture Refactoring Agent - API Documentation

## Overview

This document provides detailed documentation for all API endpoints used by the Architecture Refactoring Agent to communicate with the devart.ai platform.

## Authentication

All API requests require authentication using a Bearer token:

```
Authorization: Bearer YOUR_API_KEY
```

## Base URL

```
https://your-api.workers.dev/api
```

## Architecture Analysis Endpoints

### Get Analysis Task Details

**Endpoint**: `GET /architecture-analysis/{taskId}`

**Description**: Retrieve the full details of an architecture analysis task.

**Path Parameters**:
- `taskId` (string, required): The unique identifier of the task

**Response**:
```json
{
  "id": "task-123",
  "title": "Analyze User Service Architecture",
  "repositoryUrl": "https://github.com/example/user-service",
  "branch": "main",
  "targetModules": ["src/user", "src/auth"],
  "status": "PENDING",
  "createdAt": "2023-01-01T00:00:00Z",
  "updatedAt": "2023-01-01T00:00:00Z"
}
```

**Response Codes**:
- `200`: Success
- `401`: Unauthorized
- `404`: Task not found

### Update Analysis Status

**Endpoint**: `PUT /architecture-analysis/{taskId}/status`

**Description**: Update the status of an architecture analysis task.

**Path Parameters**:
- `taskId` (string, required): The unique identifier of the task

**Request Body**:
```json
{
  "agentId": "agent-456",
  "newStatus": "IN_PROGRESS"
}
```

**Request Fields**:
- `agentId` (string, required): The ID of the agent processing the task
- `newStatus` (string, required): The new status (PENDING, IN_PROGRESS, DONE, ERROR)

**Response**:
```json
{
  "success": true,
  "message": "Status updated successfully"
}
```

**Response Codes**:
- `200`: Success
- `400`: Bad request
- `401`: Unauthorized
- `404`: Task not found

### Report Findings

**Endpoint**: `POST /architecture-analysis/{taskId}/findings`

**Description**: Report architectural findings from the analysis.

**Path Parameters**:
- `taskId` (string, required): The unique identifier of the task

**Request Body**:
```json
{
  "agentId": "agent-456",
  "findings": [
    {
      "type": "god_class",
      "severity": "HIGH",
      "description": "UserManager class has too many responsibilities",
      "file_path": "src/UserManager.py",
      "impact_score": 0.85,
      "confidence_score": 0.92
    }
  ]
}
```

**Request Fields**:
- `agentId` (string, required): The ID of the agent reporting findings
- `findings` (array, required): Array of finding objects

**Finding Object**:
- `type` (string, required): Type of finding (god_class, circular_dependency, etc.)
- `severity` (string, required): Severity level (LOW, MEDIUM, HIGH, CRITICAL)
- `description` (string, required): Description of the finding
- `file_path` (string, required): Path to the affected file
- `impact_score` (number, required): Impact score (0.0 - 1.0)
- `confidence_score` (number, required): Confidence score (0.0 - 1.0)

**Response**:
```json
{
  "success": true,
  "message": "Findings reported successfully"
}
```

**Response Codes**:
- `200`: Success
- `400`: Bad request
- `401`: Unauthorized
- `404`: Task not found

### Report Suggestions

**Endpoint**: `POST /architecture-analysis/{taskId}/suggestions`

**Description**: Report refactoring suggestions based on analysis findings.

**Path Parameters**:
- `taskId` (string, required): The unique identifier of the task

**Request Body**:
```json
{
  "agentId": "agent-456",
  "suggestions": [
    {
      "title": "Split God Class",
      "description": "Break down the UserManager class into smaller, focused classes",
      "complexity": "HIGH",
      "impact": "HIGH",
      "priority": "CRITICAL",
      "implementation_plan": [
        "Identify distinct responsibilities in the class",
        "Create new classes for each responsibility"
      ],
      "estimated_effort_hours": 12.0,
      "related_finding_id": "finding-789"
    }
  ]
}
```

**Request Fields**:
- `agentId` (string, required): The ID of the agent reporting suggestions
- `suggestions` (array, required): Array of suggestion objects

**Suggestion Object**:
- `title` (string, required): Title of the suggestion
- `description` (string, required): Detailed description of the suggestion
- `complexity` (string, required): Complexity level (LOW, MEDIUM, HIGH)
- `impact` (string, required): Impact level (LOW, MEDIUM, HIGH)
- `priority` (string, required): Priority level (LOW, MEDIUM, HIGH, CRITICAL)
- `implementation_plan` (array, required): Steps to implement the suggestion
- `estimated_effort_hours` (number, required): Estimated effort in hours
- `related_finding_id` (string, required): ID of the related finding

**Response**:
```json
{
  "success": true,
  "message": "Suggestions reported successfully"
}
```

**Response Codes**:
- `200`: Success
- `400`: Bad request
- `401`: Unauthorized
- `404`: Task not found

### Claim Task

**Endpoint**: `POST /architecture-analysis/{taskId}/claim`

**Description**: Claim an architecture analysis task for processing.

**Path Parameters**:
- `taskId` (string, required): The unique identifier of the task

**Request Body**:
```json
{
  "agentId": "agent-456"
}
```

**Request Fields**:
- `agentId` (string, required): The ID of the agent claiming the task

**Response**:
```json
{
  "success": true,
  "message": "Task claimed successfully"
}
```

**Response Codes**:
- `200`: Success
- `400`: Bad request
- `401`: Unauthorized
- `404`: Task not found
- `409`: Task already claimed

## Sandbox Endpoints

### Provision Sandbox

**Endpoint**: `POST /sandbox/provision`

**Description**: Request provisioning of a sandbox environment for refactoring execution.

**Request Body**:
```json
{
  "agentId": "agent-456",
  "taskId": "task-123",
  "repositoryUrl": "https://github.com/example/user-service",
  "branch": "main"
}
```

**Request Fields**:
- `agentId` (string, required): The ID of the agent requesting provisioning
- `taskId` (string, required): The ID of the associated task
- `repositoryUrl` (string, required): URL of the repository to clone
- `branch` (string, required): Branch to clone

**Response**:
```json
{
  "success": true,
  "sandboxId": "sandbox-789",
  "sandboxUrl": "https://sandbox.devart.ai/sandbox-789",
  "message": "Sandbox provisioning requested successfully"
}
```

**Response Codes**:
- `200`: Success
- `400`: Bad request
- `401`: Unauthorized

### Execute Refactoring

**Endpoint**: `POST /architecture-analysis/executions/{executionId}/execute`

**Description**: Execute a refactoring suggestion in the sandbox environment.

**Path Parameters**:
- `executionId` (string, required): The unique identifier of the execution

**Request Body**:
```json
{
  "agentId": "agent-456",
  "suggestionId": "suggestion-456"
}
```

**Request Fields**:
- `agentId` (string, required): The ID of the agent executing the refactoring
- `suggestionId` (string, required): The ID of the suggestion to execute

**Response**:
```json
{
  "success": true,
  "executionId": "execution-789",
  "sandboxId": "sandbox-123",
  "changes": [
    {
      "step": "Step 1: Analyze the code",
      "success": true
    }
  ],
  "testResults": {
    "success": true,
    "passed": 42,
    "failed": 0,
    "skipped": 3
  },
  "performanceComparison": {
    "before": {
      "response_time_ms": 150,
      "memory_usage_mb": 128
    },
    "after": {
      "response_time_ms": 120,
      "memory_usage_mb": 110
    }
  }
}
```

**Response Codes**:
- `200`: Success
- `400`: Bad request
- `401`: Unauthorized
- `404`: Execution not found

## Error Responses

All error responses follow this format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

### Common Error Codes

- `UNAUTHORIZED`: Invalid or missing authentication
- `NOT_FOUND`: Resource not found
- `BAD_REQUEST`: Invalid request data
- `CONFLICT`: Resource conflict (e.g., task already claimed)
- `INTERNAL_ERROR`: Internal server error

## Rate Limiting

API requests are subject to rate limiting:
- 1000 requests per hour per API key
- 100 requests per minute per API key

Exceeding rate limits will result in a `429 TOO_MANY_REQUESTS` response.

## Webhooks

The platform may send webhooks to notify the agent of certain events:

### Task Assignment

**Event**: `task.assigned`

**Payload**:
```json
{
  "eventType": "task.assigned",
  "taskId": "task-123",
  "agentId": "agent-456"
}
```

## Versioning

The API uses semantic versioning. Breaking changes will be introduced in new major versions.

Current version: v1

## Changelog

### v1.0.0
- Initial release
- Architecture analysis endpoints
- Sandbox provisioning and execution endpoints
- Basic authentication and rate limiting