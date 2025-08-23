-- SQL queries for Grafana dashboards

-- 1. Task Throughput panel using time_bucket
-- This query groups tasks by hourly intervals to show task processing rate
SELECT
  time_bucket('1 hour', created_at) AS time,
  COUNT(*) AS task_count
FROM tasks
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY time
ORDER BY time;

-- 2. Agent Status panel using pie chart
-- This query shows the distribution of agent statuses
SELECT
  status,
  COUNT(*) AS agent_count
FROM agents
GROUP BY status;

-- 3. Average Task Cost panel using stat panel
-- This query calculates the average cost per task
SELECT
  AVG(total_cost) AS average_task_cost
FROM task_cost_summary
WHERE task_status = 'DONE';