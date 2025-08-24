-- =====================================================
-- Enterprise Governance Layer - Role-Based Access Control (RBAC)
-- =====================================================

-- Application Role Enumeration
-- Defines the three access levels for the platform.
CREATE TYPE app_role AS ENUM ('admin', 'supervisor', 'viewer');

-- User Roles Table
-- Links authenticated users to their application-specific role.
CREATE TABLE user_roles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'viewer'
);

COMMENT ON TABLE user_roles IS 'Stores application-specific roles for authenticated users.';
COMMENT ON COLUMN user_roles.role IS 'The application role: admin (full access), supervisor (task/agent management), viewer (read-only)';

-- Helper function to get the current user's role
-- This function uses SECURITY DEFINER to run with elevated permissions
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS app_role AS $$
DECLARE
  user_role app_role;
BEGIN
  SELECT role INTO user_role FROM user_roles WHERE id = auth.uid();
  RETURN COALESCE(user_role, 'viewer'::app_role);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_my_role IS 'Returns the current authenticated user\'s application role. Defaults to viewer if no role is assigned.';

-- Service Registry for Budget Control
-- This table holds all pluggable services, their budgets, and current status.
CREATE TABLE service_registry (
  id TEXT PRIMARY KEY, -- e.g., 'openai_gpt4', 'groq_llama3'
  display_name TEXT NOT NULL,
  api_endpoint TEXT NOT NULL,
  monthly_budget_usd NUMERIC DEFAULT 0,
  current_usage_usd NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'SUSPENDED'
  substitutor_service_id TEXT REFERENCES service_registry(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent Registry
-- This table tracks all available GenAI agents and their current status.
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alias TEXT NOT NULL UNIQUE, -- A human-readable name, e.g., 'python-refactor-agent-01'
  status TEXT NOT NULL DEFAULT 'IDLE', -- 'IDLE', 'BUSY'
  capabilities JSONB, -- e.g., '["python", "react", "code-review"]'
  api_key_hash TEXT, -- SHA-256 hash of the agent's API key for secure verification
  is_active BOOLEAN DEFAULT TRUE, -- Supervisors can toggle this to enable/disable an agent
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE agents IS 'Registry for all GenAI agents, their status, and capabilities.';
COMMENT ON COLUMN agents.status IS 'The current working status of the agent.';
COMMENT ON COLUMN agents.capabilities IS 'A set of tags describing what the agent can do.';
COMMENT ON COLUMN agents.last_seen IS 'A heartbeat timestamp to monitor agent health.';
COMMENT ON COLUMN agents.api_key_hash IS 'SHA-256 hash of the agent\'s API key for secure verification.';
COMMENT ON COLUMN agents.is_active IS 'Supervisors can toggle this to enable/disable an agent.';

-- =====================================================
-- System Configuration Management
-- =====================================================

-- System Settings Table
-- A key-value store for user-configurable system parameters.
CREATE TABLE system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE system_settings IS 'A key-value store for user-configurable system parameters.';
COMMENT ON COLUMN system_settings.key IS 'Unique identifier for the setting.';
COMMENT ON COLUMN system_settings.value IS 'JSONB value allowing flexible data types (numbers, strings, objects).';
COMMENT ON COLUMN system_settings.description IS 'Human-readable description of what this setting controls.';

-- Insert the initial setting value for outlier detection
INSERT INTO system_settings (key, value, description)
VALUES ('outlier_detection_stddev', '2.0', 'Number of standard deviations above average cost to flag a task for review.');

-- Enable RLS on system_settings
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow supervisors and admins to manage settings" ON system_settings
  FOR ALL USING (get_my_role() IN ('supervisor', 'admin'));
CREATE POLICY "Allow viewers to read settings" ON system_settings
  FOR SELECT USING (get_my_role() = 'viewer');

-- Tasks Table
-- This table holds all development tasks for the GenAI agents.
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'TODO', -- 'TODO', 'IN_PROGRESS', 'DONE', 'QUARANTINED', 'PENDING_BUDGET_APPROVAL'
  priority TEXT DEFAULT 'MEDIUM', -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
  agent_id TEXT, -- Identifier for the agent working on it
  required_capabilities JSONB, -- A JSON array of strings representing skills needed for this task
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Modify the tasks table to properly link to the agents table
ALTER TABLE tasks
  DROP COLUMN IF EXISTS agent_id,
  ADD COLUMN agent_id UUID REFERENCES agents(id) ON DELETE SET NULL;

-- Add comment for required_capabilities column
COMMENT ON COLUMN tasks.required_capabilities IS 'A JSON array of strings representing skills needed for this task, e.g., ''["python", "code-review"]''.';

-- Create a GIN index for efficient searching of capabilities.
CREATE INDEX idx_tasks_required_capabilities ON tasks USING GIN (required_capabilities);

COMMENT ON COLUMN tasks.agent_id IS 'The agent currently assigned to this task.';

-- Subscriptions for Telegram Notifications
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_chat_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL, -- e.g., 'BUDGET_EXCEEDED', 'BUILD_FAILURE'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Realtime on key tables
-- NOTE: You must also enable this in the Supabase Dashboard under Database > Replication.
ALTER TABLE tasks REPLICA IDENTITY FULL;
ALTER TABLE service_registry REPLICA IDENTITY FULL;
ALTER TABLE agents REPLICA IDENTITY FULL;

-- =====================================================
-- Row Level Security (RLS) Policies
-- =====================================================

-- Secure the tasks table
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access for supervisors and admins" ON tasks;
CREATE POLICY "Allow all access for supervisors and admins" ON tasks
  FOR ALL USING (get_my_role() IN ('supervisor', 'admin'));
DROP POLICY IF EXISTS "Allow read-only access for viewers" ON tasks;
CREATE POLICY "Allow read-only access for viewers" ON tasks
  FOR SELECT USING (get_my_role() = 'viewer');

-- Secure the service_registry table
ALTER TABLE service_registry ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access for supervisors and admins" ON service_registry;
CREATE POLICY "Allow all access for supervisors and admins" ON service_registry
  FOR ALL USING (get_my_role() IN ('supervisor', 'admin'));
DROP POLICY IF EXISTS "Allow read-only access for viewers" ON service_registry;
CREATE POLICY "Allow read-only access for viewers" ON service_registry
  FOR SELECT USING (get_my_role() = 'viewer');

-- Secure the agents table
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access for supervisors and admins" ON agents;
CREATE POLICY "Allow all access for supervisors and admins" ON agents
  FOR ALL USING (get_my_role() IN ('supervisor', 'admin'));
DROP POLICY IF EXISTS "Allow read-only access for viewers" ON agents;
CREATE POLICY "Allow read-only access for viewers" ON agents
  FOR SELECT USING (get_my_role() = 'viewer');

-- Initial data for demonstration
INSERT INTO service_registry (id, display_name, api_endpoint, monthly_budget_usd) VALUES
('premium_llm', 'Premium LLM (GPT-4)', 'https://api.openai.com/v1/chat/completions', 50.00),
('free_llm', 'Free LLM (Groq)', 'https://api.groq.com/openai/v1/chat/completions', 0.00);

UPDATE service_registry SET substitutor_service_id = 'free_llm' WHERE id = 'premium_llm';

INSERT INTO tasks (title, description) VALUES
('Setup Initial Project Structure', 'Create the basic file structure for the devart.ai application.'),
('Implement User Authentication', 'Add login and logout functionality using Supabase Auth.');

-- Budget Supervisor Core Function
-- This function atomically checks budget, updates usage, and handles suspension.
-- It prevents race conditions when multiple requests charge the same service simultaneously.
-- Enhanced to return suspension status for notification triggers.

-- Drop the old function signature first
DROP FUNCTION IF EXISTS charge_service(TEXT, NUMERIC);

CREATE OR REPLACE FUNCTION charge_service(service_id_to_charge TEXT, charge_amount NUMERIC)
RETURNS JSONB AS $$
DECLARE
  service RECORD;
  substitutor_service RECORD;
  was_suspended BOOLEAN := FALSE;
BEGIN
  -- Lock the row for this transaction to prevent race conditions
  SELECT * INTO service FROM service_registry WHERE id = service_id_to_charge FOR UPDATE;

  IF service IS NULL THEN
    RETURN jsonb_build_object('error', 'Service not found');
  END IF;

  -- Check if service should be suspended (budget exceeded or already suspended)
  IF service.status = 'SUSPENDED' OR (service.current_usage_usd + charge_amount > service.monthly_budget_usd AND service.monthly_budget_usd > 0) THEN
    -- Mark as suspended if not already
    IF service.status = 'ACTIVE' THEN
      UPDATE service_registry SET status = 'SUSPENDED' WHERE id = service_id_to_charge;
      was_suspended := TRUE;
    END IF;

    -- Check for a substitutor service
    IF service.substitutor_service_id IS NOT NULL THEN
      SELECT * INTO substitutor_service FROM service_registry WHERE id = service.substitutor_service_id;
      IF substitutor_service IS NOT NULL AND substitutor_service.status = 'ACTIVE' THEN
        RETURN jsonb_build_object('serviceToUse', row_to_json(substitutor_service), 'wasSuspended', was_suspended);
      END IF;
    END IF;
    
    RETURN jsonb_build_object('serviceToUse', NULL, 'wasSuspended', was_suspended);
  ELSE
    -- Budget is OK, update usage and return the original service
    UPDATE service_registry
    SET current_usage_usd = service.current_usage_usd + charge_amount
    WHERE id = service_id_to_charge;
    
    -- Re-fetch the service to return the updated state
    SELECT * INTO service FROM service_registry WHERE id = service_id_to_charge;
    RETURN jsonb_build_object('serviceToUse', row_to_json(service), 'wasSuspended', FALSE);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Service Usage Log for Auditing
-- Records every transaction, linking a task to a service charge.
CREATE TABLE service_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  service_id TEXT NOT NULL REFERENCES service_registry(id),
  charge_amount NUMERIC NOT NULL CHECK (charge_amount >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add an index for efficient querying of a task's history
CREATE INDEX idx_service_usage_log_task_id ON service_usage_log(task_id);

-- Add comments for clarity
COMMENT ON TABLE service_usage_log IS 'Immutable log of every service charge associated with a task.';
COMMENT ON COLUMN service_usage_log.task_id IS 'The task that triggered this service usage.';
COMMENT ON COLUMN service_usage_log.service_id IS 'The service that was charged (could be the original or a substitutor).';
COMMENT ON COLUMN service_usage_log.charge_amount IS 'The cost in USD for this specific transaction.';

-- Add RLS policy for service_usage_log
ALTER TABLE service_usage_log ENABLE ROW LEVEL SECURITY;

-- Allow all roles to read audit logs for transparency
DROP POLICY IF EXISTS "Allow authenticated users to read all logs" ON service_usage_log;
CREATE POLICY "Allow all users to read service usage logs" ON service_usage_log
  FOR SELECT USING (get_my_role() IN ('admin', 'supervisor', 'viewer'));

-- Only supervisors and admins can insert new log entries (through application logic)
CREATE POLICY "Allow supervisors and admins to insert usage logs" ON service_usage_log
  FOR INSERT WITH CHECK (get_my_role() IN ('supervisor', 'admin'));

-- Orchestration Engine: Atomic Task Claiming Function
-- This function atomically finds the next available task, assigns it to an agent,
-- and returns the task. This prevents race conditions in a distributed system.
CREATE OR REPLACE FUNCTION claim_next_task(requesting_agent_id UUID)
RETURNS tasks AS $$
DECLARE
  claimed_task tasks;
BEGIN
  UPDATE tasks
  SET
    status = 'IN_PROGRESS',
    agent_id = requesting_agent_id
  WHERE id = (
    SELECT id FROM tasks
    WHERE status = 'TODO'
    ORDER BY 
      CASE priority 
        WHEN 'CRITICAL' THEN 1
        WHEN 'HIGH' THEN 2
        WHEN 'MEDIUM' THEN 3
        WHEN 'LOW' THEN 4
        ELSE 5
      END,
      created_at
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING * INTO claimed_task;

  -- Also update the agent's status to BUSY
  IF claimed_task IS NOT NULL THEN
    UPDATE agents SET status = 'BUSY', last_seen = NOW() WHERE id = requesting_agent_id;
  END IF;

  RETURN claimed_task;
END;
$$ LANGUAGE plpgsql;

-- Capability-Aware Task Claiming Function
-- This function atomically finds the next available task that matches the agent's capabilities,
-- assigns it to an agent, and returns the task. This prevents race conditions in a distributed system.
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
    ORDER BY 
      CASE priority 
        WHEN 'CRITICAL' THEN 1
        WHEN 'HIGH' THEN 2
        WHEN 'MEDIUM' THEN 3
        WHEN 'LOW' THEN 4
        ELSE 5
      END,
      created_at
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
$$ LANGUAGE plpgsql;-- =====================================================
-- Intelligence and Analytics Layer
-- =====================================================
-- Ensure the 'vector' extension is enabled in the Supabase dashboard under Database > Extensions.
-- The vector extension provides vector similarity search capabilities.

-- Knowledge Base Table
-- Stores text chunks and their vector embeddings for semantic search.
CREATE TABLE knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  embedding VECTOR(1536), -- 1536 is the dimension for OpenAI's text-embedding-ada-002
  source TEXT, -- e.g., 'ADR-001.md', 'auth_service/utils.py'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE knowledge_base IS 'Stores vectorized content for agent context retrieval.';
COMMENT ON COLUMN knowledge_base.embedding IS 'Vector embedding of the content (1536 dimensions for OpenAI text-embedding-ada-002).';
COMMENT ON COLUMN knowledge_base.source IS 'The origin of the content for reference.';

-- Create index for vector similarity search performance
-- Note: This will be created after pgvector extension is enabled
-- CREATE INDEX knowledge_base_embedding_idx ON knowledge_base USING ivfflat (embedding vector_cosine_ops);

-- Analytics View - Task Cost Summary
-- This view aggregates the total cost for each task from the audit log.
CREATE OR REPLACE VIEW task_cost_summary AS
  SELECT
    t.id AS task_id,
    t.title AS task_title,
    t.status AS task_status,
    t.priority AS task_priority,
    COUNT(sul.id) AS usage_count,
    COALESCE(SUM(sul.charge_amount), 0) AS total_cost,
    t.created_at AS task_created_at
  FROM
    tasks AS t
  LEFT JOIN
    service_usage_log AS sul ON t.id = sul.task_id
  GROUP BY
    t.id, t.title, t.status, t.priority, t.created_at
  ORDER BY
    total_cost DESC;

COMMENT ON VIEW task_cost_summary IS 'Aggregated view showing cost analysis for each task.';

-- Semantic Search Function
-- This function performs a semantic search on the knowledge base using cosine similarity.
CREATE OR REPLACE FUNCTION match_knowledge (
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  source TEXT,
  similarity FLOAT
)
LANGUAGE sql STABLE AS $$
  SELECT
    kb.id,
    kb.content,
    kb.source,
    1 - (kb.embedding <=> query_embedding) AS similarity
  FROM
    knowledge_base AS kb
  WHERE 1 - (kb.embedding <=> query_embedding) > match_threshold
  ORDER BY
    similarity DESC
  LIMIT match_count;
$$;

COMMENT ON FUNCTION match_knowledge IS 'Performs semantic search on knowledge base using cosine similarity. Returns matching content with similarity scores.';

-- =====================================================
-- Collaborative Agent Platform Extensions
-- =====================================================

-- Add a column for task chaining
ALTER TABLE tasks
  ADD COLUMN parent_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL;

COMMENT ON COLUMN tasks.parent_task_id IS 'The parent task that spawned this successor task.';
CREATE INDEX idx_tasks_parent_task_id ON tasks(parent_task_id);

-- Add a column for performance outlier flagging
ALTER TABLE tasks
  ADD COLUMN review_flag BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN tasks.review_flag IS 'If true, this task is flagged for supervisor review due to performance outliers.';

-- Add columns for error handling and retry mechanism
ALTER TABLE tasks
  ADD COLUMN retry_count INT DEFAULT 0,
  ADD COLUMN max_retries INT DEFAULT 3,
  ADD COLUMN last_error TEXT;

COMMENT ON COLUMN tasks.retry_count IS 'The number of times this task has been attempted.';
COMMENT ON COLUMN tasks.max_retries IS 'The maximum number of retries allowed for this task.';
COMMENT ON COLUMN tasks.last_error IS 'The error message from the last failed attempt.';

-- Agent Sandboxes Table
-- Tracks isolated execution environments for agents.
CREATE TABLE agent_sandboxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'PROVISIONING', -- 'PROVISIONING', 'ACTIVE', 'TERMINATED'
  container_id TEXT, -- The ID from the container runtime (e.g., Docker container ID)
  connection_details JSONB, -- e.g., { "host": "...", "port": 22 }
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

COMMENT ON TABLE agent_sandboxes IS 'Tracks isolated execution environments for agents.';

-- Workflow Engine Tables
-- Tracks predefined, reusable workflows
CREATE TABLE workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT
);

-- Task templates for workflows
CREATE TABLE task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  stage_order INT NOT NULL,
  title_template TEXT NOT NULL, -- e.g., "Build service: service_name"
  description_template TEXT,
  priority TEXT NOT NULL DEFAULT 'MEDIUM',
  UNIQUE (workflow_id, stage_order)
);

-- This function identifies tasks with costs above a configurable threshold
-- and flags them for review. The threshold is now stored in system_settings.
CREATE OR REPLACE FUNCTION flag_costly_tasks()
RETURNS void AS $$
DECLARE
  avg_cost NUMERIC;
  stddev_cost NUMERIC;
  threshold_stddev NUMERIC;
  threshold NUMERIC;
BEGIN
  -- 1. Read the dynamic threshold from the settings table
  SELECT (value::NUMERIC) INTO threshold_stddev 
  FROM system_settings 
  WHERE key = 'outlier_detection_stddev';
  
  -- Default to 2.0 if setting is not found
  IF threshold_stddev IS NULL THEN
    threshold_stddev := 2.0;
  END IF;

  -- Calculate the average and standard deviation of costs for completed tasks
  SELECT AVG(total_cost), STDDEV(total_cost)
  INTO avg_cost, stddev_cost
  FROM task_cost_summary;

  -- Calculate the dynamic threshold
  threshold := avg_cost + (threshold_stddev * stddev_cost);

  -- Flag tasks that exceed the threshold and are not already flagged
  UPDATE tasks
  SET review_flag = TRUE
  WHERE id IN (
    SELECT task_id FROM task_cost_summary WHERE total_cost > threshold
  ) AND review_flag = FALSE;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Marketplace Implementation
-- =====================================================

-- Marketplace Items Table
-- Stores metadata for shared agents and workflows.
CREATE TABLE marketplace_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type TEXT NOT NULL, -- 'agent' or 'workflow'
  name TEXT NOT NULL,
  description TEXT,
  version TEXT NOT NULL,
  publisher_id UUID REFERENCES auth.users(id),
  tags JSONB, -- For search and categorization
  repository_url TEXT, -- Link to the source code
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (name, version)
);

COMMENT ON TABLE marketplace_items IS 'Stores metadata for shared agents and workflows.';
COMMENT ON COLUMN marketplace_items.item_type IS 'The type of item: agent or workflow';
COMMENT ON COLUMN marketplace_items.name IS 'The name of the item';
COMMENT ON COLUMN marketplace_items.description IS 'Description of the item';
COMMENT ON COLUMN marketplace_items.version IS 'Version identifier';
COMMENT ON COLUMN marketplace_items.publisher_id IS 'Reference to the user who published this item';
COMMENT ON COLUMN marketplace_items.tags IS 'Tags for search and categorization';
COMMENT ON COLUMN marketplace_items.repository_url IS 'Link to the source code repository';
COMMENT ON COLUMN marketplace_items.created_at IS 'Creation timestamp';

-- =====================================================
-- Workflow Performance Data Collection
-- =====================================================

-- Workflow Runs Table
-- Tracks each instance of a workflow being triggered.
CREATE TABLE workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'RUNNING', -- 'RUNNING', 'COMPLETED', 'FAILED'
  trigger_context JSONB, -- The initial variables used to start the workflow
  start_time TIMESTAMPTZ DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  total_cost NUMERIC
);

