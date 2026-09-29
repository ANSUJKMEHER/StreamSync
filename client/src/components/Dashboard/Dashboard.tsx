import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuthStore } from '../../store/authStore';
import { roomService, type Room } from '../../services/roomService';
import { githubService, type GithubRepo } from '../../services/githubService';
import {
  MdClose,
  MdPublic,
  MdLock,
  MdSearch,
  MdFolderZip,
  MdAdd,
  MdLayers,
  MdCalendarToday,
  MdInsertDriveFile
} from 'react-icons/md';
import { FaGithub } from 'react-icons/fa';
import UserDropdown from '../Auth/UserDropdown';
import NotificationsHub from './NotificationsHub';
import { SpotlightCard } from '../ui/spotlight-card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import './Dashboard.css';

export default function Dashboard() {
  const { token, user } = useAuthStore();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [repos, setRepos] = useState<GithubRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [reposLoading, setReposLoading] = useState(false);
  const [githubError, setGithubError] = useState<string | null>(null);
  const [newRoomName, setNewRoomName] = useState('');
  const [importRepo, setImportRepo] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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
        githubService
          .getUserRepos(token)
          .then((userRepos) => {
            setRepos(userRepos);
            setGithubError(null);
          })
          .catch((err) => {
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
      setRooms(rooms.filter((r) => r.id !== id));
    } catch (err) {
      console.error('Failed to delete room:', err);
    }
  };

  const handleTogglePublic = async (room: Room, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!token) return;
    try {
      const updated = await roomService.updateRoom(room.id, { isPublic: !room.isPublic }, token);
      setRooms(rooms.map((r) => (r.id === updated.id ? updated : r)));
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
      setRooms(rooms.map((r) => (r.id === updated.id ? updated : r)));
    } catch (err) {
      console.error('Failed to update access:', err);
    }
  };

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

  const filteredRepos = repos.filter((r) =>
    r.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background text-on-surface font-sans transition-colors duration-300">
      {/* Top Header */}
      <header className="h-16 border-b border-outline-variant/25 flex items-center justify-between px-6 bg-surface/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary/30 to-primary/80 border border-primary/25 text-white flex items-center justify-center font-bold text-lg shadow-[0_2px_10px_rgba(223,171,108,0.2)] select-none"
          >
            S
          </motion.div>
          <span className="font-headline-md font-bold text-primary tracking-tight text-xl">
            StreamSync
          </span>
        </div>

        <div className="flex items-center gap-3">
          <NotificationsHub />
          <UserDropdown />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* Welcome Hero Banner */}
        <div className="mb-10">
          <h1 className="text-3xl md:text-4xl font-extrabold text-on-surface mb-2 tracking-tight">
            Welcome back, {user?.username?.split(' ')[0] || 'Developer'}
          </h1>
          <p className="text-on-surface-variant text-xs md:text-sm font-medium">
            Manage your synchronized workspaces and connected GitHub repositories.
          </p>
        </div>

        {/* Two Columns Bento Layout */}
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left Column: Workspaces */}
          <div className="flex-1 flex flex-col gap-8 min-w-[320px]">
            {/* Create Workspace Card */}
            <section>
              <h2 className="text-xs font-bold text-on-surface-variant/80 uppercase tracking-widest mb-3 flex items-center gap-2">
                <MdLayers className="text-primary text-base" /> Create New Workspace
              </h2>
              <div className="bg-surface border border-outline-variant/30 rounded-2xl p-5 shadow-sm">
                <form onSubmit={handleCreateRoom} className="flex flex-col gap-3.5">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-on-surface-variant/80 text-[10px] font-bold uppercase tracking-wider pl-1">
                      Workspace Name
                    </label>
                    <Input
                      type="text"
                      placeholder="e.g. Distributed Consensus Engine"
                      value={newRoomName}
                      onChange={(e) => setNewRoomName(e.target.value)}
                      required
                      className="font-mono text-xs"
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    className="w-full flex items-center justify-center gap-1.5"
                  >
                    <MdAdd size={18} />
                    <span>Create Workspace</span>
                  </Button>
                </form>
              </div>
            </section>

            {/* Your Workspaces Grid */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-bold text-on-surface-variant/80 uppercase tracking-widest flex items-center gap-2">
                  <MdInsertDriveFile className="text-primary text-base" /> Your Workspaces
                </h2>
                <span className="text-[11px] font-mono text-on-surface-variant/70">
                  {rooms.length} {rooms.length === 1 ? 'room' : 'rooms'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {loading ? (
                  <div className="col-span-full py-12 text-center text-on-surface-variant animate-pulse font-mono text-xs">
                    Loading workspaces...
                  </div>
                ) : rooms.length === 0 ? (
                  <div className="col-span-full py-12 px-6 rounded-2xl border border-dashed border-outline-variant/40 text-center text-on-surface-variant font-mono text-xs bg-surface-container-low/30">
                    You don't have any workspaces yet. Create one above to get started!
                  </div>
                ) : (
                  rooms.map((room) => (
                    <SpotlightCard
                      key={room.id}
                      onClick={() => navigateToRoom(room.id)}
                      className="cursor-pointer flex flex-col justify-between gap-4 h-[170px]"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex flex-col min-w-0">
                          <h3 className="font-bold text-sm text-on-surface group-hover:text-primary transition-colors truncate">
                            {room.name}
                          </h3>
                          <span className="text-[10px] text-on-surface-variant/60 font-mono mt-0.5">
                            ID: {room.id.slice(0, 8)}...
                          </span>
                        </div>
                        <button
                          onClick={(e) => handleDeleteRoom(room.id, e)}
                          title="Delete Workspace"
                          className="text-on-surface-variant/60 hover:text-error transition-colors p-1.5 bg-surface-container hover:bg-error/10 rounded-lg border border-outline-variant/15 cursor-pointer"
                        >
                          <MdClose size={14} />
                        </button>
                      </div>

                      <div className="flex flex-col gap-2.5">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => handleTogglePublic(room, e)}
                            className="cursor-pointer"
                          >
                            <Badge
                              variant={room.isPublic ? 'success' : 'default'}
                              dot={true}
                              className="text-[9px] py-0.5 px-2 hover:opacity-85 transition-opacity"
                            >
                              {room.isPublic ? <MdPublic size={11} className="mr-0.5" /> : <MdLock size={11} className="mr-0.5" />}
                              {room.isPublic ? 'Public' : 'Private'}
                            </Badge>
                          </button>

                          {room.isPublic && (
                            <button
                              onClick={(e) => handleToggleAccess(room, e)}
                              className="cursor-pointer"
                            >
                              <Badge
                                variant="outline"
                                className="text-[9px] py-0.5 px-2 hover:bg-surface-container transition-colors"
                              >
                                {room.publicAccess === 'VIEW' ? 'Read-Only' : 'Collaborative'}
                              </Badge>
                            </button>
                          )}
                        </div>

                        <div className="flex justify-between items-center text-[10px] text-on-surface-variant/70 font-mono border-t border-outline-variant/15 pt-2">
                          <span className="flex items-center gap-1">
                            <MdInsertDriveFile size={12} /> {room._count?.files || 0} files
                          </span>
                          <span className="flex items-center gap-1">
                            <MdCalendarToday size={11} /> {new Date(room.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </SpotlightCard>
                  ))
                )}
              </div>
            </section>
          </div>

          {/* Right Column: GitHub Repository Import */}
          <div className="lg:w-[480px] flex-shrink-0 flex flex-col gap-8">
            <section>
              <h2 className="text-xs font-bold text-on-surface-variant/80 uppercase tracking-widest mb-3 flex items-center gap-2">
                <FaGithub className="text-primary text-base" /> Import Git Repository
              </h2>
              <div className="bg-surface border border-outline-variant/30 rounded-2xl overflow-hidden flex flex-col h-[650px] shadow-sm">
                {/* Search Bar */}
                <div className="p-3.5 border-b border-outline-variant/20 bg-surface-container-low/70">
                  <Input
                    icon={<MdSearch size={16} />}
                    type="text"
                    placeholder="Search repositories..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="font-mono text-xs"
                    rightElement={
                      repos.length > 0 ? (
                        <span className="text-[10px] font-mono text-on-surface-variant/60 bg-surface-container px-2 py-0.5 rounded-md border border-outline-variant/20">
                          {filteredRepos.length}/{repos.length}
                        </span>
                      ) : undefined
                    }
                  />
                </div>

                {/* Repo List with smooth transitions */}
                <div className="flex-1 overflow-y-auto no-scrollbar bg-surface-container-lowest divide-y divide-outline-variant/10">
                  {reposLoading ? (
                    <div className="p-8 text-center text-on-surface-variant animate-pulse font-mono text-xs">
                      Loading repositories...
                    </div>
                  ) : githubError ? (
                    <div className="p-8 text-center flex flex-col items-center gap-3">
                      <span className="text-error font-mono text-xs bg-error/10 border border-error/25 p-3 rounded-xl">
                        {githubError}
                      </span>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() =>
                          window.open(
                            `${
                              import.meta.env.VITE_API_URL ||
                              (window.location.hostname === 'localhost'
                                ? 'http://localhost:3001'
                                : 'https://streamsync-cxox.onrender.com')
                            }/api/v1/oauth/github`,
                            'GitHub OAuth',
                            'width=600,height=700'
                          )
                        }
                      >
                        Connect GitHub
                      </Button>
                    </div>
                  ) : repos.length === 0 ? (
                    <div className="p-8 text-center text-on-surface-variant font-mono text-xs">
                      No repositories found. Ensure your GitHub account is connected.
                    </div>
                  ) : (
                    filteredRepos.map((repo) => (
                      <motion.div
                        key={repo.id}
                        whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.02)' }}
                        className="flex items-center justify-between p-3.5 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0 pr-2">
                          <div className="p-2 rounded-lg bg-surface-container border border-outline-variant/20 text-primary">
                            <MdFolderZip size={18} />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="font-mono text-on-surface text-xs font-semibold truncate">
                                {repo.name}
                              </span>
                              {repo.private && (
                                <MdLock size={12} className="text-on-surface-variant/80 shrink-0" />
                              )}
                            </div>
                            <span className="text-[10px] text-on-surface-variant/60 font-mono mt-0.5">
                              Updated {Math.round((Date.now() - new Date(repo.updated_at).getTime()) / (1000 * 60 * 60 * 24))}d ago
                            </span>
                          </div>
                        </div>

                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleImportGithub(repo.full_name)}
                          disabled={isImporting}
                          className="shrink-0"
                        >
                          Import
                        </Button>
                      </motion.div>
                    ))
                  )}
                </div>

                {/* Import via URL Input Group */}
                <div className="p-4 border-t border-outline-variant/20 bg-surface-container-low/70 flex flex-col gap-3">
                  <div className="relative text-center">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-outline-variant/20"></div>
                    </div>
                    <span className="relative bg-surface-container-low px-3 text-[10px] text-on-surface-variant/80 font-bold uppercase tracking-wider">
                      or import via URL
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <Input
                      type="text"
                      placeholder="https://github.com/owner/repo"
                      value={importRepo}
                      onChange={(e) => setImportRepo(e.target.value)}
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="primary"
                      size="md"
                      disabled={isImporting || !importRepo.trim()}
                      onClick={() => handleImportGithub(importRepo)}
                      className="shrink-0"
                    >
                      Import
                    </Button>
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
