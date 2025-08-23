# devart.ai Platform Productization Suite

This repository contains the complete implementation of the Platform Productization Suite for devart.ai, transforming the platform from a powerful engine into a polished, intuitive, and maintainable product.

## Overview

The Platform Productization Suite focuses on three key areas:

1. **User Authentication & Onboarding System** - Professional authentication flow with automatic user onboarding
2. **Developer Experience Enhancement** - Dedicated Python SDK and template repository for GenAI agent development
3. **Advanced Observability with Grafana** - Integrated monitoring and analytics with embedded dashboards

## Components

### 1. User Authentication & Onboarding System

#### Features
- Professional authentication flow using Supabase Auth UI
- Email and GitHub OAuth authentication providers
- Automatic user onboarding with PostgreSQL triggers
- Role-based access control (RBAC) with automatic role assignment
- Session management with proper timeouts and security settings
- Protected routes with automatic redirects

#### Key Files
- [apps/ui/src/app/login/page.tsx](file:///d:/study/ai/dev/devart.ai/apps/ui/src/app/login/page.tsx) - Dedicated login page
- [apps/ui/src/app/page.tsx](file:///d:/study/ai/dev/devart.ai/apps/ui/src/app/page.tsx) - Protected dashboard page
- [supabase/schema.sql](file:///d:/study/ai/dev/devart.ai/supabase/schema.sql) - Database schema with user_roles table and triggers

#### Configuration
- [SUPABASE_AUTH_INSTRUCTIONS.md](file:///d:/study/ai/dev/devart.ai/SUPABASE_AUTH_INSTRUCTIONS.md) - Detailed setup instructions
- Environment variables in `.env.local` file

#### Testing
- [test-user-onboarding.js](file:///d:/study/ai/dev/devart.ai/test-user-onboarding.js) - Tests PostgreSQL trigger activation
- [test-auth-flow.js](file:///d:/study/ai/dev/devart.ai/test-auth-flow.js) - Tests registration, login, and session management
- [test-protected-routes.js](file:///d:/study/ai/dev/devart.ai/test-protected-routes.js) - Tests protected route access
- [test-session-timeouts.js](file:///d:/study/ai/dev/devart.ai/test-session-timeouts.js) - Tests session timeout and security settings

### 2. Developer Experience Enhancement (Agent SDK & Template Repository)

#### Features
- Dedicated Python SDK for GenAI agent development
- Template repository for quick agent setup
- Core functionality for claiming tasks and updating status
- Error handling and logging
- Example implementation with work loop pattern

#### Key Files
- [devart-agent-template/sdk/agent_sdk.py](file:///d:/study/ai/devart.ai/devart-agent-template/sdk/agent_sdk.py) - Main SDK implementation
- [devart-agent-template/main.py](file:///d:/study/ai/devart.ai/devart-agent-template/main.py) - Example agent implementation
- [devart-agent-template/README.md](file:///d:/study/ai/devart.ai/devart-agent-template/README.md) - Comprehensive documentation
- [devart-agent-template/requirements.txt](file:///d:/study/ai/devart.ai/devart-agent-template/requirements.txt) - Dependencies

#### Usage
1. Use the template repository to create a new agent
2. Configure environment variables
3. Implement agent-specific logic in the work loop
4. Deploy the agent to process tasks

### 3. Advanced Observability with Grafana

#### Features
- Grafana instance deployed with Docker
- Connection to Supabase PostgreSQL database
- Embedded dashboards in the Next.js UI
- Key metrics panels for monitoring
- Proper CORS configuration for embedding

#### Key Files
- [apps/ui/src/components/GrafanaPanel.tsx](file:///d:/study/ai/devart.ai/apps/ui/src/components/GrafanaPanel.tsx) - Component for embedding panels
- [apps/ui/src/components/TaskAnalyticsPanel.tsx](file:///d:/study/ai/devart.ai/apps/ui/src/components/TaskAnalyticsPanel.tsx) - Updated analytics panel with dashboards tab
- [grafana-queries.sql](file:///d:/study/ai/devart.ai/grafana-queries.sql) - SQL queries for dashboard panels
- [setup-grafana-datasource.js](file:///d:/study/ai/devart.ai/setup-grafana-datasource.js) - Script to configure data source
- [setup-grafana-dashboards.js](file:///d:/study/ai/devart.ai/setup-grafana-dashboards.js) - Script to create dashboards

#### Dashboards
1. **Task Throughput** - Time series showing task processing rate
2. **Agent Status** - Pie chart showing distribution of agent statuses
3. **Average Task Cost** - Stat panel showing average cost per task

#### Configuration
- [GRAFANA_SETUP.md](file:///d:/study/ai/devart.ai/GRAFANA_SETUP.md) - Detailed setup instructions
- [GRAFANA_ENV.md](file:///d:/study/ai/devart.ai/GRAFANA_ENV.md) - Environment setup guide
- Environment variables in `.env` file

#### Testing
- [test-grafana-embedding.js](file:///d:/study/ai/devart.ai/test-grafana-embedding.js) - Tests embedding and CORS
- [test-grafana-iframe.html](file:///d:/study/ai/devart.ai/test-grafana-iframe.html) - HTML test for iframe embedding

## Getting Started

### Prerequisites
- Node.js and npm
- Python 3.7+
- Docker
- Supabase account
- GitHub account (for OAuth setup)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/devart.ai.git
   cd devart.ai
   ```

2. Install UI dependencies:
   ```bash
   cd apps/ui
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.local.example .env.local
   # Edit .env.local with your Supabase credentials
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Set up the agent template:
   ```bash
   cd ../..
   # Use the devart-agent-template as a template for new agents
   ```

6. Set up Grafana:
   ```bash
   docker run -d -p 3001:3000 --name=grafana grafana/grafana-oss
   # Follow instructions in GRAFANA_SETUP.md
   ```

## Testing

Run the various test scripts to verify the implementation:

```bash
# Test authentication
node test-user-onboarding.js
node test-auth-flow.js
node test-protected-routes.js
node test-session-timeouts.js

# Test Grafana
node test-grafana-embedding.js
```

## Deployment

### UI Application
1. Build the Next.js application:
   ```bash
   cd apps/ui
   npm run build
   ```

2. Deploy using your preferred hosting platform (Vercel, Netlify, etc.)

### Agent SDK
1. Distribute the SDK through PyPI or as a git submodule
2. Agents can be deployed to any platform that supports Python

### Grafana
1. Use Grafana Cloud for production or set up a dedicated server
2. Configure data sources and dashboards as described in the setup guides

## Security Considerations

- Keep all API keys and secrets in environment variables
- Use PKCE for enhanced OAuth security
- Regularly rotate secrets and keys
- Implement proper rate limiting
- Monitor authentication logs for suspicious activity

## Maintenance

- Regularly update dependencies
- Monitor Grafana dashboards for data accuracy
- Review and update documentation
- Test authentication flows periodically

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](file:///d:/study/ai/devart.ai/LICENSE) file for details.

## Acknowledgments

- Supabase for the authentication and database platform
- Grafana for the visualization tools
- Next.js for the React framework