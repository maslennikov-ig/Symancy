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
  const maxReconnectAttempts = 5;
  const baseReconnectDelay = 1000; // 1 second

  /**
   * Calculate exponential backoff delay
   */
  const getReconnectDelay = useCallback(() => {
    return Math.min(
      baseReconnectDelay * Math.pow(2, reconnectAttemptsRef.current),
      30000 // Max 30 seconds
    );
  }, []);

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
  const subscribe = useCallback(() => {
    // Clean up existing channel
    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }

    // Set custom auth token if provided
    if (customToken) {
      supabase.realtime.setAuth(customToken);
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
          setMessages((prev) => {
            // Deduplicate messages
            if (prev.some((m) => m.id === newMessage.id)) {
              return prev;
            }
            return [...prev, newMessage];
          });
        }
      )
      .subscribe((status) => {
        setConnectionStatus(status as RealtimeStatus);

        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          setError(null);
          reconnectAttemptsRef.current = 0; // Reset reconnect attempts on successful connection
        } else {
          setIsConnected(false);

          // Handle reconnection for error states
          if (
            (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') &&
            reconnectAttemptsRef.current < maxReconnectAttempts
          ) {
            const delay = getReconnectDelay();
            console.warn(
              `Connection ${status}. Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})...`
            );

            if (reconnectTimeoutRef.current) {
              window.clearTimeout(reconnectTimeoutRef.current);
            }

            reconnectTimeoutRef.current = window.setTimeout(() => {
              reconnectAttemptsRef.current += 1;
              subscribe();
            }, delay);
          } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
            setError(`Failed to connect after ${maxReconnectAttempts} attempts`);
          }
        }
      });

    channelRef.current = channel;
  }, [conversationId, customToken, getReconnectDelay]);

  /**
   * Send a message
   */
  const sendMessage = useCallback(
    async (content: string, interfaceType: InterfaceType) => {
      try {
        setError(null);

        // Determine API base URL
        const apiUrl = import.meta.env.VITE_API_URL || '';
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
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Failed to send message' }));
          throw new Error(errorData.error || 'Failed to send message');
        }

        return await response.json();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    },
    [conversationId, customToken]
  );

  // Load messages and subscribe on mount
  useEffect(() => {
    loadMessages();
    subscribe();

    // Cleanup on unmount
    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [loadMessages, subscribe]);

  return {
    messages,
    sendMessage,
    isConnected,
    connectionStatus,
    error,
  };
}
