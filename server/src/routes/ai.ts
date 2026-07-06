import { Router, Request, Response, RequestHandler } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';

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

// Add a debug endpoint to see available models for this specific API key
router.get('/models', async (req: Request, res: Response): Promise<void> => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(500).json({ success: false, error: 'GEMINI_API_KEY is not configured' });
      return;
    }
    
    // Fetch directly from REST API since the JS SDK might not easily expose ListModels
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();
    
    res.json({
      success: true,
      data
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

interface AiChatRequest {
  prompt: string;
  files: { name: string; content: string }[];
  activeFile: { name: string; content: string } | null;
  cursorPosition: { lineNumber: number; column: number } | null;
  history?: { role: 'user' | 'model'; parts: { text: string }[] }[];
}

router.post('/chat', async (req: Request, res: Response): Promise<void> => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(500).json({ success: false, error: 'GEMINI_API_KEY is not configured on the server' });
      return;
    }

    const { prompt, files, activeFile, cursorPosition, history = [] } = req.body as AiChatRequest;

    if (!prompt) {
      res.status(400).json({ success: false, error: 'Prompt is required' });
      return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Build context string
    let context = "You are an expert AI pair programmer inside a real-time collaborative code editor (StreamSync).\n\n";
    
    if (files && files.length > 0) {
      context += "--- WORKSPACE FILES ---\n";
      files.slice(0, 10).forEach(f => {
        context += `File: ${f.name}\n\`\`\`\n${f.content.substring(0, 3000)}\n\`\`\`\n\n`;
      });
    }

    if (activeFile) {
      context += `--- ACTIVE FILE: ${activeFile.name} ---\n`;
      if (cursorPosition) {
        context += `The user's cursor is currently at Line ${cursorPosition.lineNumber}, Column ${cursorPosition.column}.\n`;
      }
    }

    const chat = model.startChat({
      history: [
        { role: 'user', parts: [{ text: context }] },
        { role: 'model', parts: [{ text: "Understood. I have reviewed the workspace context and am ready to assist as an expert pair programmer." }] },
        ...history
      ]
    });

    const result = await chat.sendMessage(prompt);
    const responseText = result.response.text();

    res.json({
      success: true,
      data: responseText
    });
  } catch (error: any) {
    console.error('[AI] Chat error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to chat with AI' });
  }
});

interface AiFlowchartRequest {
  prompt: string;
  files: { name: string; content: string }[];
}

router.post('/flowchart', aiRateLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { prompt, files } = req.body as AiFlowchartRequest;
    
    if (!prompt) {
      res.status(400).json({ success: false, error: 'Prompt is required' });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(500).json({ success: false, error: 'GEMINI_API_KEY is not configured on the server' });
      return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash", generationConfig: { responseMimeType: "application/json" } });

    let context = "Project Files:\n";
    // Limit to 10 files to avoid massive context issues just in case
    for (const f of files.slice(0, 10)) {
      context += `\n--- ${f.name} ---\n${f.content}\n`;
    }

    const systemPrompt = `You are an AI architect generating a flowchart based on the user's codebase.
    
    The user asked: "${prompt}"
    
    ${context}
    
    You must output a JSON object with exactly two arrays: "shapes" and "arrows".
    
    "shapes" is an array of objects:
    {
       "id": string (unique node ID),
       "label": string (short description, e.g., "React App" or "Auth Service"),
       "type": "rect" or "circle"
    }
    
    "arrows" is an array of objects representing directed edges between shapes:
    {
       "id": string (unique arrow ID),
       "fromId": string (matches a shape id),
       "toId": string (matches a shape id)
    }
    
    Keep the flowchart concise and focused directly on what the user asked. Only output valid JSON conforming to this schema.`;

    const result = await model.generateContent(systemPrompt);
    let responseText = result.response.text();
    
    // Remove markdown code blocks anywhere in the response
    responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    const parsedData = JSON.parse(responseText);

    res.json({
      success: true,
      data: parsedData
    });
  } catch (error: any) {
    console.error('[AI] Flowchart error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to generate flowchart' });
  }
});

export default router;
