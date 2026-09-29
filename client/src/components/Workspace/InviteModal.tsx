import React, { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { MdClose } from 'react-icons/md';

interface InviteModalProps {
  roomId: string;
  onClose: () => void;
}

export default function InviteModal({ roomId, onClose }: InviteModalProps) {
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<'VIEW' | 'EDIT'>('EDIT');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { token } = useAuthStore();

  const API_BASE = (import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:3001' : 'https://streamsync-cxox.onrender.com')).replace(/\/$/, '');

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch(`${API_BASE}/api/v1/invites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ roomId, targetUsername: username.trim(), role })
      });
      
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Failed to send invite');
      }
      
      setSuccess(true);
      setUsername('');
      
      // Auto close after success
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[1000] animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-surface border border-outline-variant/30 shadow-2xl rounded-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-on-surface m-0">Share Project</h2>
          <button onClick={onClose} className="p-2 hover:bg-surface-variant rounded-full text-on-surface-variant transition-colors" title="Close">
            <MdClose size={20} />
          </button>
        </div>
        
        <p className="text-body-md text-on-surface-variant mb-6">
          Invite collaborators by their GitHub username to grant them secure access to this workspace.
        </p>

        <form onSubmit={handleInvite} className="flex flex-col">
          <div className="flex gap-2 mb-4">
            <input 
              type="text" 
              placeholder="GitHub Username" 
              className="flex-1 bg-surface-container border border-outline-variant rounded-lg px-4 py-2.5 text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-on-surface-variant/50"
              value={username}
              onChange={e => setUsername(e.target.value)}
              disabled={isLoading || success}
              autoFocus
            />
            <select 
              value={role} 
              onChange={e => setRole(e.target.value as 'VIEW' | 'EDIT')}
              disabled={isLoading || success}
              className="bg-surface-container border border-outline-variant rounded-lg px-4 py-2.5 text-on-surface focus:outline-none focus:border-primary transition-all cursor-pointer"
            >
              <option value="EDIT">Editor</option>
              <option value="VIEW">Viewer</option>
            </select>
          </div>
          
          {error && <div className="text-error text-label-md mb-4 bg-error/10 p-3 rounded-lg">{error}</div>}
          {success && <div className="text-[#10b981] text-label-md mb-4 bg-[#10b981]/10 p-3 rounded-lg">Invite sent successfully!</div>}

          <div className="flex justify-end gap-3 mt-2">
            <button 
              type="button" 
              className="px-4 py-2 rounded-lg font-label-md font-bold text-on-surface-variant hover:bg-surface-variant hover:text-on-surface transition-colors"
              onClick={onClose}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="px-4 py-2 rounded-lg font-label-md font-bold text-on-primary bg-primary hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
              disabled={!username.trim() || isLoading || success}
            >
              {isLoading ? 'Sending...' : 'Send Invite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

