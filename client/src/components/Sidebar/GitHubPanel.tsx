import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useFileStore } from '../../store/fileStore';
import { githubService } from '../../services/githubService';
import type { Room } from '../../services/roomService';
import { FaGithub } from 'react-icons/fa6';
import { VscGitMerge } from 'react-icons/vsc';

interface GitHubPanelProps {
  roomData: Room | null;
}

export default function GitHubPanel({ roomData }: GitHubPanelProps) {
  const { token } = useAuthStore();
  const { files, saveFile } = useFileStore();
  
  const [commitMessage, setCommitMessage] = useState('');
  const [isPushing, setIsPushing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handlePush = async () => {
    if (!roomData || !token || !commitMessage.trim()) return;
    
    setIsPushing(true);
    setError(null);
    setSuccess(false);
    
    try {
      // Force flush all files from Yjs to the backend database before pushing
      const fileIds = files.filter(f => !f.isFolder).map(f => f.id);
      await Promise.all(fileIds.map(id => saveFile(id)));

      await githubService.pushRepo(roomData.id, commitMessage.trim(), '', token);
      setSuccess(true);
      setCommitMessage('');
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to push to GitHub');
    } finally {
      setIsPushing(false);
    }
  };

  if (!roomData) {
    return (
      <div className="h-full flex flex-col">
        <div className="px-4 py-3 border-b border-outline-variant/10">
          <h2 className="font-label-md text-label-md font-bold tracking-wider text-on-surface-variant uppercase m-0">Source Control</h2>
        </div>
        <div className="p-4 text-center text-on-surface-variant font-body-md mt-10">
          Open a workspace to manage source control.
        </div>
      </div>
    );
  }

  if (!roomData.githubRepo) {
    return (
      <div className="h-full flex flex-col">
        <div className="px-4 py-3 border-b border-outline-variant/10">
          <h2 className="font-label-md text-label-md font-bold tracking-wider text-on-surface-variant uppercase m-0">Source Control</h2>
        </div>
        <div className="p-4 text-center text-on-surface-variant font-body-md mt-10">
          This workspace is not linked to a GitHub repository.
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-outline-variant/10">
        <h2 className="font-label-md text-label-md font-bold tracking-wider text-on-surface-variant uppercase m-0">Source Control</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 text-on-surface">
            <FaGithub size={18} className="text-on-surface-variant" />
            <span className="font-label-md bg-surface-variant/50 px-2 py-1 rounded-md border border-outline-variant/30">{roomData.githubRepo}</span>
          </div>
          <div className="flex items-center gap-3 text-on-surface">
            <VscGitMerge size={18} className="text-on-surface-variant" />
            <span className="font-label-md bg-surface-variant/50 px-2 py-1 rounded-md border border-outline-variant/30">{roomData.githubBranch || 'main'}</span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <textarea
            className="w-full min-h-[80px] bg-surface-container-highest border border-outline-variant/40 text-on-surface rounded-lg p-3 font-body-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50 transition-colors resize-y"
            placeholder="Commit message"
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            disabled={isPushing}
            rows={3}
          />
          <button 
            className="w-full bg-on-surface text-surface py-2 rounded-lg font-label-md font-bold hover:bg-on-surface-variant disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
            onClick={handlePush}
            disabled={!commitMessage.trim() || isPushing}
          >
            {isPushing ? 'Pushing...' : 'Commit & Push'}
          </button>
        </div>

        {error && <div className="text-error font-body-sm bg-error/10 p-3 rounded-lg border border-error/20">{error}</div>}
        {success && <div className="text-success font-body-sm bg-success/10 p-3 rounded-lg border border-success/20">Successfully pushed to GitHub!</div>}

        <div className="flex flex-col gap-3">
          <h3 className="font-label-sm font-bold tracking-widest text-on-surface-variant uppercase m-0">Changes ({files.filter(f => !f.isFolder).length})</h3>
          <div className="flex flex-col gap-1">
            {files.filter(f => !f.isFolder).map(f => (
              <div key={f.id} className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-surface-variant/50 group transition-colors">
                <span className="font-mono text-[10px] font-bold text-warning w-4 text-center">M</span>
                <span className="font-body-sm text-on-surface-variant group-hover:text-on-surface truncate">{f.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
