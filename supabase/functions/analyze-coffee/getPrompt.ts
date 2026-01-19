import { createClient } from "npm:@supabase/supabase-js@2"

// Cache prompts for 5 minutes to reduce DB calls
const promptCache: Map<string, { content: string; timestamp: number }> = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getPrompt(
  supabase: ReturnType<typeof createClient>,
  key: 'vision' | 'arina' | 'cassandra',
  fallback: string
): Promise<string> {
  // Check cache
  const cached = promptCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.content;
  }

  try {
    const { data, error } = await supabase
      .from('prompts')
      .select('content')
      .eq('key', key)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      console.warn(`Prompt '${key}' not found in DB, using fallback`);
      return fallback;
    }

    // Update cache
    promptCache.set(key, { content: data.content, timestamp: Date.now() });
    return data.content;
  } catch (err) {
    console.error(`Error fetching prompt '${key}':`, err);
    return fallback;
  }
}
