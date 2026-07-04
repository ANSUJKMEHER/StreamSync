import { Router, Request, Response } from 'express';
import { CreateFileRequest, UpdateFileRequest } from '../types';
import { prisma } from '../db';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// GET /api/v1/files/room/:roomId — List all files in a room
// Authenticated: verify user owns the room or room is public
router.get('/room/:roomId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const roomId = req.params.roomId as string;

    // Verify user has access to this room
    const room = await prisma.room.findUnique({ 
      where: { id: roomId },
      include: { collaborators: true }
    });
    if (!room) {
      res.status(404).json({ success: false, error: 'Room not found' });
      return;
    }
    const isCollab = room.collaborators.some(c => c.userId === userId);
    if (room.ownerId !== userId && !room.isPublic && !isCollab) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const allFiles = await prisma.file.findMany({ where: { roomId } });
    const formattedFiles = allFiles.map((f) => ({
      ...f,
      createdAt: f.createdAt.toISOString(),
      updatedAt: f.updatedAt.toISOString(),
    }));
    res.json({ success: true, data: formattedFiles });
  } catch (err) {
    console.error('[Files] Get all error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch files' });
  }
});

// GET /api/v1/files/file/:id — Get single file
// Authenticated: verify user owns the parent room or room is public
router.get('/file/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;

    const file = await prisma.file.findUnique({
      where: { id },
      include: { room: { include: { collaborators: true } } },
    });
    if (!file) {
      res.status(404).json({ success: false, error: 'File not found' });
      return;
    }
    // Authorization check
    const isCollab = file.room.collaborators.some(c => c.userId === userId);
    if (file.room.ownerId !== userId && !file.room.isPublic && !isCollab) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    res.json({
      success: true,
      data: {
        ...file,
        createdAt: file.createdAt.toISOString(),
        updatedAt: file.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    console.error('[Files] Get one error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch file' });
  }
});

// POST /api/v1/files — Create file
// Authenticated: only room owner (or public EDIT rooms) can create files
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const body: CreateFileRequest = req.body;

    if (!body.name || body.name.trim() === '' || !body.roomId) {
      res.status(400).json({ success: false, error: 'File name and roomId are required' });
      return;
    }

    // Verify ownership or public EDIT access
    const room = await prisma.room.findUnique({ 
      where: { id: body.roomId },
      include: { collaborators: true }
    });
    if (!room) {
      res.status(404).json({ success: false, error: 'Room not found' });
      return;
    }
    const collab = room.collaborators.find(c => c.userId === userId);
    const canEdit = room.ownerId === userId || 
                    (room.isPublic && room.publicAccess === 'EDIT') ||
                    (collab && collab.role === 'EDIT');
    if (!canEdit) {
      res.status(403).json({ success: false, error: 'Access denied — no write access to this room' });
      return;
    }

    const ext = body.name.split('.').pop()?.toLowerCase() || '';
    const langMap: Record<string, string> = {
      js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
      py: 'python', go: 'go', rs: 'rust', html: 'html', css: 'css',
      json: 'json', md: 'markdown', yaml: 'yaml', yml: 'yaml',
      sh: 'shell', bash: 'shell', sql: 'sql',
    };

    const newFile = await prisma.file.create({
      data: {
        name: body.name.trim(),
        roomId: body.roomId,
        content: body.content ?? '',
        language: body.language ?? langMap[ext] ?? 'plaintext',
        parentId: body.parentId ?? null,
        isFolder: body.isFolder ?? false,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        ...newFile,
        createdAt: newFile.createdAt.toISOString(),
        updatedAt: newFile.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    console.error('[Files] Create error:', err);
    res.status(500).json({ success: false, error: 'Failed to create file' });
  }
});

// PUT /api/v1/files/:id — Update file
// Authenticated: only room owner or public EDIT can modify files
router.put('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;
    const body: UpdateFileRequest = req.body;

    const existing = await prisma.file.findUnique({
      where: { id },
      include: { room: { include: { collaborators: true } } },
    });
    if (!existing) {
      res.status(404).json({ success: false, error: 'File not found' });
      return;
    }
    const collab = existing.room.collaborators.find(c => c.userId === userId);
    const canEdit = existing.room.ownerId === userId || 
                    (existing.room.isPublic && existing.room.publicAccess === 'EDIT') ||
                    (collab && collab.role === 'EDIT');
    if (!canEdit) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const updatedFile = await prisma.file.update({
      where: { id },
      data: {
        name: body.name !== undefined ? body.name.trim() : undefined,
        content: body.content !== undefined ? body.content : undefined,
        language: body.language !== undefined ? body.language : undefined,
      },
    });

    res.json({
      success: true,
      data: {
        ...updatedFile,
        createdAt: updatedFile.createdAt.toISOString(),
        updatedAt: updatedFile.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    console.error('[Files] Update error:', err);
    res.status(500).json({ success: false, error: 'Failed to update file' });
  }
});

// DELETE /api/v1/files/:id — Delete file
// Authenticated: only room owner can delete files
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;

    const existing = await prisma.file.findUnique({
      where: { id },
      include: { room: { include: { collaborators: true } } },
    });
    if (!existing) {
      res.status(404).json({ success: false, error: 'File not found' });
      return;
    }
    const collab = existing.room.collaborators.find(c => c.userId === userId);
    const canDelete = existing.room.ownerId === userId || (collab && collab.role === 'EDIT');
    if (!canDelete) {
      res.status(403).json({ success: false, error: 'Access denied — missing delete permissions' });
      return;
    }

    await prisma.file.delete({ where: { id } });
    res.json({ success: true, data: { deleted: true, id } });
  } catch (err) {
    console.error('[Files] Delete error:', err);
    res.status(500).json({ success: false, error: 'Failed to delete file' });
  }
});

export default router;
