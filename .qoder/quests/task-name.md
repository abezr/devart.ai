# devart.ai - The Autonomous DevOps Platform

**A scalable, enterprise-ready control plane for orchestrating, supervising, and analyzing a team of specialized GenAI agents. It functions as a deeply integrated partner in the modern software development lifecycle, transforming AI from a simple tool into a collaborative team member that can build, test, review, and deploy code within a secure, high-performance, and intuitive environment.**

## 🏛️ Architecture

The system is built on a high-performance, scalable, and resilient architecture. It uses a message-driven pattern for task distribution, a container orchestrator for secure execution, and a real-time database for state synchronization and live UI updates.

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
    end

    subgraph "External Systems & Infrastructure"
        GitHub[GitHub API & Webhooks]
        OpenAI[OpenAI Embedding API]
        K8s[Kubernetes Cluster]
    end

    Supervisor -- "Manages & Monitors" --> UI
    UI -- "API Calls" --> API
    UI -- "Realtime Subscriptions" --> DB

    DevOps -- "Triggers Workflows via API" --> API
    API -- "Publishes Tasks" --> Queue
    API -- "Manages State" --> DB
    API -- "Manages Sandboxes" --> K8s
    API -- "Interacts with" --> GitHub & OpenAI

    Agent -- "Consumes Tasks by Capability" --> Queue
    Agent -- "Updates Status via API" --> API
    Agent -- "Executes in" --> K8s
```

## ✨ Core Features

### Intelligent Orchestration & Specialization

**Capability-Aware Dispatch**: The orchestration engine intelligently matches tasks to agents based on their declared skills (e.g., `["python", "code-review"]`), ensuring the right agent is always on the right job.

**Self-Healing Agents**: A built-in retry mechanism allows tasks to be automatically re-queued upon failure, enabling agents to recover from transient errors and query a knowledge base for solutions.

**Workflow Engine**: Define, manage, and trigger multi-stage, reusable workflows (e.g., build → test → review) from the UI or via API.

### Supervisor Experience & Intelligibility

**Visual Workflow Monitor**: An interactive graph that visualizes task chains and dependencies, providing at-a-glance understanding of complex workflows.

**Centralized Activity Feed**: A real-time, streaming log of all significant system events, from task creation to agent status changes and budget alerts.

**Agent & Workflow Marketplace**: A browsable, searchable marketplace for discovering, sharing, and reusing pre-built agents and automation workflows.

### Advanced DevOps Integration

**Interactive GitHub Integration**: Agents can post comments and pass/fail status checks directly to Pull Requests, acting as automated code reviewers.

**Production Sandbox Orchestrator**: A robust Kubernetes integration for provisioning secure, isolated, and scalable execution environments for every agent task.

### Scalability & Enterprise Infrastructure

**Advanced Job Queue**: A high-throughput RabbitMQ message queue for task distribution, enabling delayed retries, dead-lettering, and a push-based architecture.

**Role-Based Access Control (RBAC)**: Secure the platform with admin, supervisor, and viewer roles, enforced at the database level with RLS.

**Secure Agent Management**: Onboard agents with secure, hashed API keys and toggle their activation status from the UI.

### Intelligence & Analytics

**Knowledge Base**: A pgvector-powered knowledge base allows agents to perform semantic searches for contextual information.

**Performance Analytics**: A dedicated dashboard panel provides insights into task costs and workflow performance.

**Outlier Detection**: The system automatically flags tasks with unusually high costs for supervisor review.

## 🚀 Getting Started

### 1. Prerequisites

- Git, Node.js (v18+), pnpm
- Infrastructure: A running Kubernetes Cluster, a RabbitMQ instance
- Accounts: Cloudflare, Supabase, GitHub, OpenAI

### 2. Setup

**Clone & Install:**
```bash
git clone https://github.com/YOUR_USERNAME/devart.ai.git
cd devart.ai
pnpm install
```

**Supabase:**
- Create a new project and run the entire [supabase/schema.sql](supabase/schema.sql) script
- Enable the vector extension and enable Realtime for all tables

**Environment Variables:**
- Copy [.env.example](apps/api/.env.example) to `.env` in [apps/api](apps/api) and fill in all required keys from Supabase, OpenAI, GitHub, Kubernetes (a base64-encoded kubeconfig), and RabbitMQ (AMQP connection string)

**GitHub App:**
- Create a GitHub App with `pull_request:write` and `checks:write` permissions and install it on your target repository
- Configure a webhook pointing to your deployed API

### 3. Running Locally

```bash
# From the project root
pnpm dev
```
- UI: http://localhost:3000
- API: http://localhost:8787

## 🧠 System Concepts

### Capabilities

A core concept where agents are defined by a set of skills (e.g., `["python", "react"]`) and tasks are defined by a set of requirements. The orchestrator ensures a perfect match.

### Message-Driven Architecture

The system uses a message queue for tasking. The API is a Producer, and specialized agents are Consumers that listen for jobs matching their capabilities.

### Workflows

Reusable, multi-stage templates for common CI/CD processes. Supervisors can trigger these with specific context, initiating a chain of tasks on the queue.

### Sandboxes

Ephemeral, isolated Kubernetes Pods or Jobs provisioned on-demand for agents to perform their work, ensuring a clean and secure execution environment.

### Agent SDK

A dedicated SDK (e.g., [devart-agent-template](devart-agent-template)) provides a simple interface for agents to connect to the message queue and interact with the platform's API.

## 🗺️ Future Roadmap

The platform is now a mature, end-to-end solution. Future work will focus on deepening AI capabilities, enhancing the ecosystem, and achieving full multi-tenancy.

### Advanced AI & ML

- Implement the AI-driven Workflow Optimization engine that analyzes historical workflow_runs data to suggest more efficient processes
- Create a "meta-agent" that can autonomously manage the agent workforce, scaling it up or down based on queue depth and task requirements

### Ecosystem & Extensibility

- Build the full-featured UI for the Agent & Workflow Marketplace, including publishing and versioning workflows
- Develop a visual, drag-and-drop Workflow Builder in the UI
- Create a formal Plugin Architecture for adding new tools and integrations

### Platform & Multi-Tenancy

- Architect the platform to support multiple isolated organizations, enabling a potential SaaS offering
- Implement comprehensive, distributed tracing (OpenTelemetry) across all services for enterprise-grade observability

## ⚖️ License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.