# Grafana Environment Setup

This document provides detailed instructions for setting up the Grafana environment for the devart.ai platform.

## Prerequisites

Before setting up Grafana, ensure you have:

1. Docker installed on your system
2. A Supabase account with a project created
3. Node.js and npm installed
4. Access to the devart.ai codebase

## Grafana Setup

### 1. Starting Grafana with Docker

Grafana is already configured to run using Docker. To start the Grafana container:

```bash
# Navigate to the project root
cd devart.ai

# Start the Grafana container using the existing docker-compose.yml or docker command
docker run -d -p 3001:3000 --name=grafana grafana/grafana-oss
```

The Grafana instance will be available at `http://localhost:3001`.

### 2. Initial Grafana Configuration

1. Access Grafana at `http://localhost:3001`
2. Log in with default credentials:
   - Username: `admin`
   - Password: `admin`
3. Change the password when prompted

### 3. Generating Grafana API Key

To automate the setup process, you'll need to generate an API key:

1. In Grafana, click on the gear icon (Configuration) in the left sidebar
2. Select "API Keys" from the menu
3. Click "Add API Key"
4. Fill in the form:
   - Key name: `devart-setup`
   - Role: `Admin`
   - Time to live: `1h` (or as needed)
5. Click "Add"
6. Save the generated API key securely

### 4. Getting Supabase Database Connection Details

To connect Grafana to your Supabase database, you'll need the following information from your Supabase project:

1. Log in to your Supabase dashboard
2. Select your project
3. Navigate to "Settings" > "Database"
4. Note down:
   - Host (e.g., `your-project-ref.db.supabase.co`)
   - Port (usually `5432`)
   - Database name (usually `postgres`)
   - User (usually `postgres`)
5. For the password:
   - Navigate to "Settings" > "Database" > "Connection Pooling"
   - Use the password shown there

### 5. Environment Configuration

Create a `.env` file in the project root with the following variables:

```bash
# Grafana configuration
GRAFANA_API_KEY=your_grafana_api_key_here
GRAFANA_URL=http://localhost:3001

# Supabase database connection
SUPABASE_DB_HOST=your_supabase_project_ref.db.supabase.co
SUPABASE_DB_PORT=5432
SUPABASE_DB_NAME=postgres
SUPABASE_DB_USER=postgres
SUPABASE_DB_PASSWORD=your_supabase_db_password_here

# Next.js application (for CORS configuration)
NEXT_APP_URL=http://localhost:3000
```

### 6. Running the Setup Scripts

With the environment configured, you can now run the automated setup scripts:

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up the data source:
   ```bash
   node setup-grafana-datasource.js
   ```

3. Set up the dashboards:
   ```bash
   node setup-grafana-dashboards.js
   ```

### 7. Enabling Embedding

To enable embedding of Grafana panels in the Next.js application:

1. In Grafana, navigate to "Configuration" (gear icon) > "Settings"
2. Scroll down to the "Security" section
3. Enable "Allow embedding"
4. Save the changes

### 8. Testing the Setup

To verify that everything is working correctly:

1. Run the test script:
   ```bash
   node test-grafana-embedding.js
   ```

2. Open the test HTML file in a browser:
   ```bash
   open test-grafana-iframe.html
   ```

3. Start the Next.js application and navigate to the dashboard:
   ```bash
   cd apps/ui
   npm run dev
   ```
   Then visit `http://localhost:3000` and check the Dashboards tab.

## Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure "Allow embedding" is enabled in Grafana settings and that the origin is correctly configured.

2. **Data Source Connection Failures**: 
   - Verify all Supabase connection details are correct
   - Check that the Supabase project is not paused
   - Ensure there are no firewall restrictions

3. **Dashboard Panels Showing No Data**:
   - Verify that there is data in the Supabase tables
   - Check the time range settings in the panels
   - Confirm the SQL queries are correct

4. **Authentication Issues**:
   - Ensure the Grafana API key has the correct permissions
   - Check that the API key has not expired

### Logs and Monitoring

- Grafana logs can be viewed with:
  ```bash
  docker logs grafana
  ```

- Application logs for the setup scripts will be displayed in the terminal when running the scripts.

## Security Considerations

1. **API Keys**: Never commit API keys to version control. Use environment variables instead.

2. **Database Credentials**: Protect database credentials and limit database permissions to only what is necessary.

3. **Embedding**: Only enable embedding if necessary, and restrict the allowed origins to trusted domains.

4. **Network Security**: In production, ensure that Grafana is properly secured with SSL and appropriate access controls.

## Maintenance

Regular maintenance tasks include:

1. **Updating Grafana**: Keep Grafana updated to the latest stable version:
   ```bash
   docker pull grafana/grafana-oss
   ```

2. **Monitoring Data Sources**: Regularly check data source connections and refresh them if needed.

3. **Backup Dashboards**: Export important dashboards regularly:
   - In Grafana, navigate to the dashboard
   - Click "Share" > "Export" to download the JSON

4. **Reviewing Access**: Periodically review API keys and user access to ensure security.