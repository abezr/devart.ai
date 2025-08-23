import { Env } from '../index';

const OPENAI_EMBEDDING_MODEL = 'text-embedding-ada-002';
const OPENAI_API_URL = 'https://api.openai.com/v1/embeddings';

/**
 * Generate vector embedding for text using OpenAI API
 * 
 * @param env - Cloudflare environment variables containing OPENAI_API_KEY
 * @param text - Text content to generate embedding for
 * @returns Promise<number[] | null> - Vector embedding array or null if failed
 */
export async function generateEmbedding(env: Env, text: string): Promise<number[] | null> {
  if (!env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is not set in environment variables.');
    return null;
  }

  if (!text || text.trim().length === 0) {
    console.error('Text input is empty or invalid.');
    return null;
  }

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        input: text.trim(),
        model: OPENAI_EMBEDDING_MODEL,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API Error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });
      return null;
    }

    const { data } = await response.json();
    
    if (!data || !data[0] || !data[0].embedding) {
      console.error('Invalid response structure from OpenAI API');
      return null;
    }

    return data[0].embedding;
  } catch (error) {
    console.error('Failed to generate embedding:', error);
    return null;
  }
}

/**
 * Search for similar content in the knowledge base using semantic search
 * 
 * @param env - Cloudflare environment variables
 * @param query - Search query text
 * @param threshold - Similarity threshold (default: 0.7)
 * @param limit - Maximum number of results (default: 10)
 * @returns Promise<KnowledgeSearchResult[]> - Array of matching knowledge entries
 */
export interface KnowledgeSearchResult {
  id: string;
  content: string;
  source: string | null;
  similarity: number;
}

export async function searchKnowledge(
  env: Env,
  query: string,
  threshold: number = 0.7,
  limit: number = 10
): Promise<KnowledgeSearchResult[]> {
  // Generate embedding for the search query
  const queryEmbedding = await generateEmbedding(env, query);
  
  if (!queryEmbedding) {
    console.error('Failed to generate embedding for search query');
    return [];
  }

  // TODO: Implement database search using match_knowledge function
  // This will be implemented when the knowledge ingestion endpoint is created
  console.log('Search knowledge function called but database integration pending');
  return [];
}