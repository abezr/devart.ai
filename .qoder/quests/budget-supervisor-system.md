# Budget Supervisor System Design

## Overview

The Budget Supervisor System is a core component of the devart.ai platform that provides real-time budget monitoring, service gating, and automatic fallback mechanisms for AI services. The system ensures cost control by tracking service usage against allocated budgets and automatically switching to fallback services when budgets are exceeded.

This design implements a full-stack solution with:
- **Backend**: Hono-based API with atomic budget checking and charging
- **Database**: PostgreSQL functions for transaction-safe operations
- **Frontend**: Real-time React dashboard with Supabase subscriptions
- **Architecture**: Event-driven with automatic service substitution

## Technology Stack & Dependencies

### Backend Stack
- **Framework**: Hono 4.4.0 on Cloudflare Workers
- **Database**: Supabase PostgreSQL with real-time capabilities
- **Language**: TypeScript with strict type safety
- **Deployment**: Cloudflare Workers runtime

### Frontend Stack
- **Framework**: Next.js 14.2.3 with App Router
- **Styling**: Tailwind CSS
- **State Management**: React hooks with Supabase real-time subscriptions
- **Language**: TypeScript with React components

### Database Schema
```mermaid
erDiagram
    service_registry {
        TEXT id PK
        TEXT display_name
        TEXT api_endpoint
        NUMERIC monthly_budget_usd
        NUMERIC current_usage_usd
        TEXT status
        TEXT substitutor_service_id FK
        TIMESTAMPTZ created_at
    }
    
    tasks {
        UUID id PK
        TEXT title
        TEXT description
        TEXT status
        TEXT priority
        TEXT agent_id
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }
    
    subscriptions {
        UUID id PK
        TEXT telegram_chat_id
        TEXT event_type
        TIMESTAMPTZ created_at
    }
    
    service_registry ||--o{ service_registry : substitutor_service_id
```

## Architecture

### System Architecture Overview
```mermaid
graph TB
    UI[Next.js UI Dashboard] --> API[Hono API on Cloudflare Workers]
    API --> DB[(Supabase PostgreSQL)]
    API --> Budget[Budget Supervisor Service]
    Budget --> DB
    DB --> RT[Real-time Subscriptions]
    RT --> UI
    
    subgraph "Budget Control Flow"
        Budget --> Check[Check Budget]
        Check --> Charge[Atomic Charge]
        Charge --> Switch[Service Switching]
    end
    
    subgraph "Real-time Updates"
        DB --> Stream[PostgreSQL Changes]
        Stream --> UI
    end
```

### Component Architecture

#### Backend Components
```mermaid
graph LR
    subgraph "API Layer"
        Router[Hono Router]
        Middleware[CORS Middleware]
    end
    
    subgraph "Service Layer"
        Budget[Budget Supervisor]
        Client[Supabase Client Factory]
    end
    
    subgraph "Data Layer"
        Types[Shared Types]
        RPC[PostgreSQL Functions]
    end
    
    Router --> Budget
    Budget --> Client
    Client --> Types
    Budget --> RPC
```

#### Frontend Components
```mermaid
graph TD
    Page[HomePage Server Component] --> Board[TaskBoard Client Component]
    Page --> Static[Service Status Static]
    Board --> Hooks[React Hooks]
    Hooks --> Supabase[Supabase Client]
    Supabase --> RT[Real-time Channel]
```

## API Endpoints Reference

### Task Dispatch Endpoint

**POST** `/api/tasks/dispatch`

#### Request Schema
```typescript
{
  serviceId: string;    // e.g., 'premium_llm'
  cost: number;         // USD amount to charge
}
```

#### Response Schema

**Success (200)**
```typescript
{
  message: string;
  serviceUsed: string;
  wasDelegated: boolean;
}
```

**Budget Exceeded (402)**
```typescript
{
  error: string;
  status: 'SUSPENDED';
}
```

**Server Error (500)**
```typescript
{
  error: string;
}
```

#### Authentication Requirements
- Requires `SUPABASE_SERVICE_KEY` in environment
- Uses service role for administrative budget operations

### Tasks Endpoint

