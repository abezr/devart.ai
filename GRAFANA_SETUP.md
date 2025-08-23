# Grafana Setup with Supabase

This document provides instructions on how to set up Grafana with Supabase for monitoring and observability.

## Prerequisites

1. Grafana instance running (already set up via Docker)
2. Supabase project with database access
3. Node.js installed

## Steps to Set Up Grafana with Supabase

### 1. Get Supabase Database Connection Details

1. Log in to your Supabase project dashboard
2. Navigate to "Settings" > "Database"
3. Note down the following details:
   - Host (e.g., `your-project-ref.db.supabase.co`)
   - Port (usually `5432`)
   - Database name (usually `postgres`)
   - User (usually `postgres`)
   - Password (from "Settings" > "Database" > "Connection Pooling")

### 2. Generate Grafana API Key

1. Access Grafana at `http://localhost:3001`
2. Log in with default credentials (admin/admin, then change password)
3. Navigate to "Configuration" (gear icon) > "API Keys"
4. Click "Add API Key"
5. Set:
   - Name: `devart-setup`
   - Role: `Admin`
   - Time to live: `1h`
6. Click "Add" and save the generated API key

### 3. Set Environment Variables

Create a `.env` file in the project root with the following variables:

```bash
GRAFANA_API_KEY=your_grafana_api_key
SUPABASE_DB_HOST=your_supabase_project_ref.db.supabase.co
SUPABASE_DB_PORT=5432
SUPABASE_DB_NAME=postgres
SUPABASE_DB_USER=postgres
SUPABASE_DB_PASSWORD=your_supabase_db_password
```

### 4. Set Up Data Source

Run the data source setup script:

```bash
node setup-grafana-datasource.js
```

### 5. Set Up Dashboards

Run the dashboard setup script:

```bash
node setup-grafana-dashboards.js
```

## Configure Grafana for Embedding

To enable embedding of Grafana panels in the Next.js application:

1. Access Grafana
2. Navigate to "Configuration" (gear icon) > "Settings"
3. Under "Security", find "Allow embedding" and enable it
4. Save the changes

## Testing the Setup

1. Verify the data source connection in Grafana:
   - Navigate to "Configuration" > "Data Sources"
   - Click on "Supabase PostgreSQL"
   - Click "Save & Test"

2. Check the dashboards:
   - Navigate to "Dashboards" > "Manage"
   - Open the "devart.ai Analytics" dashboard
   - Verify that all panels are displaying data

3. Test embedded panels in the Next.js application:
   - Start the Next.js development server
   - Navigate to the dashboard page
   - Switch to the "Dashboards" tab
   - Verify that all embedded panels are loading correctly

## Troubleshooting

### CORS Issues

If you encounter CORS issues with embedded panels:

1. In Grafana, navigate to "Configuration" > "Settings"
2. Under "Security", ensure "Allow embedding" is enabled
3. Check that the "domain" setting includes your Next.js application domain

### Data Source Connection Issues

If the data source connection fails:

1. Verify all connection details are correct
2. Ensure the Supabase database password is correct
3. Check that there are no firewall restrictions
4. Verify that the Supabase project is not paused

### No Data in Panels

If panels show no data:

1. Verify that there is data in the Supabase tables
2. Check the SQL queries in the panel configurations
3. Ensure the time range is set correctly