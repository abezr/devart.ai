# devart.ai - Master Implementation Plan

## Project Objective
To build a scalable, enterprise-ready control plane for orchestrating autonomous GenAI agents, as per the established architectural design.

## Methodology
The implementation follows structured workflows outlined below. Each section represents a major component of the platform and should be developed in the specified order to manage dependencies.

## 1. Infrastructure Setup

### 1.1 Supabase Project
- Provision a new Supabase project
- Configure authentication settings (GitHub OAuth provider, email templates)
- Enable required extensions (pgvector for semantic search)
- Set up Row Level Security (RLS) policies

### 1.2 Database Schema
- Execute the complete `supabase/schema.sql` script to create:
  - All tables (service_registry, agents, tasks, etc.)
  - Views (task_cost_summary)
  - Functions (charge_service, claim_next_task, match_knowledge)
  - RLS policies
  - Initial data for demonstration
- Enable Realtime on relevant tables (tasks, service_registry, agents)

### 1.3 Cloudflare Account
- Set up Cloudflare account with Workers and Pages
- Configure domain and SSL certificates
- Set up CI/CD integration with GitHub

### 1.4 Kubernetes Cluster
- Provision a managed Kubernetes cluster (e.g., GKE, EKS, AKS)
- Configure kubectl access with proper credentials
- Set up namespaces for devart.ai components

### 1.5 RabbitMQ Instance
- Deploy a managed RabbitMQ cluster (e.g., CloudAMQP) or self-host
- Configure authentication and access controls
- Set up exchanges and queues for task distribution

### 1.6 GitHub App
- Create and configure the GitHub App with required permissions
- Set up webhooks for pull request events
- Configure webhook secret for security

### 1.7 Environment Configuration
- Populate all .env files with credentials from the services above:
  - API (.env): SUPABASE_URL, SUPABASE_SERVICE_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, OPENAI_API_KEY, GITHUB_WEBHOOK_SECRET, RABBITMQ_URL
  - UI (.env.local): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY

## 2. Budget Supervision Workflow

### 2.1 Backend Implementation
- Implement `charge_service` PostgreSQL function for atomic transactions with JSON return type
- Implement POST `/api/tasks/dispatch` endpoint to gate service usage with service delegation tracking
- Implement POST `/api/services/:id/increase-budget` endpoint with automatic service reactivation
- Implement GET `/api/services/status` endpoint for monitoring
- Enhance PostgreSQL function to return suspension status for notification triggers

### 2.2 Frontend Implementation
- Implement `ServiceStatusPanel` component with real-time updates via Supabase subscriptions
- Implement UI controls for budget increase approvals with user prompt dialogs
- Add visual indicators for suspended services (red borders, progress bars)
- Implement server-side rendering for initial data fetching

### 2.3 Integration
- Implement `sendTelegramMessage` service for budget alerts with Markdown formatting
- Integrate alert triggers into the `charge_service` workflow
- Test budget exceeded scenarios with fallback services
- Implement fire-and-forget notification pattern for Telegram messages

## 3. Task Orchestration Workflow

### 3.1 Backend Implementation
- Implement POST `/api/tasks` endpoint to publish new tasks to RabbitMQ with priority ordering
- Implement POST `/api/tasks/:taskId/report-failure` to handle retries via delayed queues and dead-lettering
- Implement PUT `/api/tasks/:taskId/status` for agents to report completion with ownership verification
- Implement task chaining with parent_task_id relationships and priority inheritance
- Implement `claim_next_task` PostgreSQL function with atomic task claiming using FOR UPDATE SKIP LOCKED
- Add retry mechanism with retry_count, max_retries, and last_error columns in tasks table

### 3.2 Agent SDK Implementation
- Implement `start_consuming` method to listen to the RabbitMQ queue
- Implement SDK methods for `report-failure` and `update-status`
- Replace deprecated claim_task method with RabbitMQ-based approach
- Add connection management for persistent RabbitMQ connections
- Implement message listening logic on tasks.todo queue
- Add delay handling for retry scenarios

### 3.3 Workflow Engine Implementation
- Implement workflows table for tracking predefined, reusable workflows
- Implement task_templates table for workflow task definitions
- Create GET /api/workflows endpoint for listing workflows
- Implement POST /api/workflows endpoint for creating new workflows
- Implement GET /api/workflows/:workflowId/templates for retrieving task templates
- Create POST /api/workflows/:workflowId/trigger endpoint for executing workflows
- Implement template rendering with variable substitution
- Add workflow_runs table for tracking workflow executions
- Implement workflow completion detection with check_workflow_completion function

