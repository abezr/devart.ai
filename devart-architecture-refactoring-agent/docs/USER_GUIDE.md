# Architecture Refactoring Agent - User Guide

## Overview

The Architecture Refactoring Agent is an AI-driven tool that analyzes codebases to identify architectural issues and provides intelligent refactoring suggestions. It integrates with the devart.ai platform to automate the process of improving software architecture.

## Prerequisites

Before using the Architecture Refactoring Agent, ensure you have:

1. Python 3.8 or higher
2. Access to a RabbitMQ server
3. API credentials for the devart.ai platform
4. OpenAI API key for AI-driven suggestions
5. Kubernetes cluster access for sandbox environments
6. Git installed on the system

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/devart-ai/architecture-refactoring-agent.git
cd architecture-refactoring-agent
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Environment Configuration

Create a `.env` file with the following configuration:

```env
# Agent Configuration
DEVART_AGENT_ID=your-agent-id
DEVART_API_KEY=your-api-key
DEVART_API_BASE_URL=https://your-api.workers.dev

# RabbitMQ Configuration
RABBITMQ_URL=amqp://username:password@host:port
RABBITMQ_ARCHITECTURE_ANALYSIS_QUEUE=architecture.analysis

# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key

# Kubernetes Configuration
KUBERNETES_CONFIG_PATH=/path/to/kubeconfig

# OpenTelemetry Configuration
OTEL_EXPORTER_OTLP_ENDPOINT=https://otel-collector.example.com
```

## Running the Agent

### Basic Execution

```bash
python main.py
```

The agent will start consuming architecture analysis tasks from the RabbitMQ queue and process them automatically.

### Running with Docker

```bash
docker build -t architecture-refactoring-agent .
docker run -d --env-file .env architecture-refactoring-agent
```

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DEVART_AGENT_ID` | Unique identifier for the agent | Yes |
| `DEVART_API_KEY` | API key for authenticating with devart.ai | Yes |
| `DEVART_API_BASE_URL` | Base URL for the devart.ai API | Yes |
| `RABBITMQ_URL` | Connection string for RabbitMQ | Yes |
| `RABBITMQ_ARCHITECTURE_ANALYSIS_QUEUE` | Queue name for architecture analysis tasks | No (defaults to `architecture.analysis`) |
| `OPENAI_API_KEY` | API key for OpenAI integration | Yes |
| `KUBERNETES_CONFIG_PATH` | Path to Kubernetes configuration | Yes |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OpenTelemetry collector endpoint | No |

## Usage

### 1. Submitting Analysis Tasks

Architecture analysis tasks are submitted through the devart.ai platform API. The agent automatically consumes tasks from the RabbitMQ queue.

Example task structure:
```json
{
  "taskId": "task-123",
  "title": "Analyze User Service Architecture",
  "repositoryUrl": "https://github.com/example/user-service",
  "branch": "main",
  "targetModules": ["src/user", "src/auth"]
}
```

### 2. Analysis Process

The agent performs the following steps for each task:

1. **Repository Cloning**: Clones the specified repository and branch
2. **Codebase Analysis**: Analyzes the codebase structure and identifies architectural patterns
3. **Issue Detection**: Detects common architectural issues and anti-patterns
4. **Suggestion Generation**: Uses AI to generate refactoring suggestions
5. **Reporting**: Reports findings and suggestions to the devart.ai platform

### 3. Refactoring Execution

Approved refactoring suggestions can be executed in sandboxed environments:

1. **Sandbox Provisioning**: Creates an isolated environment using Kubernetes
2. **Refactoring Application**: Applies the suggested changes
3. **Testing**: Runs automated tests to validate changes
4. **Performance Comparison**: Generates before/after performance metrics
5. **Reporting**: Reports execution results to the platform

## Core Components

### Codebase Analyzer

The Codebase Analyzer component parses and analyzes codebase structure to identify architectural patterns and anti-patterns.

**Supported Languages**:
- Python
- JavaScript
- TypeScript

**Detected Patterns**:
- God classes
- Circular dependencies
- Long functions
- Large modules
- Utility class overloads

### Refactoring Suggester

The Refactoring Suggester uses AI to generate refactoring suggestions based on analysis findings.

**Suggestion Types**:
- Split God Class
- Break Circular Dependency
- Extract Method
- Split Large Module
- Organize Utility Functions

### Refactoring Executor

The Refactoring Executor implements approved refactoring suggestions in sandboxed environments.

**Features**:
- Kubernetes integration for sandbox provisioning
- Automated testing validation
- Performance comparison metrics
- Rollback capabilities

## Monitoring and Observability

The agent integrates with OpenTelemetry for distributed tracing and monitoring:

- Traces for each analysis task
- Performance metrics
- Error tracking
- Resource usage monitoring

## Troubleshooting

### Common Issues

1. **RabbitMQ Connection Failed**
   - Check RabbitMQ URL and credentials
   - Verify network connectivity to RabbitMQ server

2. **Repository Cloning Failed**
   - Verify repository URL and branch
   - Check Git credentials and permissions

3. **OpenAI API Errors**
   - Verify OpenAI API key
   - Check rate limits and quotas

### Logs

The agent outputs logs to stdout/stderr. For production deployments, configure log aggregation through your monitoring solution.

## Best Practices

1. **Repository Access**: Ensure the agent has appropriate permissions to clone repositories
2. **Resource Allocation**: Allocate sufficient CPU and memory resources for analysis
3. **Security**: Use secure credentials and limit permissions to minimum required
4. **Monitoring**: Monitor agent performance and error rates
5. **Updates**: Keep the agent updated with the latest improvements and security fixes

## API Integration

The agent communicates with the devart.ai platform through REST APIs:

### Endpoints

- `GET /api/architecture-analysis/{taskId}` - Get task details
- `PUT /api/architecture-analysis/{taskId}/status` - Update task status
- `POST /api/architecture-analysis/{taskId}/findings` - Report findings
- `POST /api/architecture-analysis/{taskId}/suggestions` - Report suggestions
- `POST /api/sandbox/provision` - Request sandbox provisioning
- `POST /api/architecture-analysis/executions/{executionId}/execute` - Execute refactoring

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## Support

For support, contact the devart.ai team or file an issue on GitHub.