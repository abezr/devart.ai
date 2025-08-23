// Script to set up Grafana data source for Supabase PostgreSQL database
// This script should be run after obtaining the Supabase database connection details

const GRAFANA_URL = 'http://localhost:3001';
const GRAFANA_API_KEY = process.env.GRAFANA_API_KEY; // You need to generate this in Grafana

// Supabase database connection details (you need to fill these in)
const SUPABASE_DB_HOST = process.env.SUPABASE_DB_HOST || 'YOUR_SUPABASE_PROJECT_REF.db.supabase.co';
const SUPABASE_DB_PORT = process.env.SUPABASE_DB_PORT || '5432';
const SUPABASE_DB_NAME = process.env.SUPABASE_DB_NAME || 'postgres';
const SUPABASE_DB_USER = process.env.SUPABASE_DB_USER || 'postgres';
const SUPABASE_DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD || 'YOUR_SUPABASE_DB_PASSWORD';

async function setupGrafanaDataSource() {
  if (!GRAFANA_API_KEY) {
    console.error('Please set the GRAFANA_API_KEY environment variable');
    process.exit(1);
  }

  const dataSource = {
    name: 'Supabase PostgreSQL',
    type: 'postgres',
    url: `${SUPABASE_DB_HOST}:${SUPABASE_DB_PORT}`,
    user: SUPABASE_DB_USER,
    password: SUPABASE_DB_PASSWORD,
    database: SUPABASE_DB_NAME,
    access: 'proxy',
    basicAuth: false,
    isDefault: true,
    jsonData: {
      sslmode: 'require',
      postgresVersion: 1500,
      timescaledb: false
    }
  };

  try {
    const response = await fetch(`${GRAFANA_URL}/api/datasources`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GRAFANA_API_KEY}`
      },
      body: JSON.stringify(dataSource)
    });

    if (response.ok) {
      console.log('Grafana data source created successfully');
      const result = await response.json();
      console.log('Data source ID:', result.datasource.uid);
    } else {
      const error = await response.text();
      console.error('Failed to create Grafana data source:', error);
    }
  } catch (error) {
    console.error('Error setting up Grafana data source:', error);
  }
}

// Run the setup
setupGrafanaDataSource();