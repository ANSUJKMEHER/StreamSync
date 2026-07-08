import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { roomService, type Room } from '../../services/roomService';
import { githubService, type GithubRepo } from '../../services/githubService';
import { MdClose, MdPublic, MdLock, MdAccountCircle, MdKeyboardArrowDown, MdSearch, MdFolderZip } from 'react-icons/md';
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
  const navigateToRoom = (roomId: string) => {
    navigate(`/room/${roomId}`);
  };

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
      setNewRoomName('');
      navigateToRoom(room.id);
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
      navigateToRoom(room.id);
    } catch (err: any) {
      console.error('Failed to import repo:', err);
      alert(`Import failed: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const filteredRepos = repos.filter(r => r.full_name.toLowerCase().includes(searchQuery.toLowerCase()));



  return (
    <div className="min-h-screen bg-background text-on-surface font-sans transition-colors duration-300">
      {/* Header */}
      <header className="h-16 border-b border-outline-variant/25 flex items-center justify-between px-6 bg-surface shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/30 to-primary/80 border border-primary/20 text-white flex items-center justify-center font-bold text-lg shadow-[0_2px_8px_rgba(223,171,108,0.15)]">
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
          <h1 className="text-4xl font-bold text-on-surface mb-2 tracking-tight">
            Welcome back, {useAuthStore.getState().user?.username?.split(' ')[0] || 'Developer'}
          </h1>
          <p className="text-on-surface-variant font-medium">Here's an overview of your recent projects and repositories.</p>
        </div>

        {/* Two Columns */}
        <div className="flex flex-col lg:flex-row gap-8">
           {/* Left Column */}
           <div className="flex-1 flex flex-col gap-8 min-w-[320px]">
             {/* Create Workspace */}
             <section>
               <h2 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-3">Create New Workspace</h2>
               <div className="bg-surface border border-outline-variant/30 rounded-2xl p-6 shadow-sm">
                 <form onSubmit={handleCreateRoom} className="flex flex-col gap-4">
                   <div className="relative">
                     <span className="absolute left-4 top-2.5 text-on-surface-variant/80 text-[10px] font-semibold uppercase tracking-wider">Workspace Name</span>
                     <input
                       type="text"
                       placeholder="e.g. System Architecture"
                       value={newRoomName}
                       onChange={(e) => setNewRoomName(e.target.value)}
                       required
                       className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl py-3 px-4 pt-8 text-on-surface placeholder-on-surface-variant/20 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all font-code text-sm"
                     />
                   </div>
                   <button type="submit" className="w-full bg-primary hover:bg-primary/95 text-background font-bold text-xs rounded-xl py-3.5 transition-all shadow-[0_4px_16px_rgba(223,171,108,0.15)] hover:shadow-[0_4px_20px_rgba(223,171,108,0.25)]">
                     Create Workspace
                   </button>
                 </form>
               </div>
             </section>

             {/* Your Workspaces */}
             <section>
               <h2 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-3">Your Workspaces</h2>
               <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-4">
                  {loading ? (
                    <div className="text-on-surface-variant p-4 animate-pulse font-code text-xs">Loading workspaces...</div>
                  ) : rooms.length === 0 ? (
                    <div className="text-on-surface-variant p-4 font-code text-xs">You don't have any workspaces yet.</div>
                  ) : (
                    rooms.map((room) => (
                      <div key={room.id} onClick={() => navigateToRoom(room.id)} className="bg-surface border border-outline-variant/30 rounded-2xl p-5 hover:border-primary/40 hover:scale-[1.01] hover:shadow-[0_8px_30px_rgba(0,0,0,0.3)] transition-all cursor-pointer group flex flex-col justify-between gap-4 h-[160px]">
                        <div className="flex justify-between items-start gap-2">
                          <h3 className="font-semibold text-base text-white group-hover:text-primary transition-colors truncate max-w-[80%]">{room.name}</h3>
                          <button onClick={(e) => handleDeleteRoom(room.id, e)} className="text-on-surface-variant/70 hover:text-error transition-colors p-1 bg-surface-container rounded-lg border border-outline-variant/10">
                            <MdClose size={15} />
                          </button>
                        </div>
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-1.5">
                            <button 
                              onClick={(e) => handleTogglePublic(room, e)}
                              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold hover:opacity-85 transition-opacity uppercase tracking-wider ${room.isPublic ? 'bg-success/15 text-success border border-success/20' : 'bg-surface-container-high text-on-surface-variant border border-outline-variant/30'}`}
                            >
                              {room.isPublic ? <MdPublic size={12} /> : <MdLock size={12} />}
                              {room.isPublic ? 'Public' : 'Private'}
                            </button>
                            {room.isPublic && (
                              <button
                                onClick={(e) => handleToggleAccess(room, e)}
                                className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-surface-container-high text-on-surface-variant border border-outline-variant/30 hover:bg-surface-container-highest transition-colors uppercase tracking-wider"
                              >
                                {room.publicAccess === 'VIEW' ? 'Read-Only' : 'Collaborative'}
                              </button>
                            )}
                          </div>
                          <div className="flex justify-between items-center text-[11px] text-on-surface-variant/70 font-code mt-1 border-t border-outline-variant/10 pt-2">
                            <span>{room._count?.files || 0} Files</span>
                            <span>{new Date(room.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
               </div>
             </section>
           </div>

           {/* Right Column */}
           <div className="lg:w-[500px] flex-shrink-0 flex flex-col gap-8">
             <section>
               <h2 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-3">Import Git Repository</h2>
               <div className="bg-surface border border-outline-variant/30 rounded-2xl overflow-hidden flex flex-col h-[650px] shadow-sm">
                 
                 {/* Top Controls */}
                 <div className="p-4 border-b border-outline-variant/20 flex gap-3 bg-surface-container-low">
                   <div className="flex items-center gap-2 bg-surface-container border border-outline-variant/20 rounded-xl px-3.5 py-1.5 text-on-surface cursor-pointer hover:bg-surface-container-high transition-colors">
                     <MdAccountCircle size={18} className="text-primary" />
                     <span className="text-xs font-semibold">{repos.length > 0 ? repos[0].full_name.split('/')[0] : 'GitHub'}</span>
                     <MdKeyboardArrowDown size={14} className="text-on-surface-variant" />
                   </div>
                   <div className="flex-1 flex items-center gap-2 bg-surface-container border border-outline-variant/10 rounded-xl px-3 py-1.5 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
                     <MdSearch size={16} className="text-on-surface-variant" />
                     <input 
                       type="text" 
                       placeholder="Search..." 
                       className="bg-transparent border-none outline-none text-on-surface w-full placeholder-on-surface-variant/30 font-code text-xs"
                       value={searchQuery}
                       onChange={(e) => setSearchQuery(e.target.value)}
                     />
                   </div>
                 </div>

                 {/* Repo List */}
                 <div className="flex-1 overflow-y-auto no-scrollbar bg-surface-container-lowest">
                    {reposLoading ? (
                      <div className="p-8 text-center text-on-surface-variant animate-pulse font-code text-xs">Loading repositories...</div>
                    ) : githubError ? (
                      <div className="p-8 text-center flex flex-col items-center gap-4">
                        <span className="text-error font-code text-xs bg-error/10 border border-error/20 p-3 rounded-xl">{githubError}</span>
                        <button onClick={() => window.open(`${import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:3001' : 'https://streamsync-cxox.onrender.com')}/api/v1/oauth/github`, 'GitHub OAuth', 'width=600,height=700')} className="bg-primary hover:bg-primary/95 text-background px-4 py-2 rounded-xl transition-colors font-bold text-xs shadow-md">
                          Connect GitHub
                        </button>
                      </div>
                    ) : repos.length === 0 ? (
                      <div className="p-8 text-center text-on-surface-variant font-code text-xs">
                        No repositories found. Ensure you are connected to GitHub.
                      </div>
                    ) : (
                      <div className="flex flex-col divide-y divide-outline-variant/10">
                        {filteredRepos.map(repo => (
                          <div key={repo.id} className="flex items-center justify-between p-4 hover:bg-surface-container-low transition-colors">
                            <div className="flex items-center gap-3">
                              <MdFolderZip size={20} className="text-primary/60" />
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <span className="font-code text-on-surface text-xs font-semibold">{repo.name}</span>
                                  {repo.private && <MdLock size={12} className="text-on-surface-variant/80" />}
                                </div>
                                <span className="text-[10px] text-on-surface-variant/60 font-code mt-0.5">
                                  Updated {Math.round((Date.now() - new Date(repo.updated_at).getTime()) / (1000 * 60 * 60 * 24))}d ago
                                </span>
                              </div>
                            </div>
                            <button 
                              onClick={() => handleImportGithub(repo.full_name)}
                              disabled={isImporting}
                              className="bg-surface hover:bg-surface-container-high border border-outline-variant/20 hover:border-primary/30 text-on-surface font-semibold text-xs px-3.5 py-1.5 rounded-xl transition-all disabled:opacity-50"
                            >
                              Import
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                 </div>

                 {/* URL Import */}
                 <div className="p-5 border-t border-outline-variant/25 bg-surface-container-low">
                   <div className="relative text-center mb-5">
                     <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-outline-variant/10"></div></div>
                     <span className="relative bg-surface-container-low px-3.5 text-[10px] text-on-surface-variant/80 font-bold uppercase tracking-wider">or import via URL</span>
                   </div>
                   <div className="flex gap-2">
                     <input
                       type="text"
                       placeholder="Repository URL (e.g. https://github.com/owner/repo)"
                       value={importRepo}
                       onChange={(e) => setImportRepo(e.target.value)}
                       className="flex-1 bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-4 py-2.5 text-on-surface placeholder-on-surface-variant/25 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all font-code text-xs"
                     />
                     <button 
                       disabled={isImporting || !importRepo.trim()} 
                       onClick={() => handleImportGithub(importRepo)}
                       className="bg-primary hover:bg-primary/95 text-background font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-[0_4px_16px_rgba(223,171,108,0.15)] disabled:opacity-50 disabled:shadow-none"
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
