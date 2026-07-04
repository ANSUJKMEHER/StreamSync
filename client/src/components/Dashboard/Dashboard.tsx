import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { roomService, type Room } from '../../services/roomService';
import { githubService, type GithubRepo } from '../../services/githubService';
import UserDropdown from '../Auth/UserDropdown';
import NotificationsHub from './NotificationsHub';
import './Dashboard.css';

export default function Dashboard() {
  const { token } = useAuthStore();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [repos, setRepos] = useState<GithubRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [reposLoading, setReposLoading] = useState(false);
  const [githubError, setGithubError] = useState<string | null>(null);
  const [newRoomName, setNewRoomName] = useState('');

  useEffect(() => {
    if (!token) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const returnTo = params.get('returnTo');
    if (returnTo && returnTo.startsWith('/room/')) {
      navigate(returnTo);
      return;
    }

    const fetchRoomsAndRepos = async () => {
      try {
        const data = await roomService.getRooms(token);
        setRooms(data);
      } catch (err) {
        console.error('Failed to load rooms:', err);
      } finally {
        setLoading(false);
      }
      
      try {
        setReposLoading(true);
        setGithubError(null);
        const userRepos = await githubService.getUserRepos(token);
        setRepos(userRepos);
      } catch (err: any) {
        console.error('Failed to load github repos:', err);
        setGithubError(err.message || 'Failed to connect to GitHub');
      } finally {
        setReposLoading(false);
      }
    };
    fetchRoomsAndRepos();

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_SUCCESS') {
        const { token, user } = event.data.payload;
        useAuthStore.getState().setAuth(user, token);
        // Re-fetch repos with the new token
        githubService.getUserRepos(token).then(userRepos => {
          setRepos(userRepos);
          setGithubError(null);
        }).catch(err => {
          console.error('Failed to reload github repos:', err);
          setGithubError(err.message || 'Failed to connect to GitHub');
        });
      }
    };
    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
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
  const [isImporting, setIsImporting] = useState(false);

  const handleImportGithub = async (repoToImport: string) => {
    if (!token) return;
    
    let cleanedRepo = repoToImport.trim();
    if (cleanedRepo.includes('github.com/')) {
      cleanedRepo = cleanedRepo.split('github.com/')[1];
    }
    cleanedRepo = cleanedRepo.replace(/\/$/, '').replace(/\.git$/, '');

    setIsImporting(true);

    try {
      const room = await githubService.importRepo(cleanedRepo, '', '', token);
      navigate(`/room/${room.id}`);
    } catch (err: any) {
      console.error('Failed to import repo:', err);
      alert(`Import failed: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const filteredRepos = repos.filter(r => r.full_name.toLowerCase().includes(searchQuery.toLowerCase()));

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

          <section className="import-github-section" style={{ flex: 2, minWidth: '400px' }}>
            <div className="import-github-header">
              <h2>Import Git Repository</h2>
            </div>
            
            <div className="import-github-controls">
              <div className="import-dropdown">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                {repos.length > 0 ? repos[0].full_name.split('/')[0] : 'GitHub'}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </div>
              <div className="import-search">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: 'var(--text-muted)'}}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                <input 
                  type="text" 
                  placeholder="Search..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="github-repo-list-container">
              {reposLoading ? (
                <div className="repo-loading">Loading repositories...</div>
              ) : githubError ? (
                <div className="no-repos-msg" style={{ color: '#ef4444' }}>
                  {githubError}
                  <br />
                  <button onClick={() => window.open(`${import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:3001' : 'https://streamsync-cxox.onrender.com')}/api/v1/oauth/github`, 'GitHub OAuth', 'width=600,height=700')} className="btn-primary" style={{ marginTop: '1rem' }}>
                    Connect GitHub
                  </button>
                </div>
              ) : repos.length === 0 ? (
                <div className="no-repos-msg">
                  No repositories found. Ensure you are connected to GitHub.
                </div>
              ) : (
                <div className="github-repo-list">
                  {filteredRepos.map(repo => (
                    <div key={repo.id} className="repo-list-item">
                      <div className="repo-info">
                        <div className="repo-icon-wrap">
                          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                          </svg>
                        </div>
                        <div className="repo-name">
                          {repo.name}
                          {repo.private && (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: 'var(--text-muted)'}}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                          )}
                          <span className="repo-time-ago">· {Math.round((Date.now() - new Date(repo.updated_at).getTime()) / (1000 * 60 * 60 * 24))}d ago</span>
                        </div>
                      </div>
                      <button 
                        className="btn-import-repo" 
                        onClick={() => handleImportGithub(repo.full_name)}
                        disabled={isImporting}
                      >
                        Import
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="import-manual-divider">
              <span>or import via URL</span>
            </div>

            <div className="create-room-form manual-import-form">
              <input
                type="text"
                placeholder="Repository URL (e.g. https://github.com/facebook/react)"
                value={importRepo}
                onChange={(e) => setImportRepo(e.target.value)}
              />
              <button 
                className="btn-primary" 
                disabled={isImporting || !importRepo.trim()} 
                onClick={() => handleImportGithub(importRepo)}
                style={{ background: 'var(--text-primary)', color: 'var(--bg-surface)' }}
              >
                Import URL
              </button>
            </div>
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