## 4. Human-in-the-Loop Approval Workflow

### 4.1 Backend Security Implementation
- Implement `user_roles` table with app_role ENUM ('admin', 'supervisor', 'viewer')
- Implement `get_my_role` function with SECURITY DEFINER for elevated permissions
- Apply RLS policies to all sensitive tables (tasks, service_registry, system_settings)
- Implement JWT-based authentication for protected endpoints

### 4.2 Backend API Implementation
- Implement CRUD endpoints for tasks (POST, PUT, DELETE `/api/tasks`) with proper HTTP status codes
- Ensure all management endpoints are implicitly protected by the RLS policies
- Add validation for enum fields (priority, status) and input parameters
- Implement GET `/api/tasks` endpoint for task listing
- Implement GET `/api/services` endpoint for service listing

### 4.3 Frontend Implementation
- Implement `CreateTaskForm` component with validation for title and priority
- Implement UI controls for editing and deleting tasks on the `TaskBoard`
- Add role-based access controls for supervisor functions
- Implement real-time updates for task modifications

## 5. Agent Management

### 5.1 Backend Implementation
- Implement agents table with capabilities, status, and API key management
- Create POST `/api/agents/register` endpoint for secure agent registration
- Implement PUT `/api/agents/heartbeat` endpoint for agent health monitoring
- Add PUT `/api/agents/:agentId/activation` endpoint for agent activation/deactivation
- Implement agent_sandboxes table for tracking isolated execution environments
- Create POST `/api/agents/:agentId/request-sandbox` endpoint for sandbox provisioning
- Implement DELETE `/api/sandboxes/:sandboxId` endpoint for sandbox termination

### 5.2 Frontend Implementation
- Implement AgentRegistrationPanel component for supervisor agent management
- Add AgentMonitoringPanel component for real-time agent status monitoring
- Create UI controls for agent activation/deactivation
- Implement sandbox request and termination interfaces

## 6. GitHub Integration Workflow

### 5.1 Backend Implementation
- Implement POST `/api/webhooks/github` endpoint with secure signature verification using HMAC SHA-256
- Implement logic to parse pull_request events and create Code Review tasks with CRITICAL priority
- Implement POST `/api/integrations/github/pr-feedback` endpoint for posting comments and status checks
- Implement `github.ts` service module with Octokit for authenticated API calls
- Add webhook security with environment variable-based secret verification

### 5.2 Integration Testing
- Test webhook delivery and signature verification
- Verify task creation from PR events
- Test PR feedback posting functionality
- Validate error handling for GitHub API failures

## 7. Intelligence and Analytics Layer

### 6.1 Backend Implementation
- Implement `knowledge_base` table with 1536-dimension vector embeddings for OpenAI's text-embedding-ada-002
- Implement `match_knowledge` search function with cosine similarity scoring
- Implement POST `/api/knowledge` endpoint with OpenAI embedding generation
- Implement `task_cost_summary` database view with aggregated cost analysis
- Implement GET `/api/analytics/task-costs` and `/api/analytics/service-usage` endpoints
- Implement POST `/api/knowledge/search` endpoint for semantic search
- Implement `flag_costly_tasks` function for performance outlier detection

### 6.2 Frontend Implementation
- Implement `TaskAnalyticsPanel` component with dual-tab interface (Tasks and Services)
- Implement UI for submitting new documents to the knowledge base
- Add Grafana dashboard embedding with `GrafanaPanel` component
- Implement real-time data fetching with loading states and error handling

## 8. Real-time Monitoring Workflow

### 7.1 Database Configuration
- Verify Realtime is enabled on all relevant tables (tasks, agents, service_registry)
- Test real-time subscriptions for data changes
- Configure REPLICA IDENTITY FULL for all realtime tables

### 7.2 Frontend Implementation
- Implement `TaskBoard` component with real-time subscriptions and connection status indicators
- Implement `AgentMonitoringPanel` component with real-time subscriptions
- Implement `ServiceStatusPanel` component with real-time subscriptions
- Add visual indicators for special tasks (chained tasks, flagged tasks)
- Implement task detail modal for comprehensive task information

## 9. Security and Authentication

