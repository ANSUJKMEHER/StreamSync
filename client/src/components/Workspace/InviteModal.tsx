import React, { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import './InviteModal.css';

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

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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
    <div className="invite-modal-overlay" onClick={onClose}>
      <div className="invite-modal" onClick={e => e.stopPropagation()}>
        <div className="invite-modal-header">
          <h2>Share Project</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        
        <p className="invite-modal-desc">
          Invite collaborators by their GitHub username to grant them secure access to this workspace.
        </p>

        <form onSubmit={handleInvite} className="invite-form">
          <div className="input-group">
            <input 
              type="text" 
              placeholder="GitHub Username" 
              value={username}
              onChange={e => setUsername(e.target.value)}
              disabled={isLoading || success}
              autoFocus
            />
            <select 
              value={role} 
              onChange={e => setRole(e.target.value as 'VIEW' | 'EDIT')}
              disabled={isLoading || success}
            >
              <option value="EDIT">Editor</option>
              <option value="VIEW">Viewer</option>
            </select>
          </div>
          
          {error && <div className="invite-error">{error}</div>}
          {success && <div className="invite-success">Invite sent successfully!</div>}

          <div className="invite-modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn-primary" 
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
