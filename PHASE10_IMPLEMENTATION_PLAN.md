# Phase 10: Ecosystem and Enterprise Scalability - Implementation Plan

## Overview
This document outlines the implementation plan for Phase 10 of the devart.ai platform, focusing on re-architecting the foundational infrastructure for high performance and reliability while building ecosystem features that drive adoption and collaboration.

## Implementation Phases

### Phase 1: Marketplace - Backend and Schema Implementation

**Objective**: Create the foundational database schema and API endpoints for the Agent & Workflow Marketplace.

#### Tasks:
1. [ ] **Task 001**: Create marketplace_items table in supabase/schema.sql with required columns and constraints
   - Add table with columns: id, item_type, name, description, version, publisher_id, tags, repository_url, created_at
   - Add UNIQUE constraint on (name, version)
   - Add COMMENT for table documentation

2. [ ] **Task 002**: Add GET /api/marketplace endpoint to list/search marketplace items
   - Implement endpoint in apps/api/src/index.ts
   - Add filtering capabilities by tags, type, etc.

3. [ ] **Task 003**: Add POST /api/marketplace endpoint to publish new items with RBAC protection
   - Implement endpoint in apps/api/src/index.ts
   - Secure with RBAC (supervisor/admin role)
   - Associate published item with authenticated user's ID

4. [ ] **Task 004**: Implement validation logic for marketplace item publishing
   - Add validation for required fields
   - Prevent duplicate name/version combinations

### Phase 2: Agents - Error Handling and Retry Mechanism

**Objective**: Build the foundational mechanism for self-healing agents by enabling them to report failures and allowing the system to automatically retry tasks a configurable number of times.

#### Tasks:
5. [ ] **Task 005**: Modify tasks table in supabase/schema.sql to add retry_count, max_retries, and last_error columns
   - Add retry_count INT DEFAULT 0
   - Add max_retries INT DEFAULT 3
   - Add last_error TEXT
   - Add COMMENTs for column documentation

6. [ ] **Task 006**: Add POST /api/tasks/:taskId/report-failure endpoint for agents to report failures
   - Implement endpoint in apps/api/src/index.ts
   - Accept agentId and errorMessage in request body

7. [ ] **Task 007**: Implement endpoint logic to increment retry count and decide whether to re-queue or quarantine tasks
   - Fetch task to check current state and max_retries
   - Perform ownership check (agent can only report on assigned tasks)
   - If max retries exceeded, move task to QUARANTINED status
   - Otherwise, re-queue for another attempt

8. [ ] **Task 008**: Add logic to reset agent status to IDLE when a task fails
   - Reset the failing agent to IDLE so it can pick up new work
   - Unassign task (set agent_id to null) to allow different agents to attempt

### Phase 3: Workflows - Performance Data Collection

**Objective**: Lay the groundwork for AI-driven workflow optimization by creating the necessary data structures and logic to capture detailed performance metrics for every workflow execution.

#### Tasks:
9. [ ] **Task 009**: Create workflow_runs table in supabase/schema.sql with required columns and constraints
   - Add table with columns: id, workflow_id, status, trigger_context, start_time, end_time, total_cost
   - Add REFERENCES constraint to workflows table
   - Add ON DELETE CASCADE

10. [ ] **Task 010**: Add workflow_run_id column to tasks table in supabase/schema.sql
    - Add UUID column with REFERENCES constraint to workflow_runs table
    - Add ON DELETE SET NULL

11. [ ] **Task 011**: Modify /api/workflows/:workflowId/trigger endpoint to create workflow_runs records
    - Create new workflow_runs record when workflow is triggered
    - Associate the first task with the workflow run

12. [ ] **Task 012**: Enhance task completion logic to detect workflow completion
    - When a task that is part of a workflow is completed, check if it was the final task
    - Update parent workflow_runs record with final status when workflow completes

13. [ ] **Task 013**: Implement PostgreSQL function for atomic workflow completion detection
    - Create PostgreSQL function to handle workflow completion detection atomically
    - Update workflow_runs record with COMPLETED status, end_time, and aggregated total_cost

### Phase 4: Infrastructure - Production Sandbox Orchestrator

**Objective**: Replace the conceptual sandbox provisioning logic with a production-grade integration to a real container orchestrator (Kubernetes).