COMMENT ON TABLE workflow_runs IS 'Tracks each instance of a workflow being triggered.';
COMMENT ON COLUMN workflow_runs.workflow_id IS 'Reference to the workflow that was triggered';
COMMENT ON COLUMN workflow_runs.status IS 'Execution status of the workflow run';
COMMENT ON COLUMN workflow_runs.trigger_context IS 'The initial variables used to start the workflow';
COMMENT ON COLUMN workflow_runs.start_time IS 'Execution start time';
COMMENT ON COLUMN workflow_runs.end_time IS 'Execution end time';
COMMENT ON COLUMN workflow_runs.total_cost IS 'Aggregated cost of all tasks in the workflow';

-- Add a column to tasks to link them to a specific workflow run
ALTER TABLE tasks ADD COLUMN workflow_run_id UUID REFERENCES workflow_runs(id) ON DELETE SET NULL;

COMMENT ON COLUMN tasks.workflow_run_id IS 'Link to the workflow run this task belongs to';

-- Function to check if a workflow is complete and update its status atomically
CREATE OR REPLACE FUNCTION check_workflow_completion(workflow_run_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  incomplete_count INTEGER;
  updated BOOLEAN := FALSE;
BEGIN
  -- Count incomplete tasks for this workflow run
  SELECT COUNT(*) INTO incomplete_count
  FROM tasks
  WHERE workflow_run_id = check_workflow_completion.workflow_run_id
  AND status NOT IN ('DONE', 'QUARANTINED');

  -- If no incomplete tasks, mark workflow as complete
  IF incomplete_count = 0 THEN
    UPDATE workflow_runs
    SET 
      status = 'COMPLETED',
      end_time = NOW()
    WHERE id = check_workflow_completion.workflow_run_id;
    
    updated := TRUE;
  END IF;
  
  RETURN updated;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_workflow_completion IS 'Checks if a workflow is complete and updates its status atomically.';

-- =====================================================
-- Centralized Activity Feed Implementation
-- =====================================================

-- Activity Log Table
-- A real-time, append-only log of all significant system events.
CREATE TABLE activity_log (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  event_type TEXT NOT NULL, -- e.g., 'TASK_CREATED', 'AGENT_CLAIMED_TASK', 'SERVICE_SUSPENDED'
  details JSONB,
  severity TEXT DEFAULT 'INFO' -- 'INFO', 'WARN', 'ERROR'
);

COMMENT ON TABLE activity_log IS 'A real-time, append-only log of all significant system events.';

-- PostgreSQL trigger function to automatically populate the activity log
CREATE OR REPLACE FUNCTION log_activity()
RETURNS TRIGGER AS $$
DECLARE
  event_type_text TEXT;
  details_jsonb JSONB;
BEGIN
  IF (TG_OP = 'INSERT' AND TG_TABLE_NAME = 'tasks') THEN
    event_type_text := 'TASK_CREATED';
    details_jsonb := jsonb_build_object('taskId', NEW.id, 'title', NEW.title);
  ELSIF (TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'tasks') THEN
    IF OLD.status <> NEW.status THEN
      event_type_text := 'TASK_STATUS_CHANGED';
      details_jsonb := jsonb_build_object('taskId', NEW.id, 'title', NEW.title, 'from', OLD.status, 'to', NEW.status);
    END IF;
    -- Check for agent assignment
    IF OLD.agent_id IS DISTINCT FROM NEW.agent_id THEN
      event_type_text := 'TASK_ASSIGNED';
      details_jsonb := jsonb_build_object('taskId', NEW.id, 'title', NEW.title, 'agentId', NEW.agent_id);
    END IF;
  ELSIF (TG_OP = 'INSERT' AND TG_TABLE_NAME = 'agents') THEN
    event_type_text := 'AGENT_REGISTERED';
    details_jsonb := jsonb_build_object('agentId', NEW.id, 'alias', NEW.alias);
  ELSIF (TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'agents') THEN
    IF OLD.status <> NEW.status THEN
      event_type_text := 'AGENT_STATUS_CHANGED';
      details_jsonb := jsonb_build_object('agentId', NEW.id, 'alias', NEW.alias, 'from', OLD.status, 'to', NEW.status);
    END IF;
  ELSIF (TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'service_registry') THEN
    IF OLD.status <> NEW.status AND NEW.status = 'SUSPENDED' THEN
      event_type_text := 'SERVICE_SUSPENDED';
      details_jsonb := jsonb_build_object('serviceId', NEW.id, 'displayName', NEW.display_name);
    ELSIF OLD.status <> NEW.status AND NEW.status = 'ACTIVE' THEN
      event_type_text := 'SERVICE_REACTIVATED';
      details_jsonb := jsonb_build_object('serviceId', NEW.id, 'displayName', NEW.display_name);
    ELSIF OLD.monthly_budget_usd <> NEW.monthly_budget_usd THEN
      event_type_text := 'BUDGET_INCREASED';
      details_jsonb := jsonb_build_object('serviceId', NEW.id, 'displayName', NEW.display_name, 'newBudget', NEW.monthly_budget_usd);
    END IF;
  END IF;

  IF event_type_text IS NOT NULL THEN
    INSERT INTO activity_log (event_type, details, severity) VALUES (event_type_text, details_jsonb, 'INFO');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for activity logging
CREATE TRIGGER tasks_activity_trigger
  AFTER INSERT OR UPDATE ON tasks
  FOR EACH ROW EXECUTE PROCEDURE log_activity();

CREATE TRIGGER agents_activity_trigger
  AFTER INSERT OR UPDATE ON agents
  FOR EACH ROW EXECUTE PROCEDURE log_activity();

CREATE TRIGGER service_registry_activity_trigger
  AFTER UPDATE ON service_registry
  FOR EACH ROW EXECUTE PROCEDURE log_activity();

-- =====================================================
-- Advanced Trace Anomaly Detection System
-- =====================================================

-- Anomaly detection results
CREATE TABLE trace_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id TEXT NOT NULL,
  span_id TEXT,
  anomaly_type TEXT NOT NULL, -- 'PERFORMANCE', 'SECURITY', 'RESOURCE'
  anomaly_subtype TEXT, -- Specific type of anomaly
  severity TEXT NOT NULL, -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
  description TEXT,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  resolved BOOLEAN DEFAULT FALSE,
  resolution_notes TEXT
);

