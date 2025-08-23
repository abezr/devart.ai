# devart.ai - The Autonomous DevOps Platform

**A scalable, enterprise-ready control plane for orchestrating, supervising, and analyzing a team of autonomous GenAI agents.**

devart.ai functions as a deeply integrated partner in the modern software development lifecycle, transforming AI from a simple tool into a collaborative team member that can build, test, review, and deploy code within a secure, high-performance, message-driven architecture.

## 🏛️ Architecture

The system is built on a high-performance, scalable, and resilient architecture designed for enterprise workloads. It uses a message-driven pattern to decouple components and a container orchestrator for secure, isolated agent execution.

``mermaid
graph TD
    subgraph "Users & DevOps"
        Supervisor[Supervisor / Tech Lead]
        Agent[GenAI Agent (Consumer)]
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

    Agent -- "Consumes Tasks" --> Queue
    Agent -- "Updates Status via API" --> API
    Agent -- "Executes in" --> K8s

## ✨ Core Features

### Scalability & Enterprise Infrastructure
- **Advanced Job Queue**: A high-throughput RabbitMQ message queue for task distribution, enabling delayed retries, dead-lettering, and a push-based architecture
- **Production Sandbox Orchestrator**: A robust Kubernetes integration for provisioning secure, isolated, and scalable execution environments for every agent task
- **Ecosystem Marketplace**: A foundational backend for a marketplace where users can publish, discover, and share reusable agents and workflows

### Advanced DevOps Integration
- **Interactive GitHub Integration**: Agents can post comments and pass/fail status checks directly to Pull Requests, acting as automated code reviewers
- **Workflow Engine**: Define, manage, and trigger multi-stage, reusable workflows (e.g., build -> test -> review) from the UI or via API

### Governance & Security
- **Role-Based Access Control (RBAC)**: Secure the platform with admin, supervisor, and viewer roles, enforced at the database level with RLS
- **Secure Agent Management**: Onboard agents with secure, hashed API keys and toggle their activation status from the UI

### Orchestration & Collaboration
- **Self-Healing Agents**: A built-in retry mechanism allows tasks to be automatically re-queued upon failure, enabling agents to recover from transient errors
- **Task Chaining**: Agents can create successor tasks, enabling complex, multi-step workflows

### Intelligence & Analytics
- **Knowledge Base**: A pgvector-powered knowledge base allows agents to perform semantic searches for contextual information
- **Performance Analytics**: A dedicated dashboard panel provides insights into task costs and workflow performance
- **Outlier Detection**: The system automatically flags tasks with unusually high costs for supervisor review

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
- Create a new project and run the entire supabase/schema.sql script
- Enable the vector extension and enable Realtime for all tables

**Environment Variables:**
- Copy .env.example to .env in apps/api and fill in all required keys from Supabase, OpenAI, GitHub, Kubernetes (a base64-encoded kubeconfig), and RabbitMQ (AMQP connection string)

**GitHub App:**
- Create a GitHub App with pull_request:write and checks:write permissions and install it on your target repository
- Configure a webhook pointing to your deployed API

### 3. Running Locally
```bash
# From the project root
pnpm dev
```
- UI: http://localhost:3000
- API: http://localhost:8787

## 🧠 System Concepts

### Message-Driven Architecture
The core of the system is a message queue. The API acts as a Producer, publishing tasks to the queue. Agents act as Consumers, listening for work. This decouples the components and allows for massive horizontal scaling.

### Workflows
Reusable, multi-stage templates for common CI/CD processes. Supervisors can trigger these with specific context, initiating a chain of tasks on the queue.

### Sandboxes
Ephemeral, isolated Kubernetes Pods or Jobs provisioned on-demand for agents to perform their work, ensuring a clean and secure execution environment.

### Agent SDK
A dedicated SDK (e.g., devart-agent-template) provides a simple interface for agents to connect to the message queue and interact with the platform's API.

## 🗺️ Future Roadmap

The platform is now a mature, end-to-end solution. Future work will focus on enhancing the user/developer experience, deepening AI capabilities, and growing the ecosystem.

### Ecosystem & User Experience
- Build the full-featured UI for the Agent & Workflow Marketplace
- Develop a visual, drag-and-drop Workflow Builder in the UI
- Create a dedicated Observability Dashboard for monitoring queue depth, agent throughput, and sandbox health

### Advanced AI & ML
- Implement the AI-driven Workflow Optimization engine that analyzes historical workflow_runs data to suggest more efficient processes
- Enhance the Self-Healing Agents by allowing them to query the knowledge base with their last_error to find potential solutions before retrying

### Platform & Extensibility
- Develop a formal Plugin Architecture for adding new tools and integrations
- Implement Multi-Tenancy to offer devart.ai as a SaaS product

## ⚖️ License

This project is licensed under the MIT License. See the LICENSE file for details.
