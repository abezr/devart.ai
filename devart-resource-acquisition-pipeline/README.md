# Autonomous Resource Acquisition and Integration System

This directory contains the implementation of the Autonomous Resource Acquisition and Integration System for devart.ai. The system implements a multi-stage pipeline that discovers opportunities from external sources, processes and analyzes them, and automatically integrates valuable resources into the platform.

## System Components

1. **Scout Agent**: Monitors external sources (RSS feeds, websites) for new opportunities
2. **Parser Agent**: Extracts clean text content from raw HTML
3. **Classifier Agent**: Determines the type of opportunity (Free Tier, Trial, Partnership Lead)
4. **Analysis Agent**: Extracts structured information about opportunities
5. **Partnership Agent**: Handles outreach and registration with human-in-the-loop approval
6. **Integration Planner Agent**: Creates engineering tasks for integrating new services

## Architecture

The system follows a message-driven architecture using RabbitMQ as the messaging backbone. The pipeline consists of specialized agents that work together through a series of queues to process opportunities from discovery to integration.

```mermaid
graph TD
    subgraph "Phase 1: Discovery"
        A[News Feeds, Blogs, etc.] --> B[Scout Agent];
        B -- "Raw News Item" --> C(RabbitMQ: raw_news_queue);
    end

    subgraph "Phase 2: Processing Pipeline"
        C --> D[Parser Agent];
        D -- "Parsed Content" --> E(RabbitMQ: parsed_news_queue);
        E --> F[Classifier Agent <br/>(Type: Free Tier, Trial, Partnership)];
        F -- "Classified Opportunity" --> G(RabbitMQ: classified_ops_queue);
        G --> H[Analysis Agent <br/>(Value, Provider Info)];
        H -- "Analyzed Opportunity" --> I[Database: opportunities table];
    end

    subgraph "Phase 3: Action & Integration"
        I -- "New Opportunity" --> J(RabbitMQ: new_opportunity_queue);
        J --> K[Partnership Agent];
        K -- "Needs Approval?" --> L{Supervisor UI};
        L -- "Approved" --> K;
        K -- "Partnership Secured" --> M(RabbitMQ: integration_planning_queue);
        M --> N[Integration Planner Agent];
        N -- "Creates Engineering Tasks" --> O[devart.ai Task Queue];
    end
```

## Setup and Installation

### Prerequisites

1. Python 3.9 or higher
2. RabbitMQ server
3. Supabase account
4. OpenAI API key
5. devart.ai API access

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd devart-resource-acquisition-pipeline
   ```

2. Install the required dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your actual configuration
   ```

4. Set up RabbitMQ exchanges and queues:
   ```bash
   python setup_rabbitmq.py
   ```

### Running the Agents

You can run each agent individually or use Docker Compose to run all agents simultaneously.

#### Running Individually

```bash
# Run each agent in a separate terminal
python scout_agent.py
python parser_agent.py
python classifier_agent.py
python analysis_agent.py
python partnership_agent.py
python integration_planner_agent.py
```

#### Running with Docker Compose

```bash
# Build and start all services
docker-compose up --build
```

## Configuration

The agents are configured using environment variables. See [.env.example](.env.example) for all required variables.

## Data Models

### Opportunities Table

```sql
CREATE TABLE opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url TEXT NOT NULL,
  provider_name TEXT,
  opportunity_type TEXT, -- 'FREE_TIER', 'TRIAL', 'PARTNERSHIP_LEAD', 'SURVEY'
  summary TEXT,
  extracted_attributes JSONB, -- Key features, limits, contact info, etc.
  status TEXT NOT NULL DEFAULT 'DISCOVERED', -- 'DISCOVERED', 'ANALYZED', 'CONTACTED', 'SECURED', 'INTEGRATED'
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);
```

### Queue Topology

| Queue Name | Purpose |
|------------|---------|
| raw_news_queue | Stores raw news items from Scout Agent |
| parsed_news_queue | Stores parsed content from Parser Agent |
| classified_ops_queue | Stores classified opportunities from Classifier Agent |
| new_opportunity_queue | Stores newly analyzed opportunities |
| integration_planning_queue | Stores secured opportunities ready for integration |

## Security Considerations

1. **API Key Storage**: All API keys must be stored securely using encryption
2. **Rate Limiting**: Respect robots.txt and implement polite scraping
3. **Authentication**: All API calls to devart.ai must be properly authenticated
4. **Approval Workflow**: Critical actions require human approval
5. **Audit Trail**: All actions are logged for auditing purposes

## Monitoring and Observability

1. **OpenTelemetry Integration**: All agents instrumented with OpenTelemetry
2. **Health Checks**: Regular health checks for all agents
3. **Error Tracking**: Centralized error tracking and alerting
4. **Performance Metrics**: Track processing times and throughput
5. **Queue Monitoring**: Monitor queue depths and processing rates