import { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import type { RoomInvite } from '../../types';
import './NotificationsHub.css';

export default function NotificationsHub() {
  const [invites, setInvites] = useState<RoomInvite[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { token } = useAuthStore();

  const API_BASE = (import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:3001' : 'https://streamsync-cxox.onrender.com')).replace(/\/$/, '');

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
    <div className="notifications-container">
      <button 
        className={`notifications-btn ${invites.length > 0 ? 'has-unread' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Notifications"
      >
        🔔
        {invites.length > 0 && <span className="notifications-badge">{invites.length}</span>}
      </button>

      {isOpen && (
        <div className="notifications-popover">
          <div className="notifications-header">
            <h3>Pending Invites</h3>
            <button className="close-btn" onClick={() => setIsOpen(false)}>&times;</button>
          </div>
          <div className="notifications-body">
            {invites.length === 0 ? (
              <div className="no-notifications">No pending invites.</div>
            ) : (
              invites.map(invite => (
                <div key={invite.id} className="invite-card">
                  <div className="invite-info">
                    <p>
                      <strong>{invite.inviter?.username || 'Someone'}</strong> invited you to join
                    </p>
                    <p className="invite-room-name">{invite.room?.name}</p>
                    <p className="invite-role">Role: {invite.role}</p>
                  </div>
                  <div className="invite-actions">
                    <button 
                      className="btn-reject" 
                      onClick={() => handleAction(invite.id, 'reject')}
                      disabled={loading}
                    >
                      Decline
                    </button>
                    <button 
                      className="btn-accept" 
                      onClick={() => handleAction(invite.id, 'accept')}
                      disabled={loading}
                    >
                      Accept
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