COMMENT ON TABLE trace_anomalies IS 'Stores detected trace anomalies for analysis and alerting.';
COMMENT ON COLUMN trace_anomalies.trace_id IS 'The ID of the trace where the anomaly was detected.';
COMMENT ON COLUMN trace_anomalies.span_id IS 'The ID of the specific span where the anomaly occurred.';
COMMENT ON COLUMN trace_anomalies.anomaly_type IS 'The category of the anomaly: PERFORMANCE, SECURITY, or RESOURCE.';
COMMENT ON COLUMN trace_anomalies.anomaly_subtype IS 'The specific type of anomaly within the category.';
COMMENT ON COLUMN trace_anomalies.severity IS 'The severity level of the anomaly.';
COMMENT ON COLUMN trace_anomalies.description IS 'Detailed description of the detected anomaly.';
COMMENT ON COLUMN trace_anomalies.detected_at IS 'Timestamp when the anomaly was detected.';
COMMENT ON COLUMN trace_anomalies.resolved IS 'Whether the anomaly has been resolved.';
COMMENT ON COLUMN trace_anomalies.resolution_notes IS 'Notes about how the anomaly was resolved.';

-- Add root cause analysis columns to trace_anomalies table
ALTER TABLE trace_anomalies 
  ADD COLUMN IF NOT EXISTS root_cause JSONB,
  ADD COLUMN IF NOT EXISTS root_cause_confidence TEXT, -- 'LOW', 'MEDIUM', 'HIGH'
  ADD COLUMN IF NOT EXISTS suggested_actions JSONB;

