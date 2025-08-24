# devart.ai - The Autonomous DevOps Platform

devart.ai is a scalable, enterprise-ready, and self-expanding control plane for orchestrating, supervising, and analyzing a team of specialized GenAI agents. It functions as a deeply integrated partner in the modern software development lifecycle, capable of autonomously discovering, acquiring, and integrating new tools and services to continuously enhance its own capabilities.

## 🏛️ Architecture

The system is built on a high-performance, scalable, and resilient architecture. It uses a message-driven pattern for task distribution, a container orchestrator for secure execution, and a real-time database for state synchronization. A comprehensive AIOps stack with a proactive Root Cause Analysis, Generative Remediation, and a self-expanding Opportunity Pipeline provides deep, intelligent insight into every operation.

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
        OpportunityPipeline[Opportunity Pipeline (Multi-Agent System)]
    end
    
    subgraph "Observability Stack"
        Collector[OpenTelemetry Collector]
        Tempo[Grafana Tempo]
    end

    subgraph "External Systems & Infrastructure"
        GitHub[GitHub API & Webhooks]
        OpenAI[OpenAI LLM & Embedding API]
        K8s[Kubernetes Cluster]
        ExternalSources[News Feeds, Blogs, etc.]
    end

    Supervisor -- "Manages & Approves" --> UI
    UI -- "API Calls" --> API
    UI -- "Realtime Subscriptions" --> DB

    API -- "Publishes Tasks" --> Queue
    API -- "Manages State" --> DB
    API -- "Interacts with" --> GitHub

    Agent -- "Consumes Tasks" --> Queue
    Agent -- "Updates Status & Requests Actions" --> API
    Agent -- "Executes in" --> K8s
    
    ExternalSources -- "Scanned by" --> OpportunityPipeline
    OpportunityPipeline -- "Processes & Analyzes" --> OpenAI
    OpportunityPipeline -- "Stores Findings" --> DB
    OpportunityPipeline -- "Creates Integration Tasks via" --> API
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

### Autonomous Ecosystem Expansion

**Opportunity Discovery Pipeline**: A multi-agent system that autonomously scans external sources (news feeds, blogs) to discover new free-tier services, trials, and partnership opportunities.

**AI-Powered Analysis & Qualification**: The pipeline uses LLMs to parse, classify, and analyze discovered opportunities, extracting structured data on their potential value to the platform.

**Automated Outreach & Integration**: A specialized PartnershipAgent handles lead generation and service registration, with a human-in-the-loop approval workflow. Once a new tool is acquired, an IntegrationPlannerAgent automatically creates the engineering tasks required to integrate it.

### Generative AIOps & Autonomous Resilience

**Generative Remediation**: For novel anomalies, the system uses LLMs to generate new, context-aware remediation scripts, which are presented to a human supervisor for validation and approval.

**Root Cause Analysis (RCA) Engine**: Automatically analyzes detected anomalies, identifies likely root causes, assigns a confidence score, and provides actionable recommendations.

**Self-Healing Agents**: A built-in retry mechanism with exponential backoff allows tasks to be automatically re-queued upon failure, enabling agents to recover from transient errors.

### Intelligent Orchestration & Specialization

**Capability-Aware Dispatch**: The orchestration engine intelligently matches tasks to agents based on their declared skills (e.g., ["python", "selenium"]), ensuring the right agent is always on the right job.

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

## 🧠 System Concepts

**Opportunity Pipeline**: The platform's most proactive feature. It's a multi-agent assembly line that transforms unstructured information from the web into tangible, integrated capabilities for the platform, effectively allowing devart.ai to grow its own toolkit.

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