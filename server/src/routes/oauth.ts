import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { signToken } from '../middleware/auth';
import crypto from 'crypto';

const router = Router();

// In-memory CSRF state store (in production, use Redis or a session store)
const pendingOAuthStates = new Map<string, { createdAt: number }>();

// Clean up expired states every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [state, data] of pendingOAuthStates) {
    if (now - data.createdAt > 10 * 60 * 1000) { // 10 minute expiry
      pendingOAuthStates.delete(state);
    }
  }
}, 5 * 60 * 1000);

// ── Token encryption helpers ──
const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY || process.env.JWT_SECRET || 'streamsync-dev-encryption-key-32b';

function encryptToken(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  // Derive a 32-byte key from whatever string we have
  const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  // Format: iv:authTag:ciphertext
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decryptToken(encrypted: string): string {
  const parts = encrypted.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted token format');
  const [ivHex, authTagHex, ciphertext] = parts;
  const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Redirect to GitHub OAuth Authorization Page
router.get('/github', (req: Request, res: Response) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    res.status(500).json({ error: 'GitHub OAuth not configured on the server.' });
    return;
  }
  
  // Generate CSRF state parameter
  const state = crypto.randomBytes(32).toString('hex');
  pendingOAuthStates.set(state, { createdAt: Date.now() });

  // Scopes: repo (to push/pull), user:email (to get user identity)
  const params = new URLSearchParams({
    client_id: clientId,
    scope: 'repo,user:email',
    state,
  });
  const redirectUri = `https://github.com/login/oauth/authorize?${params.toString()}`;
  res.redirect(redirectUri);
});

// GitHub OAuth Callback
router.get('/github/callback', async (req: Request, res: Response): Promise<void> => {
  const { code, state } = req.query;
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  
  if (!code || typeof code !== 'string') {
    res.status(400).send('Authorization code is missing.');
    return;
  }

  // CSRF validation
  if (!state || typeof state !== 'string' || !pendingOAuthStates.has(state)) {
    res.status(403).send('Invalid or expired OAuth state. Please try again.');
    return;
  }
  pendingOAuthStates.delete(state); // One-time use

  if (!clientId || !clientSecret) {
    res.status(500).send('OAuth is not configured.');
    return;
  }

  try {
    // 1. Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code
      })
    });

    const tokenData: any = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      res.status(400).send('Failed to obtain access token from GitHub.');
      return;
    }

    // 2. Fetch user profile from GitHub
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    const githubUser: any = await userResponse.json();
    
    if (!githubUser || !githubUser.id) {
      res.status(400).send('Failed to fetch user profile from GitHub.');
      return;
    }

    // 3. Encrypt the GitHub token before storing
    const encryptedToken = encryptToken(accessToken);

    // 4. Find or Create the user in our database
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { githubId: String(githubUser.id) },
          { username: githubUser.login }
        ]
      }
    });

    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          githubId: String(githubUser.id),
          avatarUrl: githubUser.avatar_url,
          githubToken: encryptedToken, // Stored encrypted!
        }
      });
    } else {
      user = await prisma.user.create({
        data: {
          username: githubUser.login,
          githubId: String(githubUser.id),
          avatarUrl: githubUser.avatar_url,
          githubToken: encryptedToken,
        }
      });
    }

    // 5. Issue our JWT Token
    const token = signToken({ userId: user.id, username: user.username });
    
    // 6. Send back via postMessage — XSS-safe using JSON.stringify
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    
    const payload = JSON.stringify({
      type: 'OAUTH_SUCCESS',
      payload: {
        token,
        user: {
          id: user.id,
          username: user.username,
          avatarUrl: user.avatarUrl || '',
        }
      }
    });

    // Use JSON.stringify to safely embed in script — prevents XSS from
    // usernames containing quotes or other special characters
    res.send(`
      <!DOCTYPE html>
      <html><body>
      <script>
        try {
          var data = ${payload};
          window.opener.postMessage(data, ${JSON.stringify(clientUrl)});
        } catch(e) {
          document.body.innerText = 'Authentication successful. You can close this window.';
        }
        window.close();
      </script>
      </body></html>
    `);
    
  } catch (error) {
    console.error('[OAuth] Error during GitHub callback:', error);
    res.status(500).send('Internal Server Error during OAuth flow.');
  }
});

export default router;
