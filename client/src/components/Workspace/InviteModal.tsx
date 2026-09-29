import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MdClose, MdCheck } from 'react-icons/md';
import { FaGithub } from 'react-icons/fa';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

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

  const API_BASE = (
    import.meta.env.VITE_API_URL ||
    (window.location.hostname === 'localhost'
      ? 'http://localhost:3001'
      : 'https://streamsync-cxox.onrender.com')
  ).replace(/\/$/, '');

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
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ roomId, targetUsername: username.trim(), role }),
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
      }, 1800);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      {/* Motion Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm"
      />

      {/* Modal Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ type: 'spring', stiffness: 420, damping: 28 }}
        className="relative z-10 w-full max-w-md bg-surface border border-outline-variant/35 shadow-[0_16px_50px_rgba(0,0,0,0.6)] rounded-3xl p-6 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-on-surface m-0 tracking-tight">
            Share Workspace
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-surface-container rounded-xl text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
            title="Close"
          >
            <MdClose size={18} />
          </button>
        </div>

        <p className="text-xs text-on-surface-variant mb-5 font-medium leading-relaxed">
          Invite collaborators by their GitHub username to collaborate with real-time code editing and canvas synchronization.
        </p>

        <form onSubmit={handleInvite} className="flex flex-col gap-4">
          <div className="flex gap-2 items-center">
            <div className="flex-1">
              <Input
                icon={<FaGithub size={15} />}
                type="text"
                placeholder="GitHub Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading || success}
                autoFocus
                className="font-mono text-xs"
              />
            </div>

            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'VIEW' | 'EDIT')}
              disabled={isLoading || success}
              className="bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-xs text-on-surface focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15 transition-all cursor-pointer font-sans font-medium"
            >
              <option value="EDIT">Editor</option>
              <option value="VIEW">Viewer</option>
            </select>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="text-error text-xs bg-error/10 border border-error/25 p-3 rounded-xl font-medium"
              >
                {error}
              </motion.div>
            )}

            {success && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-emerald-400 text-xs bg-emerald-500/10 border border-emerald-500/25 p-3 rounded-xl font-medium flex items-center gap-2"
              >
                <MdCheck size={16} />
                <span>Invite sent successfully!</span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex justify-end gap-2.5 mt-2">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={!username.trim() || isLoading || success}
              isLoading={isLoading}
            >
              Send Invite
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
