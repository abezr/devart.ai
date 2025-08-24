# Architecture Refactoring Agent

## Overview
The Architecture Refactoring Agent is a specialized GenAI agent that analyzes codebases and performance data to suggest and implement architectural improvements. It extends the devart.ai platform's capabilities by providing automated analysis of software architecture patterns, identifying potential bottlenecks, and generating refactoring recommendations.

## Features
- Codebase analysis for architectural patterns and anti-patterns
- AI-driven refactoring suggestions
- Sandbox execution of refactorings
- Real-time monitoring and reporting
- Integration with devart.ai platform components

## Prerequisites
- Python 3.8+
- RabbitMQ server
- Access to devart.ai API
- OpenTelemetry collector (optional, for tracing)
- Kubernetes cluster (for sandbox execution)
- OpenAI API key (for AI-driven suggestions)

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-org/devart.ai.git
   cd devart.ai/devart-architecture-refactoring-agent
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## Configuration
The agent requires the following environment variables:

```bash
# Agent identification
DEVART_AGENT_ID=your-agent-id
DEVART_API_KEY=your-api-key
DEVART_API_BASE_URL=https://your-api.workers.dev

# RabbitMQ connection
RABBITMQ_URL=amqp://localhost
RABBITMQ_ARCHITECTURE_ANALYSIS_QUEUE=architecture.analysis

# OpenTelemetry (optional)
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317

# OpenAI (for AI-driven suggestions)
OPENAI_API_KEY=your-openai-api-key

# Kubernetes (for sandbox execution)
KUBECONFIG=/path/to/kubeconfig
```

## Usage
Run the agent:
```bash
python main.py
```

The agent will:
1. Connect to RabbitMQ and listen for architecture analysis tasks
2. Process incoming tasks by analyzing codebases
3. Generate refactoring suggestions using AI
4. Report findings and suggestions to the devart.ai platform
5. Execute approved refactorings in sandboxed environments

## Architecture
The agent consists of the following components:

1. **Task Consumer** - Consumes architecture analysis tasks from RabbitMQ
2. **Codebase Analyzer** - Parses and analyzes codebase structure
3. **Refactoring Suggester** - Generates AI-driven refactoring suggestions
4. **Refactoring Executor** - Implements approved refactorings in sandboxed environments

### Codebase Analyzer
The Codebase Analyzer component examines the structure of codebases to identify:
- Architectural patterns (MVC, microservices, etc.)
- Anti-patterns (God classes, circular dependencies, etc.)
- Code quality issues (long functions, large modules, etc.)
- Dependency relationships between modules

### Refactoring Suggester
The Refactoring Suggester generates actionable suggestions based on findings:
- Specific refactoring steps for each issue
- Complexity and impact assessments
- Priority rankings
- Estimated effort hours

### Refactoring Executor
The Refactoring Executor implements approved refactorings:
- Provisions sandboxed environments using Kubernetes
- Applies refactoring steps safely
- Runs tests to validate changes
- Generates performance comparisons
- Manages rollback capabilities

## API Integration
The agent communicates with the devart.ai platform through the following API endpoints:

- `POST /api/architecture-analysis` - Create new analysis task
- `GET /api/architecture-analysis/:taskId` - Get task details
- `PUT /api/architecture-analysis/:taskId/status` - Update task status
- `POST /api/architecture-analysis/:taskId/findings` - Report findings
- `POST /api/architecture-analysis/:taskId/suggestions` - Report suggestions
- `POST /api/sandbox/provision` - Request sandbox provisioning
- `POST /api/architecture-analysis/executions/:executionId/execute` - Execute refactoring

## Examples
The `examples/` directory contains scripts demonstrating usage:
- `architecture_analysis_example.py` - Basic task processing example
- `full_analysis_example.py` - Complete workflow example

## Development
To run tests:
```bash
python -m pytest tests/
```

## Contributing
1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a pull request

## License
This project is licensed under the MIT License.