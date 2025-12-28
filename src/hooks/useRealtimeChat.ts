import { useState, useEffect, useCallback, useRef } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import type { Message, InterfaceType, RealtimeStatus } from '@/types/omnichannel';

/**
 * Hook for real-time chat with Supabase subscription and reconnection logic
 *
 * Features:
 * - Load initial messages from database
 * - Subscribe to real-time message updates
 * - Auto-reconnect on disconnect with exponential backoff
 * - Message deduplication
 * - Support for custom JWT tokens (Telegram users)
 *
 * @param conversationId - The conversation ID to subscribe to
 * @param customToken - Optional custom JWT token for authentication
 * @returns Chat state and functions
 */
export function useRealtimeChat(conversationId: string, customToken?: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<RealtimeStatus>('CLOSED');
  const [error, setError] = useState<string | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const maxReconnectAttempts = 5;
  const baseReconnectDelay = 1000; // 1 second

  // Maximum messages to keep in memory to prevent memory leak (Issue #12)
  const MAX_MESSAGES_IN_MEMORY = 100;

  // HIGH-1: Race condition prevention flag for reconnection logic
  const reconnectInProgressRef = useRef(false);

  // HIGH-2: Set for O(1) message deduplication instead of O(n) array search
  const seenMessageIdsRef = useRef(new Set<string>());

  // HIGH-6: Mount tracking to prevent setState after unmount
  const isMountedRef = useRef(true);

  /**
   * Calculate exponential backoff delay (pure utility function)
   */
  const getReconnectDelay = () => {
    return Math.min(
      baseReconnectDelay * Math.pow(2, reconnectAttemptsRef.current),
      30000 // Max 30 seconds
    );
  };

  /**
   * Load initial messages from database
   */
  const loadMessages = useCallback(async () => {
    try {
      setError(null);
      const query = supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      const { data, error: fetchError } = await query;

      if (fetchError) {
        console.error('Error loading messages:', fetchError);
        setError('Failed to load messages');
        return;
      }

      setMessages(data || []);
    } catch (err) {
      console.error('Error loading messages:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, [conversationId]);

  /**
   * Subscribe to real-time updates
   */
  const subscribe = useCallback(async () => {
    // Clear pending reconnect first
    if (reconnectTimeoutRef.current) {
      window.clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Unsubscribe from existing channel
    if (channelRef.current) {
      try {
        channelRef.current.unsubscribe();
      } catch (err) {
        console.warn('Error unsubscribing:', err);
      }
      channelRef.current = null;
    }

    // Set auth BEFORE subscribing (await it to prevent race condition!)
    if (customToken) {
      await supabase.realtime.setAuth(customToken);
    }

    // Create new channel
    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;

          // HIGH-2: O(1) deduplication check using Set
          if (seenMessageIdsRef.current.has(newMessage.id)) {
            return;
          }

          setMessages((prev) => {
            // Check if this is a confirmation of an optimistic message (Issue #24)
            const optimisticIndex = prev.findIndex(
              (m) =>
                m.metadata?.temp_id &&
                newMessage.metadata?.temp_id &&
                m.metadata.temp_id === newMessage.metadata.temp_id &&
                m.metadata.optimistic
            );

            if (optimisticIndex !== -1) {
              // Replace optimistic message with real one
              const updated = [...prev];
              updated[optimisticIndex] = newMessage;
              seenMessageIdsRef.current.add(newMessage.id);
              return updated;
            }

            // Check for duplicate by ID (fallback)
            if (prev.some((m) => m.id === newMessage.id)) {
              return prev;
            }

            const updated = [...prev, newMessage];
            seenMessageIdsRef.current.add(newMessage.id);

            // Keep only last N messages to prevent memory leak (Issue #12)
            // Also prune the Set to match the trimmed messages
            if (updated.length > MAX_MESSAGES_IN_MEMORY) {
              const trimmed = updated.slice(-MAX_MESSAGES_IN_MEMORY);
              const validIds = new Set(trimmed.map((m) => m.id));
              seenMessageIdsRef.current = validIds;
              return trimmed;
            }

            return updated;
          });
        }
      )
      .subscribe((status) => {
        setConnectionStatus(status as RealtimeStatus);

        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          setError(null);
          reconnectAttemptsRef.current = 0;

          // HIGH-1: Clear reconnect flags on successful connection
          reconnectInProgressRef.current = false;
          if (reconnectTimeoutRef.current) {
            window.clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
          }
        } else {
          setIsConnected(false);

          // HIGH-1: Prevent race condition in reconnection - check in-progress flag
          if (
            (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') &&
            reconnectAttemptsRef.current < maxReconnectAttempts &&
            !reconnectInProgressRef.current // Prevent duplicate reconnect attempts
          ) {
            reconnectInProgressRef.current = true; // Set flag immediately
            const delay = getReconnectDelay();
            console.warn(
              `Connection ${status}. Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})...`
            );

            reconnectTimeoutRef.current = window.setTimeout(() => {
              reconnectTimeoutRef.current = null;
              reconnectAttemptsRef.current += 1;
              reconnectInProgressRef.current = false; // Clear flag before reconnect
              subscribe();
            }, delay);
          } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
            setError(`Failed to connect after ${maxReconnectAttempts} attempts`);
          }
        }
      });

    channelRef.current = channel;
  }, [conversationId, customToken]);

  /**
   * Send a message with AbortController (Issue #8) and optimistic updates (Issue #24)
   */
  const sendMessage = useCallback(
    async (content: string, interfaceType: InterfaceType) => {
      // HIGH-6: Check mount status before setState
      if (!isMountedRef.current) return;

      // Abort previous request if still in flight (Issue #8)
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // Generate temp ID for optimistic update (Issue #24)
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Optimistic update - show message immediately (Issue #24)
      const optimisticMessage: Message = {
        id: tempId,
        conversation_id: conversationId,
        channel: 'web',
        interface: interfaceType,
        role: 'user',
        content,
        content_type: 'text',
        reply_to_message_id: null,
        metadata: { temp_id: tempId, optimistic: true },
        processing_status: 'pending',
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, optimisticMessage]);

      // HIGH-6: Fetch timeout (30 seconds)
      const REQUEST_TIMEOUT = 30000;
      const timeoutId = setTimeout(() => {
        abortController.abort();
      }, REQUEST_TIMEOUT);

      try {
        if (!isMountedRef.current) return;
        setError(null);

        // Determine API base URL
        const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;
        const endpoint = `${apiUrl}/api/messages`;

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(customToken ? { Authorization: `Bearer ${customToken}` } : {}),
          },
          body: JSON.stringify({
            conversation_id: conversationId,
            content,
            interface: interfaceType,
            temp_id: tempId, // Send temp_id to server for matching
          }),
          signal: abortController.signal, // Add abort signal (Issue #8)
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          // HIGH-6: Check mount before setState
          if (!isMountedRef.current) return;

          // Rollback optimistic update on error (Issue #24)
          setMessages((prev) => prev.filter((m) => m.id !== tempId));

          const errorData = await response.json().catch(() => ({ error: 'Failed to send message' }));
          throw new Error(errorData.error || 'Failed to send message');
        }

        const result = await response.json();

        // HIGH-6: Check mount before setState
        if (!isMountedRef.current) return;

        // The realtime subscription will handle replacing with the real message
        // For now, just update the processing status and keep temp message
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? {
                  ...m,
                  id: result.message_id || tempId,
                  metadata: { ...m.metadata, optimistic: false },
                }
              : m
          )
        );

        return result;
      } catch (err) {
        clearTimeout(timeoutId);

        // Don't set error state if aborted (component unmounted) (Issue #8)
        if (err instanceof Error && err.name === 'AbortError') {
          console.log('Request aborted');
          return;
        }

        // HIGH-6: Check mount before setState
        if (!isMountedRef.current) return;

        // Rollback optimistic update on error (Issue #24)
        setMessages((prev) => prev.filter((m) => m.id !== tempId));

        const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
        setError(errorMessage);
        throw new Error(errorMessage);
      } finally {
        // Clear abort controller ref after request completes
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null;
        }
      }
    },
    [conversationId, customToken]
  );

  // Load messages and subscribe on mount
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      await loadMessages();
      if (mounted) {
        await subscribe();
      }
    };

    init();

    // Cleanup on unmount
    return () => {
      mounted = false;

      // HIGH-6: Mark as unmounted to prevent setState after cleanup
      isMountedRef.current = false;

      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }

      // HIGH-1: Reset reconnect flags
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      reconnectInProgressRef.current = false;

      // Abort pending fetch request (Issue #8)
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      // HIGH-2: Clear message ID deduplication Set
      seenMessageIdsRef.current.clear();
    };
    // HIGH-5: Only depend on memoized functions, not their dependencies
  }, [loadMessages, subscribe]);

  return {
    messages,
    sendMessage,
    isConnected,
    connectionStatus,
    error,
  };
}
