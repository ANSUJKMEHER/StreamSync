import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Check, X, Mail } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import type { RoomInvite } from '../../types';

export default function NotificationsHub() {
  const [invites, setInvites] = useState<RoomInvite[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { token } = useAuthStore();
  const hubRef = useRef<HTMLDivElement>(null);

  const API_BASE = (
    import.meta.env.VITE_API_URL ||
    (window.location.hostname === 'localhost'
      ? 'http://localhost:3001'
      : 'https://streamsync-cxox.onrender.com')
  ).replace(/\/$/, '');

  const fetchInvites = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/invites`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) {
        setInvites(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch invites:', err);
    }
  };

  useEffect(() => {
    fetchInvites();
    // Poll every 30s for new invites
    const interval = setInterval(fetchInvites, 30000);
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (hubRef.current && !hubRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAction = async (inviteId: string, action: 'accept' | 'reject') => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/invites/${inviteId}/${action}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) {
        const acceptedInvite = invites.find(i => i.id === inviteId);
        setInvites(invites.filter(i => i.id !== inviteId));
        
        // Redirect to the room immediately if accepted
        if (action === 'accept' && acceptedInvite?.roomId) {
          window.location.href = `/room/${acceptedInvite.roomId}`;
        }
      } else {
        alert(json.error || 'Failed to process invite');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative select-none" ref={hubRef}>
      {/* Bell Action Button */}
      <motion.button 
        whileTap={{ scale: 0.95 }}
        className="relative p-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container border border-transparent hover:border-outline-variant/30 transition-all cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell className="size-4" />
        
        {/* Kokonut-style Glowing Radar Badge */}
        {invites.length > 0 && (
          <span className="absolute top-1 right-1 flex size-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full size-2.5 bg-primary" />
          </span>
        )}
      </motion.button>

      {/* Popover */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 450, damping: 28 }}
            className="absolute top-full right-0 mt-2 w-80 bg-surface border border-outline-variant/40 rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.5)] z-[9999] overflow-hidden backdrop-blur-xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-surface-container-low/60 border-b border-outline-variant/20">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-on-surface">Notifications</span>
                {invites.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-primary/15 text-primary border border-primary/20">
                    {invites.length}
                  </span>
                )}
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-surface-container transition-colors cursor-pointer"
              >
                <X className="size-3.5" />
              </button>
            </div>

            {/* List */}
            <div className="max-h-80 overflow-y-auto p-2 flex flex-col gap-2 no-scrollbar">
              {invites.length === 0 ? (
                <div className="py-8 px-4 text-center flex flex-col items-center justify-center gap-2 text-on-surface-variant">
                  <div className="p-2.5 rounded-full bg-surface-container border border-outline-variant/20">
                    <Mail className="size-4 opacity-50" />
                  </div>
                  <span className="text-xs font-medium">No pending invites</span>
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {invites.map(invite => (
                    <motion.div 
                      key={invite.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/25 flex flex-col gap-2.5"
                    >
                      <div>
                        <p className="text-xs text-on-surface">
                          <strong className="text-primary font-semibold">
                            {invite.inviter?.username || 'Someone'}
                          </strong>{' '}
                          invited you to join
                        </p>
                        <p className="text-xs font-bold text-on-surface mt-0.5 truncate">
                          {invite.room?.name || 'Workspace'}
                        </p>
                        <span className="inline-block mt-1 text-[10px] uppercase tracking-wider font-semibold text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-md border border-outline-variant/20">
                          Role: {invite.role}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 pt-1 border-t border-outline-variant/15">
                        <button 
                          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-medium text-on-surface-variant hover:text-error hover:bg-error/10 border border-outline-variant/20 rounded-lg transition-colors disabled:opacity-50 cursor-pointer" 
                          onClick={() => handleAction(invite.id, 'reject')}
                          disabled={loading}
                        >
                          <X className="size-3" />
                          <span>Decline</span>
                        </button>
                        <button 
                          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-bold text-background bg-primary hover:bg-primary/95 rounded-lg shadow-sm transition-all disabled:opacity-50 cursor-pointer" 
                          onClick={() => handleAction(invite.id, 'accept')}
                          disabled={loading}
                        >
                          <Check className="size-3" />
                          <span>Accept</span>
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
