import { SupabaseClient } from '@supabase/supabase-js';
import { Service, BudgetCheckResult } from '../lib/types';

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
  try {
    console.log(`Budget check: Charging ${chargeAmount} USD to service ${serviceId}`);

    // Use RPC call to PostgreSQL function for atomic transaction
    const { data, error } = await supabase.rpc('charge_service', {
      service_id_to_charge: serviceId,
      charge_amount: chargeAmount,
    });

    if (error) {
      console.error('RPC Error charging service:', error);
      return { 
        serviceToUse: null,
        wasSuspended: false,
        error: 'Database transaction failed: ' + error.message 
      };
    }

    if (!data) {
      console.warn(`Service ${serviceId} not found or budget exceeded with no substitutor`);
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
      return {
        serviceToUse: null,
        wasSuspended: false,
        error: procedureError
      };
    }

    if (serviceToUse) {
      console.log(`Budget check successful: Using service ${serviceToUse.id}`);
    }
    
    return { 
      serviceToUse: serviceToUse as Service | null, 
      wasSuspended: wasSuspended || false,
      error: null 
    };

  } catch (err) {
    console.error('Unexpected error in checkAndChargeService:', err);
    return { 
      serviceToUse: null,
      wasSuspended: false,
      error: 'Unexpected error during budget check.' 
    };
  }
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
  try {
    const { data, error } = await supabase
      .from('service_registry')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching services status:', error);
      return [];
    }

    return data as Service[] || [];

  } catch (err) {
    console.error('Unexpected error in getAllServicesStatus:', err);
    return [];
  }
}