#### Tasks:
14. [ ] **Task 014**: Install Kubernetes client library (@kubernetes/client-node) in apps/api
    - Run `pnpm add @kubernetes/client-node` in apps/api directory

15. [ ] **Task 015**: Add Kubernetes-related secrets to apps/api/.env.example
    - Add KUBE_CONFIG_DATA (base64 encoded)
    - Add K8S_NAMESPACE
    - Add AGENT_CONTAINER_IMAGE

16. [ ] **Task 016**: Create kubernetes.ts service module in apps/api/src/services/
    - Create new file with Kubernetes client configuration
    - Implement functions for sandbox provisioning and termination

17. [ ] **Task 017**: Implement provisionSandbox function to create Kubernetes resources
    - Create Kubernetes resources (Pods/Jobs) for task execution
    - Return containerId and connectionDetails

18. [ ] **Task 018**: Implement terminateSandbox function to clean up Kubernetes resources
    - Clean up all resources associated with a completed task
    - Delete Kubernetes Pods/Jobs

19. [ ] **Task 019**: Replace placeholder logic in /api/agents/:agentId/request-sandbox endpoint
    - Replace with calls to the new Kubernetes service
    - Return actual container details

20. [ ] **Task 020**: Replace placeholder logic in /api/sandboxes/:sandboxId endpoint
    - Replace with calls to the new Kubernetes service
    - Implement actual sandbox management

### Phase 5: Infrastructure - Advanced Job Queue

**Objective**: Re-architect the task distribution system by replacing the database polling mechanism with a dedicated, high-throughput message queue (RabbitMQ).

#### Tasks:
21. [ ] **Task 021**: Set up RabbitMQ instance and configure access
    - Deploy RabbitMQ instance
    - Configure authentication and access controls

22. [ ] **Task 022**: Install RabbitMQ client library (amqplib) in apps/api
    - Run `pnpm add amqplib` in apps/api directory

23. [ ] **Task 023**: Modify POST /api/tasks endpoint to publish messages to RabbitMQ queue
    - In addition to database write, publish message with taskId to tasks.todo queue
    - Implement connection management to RabbitMQ

24. [ ] **Task 024**: Modify POST /api/tasks/:taskId/report-failure endpoint to republish tasks to queue with delay
    - Publish task back to queue with delay using RabbitMQ's delayed message exchange
    - If retries are exhausted, publish to dead-letter queue

25. [ ] **Task 025**: Remove deprecated POST /api/agents/:agentId/claim-task endpoint
    - Delete endpoint from apps/api/src/index.ts

26. [ ] **Task 026**: Update Agent SDK to replace claim_task method with start_consuming(callback)
    - Replace claim_task() method with start_consuming(callback) in devart-agent-template/sdk/agent_sdk.py
    - Update documentation and examples

27. [ ] **Task 027**: Implement persistent connection to RabbitMQ in Agent SDK
    - Establish persistent connection to RabbitMQ in Agent SDK
    - Handle connection failures and reconnections

28. [ ] **Task 028**: Implement message listening logic on tasks.todo queue in Agent SDK
    - Listen for messages on tasks.todo queue
    - Invoke callback with task details when messages received

## Dependencies and Implementation Order

1. **Phase 1** (Marketplace): Independent
2. **Phase 2** (Error Handling): Independent
3. **Phase 3** (Workflow Performance): Requires existing workflow tables
4. **Phase 4** (Sandbox Orchestration): Requires Kubernetes cluster access
5. **Phase 5** (Job Queue): Requires RabbitMQ instance; affects all task-related endpoints

## Testing Strategy

1. **Unit Tests**: Validate database schema changes and business logic
2. **Integration Tests**: Verify API endpoint functionality
3. **End-to-End Tests**: Test complete workflow scenarios
4. **Load Testing**: Validate performance improvements with high task volumes
5. **Security Testing**: Verify RBAC enforcement and authentication

## Rollout Plan

1. **Phase 1**: Implement marketplace backend (Tasks 1-4)
2. **Phase 2**: Add error handling and retry mechanisms (Tasks 5-8)
3. **Phase 3**: Implement workflow performance data collection (Tasks 9-13)
4. **Phase 4**: Deploy production sandbox orchestrator (Tasks 14-20)
5. **Phase 5**: Migrate to advanced job queue architecture (Tasks 21-28)