### 8.1 Backend Implementation
- Implement `handle_new_user` PostgreSQL trigger for automatic role assignment
- Implement POST `/api/agents/register` endpoint with secure API key hashing using SHA-256
- Implement PUT `/api/agents/heartbeat` endpoint with API key authentication
- Implement PUT `/api/agents/:agentId/activation` endpoint for agent management
- Modify agent-facing endpoints to require API key authentication
- Add input validation and sanitization for all endpoints

### 8.2 Frontend Implementation
- Implement `/login` page using Supabase Auth UI with GitHub OAuth support
- Implement route protection for the main dashboard
- Add session timeout handling and security settings
- Implement protected route access and redirect behavior

## 10. System Configuration Management

### 9.1 Backend Implementation
- Implement system_settings table with key-value store for configurable parameters
- Create GET /api/settings/:key endpoint for retrieving specific settings
- Implement PUT /api/settings/:key endpoint for updating settings
- Add GET /api/settings endpoint for retrieving all settings
- Implement flag_costly_tasks function for automatic performance outlier detection
- Add outlier_detection_stddev setting with default value of 2.0 standard deviations

### 9.2 Frontend Implementation
- Implement SettingsPanel component for viewing and modifying system settings
- Add UI controls for updating outlier detection threshold
- Implement real-time updates for system configuration changes

## 11. DevOps and Deployment

### 9.1 API Deployment
- Configure `wrangler.toml` for Cloudflare Workers deployment
- Ensure all secrets are set in Cloudflare Workers environment using `wrangler secret put`
- Set up CI/CD pipeline for automated deployments
- Configure CORS settings for UI integration

### 9.2 UI Deployment
- Configure Cloudflare Pages for Git-based deployments from the main branch
- Set up environment variables in Cloudflare Pages dashboard
- Configure custom domain and SSL certificates
- Optimize build settings for Next.js application

### 9.3 Agent Template
- Publish the `devart-agent-template` repository to GitHub as a template repository
- Document usage and configuration options in README.md
- Create example agents for different use cases
- Configure requirements.txt with all dependencies
- Implement AgentSDK class with start_consuming and update_task_status methods
- Add heartbeat mechanism for agent health monitoring

### 9.4 Grafana Integration
- Deploy Grafana instance using Docker (grafana/grafana-oss image)
- Configure the PostgreSQL data source to connect to Supabase
- Create initial dashboards with key metrics:
  - Task Throughput panel using time_bucket SQL query
  - Agent Status panel using pie chart SQL query
  - Average Task Cost panel using stat panel SQL query
- Configure embedding settings for iframe integration
- Implement GrafanaPanel component for embedding panels in the Next.js UI
- Add setup-grafana-datasource.js and setup-grafana-dashboards.js scripts for automated setup

## 12. Marketplace Implementation

### 10.1 Backend Implementation
- Implement marketplace_items table with item metadata (name, version, tags, repository_url)
- Create GET /api/marketplace endpoint for listing/searching items
- Implement POST /api/marketplace endpoint for publishing new items with RBAC protection
- Add validation logic for marketplace item publishing to prevent duplicate name/version combinations
- Associate published item with authenticated user's ID

### 10.2 Frontend Implementation
- Implement marketplace browsing UI for discovering shared agents and workflows
- Add publishing interface for supervisors to share their agents and workflows
- Implement search and filtering capabilities by tags and item type

## 13. Testing and Quality Assurance

### 11.1 Unit Tests
- Write unit tests for critical business logic:
  - Budget calculations in `charge_service` function
  - Signature verification for GitHub webhooks
  - Task claiming and status update logic
  - Semantic search functionality
  - Agent registration and authentication
  - Kubernetes sandbox provisioning and termination
  - RabbitMQ task publishing and consumption

### 11.2 Integration Tests
- Test the full workflow from a GitHub PR creating a task
- Test agent claiming and processing tasks via RabbitMQ
- Test agent posting feedback to GitHub
- Test budget supervision with service suspension and fallback
- Test task chaining and workflow execution
- Test agent sandboxing with Kubernetes integration
- Test marketplace item publishing and discovery

### 11.3 End-to-End Tests
- Simulate a user logging in and creating a task
- Verify task appears in real-time on the TaskBoard
- Simulate an agent claiming and completing the task
- Verify task status updates in real-time
- Test supervisor functions (budget increase, agent management)
- Test workflow execution with multiple chained tasks
- Test performance outlier detection and flagging

### 11.4 Performance Tests
- Load test the API endpoints under high concurrency
- Test the RabbitMQ queue performance with high task volumes
- Measure latency for task claiming and status updates
- Test database query performance with large datasets
- Validate real-time subscription performance
- Test Kubernetes sandbox provisioning performance
- Benchmark semantic search response times

