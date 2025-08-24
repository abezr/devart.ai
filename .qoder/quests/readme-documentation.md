# devart.ai - The Autonomous DevOps Platform

devart.ai is a scalable, enterprise-ready, and self-directing control plane for orchestrating, supervising, and analyzing a team of specialized GenAI agents. It functions as a deeply integrated partner in the modern software development lifecycle, capable of analyzing its own strategic roadmap to autonomously generate, assign, and execute tasks for its own evolution.

## 🏛️ Architecture

The system is built on a high-performance, scalable, and resilient architecture. It uses a message-driven pattern for task distribution, a container orchestrator for secure execution, and a real-time database for state synchronization. A comprehensive AIOps stack with a proactive Root Cause Analysis, Generative Remediation, and a self-directing Meta-Agent provides deep, intelligent insight into every operation.

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

### Intelligent Orchestration & Specialization

**Capability-Aware Dispatch**: The orchestration engine intelligently matches tasks to agents based on their declared skills (e.g., ["python", "kubernetes"]), ensuring the right agent is always on the right job.

**Workflow Engine**: Define, manage, and trigger multi-stage, reusable workflows (e.g., build -> test -> review) from the UI or via API.

### Advanced DevOps Integration

**Interactive GitHub Integration**: Agents can post comments and pass/fail status checks directly to Pull Requests, acting as automated code reviewers.

**Production Sandbox Orchestrator**: A robust Kubernetes integration for provisioning secure, isolated, and scalable execution environments for every agent task.

### Scalability & Governance

**Advanced Job Queue**: A high-throughput RabbitMQ message queue for task distribution, enabling delayed retries, dead-lettering, and a push-based architecture.

**Role-Based Access Control (RBAC)**: Secure the platform with admin, supervisor, and viewer roles, enforced at the database level with RLS.

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

**Environment Variables:**

1. Copy `.env.example` to `.env` in `apps/api` and `apps/ui`
2. Fill in all required keys, including the `OTEL_EXPORTER_OTLP_ENDPOINT` for your OpenTelemetry Collector

**GitHub App:**

1. Create a GitHub App with `pull_request:write`, `checks:write`, and `contents:read` permissions and install it on your target repository
2. Configure a webhook pointing to your deployed API

### 3. Running Locally

```bash
# From the project root
pnpm dev
```

- UI: http://localhost:3000
- API: http://localhost:8787

## 🧠 System Concepts

**Meta-Agent**: The pinnacle of the platform's intelligence. It's a specialized agent that reads strategic documents (roadmaps, design docs) to understand the desired future state of the platform. It then autonomously creates and dispatches the engineering tasks required to build that future.

**AI Architecture Refactoring**: The platform's most advanced capability. It treats the software it manages not as a black box, but as a dynamic entity that can be analyzed and improved. It uses AI to bridge the gap between operational performance and source code quality.

**Generative Remediation**: The pinnacle of the AIOps loop. When faced with an unknown issue, the platform leverages a large language model to generate a potential solution script. This script is sandboxed and presented to a human supervisor for approval.

**Observability**: The platform is fully instrumented with OpenTelemetry, allowing you to trace a single user action from a click in the UI, through the API, onto the message queue, into an agent's sandbox, and back.

**Capabilities**: Agents are defined by a set of skills (e.g., ["python", "react"]) and tasks are defined by a set of requirements. The orchestrator ensures a perfect match.

**Message-Driven Architecture**: The system uses a message queue for tasking. The API is a Producer, and specialized agents are Consumers that listen for jobs matching their capabilities.

## 🗺️ Future Roadmap

The platform is now a mature, end-to-end solution. Future work will focus on achieving full platform autonomy, enhancing the ecosystem, and achieving multi-tenancy.

### Advanced AI & ML

- **Autonomous Platform Evolution**: Develop a meta-agent that can analyze the platform's own roadmap, generate tasks for new features, and assign them to other agents, creating a fully self-evolving system
- **Predictive Remediation**: Implement a machine learning model that analyzes trace trends to predict and prevent anomalies before they occur

### Ecosystem & Extensibility

- Build the full-featured UI for the Agent & Workflow Marketplace, including publishing and versioning workflows
- Develop a visual, drag-and-drop Workflow Builder in the UI

### Platform & Multi-Tenancy

- Architect the platform to support multiple isolated organizations, enabling a potential SaaS offering

## ⚖️ License

This project is licensed under the MIT License. See the LICENSE file for details.
