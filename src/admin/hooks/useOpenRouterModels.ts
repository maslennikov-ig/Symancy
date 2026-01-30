import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

export interface OpenRouterModel {
  id: string;
  name: string;
  provider: string;
  shortName: string;
  pricing: {
    prompt: number;
    completion: number;
  };
  contextLength: number;
  isModerated: boolean;
  modality: string;
}

interface OpenRouterModelsResponse {
  models: OpenRouterModel[];
  count: number;
  timestamp: string;
}

// Fallback models when API fails
const FALLBACK_MODELS: OpenRouterModel[] = [
  { id: 'xiaomi/mimo-v2-flash', name: 'Xiaomi MiMo v2 Flash', provider: 'xiaomi', shortName: 'mimo-v2-flash', pricing: { prompt: 0.01, completion: 0.01 }, contextLength: 128000, isModerated: false, modality: 'text' },
  { id: 'moonshotai/kimi-k2', name: 'Moonshot Kimi K2', provider: 'moonshotai', shortName: 'kimi-k2', pricing: { prompt: 0.6, completion: 2.4 }, contextLength: 131072, isModerated: false, modality: 'text' },
  { id: 'google/gemini-1.5-flash', name: 'Google Gemini 1.5 Flash', provider: 'google', shortName: 'gemini-1.5-flash', pricing: { prompt: 0.075, completion: 0.3 }, contextLength: 1000000, isModerated: true, modality: 'text' },
  { id: 'google/gemini-1.5-pro', name: 'Google Gemini 1.5 Pro', provider: 'google', shortName: 'gemini-1.5-pro', pricing: { prompt: 1.25, completion: 5.0 }, contextLength: 2000000, isModerated: true, modality: 'text' },
  { id: 'google/gemini-2.0-flash', name: 'Google Gemini 2.0 Flash', provider: 'google', shortName: 'gemini-2.0-flash', pricing: { prompt: 0.1, completion: 0.4 }, contextLength: 1048576, isModerated: true, modality: 'text' },
  { id: 'anthropic/claude-3-5-sonnet', name: 'Anthropic Claude 3.5 Sonnet', provider: 'anthropic', shortName: 'claude-3-5-sonnet', pricing: { prompt: 3.0, completion: 15.0 }, contextLength: 200000, isModerated: true, modality: 'text' },
  { id: 'anthropic/claude-3-5-haiku', name: 'Anthropic Claude 3.5 Haiku', provider: 'anthropic', shortName: 'claude-3-5-haiku', pricing: { prompt: 0.8, completion: 4.0 }, contextLength: 200000, isModerated: true, modality: 'text' },
  { id: 'openai/gpt-4o', name: 'OpenAI GPT-4o', provider: 'openai', shortName: 'gpt-4o', pricing: { prompt: 2.5, completion: 10.0 }, contextLength: 128000, isModerated: true, modality: 'text' },
  { id: 'openai/gpt-4o-mini', name: 'OpenAI GPT-4o Mini', provider: 'openai', shortName: 'gpt-4o-mini', pricing: { prompt: 0.15, completion: 0.6 }, contextLength: 128000, isModerated: true, modality: 'text' },
  { id: 'x-ai/grok-4.1-fast', name: 'xAI Grok 4.1 Fast', provider: 'x-ai', shortName: 'grok-4.1-fast', pricing: { prompt: 3.0, completion: 15.0 }, contextLength: 131072, isModerated: false, modality: 'text' },
];

// Cache duration: 5 minutes
const CACHE_DURATION_MS = 5 * 60 * 1000;

interface CacheEntry {
  models: OpenRouterModel[];
  timestamp: number;
}

let cache: CacheEntry | null = null;

export function useOpenRouterModels() {
  const [models, setModels] = useState<OpenRouterModel[]>(FALLBACK_MODELS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFallback, setIsFallback] = useState(false);

  const fetchModels = useCallback(async (forceRefresh = false) => {
    // Check cache first
    if (!forceRefresh && cache && Date.now() - cache.timestamp < CACHE_DURATION_MS) {
      setModels(cache.models);
      setIsLoading(false);
      setIsFallback(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke<OpenRouterModelsResponse>(
        'openrouter-models',
        { method: 'GET' }
      );

      if (fnError) {
        throw new Error(fnError.message || 'Failed to fetch models');
      }

      if (data?.models && data.models.length > 0) {
        // Update cache
        cache = {
          models: data.models,
          timestamp: Date.now(),
        };

        setModels(data.models);
        setIsFallback(false);
      } else {
        throw new Error('No models returned from API');
      }
    } catch (err) {
      console.error('Failed to fetch OpenRouter models:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);

      // Use fallback models
      setModels(FALLBACK_MODELS);
      setIsFallback(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  // Get models grouped by provider
  const modelsByProvider = models.reduce((acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  }, {} as Record<string, OpenRouterModel[]>);

  // Get unique providers sorted
  const providers = Object.keys(modelsByProvider).sort();

  // Find model by ID
  const getModelById = useCallback(
    (id: string) => models.find((m) => m.id === id),
    [models]
  );

  // Get model display label
  const getModelLabel = useCallback(
    (id: string) => {
      const model = getModelById(id);
      return model ? model.name : id;
    },
    [getModelById]
  );

  // Get model pricing (cost per 1M tokens)
  const getModelPricing = useCallback(
    (id: string) => {
      const model = getModelById(id);
      if (model) {
        // Convert from per-token to per-1M tokens
        return {
          prompt: model.pricing.prompt * 1_000_000,
          completion: model.pricing.completion * 1_000_000,
        };
      }
      return { prompt: 0.1, completion: 0.1 };
    },
    [getModelById]
  );

  return {
    models,
    modelsByProvider,
    providers,
    isLoading,
    error,
    isFallback,
    refresh: () => fetchModels(true),
    getModelById,
    getModelLabel,
    getModelPricing,
  };
}
