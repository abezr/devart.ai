# devart.ai - The Autonomous DevOps Platform

devart.ai is a scalable, enterprise-ready, and self-directing control plane for orchestrating, supervising, and analyzing a team of specialized GenAI agents. It functions as a deeply integrated partner in the modern software development lifecycle, capable of analyzing its own strategic roadmap to autonomously generate, assign, and execute tasks for its own evolution.

## 🏛️ Architecture

The system is built on a high-performance, scalable, and resilient architecture. It uses a message-driven pattern for task distribution, a container orchestrator for secure execution, and a real-time database for state synchronization. A comprehensive AIOps stack with proactive Root Cause Analysis, Generative Remediation, and a self-directing Meta-Agent provides deep, intelligent insight into every operation.

```mermaid
graph TD
    subgraph "Users & DevOps"
        Supervisor[Supervisor / Tech Lead]
        Agent[Specialized GenAI Agent (Consumer)]
    end

    subgraph "devart.ai Platform"
        UI[Next.js on Cloudflare Pages]
        API[API Server (Producer)]
        DB[Supabase Postgres w/ pgvector & Realtime]
        Queue[RabbitMQ Message Queue]
        MetaAgent[Meta-Agent System (LlamaIndex + Langroid)]
    end
    
    subgraph "Observability Stack"
        Collector[OpenTelemetry Collector]
        Tempo[Grafana Tempo]
    end

    subgraph "External Systems & Infrastructure"
        GitHub[GitHub API & Webhooks]
        OpenAI[OpenAI LLM & Embedding API]
        K8s[Kubernetes Cluster]
        RoadmapDocs[Roadmap Documents]
    end

    Supervisor -- "Manages & Monitors" --> UI
    UI -- "API Calls" --> API
    UI -- "Realtime Subscriptions" --> DB

    API -- "Publishes Tasks" --> Queue
    API -- "Manages State" --> DB
    API -- "Interacts with" --> GitHub

    Agent -- "Consumes Tasks" --> Queue
    Agent -- "Updates Status & Requests Actions" --> API
    Agent -- "Executes in" --> K8s
    
    UI & API & Agent & MetaAgent -- "Exports Traces" --> Collector
    Collector -- "Stores Traces" --> Tempo
    
    RoadmapDocs -- "Ingested by" --> MetaAgent
    MetaAgent -- "Uses" --> OpenAI
    MetaAgent -- "Queries Knowledge Base in" --> DB
    MetaAgent -- "Creates Tasks via" --> API
```

### Technology Stack

**Frontend**: Next.js 14.2.3 with React, Tailwind CSS, and Supabase client for real-time subscriptions
**Backend**: Hono framework on Cloudflare Workers with TypeScript
**Database**: Supabase PostgreSQL with pgvector extension for semantic search and Realtime subscriptions
**Message Queue**: RabbitMQ with delayed message exchange support for task distribution
**Container Orchestration**: Kubernetes for secure sandboxed execution environments
**Observability**: OpenTelemetry collector with Grafana Tempo for distributed tracing
**Authentication**: Supabase Auth with GitHub OAuth and email providers
**AI Services**: OpenAI API for LLM and embedding services
**Infrastructure**: Cloudflare Pages (UI) and Cloudflare Workers (API)

## ✨ Core Features

### Autonomous Platform Evolution

**Meta-Agent System**: A specialized, self-directing agent that ingests and analyzes the platform's own strategic roadmap. It uses a hybrid RAG (LlamaIndex) and multi-agent orchestration (Langroid) architecture to reason about future features, generate detailed development tasks, and assign them to the appropriate specialized agents in the workforce.

### AI-Driven Software Engineering

**AI Architecture Refactoring**: A specialized agent that analyzes codebases, identifies architectural smells, and generates intelligent refactoring suggestions or pull requests.

**Generative Remediation**: For novel anomalies, the system uses LLMs to generate new, context-aware remediation scripts, which are presented to a human supervisor for validation and approval.

**Automated Remediation**: Based on high-confidence Root Cause Analysis findings, the system can automatically execute predefined actions to resolve known issues.

### Introspective AIOps & Resilience

**Root Cause Analysis (RCA) Engine**: Automatically analyzes detected anomalies, identifies likely root causes, assigns a confidence score, and provides actionable recommendations.

**Self-Healing Agents**: A built-in retry mechanism with exponential backoff allows tasks to be automatically re-queued upon failure, enabling agents to recover from transient errors and query a knowledge base for solutions.

**End-to-End Distributed Tracing**: Powered by OpenTelemetry, every request is traced across all system components, providing unparalleled visibility for debugging.

