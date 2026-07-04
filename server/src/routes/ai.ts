import { Router, Request, Response, RequestHandler } from 'express';

const router = Router();

// In-memory rate limiting store (Token bucket simplified: timestamp-based)
// Key: roomId or IP address
const rateLimits: Record<string, { count: number; resetAt: number }> = {};
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10;

// Rate limiting middleware
const aiRateLimiter: RequestHandler = (req, res, next) => {
  const identifier = req.body.roomId || req.ip || 'unknown';
  const now = Date.now();

  if (!rateLimits[identifier]) {
    rateLimits[identifier] = { count: 0, resetAt: now + RATE_LIMIT_WINDOW };
  }

  const limit = rateLimits[identifier];

  if (now > limit.resetAt) {
    // Reset window
    limit.count = 0;
    limit.resetAt = now + RATE_LIMIT_WINDOW;
  }

  if (limit.count >= MAX_REQUESTS_PER_WINDOW) {
    res.status(429).json({
      success: false,
      error: 'Too many requests. Please wait a moment before requesting more AI completions.',
    });
    return;
  }

  limit.count++;
  next();
};

// Types for the incoming request
interface AiCompletionRequest {
  roomId: string;
  context: {
    prefix: string;
    suffix: string;
    filename: string;
    language: string;
  };
}

/**
 * Generate mock AI completions.
 * In a real app, you would pass the context to OpenAI (gpt-4) or Anthropic (claude-3).
 */
function generateMockCompletion(prefix: string, language: string): string {
  const lastLine = prefix.split('\n').pop()?.trim() || '';

  // Simple heuristics to return somewhat plausible mock code
  if (lastLine.includes('function') || lastLine.includes('const') || lastLine.includes('let')) {
    if (language === 'typescript' || language === 'javascript') {
      return ' {\n  // AI suggested implementation\n  return true;\n}';
    }
  }

  if (lastLine.includes('import')) {
    return ' * as module from "module";';
  }
  
  if (lastLine.includes('console.log')) {
    return '("AI Completion Triggered!");';
  }

  // Generic fallback ghost text
  if (language === 'python') {
    return '\n    # AI pair programmer is here\n    pass';
  }

  return '\n  // AI suggestion inserted here';
}

router.post('/complete', aiRateLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { roomId, context } = req.body as AiCompletionRequest;

    if (!context || !context.prefix) {
      res.status(400).json({ success: false, error: 'Invalid context provided' });
      return;
    }

    // Simulate AI network latency (300-800ms)
    const latency = Math.floor(Math.random() * 500) + 300;
    await new Promise((resolve) => setTimeout(resolve, latency));

    const completion = generateMockCompletion(context.prefix, context.language || 'typescript');

    res.json({
      success: true,
      data: {
        completion,
      },
    });
  } catch (error) {
    console.error('[AI] Completion error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
