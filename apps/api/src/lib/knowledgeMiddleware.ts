import { Context } from 'hono';

// In-memory store for rate limiting (in production, use Redis or similar)
const rateLimitStore: Map<string, { count: number; resetTime: number }> = new Map();

// Rate limiting middleware for knowledge base queries
export async function rateLimitKnowledgeQueries(c: Context, next: () => Promise<void>) {
  const agentId = c.req.header('Authorization')?.replace('Bearer ', '');
  
  if (!agentId) {
    return c.json({ error: 'Authorization header is required' }, 401);
  }

  const now = Date.now();
  const windowMs = 60000; // 1 minute window
  const maxRequests = 10; // 10 requests per minute

  const key = `kb:${agentId}`;
  const record = rateLimitStore.get(key);

  if (!record || record.resetTime < now) {
    // First request or window has expired, reset the counter
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
  } else if (record.count >= maxRequests) {
    // Rate limit exceeded
    return c.json({ error: 'Rate limit exceeded. Try again later.' }, 429);
  } else {
    // Increment the counter
    rateLimitStore.set(key, { count: record.count + 1, resetTime: record.resetTime });
  }

  await next();
}

// Validation middleware for knowledge base search requests
export async function validateKnowledgeSearchRequest(c: Context, next: () => Promise<void>) {
  const { query, threshold, limit } = await c.req.json();

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return c.json({ error: 'Query is required and must be a non-empty string' }, 400);
  }

  if (threshold !== undefined && (typeof threshold !== 'number' || threshold < 0 || threshold > 1)) {
    return c.json({ error: 'Threshold must be a number between 0 and 1' }, 400);
  }

  if (limit !== undefined && (typeof limit !== 'number' || limit < 1 || limit > 100)) {
    return c.json({ error: 'Limit must be a number between 1 and 100' }, 400);
  }

  await next();
}