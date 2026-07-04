import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { roomService, type Room } from '../../services/roomService';
import UserDropdown from '../Auth/UserDropdown';
import NotificationsHub from './NotificationsHub';
import './Dashboard.css';

export default function Dashboard() {
  const { token } = useAuthStore();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [newRoomName, setNewRoomName] = useState('');

  useEffect(() => {
    if (!token) {
      return;
    }

    const fetchRooms = async () => {
      try {
        const data = await roomService.getRooms(token);
        setRooms(data);
      } catch (err) {
        console.error('Failed to load rooms:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchRooms();
  }, [token, navigate]);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim() || !token) return;
    try {
      const room = await roomService.createRoom(newRoomName, token);
      navigate(`/room/${room.id}`);
    } catch (err) {
      console.error('Failed to create room:', err);
    }
  };

  const handleDeleteRoom = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!token || !confirm('Are you sure you want to delete this workspace?')) return;
    try {
      await roomService.deleteRoom(id, token);
      setRooms(rooms.filter(r => r.id !== id));
    } catch (err) {
      console.error('Failed to delete room:', err);
    }
  };

  const handleTogglePublic = async (room: Room, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!token) return;
    try {
      const updated = await roomService.updateRoom(room.id, { isPublic: !room.isPublic }, token);
      setRooms(rooms.map(r => r.id === updated.id ? updated : r));
    } catch (err) {
      console.error('Failed to update room:', err);
    }
  };

  const handleToggleAccess = async (room: Room, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!token) return;
    const newAccess = room.publicAccess === 'VIEW' ? 'EDIT' : 'VIEW';
    try {
      const updated = await roomService.updateRoom(room.id, { publicAccess: newAccess }, token);
      setRooms(rooms.map(r => r.id === updated.id ? updated : r));
    } catch (err) {
      console.error('Failed to update access:', err);
    }
  };

  const [importRepo, setImportRepo] = useState('');
  const [importBranch, setImportBranch] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const handleImportGithub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importRepo.trim() || !token) return;
    
    let cleanedRepo = importRepo.trim();
    if (cleanedRepo.includes('github.com/')) {
      cleanedRepo = cleanedRepo.split('github.com/')[1];
    }
    cleanedRepo = cleanedRepo.replace(/\/$/, '').replace(/\.git$/, '');

    setIsImporting(true);

    try {
      const { githubService } = await import('../../services/githubService');
      const room = await githubService.importRepo(cleanedRepo, importBranch, '', token);
      navigate(`/room/${room.id}`);
    } catch (err: any) {
      console.error('Failed to import repo:', err);
      alert(`Import failed: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  if (loading) {
    return <div className="dashboard-loading">Loading workspaces...</div>;
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="dashboard-brand">StreamSync</div>
        <div className="dashboard-user" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <NotificationsHub />
          <UserDropdown />
        </div>
      </header>

      <main className="dashboard-main">
        <div className="dashboard-actions-row" style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          <section className="create-room-section" style={{ flex: 1, minWidth: '300px' }}>
            <h2>Create New Workspace</h2>
            <form onSubmit={handleCreateRoom} className="create-room-form">
              <input
                type="text"
                placeholder="Workspace Name (e.g. System Architecture)"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                required
              />
              <button type="submit" className="btn-primary">Create</button>
            </form>
          </section>

          <section className="import-github-section" style={{ flex: 1, minWidth: '300px', background: 'var(--bg-surface)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <svg height="24" viewBox="0 0 16 16" version="1.1" width="24" fill="currentColor">
                <path fillRule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
              </svg>
              Import from GitHub
            </h2>
            <form onSubmit={handleImportGithub} className="create-room-form" style={{ marginTop: '1rem', flexDirection: 'column' }}>
              <input
                type="text"
                placeholder="Repository (e.g. facebook/react)"
                value={importRepo}
                onChange={(e) => setImportRepo(e.target.value)}
                required
              />
              <input
                type="text"
                placeholder="Branch (optional, defaults to default branch)"
                value={importBranch}
                onChange={(e) => setImportBranch(e.target.value)}
              />
              <button type="submit" className="btn-primary" disabled={isImporting} style={{ background: '#2ea44f', borderColor: '#2ea44f', width: '100%' }}>
                {isImporting ? 'Importing...' : 'Clone & Create Workspace'}
              </button>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                Requires GitHub Account Connection.
              </p>
            </form>
          </section>
        </div>

        <section className="rooms-list-section">
          <h2>Your Workspaces</h2>
          {rooms.length === 0 ? (
            <p className="no-rooms-msg">You don't have any workspaces yet.</p>
          ) : (
            <div className="rooms-grid">
              {rooms.map((room) => (
                <div key={room.id} className="room-card" onClick={() => navigate(`/room/${room.id}`)}>
                  <div className="room-card-header">
                    <h3>{room.name}</h3>
                    <button className="btn-icon delete" onClick={(e) => handleDeleteRoom(room.id, e)}>✕</button>
                  </div>
                  <div className="room-card-stats">
                    {room._count?.files || 0} Files
                  </div>
                  <div className="room-card-sharing">
                    <button 
                      className={`btn-share-toggle ${room.isPublic ? 'active' : ''}`}
                      onClick={(e) => handleTogglePublic(room, e)}
                    >
                      {room.isPublic ? '🌐 Public' : '🔒 Private'}
                    </button>
                    {room.isPublic && (
                      <button 
                        className="btn-access-toggle"
                        onClick={(e) => handleToggleAccess(room, e)}
                      >
                        {room.publicAccess === 'VIEW' ? 'Read-Only' : 'Anyone can Edit'}
                      </button>
                    )}
                  </div>
                  <div className="room-card-footer">
                    Created {new Date(room.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
