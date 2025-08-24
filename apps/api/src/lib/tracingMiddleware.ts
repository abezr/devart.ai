import { Context, Next } from 'hono';
import { trace, Span, SpanKind, SpanStatusCode } from '@opentelemetry/api';

/**
 * Tracing middleware for Hono applications
 * Creates spans for incoming requests and captures relevant attributes
 */
export async function tracingMiddleware(c: Context, next: Next) {
  const tracer = trace.getTracer('hono-server');
  
  // Extract trace context from incoming request headers
  const span = tracer.startSpan(`HTTP ${c.req.method} ${c.req.path}`, {
    kind: SpanKind.SERVER,
    attributes: {
      'http.method': c.req.method,
      'http.url': c.req.url,
      'http.host': c.req.header('host') || '',
      'http.user_agent': c.req.header('user-agent') || '',
    },
  });

  // Set the span as the active span for the request
  return tracer.withSpan(span, async () => {
    try {
      // Process the request
      await next();
      
      // Capture response attributes
      const status = c.res.status;
      span.setAttribute('http.status_code', status);
      
      // Record error if status indicates one
      if (status >= 400) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: `HTTP Error ${status}`,
        });
      }
    } catch (error) {
      // Record exception in case of unhandled errors
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: (error as Error).message,
      });
      throw error;
    } finally {
      // End the span when the request is complete
      span.end();
    }
  });
}

/**
 * Sanitize headers to exclude sensitive information
 * @param headers Headers object to sanitize
 * @returns Sanitized headers object
 */
function sanitizeHeaders(headers: Headers): Record<string, string> {
  const sanitized: Record<string, string> = {};
  const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
  
  headers.forEach((value, key) => {
    if (!sensitiveHeaders.includes(key.toLowerCase())) {
      sanitized[key] = value;
    }
  });
  
  return sanitized;
}