# Collaborative Agent Platform Design

## Overview

This design document outlines the evolution of the existing AI development platform from a collection of individual workers into a truly Collaborative and Proactive Development Team. The platform currently provides intelligent task management, budget supervision, and analytics capabilities. This enhancement introduces three core collaborative features: task chaining for multi-step workflows, proactive code review through GitHub integration, and performance outlier detection for continuous improvement.

**Repository Type**: Full-Stack Application with AI Agent Orchestration

## Technology Stack & Dependencies

- **Backend**: Hono 4.4.0 on Cloudflare Workers
- **Frontend**: Next.js 14.2.3 with React and Tailwind CSS
- **Database**: Supabase PostgreSQL with pgvector extension
- **Real-time**: Supabase Realtime for live UI updates
- **Monorepo Management**: pnpm workspaces
- **External Integrations**: GitHub Webhooks, Telegram notifications

## Architecture

The collaborative platform architecture extends the existing three-layer system with workflow orchestration capabilities:

```mermaid
graph TB
    subgraph "Collaborative Layer"
        TC[Task Chaining Engine]
        GW[GitHub Webhook Handler]
        PD[Performance Detection]
    end
    
    subgraph "Intelligence Layer"
        VS[Vector Search]
        EM[Embedding Service]
        KB[Knowledge Base]
    end
    
    subgraph "Supervision Layer"
        BS[Budget Supervisor]
        HS[Human Loop Supervisor]
        AL[Audit Logging]
    end
    
    subgraph "Core Platform"
        OE[Orchestration Engine]
        RT[Real-time System]
        DB[(PostgreSQL)]
    end
    
    subgraph "External Systems"
        GH[GitHub Repository]
        TG[Telegram Bot]
    end
    
    TC --> OE
    GW --> OE
    PD --> DB
    
    GH --> GW
    BS --> TG
    
    OE --> RT
    RT --> DB
    
    VS --> KB
    EM --> KB
```

## Database Schema Extensions

### Task Chaining Schema

```mermaid
erDiagram
    tasks {
        uuid id PK
        text title
        text description
        text status
        text priority
        uuid agent_id FK
        uuid parent_task_id FK
        boolean review_flag
        timestamptz created_at
        timestamptz updated_at
    }
    
    tasks ||--o{ tasks : "parent-child"
```

**Schema Modifications**:

1. **Parent-Child Relationship**:
   - `parent_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL`
   - Enables task chaining with inheritance of priority and context
   - Indexed for efficient workflow traversal

2. **Performance Monitoring**:
   - `review_flag BOOLEAN DEFAULT FALSE`
   - Marks tasks requiring supervisor attention
   - Automated flagging based on cost outliers

### Analytics Enhancement

```mermaid
erDiagram
    task_cost_summary {
        uuid task_id PK
        text task_title
        text task_status
        text task_priority
        integer usage_count
        numeric total_cost
        timestamptz task_created_at
    }
    
    service_usage_log {
        uuid id PK
        uuid task_id FK
        text service_id FK
        numeric charge_amount
        timestamptz created_at
    }
    
    task_cost_summary ||--|| service_usage_log : "aggregates"
```

## API Architecture

### Task Chaining Endpoints

```mermaid
sequenceDiagram
    participant Agent
    participant API
    participant DB
    participant NextAgent
    
    Agent->>API: POST /api/tasks/:taskId/create-successor
    Note over Agent,API: {title, description}
    
    API->>DB: SELECT priority FROM tasks WHERE id = :taskId
    DB-->>API: Parent task data
    
    API->>DB: INSERT successor task with parent_task_id
    DB-->>API: New task created
    
    API-->>Agent: 201 Created with task details
    
    NextAgent->>API: POST /api/agents/:id/claim-task
    API->>DB: RPC claim_next_task()
    DB-->>API: Returns chained task
    API-->>NextAgent: Task with parent context
```

