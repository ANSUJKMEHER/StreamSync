import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// GET all rooms for the authenticated user
router.get('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const rooms = await prisma.room.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { files: true },
        },
      },
    });

    // Also get rooms the user is a collaborator on
    const collabRooms = await prisma.collaborator.findMany({
      where: { userId },
      include: {
        room: {
          include: {
            _count: { select: { files: true } }
          }
        }
      }
    });

    const allRooms = [
      ...rooms,
      ...collabRooms.map(c => c.room)
    ];

    res.json({ success: true, data: allRooms });
  } catch (error) {
    console.error('[ROOMS] Failed to fetch rooms:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET a specific room (checks permissions)
// authenticate middleware must be optional if room is public!
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    // Optional auth extraction since this can be accessed by guests
    const authHeader = req.headers.authorization;
    let userId: string | null = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'streamsync-dev-secret-change-in-production');
        userId = (decoded as any).userId;
      } catch (e) {
        // invalid token, ignore
      }
    }

    const roomId = req.params.id as string;

    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: { collaborators: true }
    });

    if (!room) {
      res.status(404).json({ success: false, error: 'Room not found' });
      return;
    }

    const isCollaborator = userId ? room.collaborators.find(c => c.userId === userId) : null;

    if (room.ownerId !== userId && !room.isPublic && !isCollaborator) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    // Include the room's access level for the current user
    let access = room.publicAccess;
    if (room.ownerId === userId) {
      access = 'OWNER';
    } else if (isCollaborator) {
      access = isCollaborator.role;
    }

    res.json({ success: true, data: { ...room, access } });
  } catch (error) {
    console.error('[ROOMS] Failed to fetch room:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST a new room
router.post('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { name } = req.body;

    if (!name) {
      res.status(400).json({ success: false, error: 'Room name is required' });
      return;
    }

    const room = await prisma.room.create({
      data: {
        name,
        ownerId: userId,
      },
    });

    res.json({ success: true, data: room });
  } catch (error) {
    console.error('[ROOMS] Failed to create room:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// PUT (Update) a room's permissions
router.put('/:id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const roomId = req.params.id as string;
    const { name, isPublic, publicAccess } = req.body;

    const room = await prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!room || room.ownerId !== userId) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const updatedRoom = await prisma.room.update({
      where: { id: roomId },
      data: {
        ...(name !== undefined && { name }),
        ...(isPublic !== undefined && { isPublic }),
        ...(publicAccess !== undefined && { publicAccess }),
      },
    });

    res.json({ success: true, data: updatedRoom });
  } catch (error) {
    console.error('[ROOMS] Failed to update room:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// DELETE a room
router.delete('/:id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const roomId = req.params.id as string;

    const room = await prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!room || room.ownerId !== userId) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    await prisma.room.delete({
      where: { id: roomId },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[ROOMS] Failed to delete room:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
