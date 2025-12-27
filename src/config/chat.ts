/**
 * Chat configuration constants
 */
export const CHAT_CONFIG = {
  /** Avatar URL for Arina (AI assistant) */
  ARINA_AVATAR: "https://ui-avatars.com/api/?name=Arina&background=8B4513&color=fff",
  /** Default avatar URL for user */
  USER_AVATAR: "https://ui-avatars.com/api/?name=User&background=random",
  /** Typing delay in ms for bot responses */
  TYPING_DELAY: 1000,
  /** Initial greeting delay in ms */
  GREETING_DELAY: 500,
} as const;