**GET** `/api/tasks`

Returns array of task objects for dashboard display.

## Data Models & Database Schema

### Service Registry Model
```typescript
interface Service {
  id: string;                          // Unique service identifier
  display_name: string;                // Human-readable name
  api_endpoint: string;                // Service API URL
  monthly_budget_usd: number;          // Monthly budget limit
  current_usage_usd: number;           // Current month usage
  status: 'ACTIVE' | 'SUSPENDED';     // Service status
  substitutor_service_id: string | null; // Fallback service
  created_at: string;                  // ISO timestamp
}
```

### Task Model
```typescript
interface Task {
  id: string;                          // UUID
  title: string;                       // Task title
  description: string | null;          // Optional description
  status: TaskStatus;                  // Current status
  priority: TaskPriority;              // Task priority
  agent_id: string | null;             // Assigned agent
  created_at: string;                  // ISO timestamp
  updated_at: string;                  // ISO timestamp
}

type TaskStatus = 
  | 'TODO' 
  | 'IN_PROGRESS' 
  | 'DONE' 
  | 'QUARANTINED' 
  | 'PENDING_BUDGET_APPROVAL';

type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
```

## Business Logic Layer

### Budget Supervisor Core Logic

#### Budget Checking Flow
```mermaid
sequenceDiagram
    participant Client
    participant API
    participant Budget
    participant DB
    
    Client->>API: POST /api/tasks/dispatch
    API->>Budget: checkAndChargeService(serviceId, cost)
    Budget->>DB: CALL charge_service(serviceId, cost)
    
    alt Budget Available
        DB-->>Budget: Return updated service
        Budget-->>API: { serviceToUse: service, error: null }
        API-->>Client: 200 Success
    else Budget Exceeded + Substitutor Available
        DB-->>Budget: Return substitutor service
        Budget-->>API: { serviceToUse: substitutor, error: null }
        API-->>Client: 200 Success (wasDelegated: true)
    else Budget Exceeded + No Substitutor
        DB-->>Budget: Return null
        Budget-->>API: { serviceToUse: null, error: message }
        API-->>Client: 402 Payment Required
    end
```

#### Atomic Transaction Logic

The system uses PostgreSQL stored procedures to ensure atomicity:

```sql
CREATE OR REPLACE FUNCTION charge_service(
  service_id_to_charge TEXT, 
  charge_amount NUMERIC
) RETURNS service_registry AS $$
DECLARE
  service RECORD;
  substitutor_service RECORD;
BEGIN
  -- Lock row for transaction
  SELECT * INTO service 
  FROM service_registry 
  WHERE id = service_id_to_charge 
  FOR UPDATE;

  -- Check budget and handle suspension
  IF service.current_usage_usd + charge_amount > service.monthly_budget_usd THEN
    -- Update status to suspended
    UPDATE service_registry 
    SET status = 'SUSPENDED' 
    WHERE id = service_id_to_charge;
    
    -- Return substitutor if available
    IF service.substitutor_service_id IS NOT NULL THEN
      SELECT * INTO substitutor_service 
      FROM service_registry 
      WHERE id = service.substitutor_service_id;
      RETURN substitutor_service;
    ELSE
      RETURN NULL;
    END IF;
  ELSE
    -- Charge the service
    UPDATE service_registry
    SET current_usage_usd = service.current_usage_usd + charge_amount
    WHERE id = service_id_to_charge;
    
    SELECT * INTO service 
    FROM service_registry 
    WHERE id = service_id_to_charge;
    RETURN service;
  END IF;
END;
$$ LANGUAGE plpgsql;
```

### Service Substitution Logic

```mermaid
flowchart TD
    Start[Service Request] --> Check{Budget Available?}
    Check -->|Yes| Charge[Charge Service]
    Check -->|No| Suspend[Mark as Suspended]
    Suspend --> HasSub{Has Substitutor?}
    HasSub -->|Yes| UseSub[Use Substitutor Service]
    HasSub -->|No| Reject[Reject Request - 402]
    Charge --> Success[Return Original Service]
    UseSub --> Success2[Return Substitutor Service]
```

