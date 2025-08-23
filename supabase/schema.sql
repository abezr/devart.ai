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
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE agents IS 'Registry for all GenAI agents, their status, and capabilities.';
COMMENT ON COLUMN agents.status IS 'The current working status of the agent.';
COMMENT ON COLUMN agents.capabilities IS 'A set of tags describing what the agent can do.';
COMMENT ON COLUMN agents.last_seen IS 'A heartbeat timestamp to monitor agent health.';

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

-- Add RLS policy
ALTER TABLE service_usage_log ENABLE ROW LEVEL SECURITY;

-- For now, create a permissive policy for authenticated users.
-- This can be tightened later.
CREATE POLICY "Allow authenticated users to read all logs"
  ON service_usage_log FOR SELECT
  TO authenticated
  USING (true);

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

-- This function identifies tasks with costs above a certain threshold (e.g., 2 standard deviations)
-- and flags them for review.
CREATE OR REPLACE FUNCTION flag_costly_tasks()
RETURNS void AS $$
DECLARE
  avg_cost NUMERIC;
  stddev_cost NUMERIC;
  threshold NUMERIC;
BEGIN
  -- Calculate the average and standard deviation of costs for completed tasks
  SELECT AVG(total_cost), STDDEV(total_cost)
  INTO avg_cost, stddev_cost
  FROM task_cost_summary;

  -- Set the threshold for flagging (e.g., average + 2 standard deviations)
  threshold := avg_cost + (2 * stddev_cost);

  -- Flag tasks that exceed the threshold and are not already flagged
  UPDATE tasks
  SET review_flag = TRUE
  WHERE id IN (
    SELECT task_id FROM task_cost_summary WHERE total_cost > threshold
  ) AND review_flag = FALSE;
END;
$$ LANGUAGE plpgsql;