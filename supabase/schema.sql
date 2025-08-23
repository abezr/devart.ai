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