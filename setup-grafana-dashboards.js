// Script to set up Grafana dashboards
// This script should be run after setting up the data source

const GRAFANA_URL = 'http://localhost:3001';
const GRAFANA_API_KEY = process.env.GRAFANA_API_KEY; // You need to generate this in Grafana

// Dashboard configuration
const dashboard = {
  dashboard: {
    title: 'devart.ai Analytics',
    tags: ['devart', 'ai', 'analytics'],
    timezone: 'browser',
    schemaVersion: 16,
    version: 0,
    refresh: '5s',
    panels: [
      {
        id: 1,
        title: 'Task Throughput',
        type: 'timeseries',
        datasource: 'Supabase PostgreSQL',
        targets: [
          {
            refId: 'A',
            rawSql: `SELECT
  time_bucket('1 hour', created_at) AS time,
  COUNT(*) AS task_count
FROM tasks
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY time
ORDER BY time`,
            format: 'time_series'
          }
        ],
        gridPos: { h: 8, w: 12, x: 0, y: 0 }
      },
      {
        id: 2,
        title: 'Agent Status',
        type: 'piechart',
        datasource: 'Supabase PostgreSQL',
        targets: [
          {
            refId: 'A',
            rawSql: `SELECT
  status,
  COUNT(*) AS agent_count
FROM agents
GROUP BY status`,
            format: 'table'
          }
        ],
        gridPos: { h: 8, w: 12, x: 12, y: 0 }
      },
      {
        id: 3,
        title: 'Average Task Cost',
        type: 'stat',
        datasource: 'Supabase PostgreSQL',
        targets: [
          {
            refId: 'A',
            rawSql: `SELECT
  AVG(total_cost) AS average_task_cost
FROM task_cost_summary
WHERE task_status = 'DONE'`,
            format: 'table'
          }
        ],
        options: {
          reduceOptions: {
            values: false,
            calcs: ['lastNotNull']
          },
          textMode: 'value',
          text: {},
          colorMode: 'value',
          graphMode: 'area',
          justifyMode: 'auto',
          orientation: 'horizontal',
          percentChangeColorMode: 'standard',
          showPercentChange: false,
          wideLayout: true
        },
        gridPos: { h: 8, w: 12, x: 0, y: 8 }
      }
    ]
  },
  overwrite: true
};

async function setupGrafanaDashboards() {
  if (!GRAFANA_API_KEY) {
    console.error('Please set the GRAFANA_API_KEY environment variable');
    process.exit(1);
  }

  try {
    const response = await fetch(`${GRAFANA_URL}/api/dashboards/db`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GRAFANA_API_KEY}`
      },
      body: JSON.stringify(dashboard)
    });

    if (response.ok) {
      console.log('Grafana dashboard created successfully');
      const result = await response.json();
      console.log('Dashboard URL:', result.url);
    } else {
      const error = await response.text();
      console.error('Failed to create Grafana dashboard:', error);
    }
  } catch (error) {
    console.error('Error setting up Grafana dashboard:', error);
  }
}

// Run the setup
setupGrafanaDashboards();