**Endpoint Specification**:
- **Method**: POST `/api/tasks/:taskId/create-successor`
- **Input**: `{title: string, description?: string}`
- **Output**: Created task with inherited priority and parent relationship
- **Security**: Validates parent task existence before creation

### GitHub Integration Endpoints

```mermaid
sequenceDiagram
    participant GitHub
    participant Webhook
    participant API
    participant DB
    participant Agent
    
    GitHub->>Webhook: pull_request.opened event
    Webhook->>API: POST /api/webhooks/github
    Note over Webhook,API: HMAC SHA-256 signature verification
    
    API->>API: Verify GitHub signature
    API->>DB: INSERT code review task (CRITICAL priority)
    DB-->>API: Task created
    
    API-->>Webhook: 202 Accepted
    
    Agent->>API: Claim next task
    API->>DB: RPC claim_next_task()
    DB-->>Agent: Code review task with PR details
```

**Security Implementation**:
- HMAC SHA-256 signature verification using Web Crypto API
- Environment variable for webhook secret management
- Request validation and sanitization

## Business Logic Layer

### Task Chaining Workflow

```mermaid
flowchart TD
    A[Agent Completes Task] --> B{Create Successor?}
    B -->|Yes| C[Call create-successor API]
    B -->|No| D[Mark Task as DONE]
    
    C --> E[Inherit Parent Properties]
    E --> F[Set parent_task_id Reference]
    F --> G[Enqueue Successor Task]
    G --> H[Next Agent Claims Task]
    
    H --> I[Access Parent Context]
    I --> J[Execute with Chain Awareness]
    
    D --> K[Update Agent Status to IDLE]
    J --> L{Chain Continues?}
    L -->|Yes| A
    L -->|No| K
```

**Inheritance Rules**:
- Priority level inherited from parent task
- Task chain metadata preserved for context
- Atomic successor creation with rollback protection

### Proactive Code Review Logic

```mermaid
flowchart TD
    A[PR Opened in GitHub] --> B[Webhook Received]
    B --> C[Verify Signature]
    C --> D{Valid Request?}
    D -->|No| E[Return 401 Unauthorized]
    D -->|Yes| F[Parse PR Payload]
    
    F --> G[Extract PR Details]
    G --> H[Create CRITICAL Task]
    H --> I[Set Review Context]
    I --> J[Enqueue for Agent]
    
    J --> K[Agent Claims Review Task]
    K --> L[Access PR via API]
    L --> M[Perform Code Analysis]
    M --> N[Generate Review Comments]
```

**Task Creation Pattern**:
- **Priority**: CRITICAL (highest urgency)
- **Title**: "Code Review: {PR Title}"
- **Description**: PR URL, diff URL, and context
- **Immediate availability**: Ready for agent claiming

### Performance Outlier Detection

```mermaid
flowchart TD
    A[Scheduled Execution] --> B[Calculate Cost Statistics]
    B --> C[Determine Threshold]
    C --> D[Identify Outlier Tasks]
    D --> E[Flag for Review]
    E --> F[Update UI Indicators]
    
    subgraph "Statistical Analysis"
        G[Average Cost Calculation]
        H[Standard Deviation]
        I[Threshold = μ + 2σ]
    end
    
    B --> G
    G --> H
    H --> I
    I --> C
```

**Statistical Method**:
- Uses task_cost_summary view for aggregated data
- Threshold: Average + 2 Standard Deviations
- Automated flagging with manual review workflow

## User Interface Architecture

### Task Board Enhancement

```mermaid
graph TD
    subgraph "TaskBoard Component"
        A[Task List Rendering]
        B[Real-time Subscriptions]
        C[Visual Indicators]
    end
    
    subgraph "Task Item States"
        D[Normal Task]
        E[Chained Task]
        F[Flagged Task]
        G[Review Task]
    end
    
    A --> D
    A --> E
    A --> F
    A --> G
    
    B --> H[Supabase Channel]
    H --> I[Live UI Updates]
    
    C --> J[Chain Icons]
    C --> K[Alert Indicators]
    C --> L[Priority Badges]
```

