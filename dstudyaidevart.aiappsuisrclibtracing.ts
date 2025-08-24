import { trace, SpanStatusCode } from '@opentelemetry/api';

/**
 * Tracing utility functions for React components
 */

/**
 * Start a span for a user interaction
 * @param name Name of the span
 * @param attributes Attributes to add to the span
 * @returns The created span
 */
export function startUserInteractionSpan(name: string, attributes: Record<string, any> = {}) {
  const tracer = trace.getTracer('frontend-react');
  const span = tracer.startSpan(name, {
    attributes: {
      'component.type': 'user-interaction',
      ...attributes
    }
  });
  
  return span;
}

/**
 * End a span and optionally record an error
 * @param span The span to end
 * @param error Optional error to record
 */
export function endUserInteractionSpan(span: any, error?: Error) {
  if (error) {
    span.recordException(error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message
    });
  }
  
  span.end();
}

/**
 * Wrap a function with a tracing span
 * @param name Name of the span
 * @param fn Function to wrap
 * @param attributes Attributes to add to the span
 * @returns Wrapped function
 */
export function withTracingSpan<T extends (...args: any[]) => any>(
  name: string,
  fn: T,
  attributes: Record<string, any> = {}
): T {
  return function(...args: any[]) {
    const span = startUserInteractionSpan(name, attributes);
    
    try {
      const result = fn.apply(this, args);
      
      // If the function returns a promise, end the span when it resolves or rejects
      if (result instanceof Promise) {
        return result
          .then((resolvedResult) => {
            span.end();
            return resolvedResult;
          })
          .catch((error) => {
            span.recordException(error);
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: error.message
            });
            span.end();
            throw error;
          });
      }
      
      // For synchronous functions, end the span immediately
      span.end();
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: (error as Error).message
      });
      span.end();
      throw error;
    }
  } as T;
}
