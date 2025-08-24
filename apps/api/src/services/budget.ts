import { SupabaseClient } from '@supabase/supabase-js';
import { Service, BudgetCheckResult } from '../lib/types';
import { trace, SpanStatusCode } from '@opentelemetry/api';

/**
 * Budget Supervisor Service
 * Handles the core business logic for budget checking, charging, and service suspension.
 * 
 * This module provides atomic operations to prevent race conditions when multiple
 * requests attempt to charge the same service simultaneously.
 */

/**
 * Checks if a service has enough budget, charges it, and handles suspension.
 * Uses an atomic PostgreSQL function to ensure transaction safety.
 * 
 * @param supabase - An active Supabase client instance with service role privileges
 * @param serviceId - The ID of the service to charge (e.g., 'premium_llm')
 * @param chargeAmount - The cost of the operation in USD
 * @returns Promise resolving to service to use (original or substitutor) or null if none available
 */
export async function checkAndChargeService(
  supabase: SupabaseClient,
  serviceId: string,
  chargeAmount: number
): Promise<BudgetCheckResult> {
  const tracer = trace.getTracer('budget-service');
  
  return tracer.startActiveSpan('checkAndChargeService', {
    attributes: {
      'service.id': serviceId,
      'charge.amount': chargeAmount,
    }
  }, async (span) => {
    try {
      console.log(`Budget check: Charging ${chargeAmount} USD to service ${serviceId}`);

      // Use RPC call to PostgreSQL function for atomic transaction
      const { data, error } = await supabase.rpc('charge_service', {
        service_id_to_charge: serviceId,
        charge_amount: chargeAmount,
      });

      if (error) {
        console.error('RPC Error charging service:', error);
        span.recordException(error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: 'Database transaction failed: ' + error.message
        });
        
        return { 
          serviceToUse: null,
          wasSuspended: false,
          error: 'Database transaction failed: ' + error.message 
        };
      }

      if (!data) {
        console.warn(`Service ${serviceId} not found or budget exceeded with no substitutor`);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: `Service '${serviceId}' not found or budget exceeded.`
        });
        
        return { 
          serviceToUse: null,
          wasSuspended: false,
          error: `Service '${serviceId}' not found or budget exceeded.` 
        };
      }

      // The RPC function now returns a JSON object with serviceToUse and wasSuspended
      const { serviceToUse, wasSuspended, error: procedureError } = data;

      if (procedureError) {
        console.error('Procedure error:', procedureError);
        span.recordException(new Error(procedureError));
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: procedureError
        });
        
        return {
          serviceToUse: null,
          wasSuspended: false,
          error: procedureError
        };
      }

      if (serviceToUse) {
        console.log(`Budget check successful: Using service ${serviceToUse.id}`);
        span.setAttribute('service.substituted', !!serviceToUse && serviceToUse.id !== serviceId);
      }
      
      span.setAttribute('service.wasSuspended', wasSuspended || false);
      
      return { 
        serviceToUse: serviceToUse as Service | null, 
        wasSuspended: wasSuspended || false,
        error: null 
      };

    } catch (err) {
      console.error('Unexpected error in checkAndChargeService:', err);
      span.recordException(err as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: 'Unexpected error during budget check.'
      });
      
      return { 
        serviceToUse: null,
        wasSuspended: false,
        error: 'Unexpected error during budget check.' 
      };
    } finally {
      span.end();
    }
  });
}

/**
 * Gets the current status of all services for monitoring purposes.
 * This is a read-only operation that doesn't modify any budgets.
 * 
 * @param supabase - An active Supabase client instance
 * @returns Promise resolving to array of all services with their current status
 */
export async function getAllServicesStatus(
  supabase: SupabaseClient
): Promise<Service[]> {
  const tracer = trace.getTracer('budget-service');
  
  return tracer.startActiveSpan('getAllServicesStatus', async (span) => {
    try {
      const { data, error } = await supabase
        .from('service_registry')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching services status:', error);
        span.recordException(error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message
        });
        return [];
      }

      span.setAttribute('services.count', data?.length || 0);
      return data as Service[] || [];

    } catch (err) {
      console.error('Unexpected error in getAllServicesStatus:', err);
      span.recordException(err as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: 'Unexpected error fetching services status'
      });
      return [];
    } finally {
      span.end();
    }
  });
}