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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Modify the tasks table to properly link to the agents table
ALTER TABLE tasks
  DROP COLUMN IF EXISTS agent_id,
  ADD COLUMN agent_id UUID REFERENCES agents(id) ON DELETE SET NULL;

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