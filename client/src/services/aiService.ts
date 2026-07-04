const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '');

interface AiCompletionContext {
  prefix: string;
  suffix: string;
  filename: string;
  language: string;
}

export const aiService = {
  /**
   * Fetches an AI code completion snippet.
   */
  async fetchCompletion(roomId: string, context: AiCompletionContext): Promise<string | null> {
    try {
      const response = await fetch(`${API_BASE}/api/v1/ai/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, context }),
      });

      const json = await response.json();

      if (!response.ok || !json.success) {
        if (response.status === 429) {
          console.warn('[AI] Rate limited:', json.error);
        } else {
          console.error('[AI] Server error:', json.error);
        }
        return null;
      }

      return json.data?.completion || null;
    } catch (error) {
      console.error('[AI] Failed to fetch completion:', error);
      return null;
    }
  },
};

