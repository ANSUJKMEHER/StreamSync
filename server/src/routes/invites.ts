import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// GET /api/v1/invites — List all pending invites for the logged in user
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    
    // Find the user's username (to match targetUsername)
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    // Get invites by inviteeId or by targetUsername (if inviteeId hasn't been set yet)
    const pendingInvites = await prisma.roomInvite.findMany({
      where: {
        OR: [
          { inviteeId: userId },
          { targetUsername: user.username },
          { targetUsername: user.githubId || 'NO_MATCH' }
        ],
        status: 'PENDING'
      },
      include: {
        room: {
          select: { name: true, ownerId: true }
        },
        inviter: {
          select: { username: true, avatarUrl: true }
        }
      }
    });

    // Update inviteeId for any invites that matched by username but didn't have ID yet
    const needsUpdate = pendingInvites.filter(i => !i.inviteeId);
    if (needsUpdate.length > 0) {
      await prisma.roomInvite.updateMany({
        where: { id: { in: needsUpdate.map(i => i.id) } },
        data: { inviteeId: userId }
      });
    }

    res.json({ success: true, data: pendingInvites });
  } catch (err) {
    console.error('[Invites] Get all error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch invites' });
  }
});

// POST /api/v1/invites — Send an invite to a user
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { roomId, targetUsername, role = 'EDIT' } = req.body;

    if (!roomId || !targetUsername) {
      res.status(400).json({ success: false, error: 'roomId and targetUsername are required' });
      return;
    }

    // Verify room ownership
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room || room.ownerId !== userId) {
      res.status(403).json({ success: false, error: 'Only the room owner can send invites' });
      return;
    }

    // Try to find the user in our DB by username or githubId
    const targetUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username: targetUsername },
          { githubId: targetUsername }
        ]
      }
    });

    // Don't allow inviting yourself
    if (targetUser && targetUser.id === userId) {
      res.status(400).json({ success: false, error: 'You cannot invite yourself' });
      return;
    }

    // Create the invite
    const invite = await prisma.roomInvite.create({
      data: {
        roomId,
        inviterId: userId,
        targetUsername,
        inviteeId: targetUser ? targetUser.id : null,
        role
      },
      include: {
        invitee: {
          select: { username: true, avatarUrl: true }
        }
      }
    });

    res.status(201).json({ success: true, data: invite });
  } catch (err: any) {
    console.error('[Invites] Create error:', err);
    if (err.code === 'P2002') {
      res.status(400).json({ success: false, error: 'An invite has already been sent to this user for this room' });
      return;
    }
    res.status(500).json({ success: false, error: 'Failed to create invite' });
  }
});

// POST /api/v1/invites/:id/accept
router.post('/:id/accept', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const inviteId = req.params.id;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    
    const invite = await prisma.roomInvite.findUnique({ where: { id: inviteId } });
    if (!invite || !user) {
      res.status(404).json({ success: false, error: 'Invite not found' });
      return;
    }

    // Verify the invite is meant for this user
    if (invite.inviteeId !== userId && invite.targetUsername !== user.username && invite.targetUsername !== user.githubId) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    if (invite.status !== 'PENDING') {
      res.status(400).json({ success: false, error: 'Invite is no longer pending' });
      return;
    }

    // Use a transaction to mark invite ACCEPTED and create Collaborator
    await prisma.$transaction([
      prisma.roomInvite.update({
        where: { id: inviteId },
        data: { status: 'ACCEPTED', inviteeId: userId }
      }),
      prisma.collaborator.upsert({
        where: { roomId_userId: { roomId: invite.roomId, userId } },
        create: { roomId: invite.roomId, userId, role: invite.role },
        update: { role: invite.role }
      })
    ]);

    res.json({ success: true, message: 'Invite accepted' });
  } catch (err) {
    console.error('[Invites] Accept error:', err);
    res.status(500).json({ success: false, error: 'Failed to accept invite' });
  }
});

// POST /api/v1/invites/:id/reject
router.post('/:id/reject', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const inviteId = req.params.id;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    const invite = await prisma.roomInvite.findUnique({ where: { id: inviteId } });
    if (!invite || !user) {
      res.status(404).json({ success: false, error: 'Invite not found' });
      return;
    }

    if (invite.inviteeId !== userId && invite.targetUsername !== user.username && invite.targetUsername !== user.githubId) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    await prisma.roomInvite.update({
      where: { id: inviteId },
      data: { status: 'REJECTED', inviteeId: userId }
    });

    res.json({ success: true, message: 'Invite rejected' });
  } catch (err) {
    console.error('[Invites] Reject error:', err);
    res.status(500).json({ success: false, error: 'Failed to reject invite' });
  }
});

// DELETE /api/v1/invites/:id — Cancel an invite (room owner only)
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const inviteId = req.params.id;

    const invite = await prisma.roomInvite.findUnique({ where: { id: inviteId } });
    if (!invite) {
      res.status(404).json({ success: false, error: 'Invite not found' });
      return;
    }
    
    // Ensure caller is the room owner
    const room = await prisma.room.findUnique({ where: { id: invite.roomId } });
    if (!room || room.ownerId !== userId) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    await prisma.roomInvite.delete({ where: { id: inviteId } });
    res.json({ success: true, message: 'Invite cancelled' });
  } catch (err) {
    console.error('[Invites] Delete error:', err);
    res.status(500).json({ success: false, error: 'Failed to cancel invite' });
  }
});

// GET /api/v1/invites/room/:roomId — Get all invites for a room (room owner only)
router.get('/room/:roomId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const roomId = req.params.roomId;

    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room || room.ownerId !== userId) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const invites = await prisma.roomInvite.findMany({
      where: { roomId },
      include: {
        invitee: {
          select: { username: true, avatarUrl: true }
        }
      }
    });
    
    res.json({ success: true, data: invites });
  } catch (err) {
    console.error('[Invites] Room invites error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch room invites' });
  }
});

export default router;