**Visual Design Patterns**:
- **Flagged Tasks**: Red ring border with warning icon
- **Chain Tasks**: Link icons showing parent-child relationship
- **Code Reviews**: GitHub icon with CRITICAL badge
- **Real-time Updates**: Smooth transitions for status changes

### Component State Management

```mermaid
stateDiagram-v2
    [*] --> Loading
    Loading --> Loaded
    Loaded --> Subscribing
    Subscribing --> Active
    
    Active --> Updating : Real-time Event
    Updating --> Active : UI Refresh
    
    Active --> Flagging : Outlier Detected
    Flagging --> Active : Review Acknowledged
    
    Active --> Chaining : Successor Created
    Chaining --> Active : Chain Updated
```

## Data Flow Architecture

### Multi-Agent Collaboration Flow

```mermaid
sequenceDiagram
    participant UI as User Interface
    participant Agent1 as Agent 1
    participant API as API Server
    participant DB as Database
    participant Agent2 as Agent 2
    
    UI->>API: Create initial task
    API->>DB: INSERT task
    
    Agent1->>API: Claim task
    API->>DB: claim_next_task()
    DB-->>Agent1: Task assigned
    
    Agent1->>Agent1: Process task
    Agent1->>API: Create successor
    API->>DB: INSERT with parent_task_id
    
    Agent1->>API: Complete original task
    API->>DB: UPDATE status = 'DONE'
    
    Agent2->>API: Claim next task
    API->>DB: claim_next_task()
    DB-->>Agent2: Successor task with parent context
    
    Agent2->>Agent2: Continue workflow
```

### GitHub Integration Data Flow

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant GH as GitHub
    participant API as Webhook API
    participant DB as Database
    participant Agent as Code Review Agent
    participant UI as Dashboard
    
    Dev->>GH: Create Pull Request
    GH->>API: webhook: pull_request.opened
    
    API->>API: Verify HMAC signature
    API->>DB: CREATE code review task
    
    DB-->>UI: Real-time notification
    UI->>UI: Display new review task
    
    Agent->>API: Claim review task
    API->>DB: Assign task to agent
    
    Agent->>GH: Fetch PR details
    Agent->>Agent: Perform review
    Agent->>API: Complete review task
```

## Testing Strategy

### Unit Testing Approach

```mermaid
graph TD
    subgraph "Backend Tests"
        A[API Endpoint Tests]
        B[Database Function Tests]
        C[Integration Tests]
    end
    
    subgraph "Frontend Tests"
        D[Component Tests]
        E[Hook Tests]
        F[Real-time Tests]
    end
    
    subgraph "End-to-End Tests"
        G[Task Chaining Flow]
        H[GitHub Webhook Flow]
        I[Performance Detection Flow]
    end
    
    A --> G
    B --> G
    D --> G
    
    C --> H
    E --> H
    
    B --> I
    F --> I
```

**Test Coverage Requirements**:
- API endpoints: Input validation, error handling, response formats
- Database functions: Atomic operations, race condition prevention
- Real-time features: WebSocket connections, state synchronization
- UI components: Visual indicators, user interactions, accessibility

### Integration Testing Patterns

**Task Chaining Tests**:
- Verify parent-child relationship creation
- Test priority inheritance
- Validate atomic successor creation

**GitHub Webhook Tests**:
- Mock webhook payloads
- Test signature verification
- Validate task creation from PR events

**Performance Detection Tests**:
- Statistical calculation accuracy
- Threshold determination logic
- UI flag synchronization**Statistical Method**:
- Uses task_cost_summary view for aggregated data
- Threshold: Average + 2 Standard Deviations
- Automated flagging with manual review workflow

## User Interface Architecture

### Task Board Enhancement

```mermaid
graph TD
    subgraph "TaskBoard Component"
        A[Task List Rendering]
        B[Real-time Subscriptions]
        C[Visual Indicators]
    end
    
    subgraph "Task Item States"
        D[Normal Task]
        E[Chained Task]
        F[Flagged Task]
        G[Review Task]
    end
    
    A --> D
    A --> E
    A --> F
    A --> G
    
    B --> H[Supabase Channel]
    H --> I[Live UI Updates]
    
    C --> J[Chain Icons]
    C --> K[Alert Indicators]
    C --> L[Priority Badges]
