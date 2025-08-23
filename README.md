# devart.ai - Autonomous AI Development Hub

Welcome to `devart.ai`, a serverless control plane for supervising and managing an AI-powered coding team. This platform provides a central dashboard for status, roadmaps, and quality metrics, with a powerful, budget-aware backend to orchestrate GenAI agents.

This project is built on a modern, free-tier-friendly stack designed for rapid development and zero operational overhead.

## ✨ Features

-   **Live Dashboard:** Real-time status of agents, tasks, and quality metrics.
-   **Budget Supervisor:** Enforce spending limits on external services (e.g., LLM APIs), suspend usage, and require manual approval for increases.
-   **Pluggable Services:** A control plane/execution plane architecture that allows you to use services from any cloud provider's free tier.
-   **Quality Gate:** Automatically handle CI/CD results and trigger agent-led regression fixes.
-   **Quarantine Queue:** Isolate tasks that require manual human intervention.
-   **Dynamic Prompts:** Manage and tune agent prompts from a central location.
-   **Telegram Notifications:** Subscribe to critical events like budget warnings and build failures.

## 🏛️ Architecture Overview

-   **Frontend (UI):** [Next.js](https://nextjs.org/) (React) hosted on [Cloudflare Pages](https://pages.cloudflare.com/).
-   **Backend (API):** [Hono](https://hono.dev/) on [Cloudflare Workers](https://workers.cloudflare.com/).
-   **Database & Realtime:** [Supabase](https://supabase.com/) (Postgres).
-   **Package Management:** [pnpm](https://pnpm.io/) Workspaces (Monorepo).

## 🚀 Getting Started

Follow these steps to get your `devart.ai` instance up and running.

### 1. Prerequisites

-   [Git](https://git-scm.com/) installed.
-   [Node.js](https://nodejs.org/) (v18+).
-   [pnpm](https://pnpm.io/installation) installed (`npm install -g pnpm`).
-   A [Cloudflare](https://dash.cloudflare.com/sign-up) account (free).
-   A [Supabase](https://app.supabase.com/) account (free).
-   A [GitHub](https://github.com/) account.

### 2. Initial Setup

#### a. Initialize Your Git Repository

After creating the files from the provided archive:

```bash
# Navigate to your project root
cd devart.ai

# Initialize git
git init -b main
git add .
git commit -m "Initial commit: project structure and boilerplate"

# Create a new repository on GitHub named "devart.ai"
# Then, link your local repo to the remote
git remote add origin https://github.com/YOUR_USERNAME/devart.ai.git
git push -u origin main
```

#### b. Set up Supabase

1. Go to your [Supabase Dashboard](https://app.supabase.com/) and create a new project.
2. Navigate to the **SQL Editor** and run the contents of `supabase/schema.sql` to create the necessary tables.
3. Go to **Database** → **Replication**. Ensure `supabase_realtime` is enabled and enable it for the `tasks` and `service_registry` tables.
4. Go to **Project Settings** → **API**. Find your **Project URL** and your `anon` and `service_role` **Project API Keys**. You will need these for the next step.

#### c. Set up Cloudflare

1. Install the Cloudflare CLI, Wrangler: `pnpm add -g wrangler`.
2. Log in to your Cloudflare account: `wrangler login`.

### 3. Local Installation & Configuration

#### API Configuration:
1. In the `apps/api` directory, rename `.env.example` to `.env`.
2. Fill in your Supabase URL and service_role key.

#### UI Configuration:
1. In the `apps/ui` directory, rename `.env.local.example` to `.env.local`.
2. Fill in your Supabase URL and anon key.

#### Install Dependencies:
From the root of the devart.ai project, run:
```bash
pnpm install
```

### 4. Running in Development Mode

This command will start the Next.js UI and the Cloudflare Worker API concurrently.

```bash
# From the root of the project
pnpm dev
```

- The UI will be available at http://localhost:3000.
- The API will be available at http://localhost:8787.

### 5. Publishing & Deployment

#### a. Deploy the API to Cloudflare Workers

1. Navigate to the API directory: `cd apps/api`.
2. Set your Supabase secrets so they are available in production:
   ```bash
   wrangler secret put SUPABASE_URL
   # (Paste your Supabase URL when prompted)

   wrangler secret put SUPABASE_SERVICE_KEY
   # (Paste your Supabase service_role key when prompted)
   ```
3. Deploy the worker:
   ```bash
   pnpm deploy
   ```
   Wrangler will give you a production URL for your API (e.g., `https://api.your-worker.workers.dev`).

#### b. Deploy the UI to Cloudflare Pages

1. Push your latest code to your GitHub repository.
2. In the Cloudflare dashboard, go to **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**.
3. Select your `devart.ai` GitHub repository.
4. Configure the build settings:
   - **Framework preset:** Next.js
   - **Root directory:** `apps/ui`
   - **Build command:** `pnpm next build`
5. Under **Environment variables**, add your public Supabase keys:
   - `NEXT_PUBLIC_SUPABASE_URL` = (Your Supabase URL)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (Your Supabase anon key)
6. Click **Save and Deploy**. Cloudflare will build and deploy your site.

You now have a live, globally distributed application!

## 📂 Project Structure

```
devart.ai/
├── apps/
│   ├── api/          # Cloudflare Worker backend
│   │   ├── src/
│   │   │   └── index.ts
│   │   ├── .env.example
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── wrangler.toml
│   └── ui/           # Next.js frontend
│       ├── src/
│       │   └── app/
│       │       ├── layout.tsx
│       │       ├── page.tsx
│       │       └── globals.css
│       ├── .env.local.example
│       ├── next.config.mjs
│       ├── package.json
│       ├── postcss.config.js
│       ├── tailwind.config.ts
│       └── tsconfig.json
├── supabase/
│   └── schema.sql
├── .gitignore
├── LICENSE
├── README.md
├── package.json
└── pnpm-workspace.yaml
```

- **apps/api**: The Cloudflare Worker backend. All business logic, budget controls, and webhook processing happens here.
- **apps/ui**: The Next.js frontend dashboard.
- **supabase/**: Contains SQL schemas for your database.
- **pnpm-workspace.yaml**: Defines the monorepo structure for pnpm.

## 🛠️ Development Workflow

### Adding New Features

1. **Backend Changes**: Edit files in `apps/api/src/`
2. **Frontend Changes**: Edit files in `apps/ui/src/`
3. **Database Changes**: Add migrations to `supabase/`

### Testing Locally

```bash
# Start both UI and API in development mode
pnpm dev

# Test API endpoints
curl http://localhost:8787/api/tasks

# View UI dashboard
open http://localhost:3000
```

### Deploying Changes

```bash
# Deploy API updates
cd apps/api && pnpm deploy

# Deploy UI updates (push to GitHub - Cloudflare Pages auto-deploys)
git add . && git commit -m "Update features" && git push
```

## 🔧 Configuration

### Environment Variables

#### API (.env)
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
```

#### UI (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Budget Control

The platform includes built-in budget supervision:

1. **Service Registry**: Configure LLM services and their monthly budgets
2. **Auto-Suspension**: Services are automatically suspended when budgets are exceeded
3. **Fallback Services**: Configure free-tier alternatives (e.g., Groq) as fallbacks
4. **Manual Approval**: Require human approval for budget increases

### Real-time Features

- **Task Updates**: Live updates when tasks change status
- **Budget Alerts**: Real-time notifications when budgets are exceeded
- **Service Status**: Live monitoring of service health and usage

## 📊 Key Components

### Budget Supervisor
- Tracks spending across all configured services
- Automatically suspends services when budgets are exceeded
- Provides fallback service routing
- Sends alerts for budget violations

### Task Orchestrator
- Manages task lifecycle from creation to completion
- Routes tasks to appropriate services based on budget and availability
- Handles quarantine queue for tasks requiring manual intervention

### Quality Gate
- Processes CI/CD webhooks
- Automatically creates regression fix tasks
- Integrates with build systems for automated quality checks

## 🔗 External Integrations

### LLM Services
- OpenAI GPT-4 (premium tier)
- Groq (free tier alternative)
- Configurable via service registry

### Notifications
- Telegram bot for critical alerts
- Webhook support for custom integrations

### CI/CD
- GitHub Actions
- GitLab CI
- Generic webhook support

## 🐛 Troubleshooting

### Common Issues

**Build Failures**:
- Ensure all environment variables are set correctly
- Check that Supabase tables are created and realtime is enabled
- Verify Cloudflare account ID is set in wrangler.toml

**API Connection Issues**:
- Confirm CORS origins include your UI domain
- Check that Supabase service key has proper permissions
- Verify Cloudflare Worker is deployed successfully

**UI Deployment Issues**:
- Ensure build command uses correct package manager (pnpm)
- Check that environment variables are set in Cloudflare Pages
- Verify root directory is set to `apps/ui`

### Getting Help

1. Check the [GitHub Issues](https://github.com/YOUR_USERNAME/devart.ai/issues)
2. Review the [Supabase Documentation](https://supabase.com/docs)
3. Consult [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)

## 🚦 Next Steps

Once you have the basic setup running:

1. **Configure Services**: Add your LLM API keys and set budgets
2. **Setup Notifications**: Connect Telegram bot for alerts
3. **Integrate CI/CD**: Add webhook endpoints to your build pipeline
4. **Customize Dashboard**: Modify UI components to match your needs
5. **Add Authentication**: Implement user login and role-based access

## ⚖️ License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines for more information.

---

**Built with ❤️ for the AI development community**