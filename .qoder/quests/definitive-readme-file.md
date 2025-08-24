# devart.ai - The Autonomous DevOps Platform

devart.ai is a scalable, enterprise-ready, and self-healing control plane for orchestrating, supervising, and analyzing a team of specialized GenAI agents. It functions as a deeply integrated partner in the modern software development lifecycle, proactively identifying, diagnosing, and automatically remediating operational issues while transforming AI into a collaborative team member that can intelligently build, test, review, and deploy code.

## 🏛️ Architecture

The system is built on a high-performance, scalable, and resilient architecture. It uses a message-driven pattern for task distribution, a container orchestrator for secure execution, and a real-time database for state synchronization. A comprehensive AIOps stack with a proactive Root Cause Analysis and Automated Remediation engine provides deep, intelligent insight into every operation.

```mermaid
graph TD
    subgraph "Users & DevOps"
        Supervisor[Supervisor / Tech Lead]
        Agent[Specialized GenAI Agent (Consumer)]
        DevOps[DevOps Toolchain (Producer)]
    end

    subgraph "devart.ai Platform"
        UI[Next.js on Cloudflare Pages]
        API[API Server (Producer)]
        DB[Supabase Postgres w/ pgvector & Realtime]
        Queue[RabbitMQ Message Queue]
        AnomalyDetection[Anomaly Detection Service]
        RCA_Engine[Root Cause Analysis Engine]
        Remediation_Engine[Automated Remediation Engine]
    end
    
    subgraph "Observability Stack"
        Collector[OpenTelemetry Collector]
        Tempo[Grafana Tempo]
    end

    subgraph "External Systems & Infrastructure"
        GitHub[GitHub API & Webhooks]
        OpenAI[OpenAI Embedding API]
        K8s[Kubernetes Cluster]
        Telegram[Telegram Bot API]
    end

    Supervisor -- "Manages & Monitors" --> UI
    UI -- "API Calls" --> API
    UI -- "Realtime Subscriptions" --> DB

    DevOps -- "Triggers Workflows via API" --> API
    API -- "Publishes Tasks" --> Queue
    API -- "Manages State" --> DB
    API -- "Interacts with" --> GitHub & OpenAI

    Agent -- "Consumes Tasks" --> Queue
    Agent -- "Updates Status via API" --> API
    Agent -- "Executes in" --> K8s
    
    UI & API & Agent -- "Exports Traces" --> Collector
    Collector -- "Stores Traces" --> Tempo
    
    Tempo -- "Provides Trace Data" --> AnomalyDetection
    AnomalyDetection -- "Writes Findings" --> DB
    DB -- "Triggers (New Anomaly)" --> RCA_Engine
    RCA_Engine -- "Analyzes Traces" --> Tempo
    RCA_Engine -- "Writes RCA Findings" --> DB
    DB -- "Triggers (High-Confidence RCA)" --> Remediation_Engine
    Remediation_Engine -- "Executes Actions" --> K8s & API
    Remediation_Engine -- "Sends Notifications" --> Telegram
```

## ✨ Core Features

### Autonomous Operations & AIOps

**Automated Remediation**: Based on high-confidence Root Cause Analysis findings, the system can automatically execute predefined actions—such as restarting a service, rolling back a configuration, or scaling resources—to resolve issues without human intervention.

**Root Cause Analysis (RCA) Engine**: Automatically analyzes detected anomalies, identifies likely root causes from multiple categories (e.g., Infrastructure, Application Code), assigns a confidence score, and provides actionable recommendations.

**Advanced Anomaly Detection**: The system analyzes trace data to detect performance regressions (latency, throughput) and security issues (error rate spikes) using statistical algorithms.

**Self-Healing Agents**: A built-in retry mechanism with exponential backoff allows tasks to be automatically re-queued upon failure, enabling agents to recover from transient errors.

**End-to-End Distributed Tracing**: Powered by OpenTelemetry, every request is traced across all system components, providing unparalleled visibility for debugging.

### Intelligent Orchestration & Specialization

**Capability-Aware Dispatch**: The orchestration engine intelligently matches tasks to agents based on their declared skills (e.g., ["python", "code-review"]), ensuring the right agent is always on the right job.

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
1. Copy `.env.example` to `.env` in `apps/api` and `apps.ui`
2. Fill in all required keys, including the `OTEL_EXPORTER_OTLP_ENDPOINT` for your OpenTelemetry Collector

**GitHub App:**
1. Create a GitHub App with `pull_request:write` and `checks:write` permissions and install it on your target repository
2. Configure a webhook pointing to your deployed API

### 3. Running Locally

```bash
# From the project root
pnpm dev
```

- UI: http://localhost:3000
- API: http://localhost:8787

## 🧠 System Concepts

**Automated Remediation**: The final step in the AIOps loop. The platform maintains a catalog of remediation_actions (e.g., "restart-service", "scale-deployment"). When the RCA engine produces a high-confidence finding, it can trigger the corresponding action automatically, closing the loop from detection to resolution.

**Root Cause Analysis (RCA)**: Beyond just detecting anomalies, the platform employs an analysis engine to correlate trace data with known patterns. It suggests a probable cause for any issue, dramatically reducing debugging time for human supervisors.

**Observability**: The platform is fully instrumented with OpenTelemetry, allowing you to trace a single user action from a click in the UI, through the API, onto the message queue, into an agent's sandbox, and back.

**Capabilities**: Agents are defined by a set of skills (e.g., ["python", "react"]) and tasks are defined by a set of requirements. The orchestrator ensures a perfect match.

**Message-Driven Architecture**: The system uses a message queue for tasking. The API is a Producer, and specialized agents are Consumers that listen for jobs matching their capabilities.

## 🗺️ Future Roadmap

The platform is now a mature, end-to-end solution. Future work will focus on deepening AI capabilities, enhancing the ecosystem, and achieving full multi-tenancy.

### Advanced AI & ML

- **Generative Remediation**: Develop agents that can, based on an RCA finding, generate a novel remediation script or configuration patch, rather than just executing a predefined one.
- **Predictive Maintenance**: Implement a machine learning model that analyzes trace trends to predict and prevent anomalies before they occur.
- **AI-driven Workflow Optimization**: Implement the AI-driven Workflow Optimization engine that analyzes historical workflow_runs data to suggest more efficient processes.

### Ecosystem & Extensibility

- **Agent & Workflow Marketplace**: Build the full-featured UI for the Agent & Workflow Marketplace, including publishing and versioning workflows.
- **Visual Workflow Builder**: Develop a drag-and-drop Workflow Builder in the UI.

### Platform & Multi-Tenancy

- **Multi-Organization Support**: Architect the platform to support multiple isolated organizations, enabling a potential SaaS offering.

## ⚖️ License

This project is licensed under the MIT License. See the LICENSE file for details.