**Advanced Trace Anomaly Detection**: Proactively identifies performance regressions and security issues by analyzing trace data collected through OpenTelemetry. Features statistical anomaly detection for latency, error rates, throughput, and security patterns with Telegram integration for critical alerts.

### Intelligent Orchestration & Specialization

**Capability-Aware Dispatch**: The orchestration engine intelligently matches tasks to agents based on their declared skills (e.g., ["python", "kubernetes"]), ensuring the right agent is always on the right job.

**Workflow Engine**: Define, manage, and trigger multi-stage, reusable workflows (e.g., build -> test -> review) from the UI or via API.

### Advanced DevOps Integration

**Interactive GitHub Integration**: Agents can post comments and pass/fail status checks directly to Pull Requests, acting as automated code reviewers.

**Production Sandbox Orchestrator**: A robust Kubernetes integration for provisioning secure, isolated, and scalable execution environments for every agent task.

### Scalability & Governance

**Advanced Job Queue**: A high-throughput RabbitMQ message queue for task distribution, enabling delayed retries, dead-lettering, and a push-based architecture.

**Role-Based Access Control (RBAC)**: Secure the platform with admin, supervisor, and viewer roles, enforced at the database level with RLS.

**Enhanced Observability**: Integrated Grafana dashboards for real-time monitoring of task throughput, agent status, and average task costs. Embedded panels in the Next.js UI for at-a-glance trend analysis.

**Professional Authentication**: Supabase Auth UI with email and GitHub OAuth authentication providers, automatic user onboarding with PostgreSQL triggers, and session management with proper timeouts and security settings.

## 🚀 Getting Started

### 1. Prerequisites

- Git, Node.js (v18+), pnpm
- Infrastructure: A running Kubernetes Cluster, a RabbitMQ instance, and a full Observability Stack (e.g., OpenTelemetry Collector, Grafana Tempo)
- Accounts: Cloudflare, Supabase, GitHub, OpenAI

### 2. Setup

**Clone & Install:**

```bash
git clone https://github.com/YOUR_USERNAME/devart.ai.git
cd devart.ai
pnpm install
```

**Supabase:**

1. Create a new project and run the entire `supabase/schema.sql` script
2. Enable the vector extension and enable Realtime for all tables
3. Configure authentication settings: enable GitHub OAuth provider and set up email templates
4. Set up Row Level Security (RLS) policies for role-based access control

**Environment Variables:**

1. Copy `.env.example` to `.env` in `apps/api` and `apps/ui`
2. Fill in all required keys:
   - `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` for backend API
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for frontend UI
   - `OTEL_EXPORTER_OTLP_ENDPOINT` for your OpenTelemetry Collector
   - `OPENAI_API_KEY` for AI services
   - `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` for notifications
   - `GITHUB_WEBHOOK_SECRET` for GitHub integration
   - `RABBITMQ_URL` and related RabbitMQ configuration
   - `KUBE_CONFIG_DATA` and related Kubernetes configuration

**GitHub App:**

1. Create a GitHub App with `pull_request:write`, `checks:write`, and `contents:read` permissions and install it on your target repository
2. Configure a webhook pointing to your deployed API
3. Set up webhook secret for security

**RabbitMQ Configuration:**

1. Enable the delayed message exchange plugin
2. Configure exchanges and queues for task distribution
3. Set up dead letter queues for failed messages

**Kubernetes Setup:**

1. Configure cluster access with appropriate service accounts
2. Set up resource limits and security contexts for sandboxes
3. Configure network policies for secure execution environments

**Grafana Setup:**

1. Deploy Grafana instance using Docker or Kubernetes
2. Configure Supabase as a PostgreSQL data source
3. Import dashboards using the provided setup scripts
4. Configure authentication and embedding settings

### 3. Running Locally

```bash
# From the project root
pnpm dev
```

- UI: http://localhost:3000
- API: http://localhost:8787

### 4. Testing

Run the comprehensive test suite to verify the implementation:

```bash
# Test authentication flow
node test-user-onboarding.js
node test-auth-flow.js
node test-protected-routes.js
node test-session-timeouts.js

# Test capability-aware dispatch
node test-capability-dispatch.js

# Test RabbitMQ functionality
node test-rabbitmq-delayed.ts
node test-agent-rabbitmq.py

# Test Kubernetes sandboxing
node test-kubernetes-sandbox.ts

# Test task retry mechanism
node test-task-failure-backoff.ts

# Test observability features
node test-grafana-embedding.js
node test-anomaly-detection.ts
node test-anomaly-detection-full.ts

# Test phase 10 features
node test-phase10-features.ts
```

## 🧠 System Concepts

