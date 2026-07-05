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
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-on-surface-variant animate-pulse font-code text-lg">Loading workspaces...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-on-surface font-sans">
      {/* Header */}
      <header className="h-16 border-b border-outline-variant/30 flex items-center justify-between px-6 bg-surface">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-md bg-gradient-to-br from-primary to-accent text-white flex items-center justify-center font-bold text-lg shadow-[0_2px_8px_rgba(208,188,255,0.4)]">
            S
          </div>
          <span className="font-headline-md font-bold text-primary tracking-tight text-xl">StreamSync</span>
        </div>
        
        <div className="flex items-center gap-4">
          <NotificationsHub />
          <UserDropdown />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Welcome Text */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-on-surface mb-2">
            Welcome back, {useAuthStore.getState().user?.username?.split(' ')[0] || 'Developer'}
          </h1>
          <p className="text-on-surface-variant text-body-lg">Here's an overview of your recent projects and repositories.</p>
        </div>

        {/* Two Columns */}
        <div className="flex flex-col lg:flex-row gap-8">
           {/* Left Column */}
           <div className="flex-1 flex flex-col gap-8 min-w-[320px]">
             {/* Create Workspace */}
             <section>
               <h2 className="text-title-lg font-semibold text-on-surface mb-4">Create New Workspace</h2>
               <div className="bg-surface-container-low border border-outline-variant/30 rounded-2xl p-6">
                 <form onSubmit={handleCreateRoom} className="flex flex-col gap-4">
                   <div className="relative">
                     <span className="absolute left-4 top-2 text-on-surface-variant text-xs font-code uppercase tracking-wider">Workspace Name</span>
                     <input
                       type="text"
                       placeholder="e.g. System Architecture"
                       value={newRoomName}
                       onChange={(e) => setNewRoomName(e.target.value)}
                       required
                       className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl py-3 px-4 pt-8 text-on-surface placeholder-on-surface-variant/30 focus:outline-none focus:border-primary transition-colors font-code"
                     />
                   </div>
                   <button type="submit" className="w-full bg-primary hover:bg-primary/90 text-on-primary font-label-lg rounded-xl py-3 transition-colors shadow-[0_4px_12px_rgba(208,188,255,0.2)]">
                     Create Workspace
                   </button>
                 </form>
               </div>
             </section>

             {/* Your Workspaces */}
             <section>
               <h2 className="text-title-lg font-semibold text-on-surface mb-4">Your Workspaces</h2>
               <div className="flex flex-col gap-4">
                  {rooms.length === 0 ? (
                    <div className="text-on-surface-variant p-4">You don't have any workspaces yet.</div>
                  ) : (
                    rooms.map((room) => (
                      <div key={room.id} onClick={() => navigate(`/room/${room.id}`)} className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 hover:border-primary/50 transition-colors cursor-pointer group flex flex-col gap-4">
                        <div className="flex justify-between items-start">
                          <h3 className="font-code-lg text-lg text-primary">{room.name}</h3>
                          <button onClick={(e) => handleDeleteRoom(room.id, e)} className="text-on-surface-variant hover:text-error transition-colors p-1">
                            <span className="material-symbols-outlined text-[20px]">close</span>
                          </button>
                        </div>
                        <div className="text-on-surface-variant text-body-sm font-code">
                          {room._count?.files || 0} Files
                        </div>
                        <div className="flex items-center gap-2">
                           <button 
                             onClick={(e) => handleTogglePublic(room, e)}
                             className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold hover:opacity-80 transition-opacity ${room.isPublic ? 'bg-success/10 text-success' : 'bg-surface-variant text-on-surface-variant'}`}
                           >
                             <span className="material-symbols-outlined text-[14px]">{room.isPublic ? 'public' : 'lock'}</span>
                             {room.isPublic ? 'Public' : 'Private'}
                           </button>
                           {room.isPublic && (
                             <button
                               onClick={(e) => handleToggleAccess(room, e)}
                               className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-surface-variant text-on-surface-variant hover:bg-surface-container-high transition-colors"
                             >
                               {room.publicAccess === 'VIEW' ? 'Read-Only' : 'Anyone can Edit'}
                             </button>
                           )}
                        </div>
                        <div className="text-on-surface-variant/70 text-xs font-code mt-2">
                          Created {new Date(room.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    ))
                  )}
               </div>
             </section>
           </div>

           {/* Right Column */}
           <div className="lg:w-[600px] flex-shrink-0 flex flex-col gap-8">
             <section>
               <h2 className="text-title-lg font-semibold text-on-surface mb-4">Import Git Repository</h2>
               <div className="bg-surface-container-low border border-outline-variant/30 rounded-2xl overflow-hidden flex flex-col h-[700px]">
                 
                 {/* Top Controls */}
                 <div className="p-4 border-b border-outline-variant/20 flex gap-4 bg-surface-container-lowest">
                   <div className="flex items-center gap-2 bg-surface-variant rounded-lg px-3 py-2 text-on-surface">
                     <span className="material-symbols-outlined text-[18px]">account_circle</span>
                     <span className="font-label-md">{repos.length > 0 ? repos[0].full_name.split('/')[0] : 'GitHub'}</span>
                     <span className="material-symbols-outlined text-[18px]">keyboard_arrow_down</span>
                   </div>
                   <div className="flex-1 flex items-center gap-2 bg-surface-container rounded-lg px-3 py-2 border border-outline-variant/30 focus-within:border-primary transition-colors">
                     <span className="material-symbols-outlined text-[18px] text-on-surface-variant">search</span>
                     <input 
                       type="text" 
                       placeholder="Search..." 
                       className="bg-transparent border-none outline-none text-on-surface w-full placeholder-on-surface-variant/50 font-code text-sm"
                       value={searchQuery}
                       onChange={(e) => setSearchQuery(e.target.value)}
                     />
                   </div>
                 </div>

                 {/* Repo List */}
                 <div className="flex-1 overflow-y-auto no-scrollbar">
                    {reposLoading ? (
                      <div className="p-8 text-center text-on-surface-variant animate-pulse font-code text-sm">Loading repositories...</div>
                    ) : githubError ? (
                      <div className="p-8 text-center flex flex-col items-center gap-4">
                        <span className="text-error font-code text-sm">{githubError}</span>
                        <button onClick={() => window.open(`${import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:3001' : 'https://streamsync-cxox.onrender.com')}/api/v1/oauth/github`, 'GitHub OAuth', 'width=600,height=700')} className="bg-surface-variant hover:bg-surface-container-highest text-on-surface px-4 py-2 rounded-lg transition-colors font-label-md">
                          Connect GitHub
                        </button>
                      </div>
                    ) : repos.length === 0 ? (
                      <div className="p-8 text-center text-on-surface-variant font-code text-sm">
                        No repositories found. Ensure you are connected to GitHub.
                      </div>
                    ) : (
                      <div className="flex flex-col">
                        {filteredRepos.map(repo => (
                          <div key={repo.id} className="flex items-center justify-between p-4 border-b border-outline-variant/10 hover:bg-surface-container-lowest transition-colors">
                            <div className="flex items-center gap-3">
                              <span className="material-symbols-outlined text-[20px] text-on-surface-variant">folder_zip</span>
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <span className="font-code text-on-surface text-sm">{repo.name}</span>
                                  {repo.private && <span className="material-symbols-outlined text-[14px] text-on-surface-variant">lock</span>}
                                </div>
                                <span className="text-xs text-on-surface-variant font-code mt-1">
                                  {Math.round((Date.now() - new Date(repo.updated_at).getTime()) / (1000 * 60 * 60 * 24))}d ago
                                </span>
                              </div>
                            </div>
                            <button 
                              onClick={() => handleImportGithub(repo.full_name)}
                              disabled={isImporting}
                              className="bg-surface-variant hover:bg-surface-container-highest text-on-surface font-label-md px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                            >
                              Import
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                 </div>

                 {/* URL Import */}
                 <div className="p-6 border-t border-outline-variant/20 bg-surface-container-lowest">
                   <div className="relative text-center mb-6">
                     <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-outline-variant/30"></div></div>
                     <span className="relative bg-surface-container-lowest px-4 text-xs text-on-surface-variant font-code uppercase tracking-wider">or import via URL</span>
                   </div>
                   <div className="flex gap-4">
                     <input
                       type="text"
                       placeholder="Repository URL (e.g. https://github.com/facebook/react)"
                       value={importRepo}
                       onChange={(e) => setImportRepo(e.target.value)}
                       className="flex-1 bg-surface-container border border-outline-variant/30 rounded-lg px-4 py-2.5 text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:border-primary transition-colors font-code text-sm"
                     />
                     <button 
                       disabled={isImporting || !importRepo.trim()} 
                       onClick={() => handleImportGithub(importRepo)}
                       className="bg-surface-variant hover:bg-surface-container-highest text-on-surface font-label-md px-6 py-2.5 rounded-lg transition-colors disabled:opacity-50"
                     >
                       Import URL
                     </button>
                   </div>
                 </div>

               </div>
             </section>
           </div>
        </div>
      </main>
    </div>
  );
}
