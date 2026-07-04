import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { UserPublic, AuthRequest } from '../types';
import { authenticateToken, signToken } from '../middleware/auth';
import { prisma } from '../db';
import { User } from '@prisma/client';

const router = Router();

// Helper: strip password hash from user
function toPublic(user: User): UserPublic {
  return {
    id: user.id,
    username: user.username,
    createdAt: user.createdAt.toISOString(),
    avatarUrl: user.avatarUrl,
    githubId: user.githubId,
  };
}

// POST /api/v1/auth/register — Create new user
router.post('/register', async (req: Request, res: Response) => {
  const { username, password }: AuthRequest = req.body;

  if (!username || !password) {
    res.status(400).json({ success: false, error: 'Username and password are required' });
    return;
  }

  if (username.length < 2 || username.length > 30) {
    res.status(400).json({ success: false, error: 'Username must be 2-30 characters' });
    return;
  }

  if (password.length < 4) {
    res.status(400).json({ success: false, error: 'Password must be at least 4 characters' });
    return;
  }

  try {
    // Check if username already exists
    const existing = await prisma.user.findFirst({
      where: {
        username: {
          equals: username,
        }
      }
    });

    if (existing) {
      res.status(409).json({ success: false, error: 'Username already taken' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = await prisma.user.create({
      data: {
        username: username.trim(),
        passwordHash,
      }
    });

    const token = signToken({ userId: newUser.id, username: newUser.username });

    console.log(`[Auth] New user registered: ${newUser.username}`);

    res.status(201).json({
      success: true,
      data: {
        user: toPublic(newUser),
        token,
      },
    });
  } catch (err) {
    console.error('[Auth] Registration error:', err);
    res.status(500).json({ success: false, error: 'Registration failed' });
  }
});

// POST /api/v1/auth/login — Authenticate user
router.post('/login', async (req: Request, res: Response) => {
  const { username, password }: AuthRequest = req.body;

  if (!username || !password) {
    res.status(400).json({ success: false, error: 'Username and password are required' });
    return;
  }

  try {
    const user = await prisma.user.findFirst({
      where: {
        username: {
          equals: username,
        }
      }
    });

    if (!user) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    if (!user.passwordHash) {
      res.status(401).json({ success: false, error: 'Please log in with GitHub.' });
      return;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    const token = signToken({ userId: user.id, username: user.username });

    console.log(`[Auth] User logged in: ${user.username}`);

    res.json({
      success: true,
      data: {
        user: toPublic(user),
        token,
      },
    });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

// GET /api/v1/auth/me — Get current user
router.get('/me', authenticateToken, async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Not authenticated' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId }
    });

    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    res.json({
      success: true,
      data: toPublic(user),
    });
  } catch (err) {
    console.error('[Auth] Get me error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch user' });
  }
});

export default router;