```

**Visual Design Patterns**:
- **Flagged Tasks**: Red ring border with warning icon
- **Chain Tasks**: Link icons showing parent-child relationship
- **Code Reviews**: GitHub icon with CRITICAL badge
- **Real-time Updates**: Smooth transitions for status changes

### Component State Management

```mermaid
stateDiagram-v2
    [*] --> Loading
    Loading --> Loaded
    Loaded --> Subscribing
    Subscribing --> Active
    
    Active --> Updating : Real-time Event
    Updating --> Active : UI Refresh
    
    Active --> Flagging : Outlier Detected
    Flagging --> Active : Review Acknowledged
    
    Active --> Chaining : Successor Created
    Chaining --> Active : Chain Updated
```

## Data Flow Architecture

### Multi-Agent Collaboration Flow

```mermaid
sequenceDiagram
    participant UI as User Interface
    participant Agent1 as Agent 1
    participant API as API Server
    participant DB as Database
    participant Agent2 as Agent 2
    
    UI->>API: Create initial task
    API->>DB: INSERT task
    
    Agent1->>API: Claim task
    API->>DB: claim_next_task()
    DB-->>Agent1: Task assigned
    
    Agent1->>Agent1: Process task
    Agent1->>API: Create successor
    API->>DB: INSERT with parent_task_id
    
    Agent1->>API: Complete original task
    API->>DB: UPDATE status = 'DONE'
    
    Agent2->>API: Claim next task
    API->>DB: claim_next_task()
    DB-->>Agent2: Successor task with parent context
    
    Agent2->>Agent2: Continue workflow
```

### GitHub Integration Data Flow

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant GH as GitHub
    participant API as Webhook API
    participant DB as Database
    participant Agent as Code Review Agent
    participant UI as Dashboard
    
    Dev->>GH: Create Pull Request
    GH->>API: webhook: pull_request.opened
    
    API->>API: Verify HMAC signature
    API->>DB: CREATE code review task
    
    DB-->>UI: Real-time notification
    UI->>UI: Display new review task
    
    Agent->>API: Claim review task
    API->>DB: Assign task to agent
    
    Agent->>GH: Fetch PR details
    Agent->>Agent: Perform review
    Agent->>API: Complete review task
```

## Testing Strategy

### Unit Testing Approach

```mermaid
graph TD
    subgraph "Backend Tests"
        A[API Endpoint Tests]
        B[Database Function Tests]
        C[Integration Tests]
    end
    
    subgraph "Frontend Tests"
        D[Component Tests]
        E[Hook Tests]
        F[Real-time Tests]
    end
    
    subgraph "End-to-End Tests"
        G[Task Chaining Flow]
        H[GitHub Webhook Flow]
        I[Performance Detection Flow]
    end
    
    A --> G
    B --> G
    D --> G
    
    C --> H
    E --> H
    
    B --> I
    F --> I
```

**Test Coverage Requirements**:
- API endpoints: Input validation, error handling, response formats
- Database functions: Atomic operations, race condition prevention
- Real-time features: WebSocket connections, state synchronization
- UI components: Visual indicators, user interactions, accessibility

### Integration Testing Patterns

**Task Chaining Tests**:
- Verify parent-child relationship creation
- Test priority inheritance
- Validate atomic successor creation

**GitHub Webhook Tests**:
- Mock webhook payloads
- Test signature verification
- Validate task creation from PR events

**Performance Detection Tests**:
- Statistical calculation accuracy
- Threshold determination logic
- UI flag synchronization





























































































































































































































































































































































































































