-- Root Cause Patterns Table
-- Stores root cause patterns for learning and improvement
CREATE TABLE IF NOT EXISTS root_cause_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anomaly_type TEXT NOT NULL,
  anomaly_subtype TEXT,
  root_cause_category TEXT NOT NULL,
  root_cause_details TEXT,
  pattern_identifiers JSONB,
  confidence_score NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE root_cause_patterns IS 'Stores root cause patterns for learning and improvement.';
COMMENT ON COLUMN root_cause_patterns.anomaly_type IS 'The category of the anomaly: PERFORMANCE, SECURITY, or RESOURCE.';
COMMENT ON COLUMN root_cause_patterns.anomaly_subtype IS 'The specific type of anomaly within the category.';
COMMENT ON COLUMN root_cause_patterns.root_cause_category IS 'The category of the root cause.';
COMMENT ON COLUMN root_cause_patterns.root_cause_details IS 'Detailed description of the root cause.';
COMMENT ON COLUMN root_cause_patterns.pattern_identifiers IS 'Identifiers used to match this pattern.';
COMMENT ON COLUMN root_cause_patterns.confidence_score IS 'Numeric confidence score for this pattern.';
COMMENT ON COLUMN root_cause_patterns.created_at IS 'Timestamp when the pattern was created.';

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_root_cause_patterns_type ON root_cause_patterns(anomaly_type);
CREATE INDEX IF NOT EXISTS idx_root_cause_patterns_category ON root_cause_patterns(root_cause_category);