## Real-time UI Architecture

### Component Hierarchy
```mermaid
graph TD
    HomePage[HomePage - Server Component] --> TaskBoard[TaskBoard - Client Component]
    HomePage --> ServiceStatus[ServiceStatus - Static]
    
    TaskBoard --> State[useState - tasks]
    TaskBoard --> Effect[useEffect - subscription]
    TaskBoard --> Channel[Supabase Channel]
    
    Channel --> Listen[postgres_changes listener]
    Listen --> Refetch[Refetch all tasks]
    Refetch --> Update[Update state]
```

### Real-time Data Flow

```mermaid
sequenceDiagram
    participant DB as PostgreSQL
    participant RT as Supabase Realtime
    participant UI as TaskBoard Component
    participant User as Browser
    
    Note over DB,User: Initial Load
    UI->>DB: Fetch initial tasks (SSR)
    DB-->>UI: Return task list
    UI->>User: Render with initial data
    
    Note over DB,User: Real-time Updates
    UI->>RT: Subscribe to 'tasks' table changes
    DB->>RT: Task status changed
    RT->>UI: Emit postgres_changes event
    UI->>DB: Refetch all tasks
    DB-->>UI: Return updated task list
    UI->>User: Re-render with new data
```

### State Management Strategy

#### Client-Side State
- **Initial Data**: Server-side rendered for SEO and performance
- **Real-time Updates**: Client-side subscription with automatic refetch
- **State Synchronization**: Simple refetch strategy for data consistency

#### Subscription Management
```typescript
useEffect(() => {
  const channel = supabase
    .channel('realtime-tasks')
    .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'tasks' },
        (payload) => {
          // Refetch all tasks on any change
          fetchTasks();
        })
    .subscribe();

  return () => supabase.removeChannel(channel);
}, []);
```

## Implementation Architecture

### File Structure
```
apps/
├── api/src/
│   ├── lib/
│   │   ├── types.ts           # Shared TypeScript interfaces
│   │   └── supabase.ts        # Supabase client factory
│   ├── services/
│   │   └── budget.ts          # Budget supervisor logic
│   └── index.ts               # Hono app with routes
└── ui/src/
    ├── lib/
    │   └── supabase.ts        # Browser Supabase client
    ├── components/
    │   └── TaskBoard.tsx      # Real-time task board
    └── app/
        └── page.tsx           # Main dashboard page
```

### Dependency Injection Pattern

#### API Layer
```typescript
// Supabase client creation per request (serverless pattern)
export const createSupabaseClient = (env: Env): SupabaseClient => {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
};

// Usage in route handlers
app.post('/api/tasks/dispatch', async (c) => {
  const supabase = createSupabaseClient(c.env);
  const result = await checkAndChargeService(supabase, serviceId, cost);
});
```

#### UI Layer
```typescript
// Singleton client for browser environment
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

### Error Handling Strategy

#### API Error Responses
- **400**: Invalid request parameters
- **402**: Budget exceeded (Payment Required)
- **500**: Database or system errors

#### Frontend Error Handling
- **Connection Issues**: Automatic retry with exponential backoff
- **Real-time Failures**: Graceful degradation to polling
- **Data Inconsistency**: Refetch strategy ensures consistency

## Testing Strategy

### Backend Testing
- **Unit Tests**: Budget calculation logic
- **Integration Tests**: Database transaction behavior
- **API Tests**: Endpoint contracts and error cases

### Frontend Testing
- **Component Tests**: TaskBoard rendering and state updates
- **Real-time Tests**: Subscription behavior and cleanup
- **E2E Tests**: Complete budget flow from UI to database

### Test Data Setup
```sql
-- Test services with different budget scenarios
INSERT INTO service_registry VALUES
('test_premium', 'Test Premium', 'https://api.test.com', 10.00, 8.00, 'ACTIVE', 'test_free'),
('test_free', 'Test Free', 'https://free.test.com', 0.00, 0.00, 'ACTIVE', NULL),
('test_suspended', 'Test Suspended', 'https://suspended.test.com', 5.00, 5.00, 'SUSPENDED', NULL);
```