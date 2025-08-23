/**
 * Shared TypeScript interfaces for the devart.ai Budget Supervisor System
 * These types match the database schema defined in supabase/schema.sql
 */

export interface Service {
  id: string;
  display_name: string;
  api_endpoint: string;
  monthly_budget_usd: number;
  current_usage_usd: number;
  status: 'ACTIVE' | 'SUSPENDED';
  substitutor_service_id: string | null;
  created_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'QUARANTINED' | 'PENDING_BUDGET_APPROVAL';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  agent_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  telegram_chat_id: string;
  event_type: string;
  created_at: string;
}

// Type for the Budget Supervisor response
export interface BudgetCheckResult {
  serviceToUse: Service | null;
  error: string | null;
}