-- Enable RLS on root_cause_patterns
ALTER TABLE root_cause_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow supervisors and admins to manage patterns" ON root_cause_patterns
  FOR ALL USING (get_my_role() IN ('supervisor', 'admin'));
CREATE POLICY "Allow viewers to read patterns" ON root_cause_patterns
  FOR SELECT USING (get_my_role() = 'viewer');

-- Anomaly detection configuration
CREATE TABLE anomaly_detection_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key TEXT NOT NULL UNIQUE,
  config_value JSONB,
  description TEXT
);

COMMENT ON TABLE anomaly_detection_config IS 'Configuration settings for the anomaly detection system.';
COMMENT ON COLUMN anomaly_detection_config.config_key IS 'Unique identifier for the configuration setting.';
COMMENT ON COLUMN anomaly_detection_config.config_value IS 'JSONB value allowing flexible configuration data types.';
COMMENT ON COLUMN anomaly_detection_config.description IS 'Human-readable description of what this setting controls.';

-- Add indexes for efficient querying
CREATE INDEX idx_trace_anomalies_type ON trace_anomalies(anomaly_type);
CREATE INDEX idx_trace_anomalies_severity ON trace_anomalies(severity);
CREATE INDEX idx_trace_anomalies_detected ON trace_anomalies(detected_at);

-- Enable RLS on trace_anomalies
ALTER TABLE trace_anomalies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow supervisors and admins to manage anomalies" ON trace_anomalies
  FOR ALL USING (get_my_role() IN ('supervisor', 'admin'));
CREATE POLICY "Allow viewers to read anomalies" ON trace_anomalies
  FOR SELECT USING (get_my_role() = 'viewer');

-- Enable RLS on anomaly_detection_config
ALTER TABLE anomaly_detection_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow supervisors and admins to manage config" ON anomaly_detection_config
  FOR ALL USING (get_my_role() IN ('supervisor', 'admin'));
CREATE POLICY "Allow viewers to read config" ON anomaly_detection_config
  FOR SELECT USING (get_my_role() = 'viewer');

-- Insert default configuration values
INSERT INTO anomaly_detection_config (config_key, config_value, description) VALUES
('latency_threshold_stddev', '3.0', 'Number of standard deviations above average latency to flag as anomaly'),
('error_rate_threshold', '0.05', 'Error rate threshold (5%) to flag as anomaly'),
('sampling_enabled', 'true', 'Whether to enable sampling for anomaly detection'),
('sampling_ratio', '0.1', 'Ratio of traces to sample for anomaly detection (10%)');
