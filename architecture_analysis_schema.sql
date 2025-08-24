-- =====================================================
-- Architecture Analysis System Tables
-- =====================================================

-- Architecture Analysis Tasks Table
-- Stores architecture analysis tasks for codebase evaluation
CREATE TABLE architecture_analysis_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  repository_url TEXT NOT NULL,
  branch TEXT DEFAULT 'main',
  analysis_scope TEXT, -- 'full', 'module', 'directory'
  target_modules TEXT[], -- Specific modules to analyze
  status TEXT NOT NULL DEFAULT 'TODO', -- 'TODO', 'IN_PROGRESS', 'DONE', 'ERROR'
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE architecture_analysis_tasks IS 'Stores architecture analysis tasks for codebase evaluation.';
COMMENT ON COLUMN architecture_analysis_tasks.title IS 'Title of the analysis task.';
COMMENT ON COLUMN architecture_analysis_tasks.description IS 'Description of what should be analyzed.';
COMMENT ON COLUMN architecture_analysis_tasks.repository_url IS 'URL of the repository to analyze.';
COMMENT ON COLUMN architecture_analysis_tasks.branch IS 'Branch of the repository to analyze.';
COMMENT ON COLUMN architecture_analysis_tasks.analysis_scope IS 'Scope of the analysis (full, module, directory).';
COMMENT ON COLUMN architecture_analysis_tasks.target_modules IS 'Specific modules to analyze.';
COMMENT ON COLUMN architecture_analysis_tasks.status IS 'Current status of the analysis task.';
COMMENT ON COLUMN architecture_analysis_tasks.agent_id IS 'Agent assigned to perform the analysis.';
COMMENT ON COLUMN architecture_analysis_tasks.created_by IS 'User who created the task.';

