import { Router, Request, Response, RequestHandler } from 'express';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// In-memory rate limiting for execution
const rateLimits: Record<string, { count: number; resetAt: number }> = {};
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 15;

const executionRateLimiter: RequestHandler = (req, res, next) => {
  const identifier = req.user?.userId || req.ip || 'unknown';
  const now = Date.now();

  if (!rateLimits[identifier]) {
    rateLimits[identifier] = { count: 0, resetAt: now + RATE_LIMIT_WINDOW };
  }

  const limit = rateLimits[identifier];

  if (now > limit.resetAt) {
    limit.count = 0;
    limit.resetAt = now + RATE_LIMIT_WINDOW;
  }

  if (limit.count >= MAX_REQUESTS_PER_WINDOW) {
    res.status(429).json({
      success: false,
      error: 'Too many execution requests. Please wait a moment.',
    });
    return;
  }

  limit.count++;
  next();
};

// Map languages to Judge0 Language IDs
const LANGUAGE_MAP: Record<string, number> = {
  'javascript': 93, // Node.js 18.15.0
  'typescript': 94, // TypeScript 5.0.3
  'python': 71,     // Python 3.8.1
  'java': 62,       // Java 13.0.1
  'c': 50,          // C (GCC 9.2.0)
  'cpp': 54,        // C++ (GCC 9.2.0)
  'rust': 73,       // Rust 1.40.0
  'go': 60,         // Go 1.13.5
};

router.post('/', authenticateToken, executionRateLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, language } = req.body;

    if (!code || typeof code !== 'string') {
      res.status(400).json({ success: false, error: 'Code payload is missing or invalid.' });
      return;
    }

    const lang = language ? language.toLowerCase() : 'javascript';
    const languageId = LANGUAGE_MAP[lang];

    if (!languageId) {
      res.status(400).json({ success: false, error: `Language '${lang}' is not supported by Judge0.` });
      return;
    }

    const apiKey = process.env.RAPIDAPI_KEY;
    const apiHost = process.env.RAPIDAPI_HOST || 'judge0-ce.p.rapidapi.com';

    if (!apiKey) {
      res.status(500).json({ success: false, error: 'Execution engine API key is missing on the server.' });
      return;
    }

    // Call Judge0 API via RapidAPI
    const url = `https://${apiHost}/submissions?base64_encoded=false&wait=true`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': apiHost
      },
      body: JSON.stringify({
        source_code: code,
        language_id: languageId
      }),
    });

    if (!response.ok) {
      console.error(`Judge0 API error: ${response.status} ${response.statusText}`);
      res.status(502).json({ success: false, error: 'Execution engine failed to process the request.' });
      return;
    }

    const data: any = await response.json();
    
    // Determine the error message if any
    const errorOutput = data.stderr || data.compile_output || data.message || '';
    
    res.json({
      success: true,
      data: {
        stdout: data.stdout || '',
        stderr: errorOutput,
        code: data.status?.id === 3 ? 0 : 1, // Status 3 is 'Accepted'
      }
    });

  } catch (error) {
    console.error('[EXECUTE] Internal error:', error);
    res.status(500).json({ success: false, error: 'Internal server error during code execution.' });
  }
});

export default router;
