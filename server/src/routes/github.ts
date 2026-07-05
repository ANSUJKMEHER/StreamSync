import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { authenticateToken } from '../middleware/auth';
import { decryptToken } from './oauth';
import { roomManager } from '../websocket/roomManager';

const router = Router();

// Helper to fetch from GitHub API
async function fetchGithubAPI(url: string, token: string, method = 'GET', body: any = null) {
  const options: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'StreamSync-App'
    }
  };
  
  if (body) {
    options.body = JSON.stringify(body);
    options.headers = { ...options.headers, 'Content-Type': 'application/json' };
  }
  
  const response = await fetch(url, options);
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`GitHub API Error (${response.status}): ${errText}`);
  }
  return response.json() as any;
}

// GET /api/v1/github/repos
router.get('/repos', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.githubToken) {
      res.status(401).json({ success: false, error: 'GitHub OAuth token not found.' });
      return;
    }
    let pat: string;
    try {
      pat = decryptToken(user.githubToken);
    } catch {
      res.status(401).json({ success: false, error: 'Stored GitHub token is invalid.' });
      return;
    }

    const reposData = await fetchGithubAPI('https://api.github.com/user/repos?sort=updated&per_page=100', pat);
    
    // Map to a simpler format
    const formattedRepos = reposData.map((r: any) => ({
      id: r.id,
      name: r.name,
      full_name: r.full_name,
      private: r.private,
      updated_at: r.updated_at,
      description: r.description
    }));

    res.json({ success: true, data: formattedRepos });
  } catch (error: any) {
    console.error('[GITHUB] Get repos error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

// POST /api/v1/github/import
router.post('/import', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { repo, branch } = req.body;

    let parsedRepo = repo.trim();
    if (parsedRepo.startsWith('http')) {
      try {
        const urlObj = new URL(parsedRepo);
        const pathParts = urlObj.pathname.split('/').filter(Boolean);
        if (pathParts.length >= 2) {
          parsedRepo = `${pathParts[0]}/${pathParts[1]}`;
        }
      } catch (e) {
        // ignore invalid URL
      }
    }

    if (!parsedRepo || !parsedRepo.includes('/')) {
      res.status(400).json({ success: false, error: 'Repository must be in "owner/repo" format or a valid GitHub URL.' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.githubToken) {
      res.status(401).json({ success: false, error: 'GitHub OAuth token not found. Please log in with GitHub.' });
      return;
    }
    let pat: string;
    try {
      pat = decryptToken(user.githubToken);
    } catch {
      res.status(401).json({ success: false, error: 'Stored GitHub token is invalid. Please re-authenticate with GitHub.' });
      return;
    }

    // 1. Fetch repository details to validate and get default branch
    let actualBranch = branch;
    try {
      const repoData = await fetchGithubAPI(`https://api.github.com/repos/${parsedRepo}`, pat);
      if (!actualBranch) {
        actualBranch = repoData.default_branch;
      }
    } catch (e: any) {
      if (e.message.includes('404')) {
        res.status(404).json({ success: false, error: `Repository "${parsedRepo}" not found or is private and requires more permissions.` });
        return;
      }
      throw e;
    }

    // 2. Fetch latest commit on branch to get the tree sha
    let refData;
    try {
      refData = await fetchGithubAPI(`https://api.github.com/repos/${parsedRepo}/git/ref/heads/${actualBranch}`, pat);
    } catch (e: any) {
      if (e.message.includes('404')) {
        res.status(404).json({ success: false, error: `Branch "${actualBranch}" not found in repository "${parsedRepo}".` });
        return;
      }
      throw e;
    }
    
    const commitSha = refData.object.sha;
    
    // 3. Fetch the tree recursively
    const commitData = await fetchGithubAPI(`https://api.github.com/repos/${parsedRepo}/git/commits/${commitSha}`, pat);
    const treeSha = commitData.tree.sha;
    const treeData = await fetchGithubAPI(`https://api.github.com/repos/${parsedRepo}/git/trees/${treeSha}?recursive=1`, pat);

    let blobs = treeData.tree.filter((item: any) => item.type === 'blob');

    // Hard limit to prevent extreme rate limits or DB crashes
    if (blobs.length > 150) {
      blobs = blobs.slice(0, 150);
      console.warn(`[GITHUB] Repository too large. Truncating to first 150 files.`);
    }

    // 3. Create the room
    const room = await prisma.room.create({
      data: {
        name: parsedRepo.split('/')[1] || parsedRepo,
        ownerId: userId,
        githubRepo: parsedRepo,
        githubBranch: actualBranch,
      }
    });

    // 4. Fetch all file contents and save to DB in chunks
    // Fetch files in chunks of 5 to avoid GitHub API rate limits
    const chunkSize = 5;
    for (let i = 0; i < blobs.length; i += chunkSize) {
      const chunk = blobs.slice(i, i + chunkSize);
      
      const filePromises = chunk.map(async (blob: any) => {
        try {
          const blobData = await fetchGithubAPI(blob.url, pat);
          const content = Buffer.from(blobData.content, 'base64').toString('utf-8');
          
          let lang = 'plaintext';
          if (blob.path.endsWith('.ts') || blob.path.endsWith('.tsx')) lang = 'typescript';
          else if (blob.path.endsWith('.js') || blob.path.endsWith('.jsx')) lang = 'javascript';
          else if (blob.path.endsWith('.py')) lang = 'python';
          else if (blob.path.endsWith('.json')) lang = 'json';
          else if (blob.path.endsWith('.css')) lang = 'css';
          else if (blob.path.endsWith('.html')) lang = 'html';
          
          await prisma.file.create({
            data: {
              name: blob.path,
              content: content,
              language: lang,
              roomId: room.id,
              isFolder: false,
            }
          });
        } catch (e) {
          console.error(`Failed to fetch blob ${blob.path}`, e);
        }
      });
      
      await Promise.all(filePromises);
      
      // Optional: Add a slight delay between chunks if necessary
      // await new Promise(r => setTimeout(r, 200));
    }

    res.json({ success: true, data: room });
  } catch (error: any) {
    console.error('[GITHUB] Import error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

// POST /api/v1/github/push
router.post('/push', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { roomId, commitMessage } = req.body;

    if (!roomId || !commitMessage) {
      res.status(400).json({ success: false, error: 'roomId and commitMessage are required.' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.githubToken) {
      res.status(401).json({ success: false, error: 'GitHub OAuth token not found. Please log in with GitHub.' });
      return;
    }
    let pat: string;
    try {
      pat = decryptToken(user.githubToken);
    } catch {
      res.status(401).json({ success: false, error: 'Stored GitHub token is invalid. Please re-authenticate with GitHub.' });
      return;
    }

    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: { files: true }
    });

    if (!room || room.ownerId !== userId) {
      res.status(403).json({ success: false, error: 'Access denied or room not found.' });
      return;
    }

    if (!room.githubRepo || !room.githubBranch) {
      res.status(400).json({ success: false, error: 'Room is not linked to a GitHub repository.' });
      return;
    }

    const repo = room.githubRepo;
    const branch = room.githubBranch;

    const refData = await fetchGithubAPI(`https://api.github.com/repos/${repo}/git/ref/heads/${branch}`, pat);
    const latestCommitSha = refData.object.sha;

    const latestCommitData = await fetchGithubAPI(`https://api.github.com/repos/${repo}/git/commits/${latestCommitSha}`, pat);
    const baseTreeSha = latestCommitData.tree.sha;

    // Force-flush any pending Yjs snapshots to DB
    await roomManager.saveRoomNow(roomId);

    const newTree = [];
    for (const file of room.files) {
      if (file.isFolder) continue; 
      
      // Try to get live content from in-memory Y.Doc first
      // Falls back to DB content if the file hasn't been opened this session
      const liveDoc = roomManager.getDocIfExists(file.id);
      const liveContent = liveDoc
        ? liveDoc.getText('monaco').toString()
        : file.content;
      
      const blobData = await fetchGithubAPI(`https://api.github.com/repos/${repo}/git/blobs`, pat, 'POST', {
        content: liveContent,
        encoding: 'utf-8'
      });
      
      newTree.push({
        path: file.name,
        mode: '100644',
        type: 'blob',
        sha: blobData.sha
      });
    }

    const newTreeData = await fetchGithubAPI(`https://api.github.com/repos/${repo}/git/trees`, pat, 'POST', {
      base_tree: baseTreeSha,
      tree: newTree
    });

    const newCommitData = await fetchGithubAPI(`https://api.github.com/repos/${repo}/git/commits`, pat, 'POST', {
      message: commitMessage,
      tree: newTreeData.sha,
      parents: [latestCommitSha]
    });

    await fetchGithubAPI(`https://api.github.com/repos/${repo}/git/refs/heads/${branch}`, pat, 'PATCH', {
      sha: newCommitData.sha,
      force: false
    });

    res.json({ success: true, message: 'Successfully pushed to GitHub.' });
  } catch (error: any) {
    console.error('[GITHUB] Push error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

export default router;
