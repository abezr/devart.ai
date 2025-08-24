import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Env } from '../index';
import { trace, SpanStatusCode } from '@opentelemetry/api';

/**
 * Creates a new Supabase client instance for each request.
 * This is the recommended pattern for serverless environments like Cloudflare Workers.
 * 
 * @param env - The environment context containing Supabase credentials
 * @returns A configured Supabase client with service role privileges
 */
export const createSupabaseClient = (env: Env): SupabaseClient => {
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  
  // Wrap the client methods with tracing
  const originalFrom = client.from;
  client.from = function(table: string) {
    const tracer = trace.getTracer('supabase-client');
    const span = tracer.startSpan(`supabase.query.${table}`, {
      attributes: {
        'db.system': 'postgresql',
        'db.name': 'supabase',
        'db.table': table,
      }
    });
    
    const result = originalFrom.call(this, table);
    
    // Wrap the select method
    const originalSelect = result.select;
    result.select = function(...args: any[]) {
      span.setAttribute('db.operation', 'select');
      span.setAttribute('db.statement', `SELECT FROM ${table}`);
      try {
        const selectResult = originalSelect.apply(this, args);
        span.end();
        return selectResult;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: (error as Error).message,
        });
        span.end();
        throw error;
      }
    };
    
    // Wrap the insert method
    const originalInsert = result.insert;
    result.insert = function(...args: any[]) {
      span.setAttribute('db.operation', 'insert');
      span.setAttribute('db.statement', `INSERT INTO ${table}`);
      try {
        const insertResult = originalInsert.apply(this, args);
        span.end();
        return insertResult;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: (error as Error).message,
        });
        span.end();
        throw error;
      }
    };
    
    // Wrap the update method
    const originalUpdate = result.update;
    result.update = function(...args: any[]) {
      span.setAttribute('db.operation', 'update');
      span.setAttribute('db.statement', `UPDATE ${table}`);
      try {
        const updateResult = originalUpdate.apply(this, args);
        span.end();
        return updateResult;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: (error as Error).message,
        });
        span.end();
        throw error;
      }
    };
    
    // Wrap the delete method
    const originalDelete = result.delete;
    result.delete = function(...args: any[]) {
      span.setAttribute('db.operation', 'delete');
      span.setAttribute('db.statement', `DELETE FROM ${table}`);
      try {
        const deleteResult = originalDelete.apply(this, args);
        span.end();
        return deleteResult;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: (error as Error).message,
        });
        span.end();
        throw error;
      }
    };
    
    // Wrap the rpc method
    const originalRpc = client.rpc;
    client.rpc = function(fn: string, params?: any) {
      const rpcSpan = tracer.startSpan(`supabase.rpc.${fn}`, {
        attributes: {
          'db.system': 'postgresql',
          'db.name': 'supabase',
          'db.operation': 'rpc',
          'db.statement': `CALL ${fn}`,
        }
      });
      
      try {
        const rpcResult = originalRpc.call(this, fn, params);
        rpcSpan.end();
        return rpcResult;
      } catch (error) {
        rpcSpan.recordException(error as Error);
        rpcSpan.setStatus({
          code: SpanStatusCode.ERROR,
          message: (error as Error).message,
        });
        rpcSpan.end();
        throw error;
      }
    };
    
    return result;
  };
  
  return client;
};