-- Architecture Findings Table
-- Stores findings from architecture analysis
CREATE TABLE architecture_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES architecture_analysis_tasks(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'circular_dependency', 'god_class', 'performance_bottleneck', etc.
  severity TEXT NOT NULL, -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
  description TEXT NOT NULL,
  file_path TEXT,
  line_number INTEGER,
  impact_score NUMERIC, -- 0.0-1.0 score of impact
  confidence_score NUMERIC, -- 0.0-1.0 score of detection confidence
  metadata JSONB, -- Additional structured data about the finding
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE architecture_findings IS 'Stores findings from architecture analysis.';
COMMENT ON COLUMN architecture_findings.task_id IS 'Reference to the analysis task.';
COMMENT ON COLUMN architecture_findings.type IS 'Type of architectural issue found.';
COMMENT ON COLUMN architecture_findings.severity IS 'Severity level of the finding.';
COMMENT ON COLUMN architecture_findings.description IS 'Detailed description of the finding.';
COMMENT ON COLUMN architecture_findings.file_path IS 'File path where the issue was found.';
COMMENT ON COLUMN architecture_findings.line_number IS 'Line number where the issue was found.';
COMMENT ON COLUMN architecture_findings.impact_score IS 'Impact score of the finding (0.0-1.0).';
COMMENT ON COLUMN architecture_findings.confidence_score IS 'Confidence score of the detection (0.0-1.0).';
COMMENT ON COLUMN architecture_findings.metadata IS 'Additional structured data about the finding.';

-- Refactoring Suggestions Table
-- Stores AI-generated refactoring suggestions
CREATE TABLE refactoring_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES architecture_analysis_tasks(id) ON DELETE CASCADE,
  finding_id UUID REFERENCES architecture_findings(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  complexity TEXT NOT NULL, -- 'LOW', 'MEDIUM', 'HIGH'
  impact TEXT NOT NULL, -- 'LOW', 'MEDIUM', 'HIGH'
  implementation_plan JSONB, -- Step-by-step implementation plan
  estimated_effort_hours NUMERIC, -- Estimated effort in hours
  priority TEXT DEFAULT 'MEDIUM', -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
  metadata JSONB, -- Additional structured data about the suggestion
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE refactoring_suggestions IS 'Stores AI-generated refactoring suggestions.';
COMMENT ON COLUMN refactoring_suggestions.task_id IS 'Reference to the analysis task.';
COMMENT ON COLUMN refactoring_suggestions.finding_id IS 'Reference to the finding this suggestion addresses.';
COMMENT ON COLUMN refactoring_suggestions.title IS 'Title of the refactoring suggestion.';
COMMENT ON COLUMN refactoring_suggestions.description IS 'Detailed description of the suggestion.';
COMMENT ON COLUMN refactoring_suggestions.complexity IS 'Complexity level of implementing the suggestion.';
COMMENT ON COLUMN refactoring_suggestions.impact IS 'Expected impact of implementing the suggestion.';
COMMENT ON COLUMN refactoring_suggestions.implementation_plan IS 'Step-by-step implementation plan.';
COMMENT ON COLUMN refactoring_suggestions.estimated_effort_hours IS 'Estimated effort in hours.';
COMMENT ON COLUMN refactoring_suggestions.priority IS 'Priority of implementing the suggestion.';
COMMENT ON COLUMN refactoring_suggestions.metadata IS 'Additional structured data about the suggestion.';

-- Refactoring Executions Table
-- Tracks execution of refactoring suggestions
CREATE TABLE refactoring_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id UUID REFERENCES refactoring_suggestions(id) ON DELETE CASCADE,
  task_id UUID REFERENCES architecture_analysis_tasks(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PROVISIONING', 'EXECUTING', 'VALIDATING', 'SUCCESS', 'FAILED'
  sandbox_id TEXT, -- Identifier for the sandbox environment
  sandbox_url TEXT, -- URL to access the sandbox environment
  execution_result JSONB, -- Detailed results of the execution
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE refactoring_executions IS 'Tracks execution of refactoring suggestions.';
COMMENT ON COLUMN refactoring_executions.suggestion_id IS 'Reference to the refactoring suggestion.';
COMMENT ON COLUMN refactoring_executions.task_id IS 'Reference to the analysis task.';
COMMENT ON COLUMN refactoring_executions.agent_id IS 'Agent that executed the refactoring.';
COMMENT ON COLUMN refactoring_executions.status IS 'Current status of the execution.';
COMMENT ON COLUMN refactoring_executions.sandbox_id IS 'Identifier for the sandbox environment.';
COMMENT ON COLUMN refactoring_executions.sandbox_url IS 'URL to access the sandbox environment.';
COMMENT ON COLUMN refactoring_executions.execution_result IS 'Detailed results of the execution.';
COMMENT ON COLUMN refactoring_executions.started_at IS 'Timestamp when execution started.';
COMMENT ON COLUMN refactoring_executions.completed_at IS 'Timestamp when execution completed.';

-- Add indexes for efficient querying
CREATE INDEX idx_architecture_analysis_tasks_status ON architecture_analysis_tasks(status);
CREATE INDEX idx_architecture_analysis_tasks_agent ON architecture_analysis_tasks(agent_id);
CREATE INDEX idx_architecture_analysis_tasks_created ON architecture_analysis_tasks(created_at);
CREATE INDEX idx_architecture_findings_task ON architecture_findings(task_id);
CREATE INDEX idx_architecture_findings_type ON architecture_findings(type);
CREATE INDEX idx_architecture_findings_severity ON architecture_findings(severity);
CREATE INDEX idx_refactoring_suggestions_task ON refactoring_suggestions(task_id);
CREATE INDEX idx_refactoring_suggestions_finding ON refactoring_suggestions(finding_id);
CREATE INDEX idx_refactoring_suggestions_priority ON refactoring_suggestions(priority);
CREATE INDEX idx_refactoring_executions_suggestion ON refactoring_executions(suggestion_id);
CREATE INDEX idx_refactoring_executions_task ON refactoring_executions(task_id);
CREATE INDEX idx_refactoring_executions_status ON refactoring_executions(status);

-- Enable Realtime on architecture analysis tables
ALTER TABLE architecture_analysis_tasks REPLICA IDENTITY FULL;
ALTER TABLE architecture_findings REPLICA IDENTITY FULL;
ALTER TABLE refactoring_suggestions REPLICA IDENTITY FULL;
ALTER TABLE refactoring_executions REPLICA IDENTITY FULL;

-- Enable RLS on architecture analysis tables
ALTER TABLE architecture_analysis_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow supervisors and admins to manage analysis tasks" ON architecture_analysis_tasks
  FOR ALL USING (get_my_role() IN ('supervisor', 'admin'));
CREATE POLICY "Allow agents to update their assigned tasks" ON architecture_analysis_tasks
  FOR UPDATE USING (agent_id IN (SELECT id FROM agents WHERE alias = current_user));
CREATE POLICY "Allow viewers to read analysis tasks" ON architecture_analysis_tasks
  FOR SELECT USING (get_my_role() = 'viewer');

ALTER TABLE architecture_findings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow supervisors and admins to manage findings" ON architecture_findings
  FOR ALL USING (get_my_role() IN ('supervisor', 'admin'));
CREATE POLICY "Allow viewers to read findings" ON architecture_findings
  FOR SELECT USING (get_my_role() = 'viewer');

ALTER TABLE refactoring_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow supervisors and admins to manage suggestions" ON refactoring_suggestions
  FOR ALL USING (get_my_role() IN ('supervisor', 'admin'));
CREATE POLICY "Allow viewers to read suggestions" ON refactoring_suggestions
  FOR SELECT USING (get_my_role() = 'viewer');

ALTER TABLE refactoring_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow supervisors and admins to manage executions" ON refactoring_executions
  FOR ALL USING (get_my_role() IN ('supervisor', 'admin'));
CREATE POLICY "Allow agents to update their executions" ON refactoring_executions
  FOR UPDATE USING (agent_id IN (SELECT id FROM agents WHERE alias = current_user));
CREATE POLICY "Allow viewers to read executions" ON refactoring_executions
  FOR SELECT USING (get_my_role() = 'viewer');