**Meta-Agent**: The pinnacle of the platform's intelligence. It's a specialized agent that reads strategic documents (roadmaps, design docs) to understand the desired future state of the platform. It then autonomously creates and dispatches the engineering tasks required to build that future. Using LlamaIndex for document ingestion and Langroid for orchestration, the Meta-Agent can analyze complex roadmap documents and generate detailed development tasks.

**AI Architecture Refactoring**: The platform's most advanced capability. It treats the software it manages not as a black box, but as a dynamic entity that can be analyzed and improved. It uses AI to bridge the gap between operational performance and source code quality by identifying architectural smells and generating intelligent refactoring suggestions.

**Generative Remediation**: The pinnacle of the AIOps loop. When faced with an unknown issue, the platform leverages a large language model to generate a potential solution script. This script is sandboxed and presented to a human supervisor for approval, ensuring a safe and effective "human-in-the-loop" process for creative problem-solving.

**Automated Remediation**: Based on high-confidence Root Cause Analysis findings, the system can automatically execute predefined actions to resolve known issues without human intervention. Actions include service restarts, configuration rollbacks, and resource scaling.

**Root Cause Analysis (RCA)**: Beyond just detecting anomalies, the platform employs an analysis engine to correlate trace data with known patterns. It suggests a probable cause for any issue, dramatically reducing debugging time with confidence scoring from LOW to HIGH.

**Observability**: The platform is fully instrumented with OpenTelemetry, allowing you to trace a single user action from a click in the UI, through the API, onto the message queue, into an agent's sandbox, and back. Integrated Grafana dashboards provide real-time monitoring of key metrics.

**Capabilities**: Agents are defined by a set of skills (e.g., ["python", "react", "kubernetes"]) and tasks are defined by a set of requirements. The orchestrator uses PostgreSQL's JSONB containment operator to ensure perfect matches between agent capabilities and task requirements.

**Message-Driven Architecture**: The system uses a RabbitMQ message queue for tasking with delayed message exchange support. The API is a Producer, and specialized agents are Consumers that listen for jobs matching their capabilities.

**Self-Healing Agents**: Agents can automatically recover from transient errors through a built-in retry mechanism with exponential backoff. Failed tasks are re-queued with increasing delays, and agents can query a knowledge base for solutions before retrying.

**Workflow Engine**: Multi-stage, reusable workflows can be defined, managed, and triggered from the UI or via API. Tasks in a workflow are automatically chained together with parent-child relationships and inherit priority from their parent tasks.

## 🗺️ Future Roadmap

The platform is now a mature, end-to-end solution. Future work will focus on achieving full platform autonomy, enhancing the ecosystem, and achieving multi-tenancy.

### Advanced AI & ML

- **Autonomous Platform Evolution**: Develop a meta-agent that can analyze the platform's own roadmap, generate tasks for new features, and assign them to other agents, creating a fully self-evolving system
- **Predictive Remediation**: Implement a machine learning model that analyzes trace trends to predict and prevent anomalies before they occur
- **AI-driven Architecture Refactoring**: Enhance agents that can analyze codebases and performance data to suggest and implement architectural improvements
- **AI-driven Workflow Optimization**: Analyze historical workflow data to suggest more efficient processes

### Ecosystem & Extensibility

- Build the full-featured UI for the Agent & Workflow Marketplace, including publishing and versioning workflows
- Develop a visual, drag-and-drop Workflow Builder in the UI
- Create a comprehensive Agent SDK documentation and examples
- Implement versioning and dependency management for shared agents and workflows

### Platform & Multi-Tenancy

- Architect the platform to support multiple isolated organizations, enabling a potential SaaS offering
- Implement organization-level resource quotas and billing
- Add cross-organization collaboration features
- Develop tenant isolation mechanisms for data and resources

### Security & Compliance

- Implement advanced security scanning for generated remediation scripts
- Add compliance checking capabilities for various regulatory frameworks
- Enhance audit logging for all system activities
- Implement data encryption at rest and in transit

## 👨‍💻 Developer Experience

### Agent Development

devart.ai provides a comprehensive Python SDK and template repository for rapid GenAI agent development:

- **Agent SDK**: Core functionality for claiming tasks and updating status with proper error handling
- **Template Repository**: Complete example implementation with work loop pattern
- **RabbitMQ Integration**: Event-driven task consumption with graceful shutdown handling
- **Capability Management**: Automatic capability declaration and task matching
- **Sandbox Execution**: Secure, isolated execution environments with resource limits

### Development Tools

- **Comprehensive Testing Suite**: Unit tests, integration tests, and end-to-end tests for all components
- **Observability Integration**: Built-in OpenTelemetry instrumentation for tracing and monitoring
- **Documentation**: Complete API documentation and usage examples
- **Deployment Scripts**: Automated setup for Grafana dashboards and data sources

## ⚖️ License

This project is licensed under the MIT License. See the LICENSE file for details.