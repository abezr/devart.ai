# Intelligent Agent Dispatch & Specialization Layer

## Overview

The Intelligent Agent Dispatch & Specialization Layer transforms the orchestration engine from a simple FIFO queue manager into a smart, capability-aware router that matches the right agent to the right job. This enhancement addresses the inefficiency of the previous system where specialized agents could be assigned to tasks they weren't suited for, while more appropriate agents remained idle.

## Key Components

### 1. Capability Management System

The system introduces formal definitions of agent capabilities and task requirements:

- **Agent Capabilities**: Each agent can declare its skills as a set of tags (e.g., `["python", "code-review", "testing"]`)
- **Task Requirements**: Each task can specify required capabilities as a set of tags (e.g., `["python", "code-review"]`)

### 2. Database Schema Changes

#### Tasks Table Enhancement

The `tasks` table now includes a new column:

```sql
ALTER TABLE tasks
  ADD COLUMN required_capabilities JSONB;

COMMENT ON COLUMN tasks.required_capabilities IS 'A JSON array of strings representing skills needed for this task, e.g., ''["python", "code-review"]''.';

-- Create a GIN index for efficient searching of capabilities.
CREATE INDEX idx_tasks_required_capabilities ON tasks USING GIN (required_capabilities);
```

#### Agents Table (Existing)

The `agents` table already had a capabilities field:

```sql
-- Existing column in agents table
capabilities JSONB -- e.g., '["python", "react", "code-review"]'
```

### 3. API Endpoints

#### PUT /api/tasks/:taskId/capabilities

This endpoint allows supervisors to add or update skill requirements for a specific task after it has been created.

**Request:**
```
PUT /api/tasks/{taskId}/capabilities
Content-Type: application/json

{
  "capabilities": ["python", "code-review"]
}
```

**Response:**
```
{
  "id": "task-uuid",
  "title": "Code Review Task",
  "description": "Review the latest code changes",
  "status": "TODO",
  "priority": "HIGH",
  "agent_id": null,
  "required_capabilities": ["python", "code-review"],
  "created_at": "2023-05-15T10:30:00Z",
  "updated_at": "2023-05-15T11:45:00Z"
}
```

#### Enhanced Task Claiming Endpoint

The existing task claiming logic has been updated to use capability-aware matching:

**Request:**
```
POST /api/agents/{agentId}/claim-task
Content-Type: application/json

{
  "agentId": "agent-uuid",
  "apiKey": "agent-api-key"
}
```

**Response:**
```
{
  "id": "task-uuid",
  "title": "Specialized Task",
  "description": "Task requiring specific skills",
  "status": "IN_PROGRESS",
  "priority": "HIGH",
  "agent_id": "agent-uuid",
  "required_capabilities": ["python", "testing"],
  "created_at": "2023-05-15T10:30:00Z",
  "updated_at": "2023-05-15T11:45:00Z"
}
```

### 4. PostgreSQL Functions

#### claim_next_task_by_capability

This function replaces the existing `claim_next_task` function with a capability-aware version:

```sql
CREATE OR REPLACE FUNCTION claim_next_task_by_capability(requesting_agent_id UUID)
RETURNS tasks AS $$
DECLARE
  claimed_task tasks;
  agent_capabilities JSONB;
BEGIN
  -- 1. Get the capabilities of the requesting agent.
  SELECT capabilities INTO agent_capabilities FROM agents WHERE id = requesting_agent_id;

  -- 2. Find and claim the highest-priority task that the agent is qualified for.
  UPDATE tasks
  SET
    status = 'IN_PROGRESS',
    agent_id = requesting_agent_id
  WHERE id = (
    SELECT id FROM tasks
    WHERE
      status = 'TODO'
      -- The core matching logic: task requirements are a subset of agent capabilities.
      AND (required_capabilities IS NULL OR required_capabilities <@ agent_capabilities)
    ORDER BY priority, created_at
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING * INTO claimed_task;

  -- 3. Update the agent's status to BUSY if a task was claimed.
  IF claimed_task IS NOT NULL THEN
    UPDATE agents SET status = 'BUSY', last_seen = NOW() WHERE id = requesting_agent_id;
  END IF;

  RETURN claimed_task;
END;
$$ LANGUAGE plpgsql;
```

## Business Logic

### Capability Matching Algorithm

The core of the intelligent dispatch system is the capability matching algorithm that uses PostgreSQL's JSONB containment operator (`<@`):

1. When an agent requests a task, the system retrieves the agent's capabilities
2. It then searches for tasks where:
   - The task status is 'TODO'
   - Either the task has no required capabilities (NULL) or all required capabilities are contained within the agent's capabilities
3. Tasks are ordered by priority and creation time
4. The highest priority task is claimed using PostgreSQL's `FOR UPDATE SKIP LOCKED` to prevent race conditions

### Backward Compatibility

The system maintains backward compatibility by:
- Allowing tasks with NULL required_capabilities to be claimed by any agent
- Preserving existing API endpoints while enhancing their functionality
- Maintaining the same data structures with additive changes only

## UI Components

### AgentMonitoringPanel Enhancement

The agent monitoring panel displays each agent's capabilities as a list of tags, giving supervisors an at-a-glance view of the workforce's skills.

### CreateTaskForm Enhancement

The task creation form includes a new input field (e.g., a tag input or a multi-select dropdown) that allows supervisors to specify required_capabilities when creating new tasks.

### TaskDetailModal Enhancement

When viewing the details of a task, the modal displays its required_capabilities. If the user has the supervisor role, this field is editable, calling the PUT /api/tasks/:taskId/capabilities endpoint on change.

## Security Considerations

1. **RBAC Enforcement**: The new PUT /api/tasks/:taskId/capabilities endpoint is secured by existing RBAC policies to ensure only authorized users can modify task requirements
2. **Input Validation**: All API endpoints validate that capabilities are provided as arrays of strings
3. **Agent Authentication**: Existing agent API key verification mechanisms are preserved

## Performance Considerations

1. **Indexing**: The GIN index on the required_capabilities column ensures efficient querying
2. **Containment Operator**: The PostgreSQL JSONB `<@` operator is highly efficient, especially with the GIN index
3. **Atomic Operations**: Task claiming uses PostgreSQL's `FOR UPDATE SKIP LOCKED` to prevent race conditions without blocking

## Testing Strategy

### Unit Tests

1. Test capability matching logic with various combinations of agent capabilities and task requirements
2. Verify that agents can only claim tasks for which they have all required skills
3. Test backward compatibility with tasks that have NULL required_capabilities
4. Validate input validation for the PUT /api/tasks/:taskId/capabilities endpoint

### Integration Tests

1. End-to-end test of task creation with capabilities and agent claiming
2. Test supervisor UI for managing task requirements
3. Verify real-time updates in the agent monitoring panel
4. Test RBAC enforcement for the new API endpoint

### Performance Tests

1. Load testing with high volumes of tasks and agents
2. Benchmark query performance with the GIN index
3. Test race condition handling under concurrent load