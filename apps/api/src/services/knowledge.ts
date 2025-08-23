import { Env } from '../index';
import { createSupabaseClient } from '../lib/supabase';
import { generateEmbedding } from './embedding';

export interface KnowledgeSearchResult {
  id: string;
  content: string;
  source: string | null;
  similarity: number;
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

  try {
    const supabase = createSupabaseClient(env);
    
    // Call the match_knowledge function in Supabase
    const { data, error } = await supabase.rpc('match_knowledge', {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: limit
    });

    if (error) {
      console.error('Error searching knowledge base:', error);
      return [];
    }

    // Map the results to the expected format
    return (data || []).map((item: any) => ({
      id: item.id,
      content: item.content,
      source: item.source,
      similarity: item.similarity
    }));
  } catch (error) {
    console.error('Failed to search knowledge base:', error);
    return [];
  }
}