### 11.5 Security Audit
- Perform a security review of all endpoints
- Verify RLS policies are correctly implemented
- Test authentication mechanisms and API key security
- Review Telegram notification security implementation
- Validate GitHub webhook signature verification
- Test agent API key verification and authorization
- Verify marketplace item publishing RBAC controls

## Dependencies and Implementation Order

1. **Phase 1** (Infrastructure): Independent setup of all infrastructure components
2. **Phase 2** (Budget Supervision): Depends on Supabase database and Cloudflare deployment
3. **Phase 3** (Task Orchestration): Depends on RabbitMQ setup and database schema
4. **Phase 4** (Human-in-the-Loop): Can be implemented in parallel with Phases 2-3
5. **Phase 5** (Agent Management): Depends on authentication and agent registration implementation
6. **Phase 6** (GitHub Integration): Depends on webhook configuration and API endpoints
7. **Phase 7** (Intelligence Layer): Depends on OpenAI API key and pgvector extension
8. **Phase 8** (Monitoring): Depends on real-time configuration
9. **Phase 9** (Security): Can be implemented in parallel with other phases
10. **Phase 10** (System Configuration): Can be implemented in parallel with other phases
11. **Phase 11** (DevOps): Deployment configuration can happen throughout development
12. **Phase 12** (Marketplace): Depends on authentication and RBAC implementation
13. **Phase 13** (Testing): Testing should happen continuously throughout implementation

### Critical Path
- Database schema implementation
- Core API endpoints (tasks, services, agents)
- Real-time functionality
- Authentication system
- Task orchestration with RabbitMQ
- Kubernetes sandboxing integration

## Key Implementation Patterns

### Database Design
- Use PostgreSQL stored functions with FOR UPDATE row locking for atomic financial operations
- Implement workflow completion detection using PostgreSQL stored functions
- Use database views to encapsulate complex queries and aggregations
- Apply ALTER TABLE statements after table definition for foreign key constraints

### API Design
- Implement CRUD operations with proper input validation
- Use appropriate HTTP methods (POST, PUT, DELETE) and status codes (201, 400, 404)
- Validate enum fields against predefined constants
- Implement fire-and-forget operation pattern for non-critical operations like audit logging

### Security
- Implement GitHub webhook security using HMAC SHA-256 signature verification
- Use Supabase Auth UI with automatic user onboarding via PostgreSQL triggers
- Store API keys as secure SHA-256 hashes only
- Implement role-based access control with Row Level Security

### Workflow Management
- Implement workflow management with standard CRUD endpoints
- Use a templating system for workflow tasks with title_template and description_template fields
- Automatically create successor tasks from workflow templates with variable substitution

### Task Management
- Implement priority-based task selection with numeric mapping (CRITICAL=1, HIGH=2, MEDIUM=3, LOW=4)
- Add parent-child relationships between tasks with ON DELETE SET NULL constraint
- Implement performance outlier detection using statistical methods (average + 2 standard deviations)

### Agent Integration
- Implement agent self-registration with capabilities and heartbeat mechanism
- Use dedicated service modules for external integrations with centralized error handling
- Implement visual indicators in the UI for special task states (chained tasks, flagged tasks)
- Implement agent sandboxing with Kubernetes for isolated execution environments
- Add retry mechanism with exponential backoff for failed tasks

### Analytics
- Implement analytics features using PostgreSQL views for complex aggregations
- Use vector database capabilities with pgvector for semantic search
- Create dedicated SDKs and template repositories for developer experience
- Implement performance outlier detection using statistical methods (average + 2 standard deviations)
- Add INDEX on knowledge_base embedding column for vector similarity search performance

### Marketplace
- Implement marketplace with versioned items for agents and workflows
- Add tagging system for easy discovery and categorization
- Implement RBAC controls for publishing permissions

### Performance Optimization
- Implement database indexing strategies for frequently queried tables
- Optimize RabbitMQ queue configuration for high-throughput task distribution
- Use connection pooling for database and external service connections
- Implement caching strategies for frequently accessed data
- Optimize real-time subscription performance with proper REPLICA IDENTITY settings
- Use lazy loading and pagination for large dataset queries

## Conclusion

This master implementation plan provides the development team with a clear, sequential, and comprehensive guide to building the devart.ai platform. By following this plan, the team will deliver a product that meets all strategic objectives while maintaining code quality, security, and scalability.