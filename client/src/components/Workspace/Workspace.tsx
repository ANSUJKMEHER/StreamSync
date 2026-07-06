import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFileStore } from '../../store/fileStore';
import { useAuthStore } from '../../store/authStore';
import { useRoomStore } from '../../store/roomStore';
import { wsService } from '../../services/websocket';
import { yjsService } from '../../services/yjsService';
import { roomService, type Room } from '../../services/roomService';
import FileExplorer from '../Sidebar/FileExplorer';
import ActivityBar from '../Sidebar/ActivityBar';
import FileTabs from '../Tabs/FileTabs';
import { MdShare, MdPlayArrow, MdTerminal } from 'react-icons/md';
import MonacoEditor from '../Editor/MonacoEditor';
import CanvasPanel from '../Canvas/CanvasPanel';
import BottomPanel from '../Panel/BottomPanel';
import UserDropdown from '../Auth/UserDropdown';
import GlobalLoader from '../Layout/GlobalLoader';
import InviteModal from './InviteModal';
import GitHubPanel from '../Sidebar/GitHubPanel';
import AICopilotPanel from '../Sidebar/AICopilotPanel';
import VoiceChat from './VoiceChat';
import '../../App.css';

type ViewMode = 'editor' | 'canvas' | 'split';
type ActivityView = 'explorer' | 'search' | 'github' | 'extensions' | 'ai';

export default function Workspace() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { files, activeFileId, openFileIds, fetchFiles, isLoading, isSidebarOpen } = useFileStore();
  const { user, token } = useAuthStore();
  const { setActiveRoom, roomUsers } = useRoomStore();
  
  const [roomData, setRoomData] = useState<Room | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('editor');
  
  // VS Code Layout States
  const [activeActivityView, setActiveActivityView] = useState<ActivityView>('explorer');
  const [isBottomPanelOpen, setIsBottomPanelOpen] = useState(false);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(300);

  // Execution States
  // Execution States
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionOutput, setExecutionOutput] = useState<{ stdout: string; stderr: string } | null>(null);
  
  // Split pane state
  const [splitWidth, setSplitWidth] = useState(50);
  
  // Invite Modal
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  const activeFile = files.find((f) => f.id === activeFileId);

  // Load room details
  useEffect(() => {
    if (!roomId) return;
    const loadRoom = async () => {
      try {
        const data = await roomService.getRoom(roomId, token);
        setRoomData(data);
      } catch (err) {
        console.error('Failed to fetch room:', err);
        if (!token) {
          navigate(`/?returnTo=/room/${roomId}`);
        } else {
          navigate('/');
        }
      }
    };
    loadRoom();
  }, [roomId, token, navigate]);

  // Fetch files and connect WebSocket
  useEffect(() => {
    if (!roomId) return;

    fetchFiles(roomId).then(() => {
      setTimeout(() => setIsInitialLoad(false), 400);
    });

    if (token) {
      wsService.connect(token);
    }

    return () => {
      wsService.disconnect();
    };
  }, [roomId, token, fetchFiles]);

  // Join room based on Workspace ID (roomId), NOT active file
  useEffect(() => {
    if (!roomId) {
      setActiveRoom(null);
      return;
    }

    setActiveRoom(roomId);
    wsService.joinRoom(roomId);

    return () => {
      wsService.leaveRoom(roomId);
    };
  }, [roomId, setActiveRoom]);

  // Preload Y.Docs for all open files to ensure background tabs receive yjs-sync updates
  useEffect(() => {
    if (!roomId) return;
    openFileIds.forEach(fileId => {
      // Calling getDoc will instantiate the Y.Doc and send sync-doc to the server
      yjsService.getDoc(roomId, fileId);
    });
  }, [roomId, openFileIds]);



  const handleRunCode = async () => {
    if (!activeFile || !token) return;
    setIsExecuting(true);
    setIsBottomPanelOpen(true); // Open the panel when running
    setExecutionOutput({ stdout: '', stderr: '' });

    try {
      const { executionService } = await import('../../services/executionService');
      const result = await executionService.executeCode(activeFile.content, activeFile.language, token);
      setExecutionOutput({ stdout: result.stdout, stderr: result.stderr });
    } catch (error: any) {
      setExecutionOutput({ stdout: '', stderr: error.message || 'Execution failed' });
    } finally {
      setIsExecuting(false);
    }
  };

  

  if (isInitialLoad && isLoading) {
    return <GlobalLoader subtitle="Loading Workspace..." />;
  }

  // --- Rendering Architecture ---
  
  const renderSidebar = () => {
    if (!isSidebarOpen) return null;
    if (activeActivityView === 'explorer') return <FileExplorer />;
    if (activeActivityView === 'github') return <GitHubPanel roomData={roomData} />;
    if (activeActivityView === 'ai') return <AICopilotPanel />;
    return (
      <div style={{ padding: '16px', color: 'var(--text-muted)' }}>
        {activeActivityView.charAt(0).toUpperCase() + activeActivityView.slice(1)} coming soon...
      </div>
    );
  };

  const renderEditorArea = () => (
    <div className="flex flex-col h-full w-full overflow-hidden">
      <FileTabs />
      <div className="flex-1 relative">
        <MonacoEditor />
      </div>
    </div>
  );

  const renderCanvasArea = () => (
    <div className="h-full w-full relative">
      <CanvasPanel />
    </div>
  );

  const renderMainArea = () => {
    // Use a stable DOM structure for editor and canvas to prevent React from unmounting components when switching modes
    let content = (
      <div className="flex w-full h-full relative" ref={(el) => {
          if (el && !el.dataset.listenerAttached) {
            el.dataset.listenerAttached = 'true';
          }
        }}>
        
        {/* Editor Area */}
        <div 
          className={`flex-col h-full border-r border-outline-variant/20 relative z-20 ${viewMode === 'canvas' ? 'hidden' : 'flex'}`}
          style={{ width: viewMode === 'split' ? `${splitWidth}%` : '100%' }}
        >
          {renderEditorArea()}
        </div>
        
        {/* Divider */}
        {viewMode === 'split' && (
          <div 
            className="w-1 bg-surface cursor-col-resize hover:bg-primary/50 transition-colors flex items-center justify-center relative z-40 group shrink-0"
            onMouseDown={(e) => {
              e.preventDefault();
              const startX = e.clientX;
              const startWidth = splitWidth;
              
              const onMouseMove = (moveEvent: MouseEvent) => {
                const deltaX = moveEvent.clientX - startX;
                const containerWidth = window.innerWidth - (isSidebarOpen ? 260 : 0) - 48; // Account for activity bar and sidebar
                const deltaPercent = (deltaX / containerWidth) * 100;
                setSplitWidth(Math.max(10, Math.min(90, startWidth + deltaPercent)));
              };
              
              const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                document.body.style.cursor = 'default';
              };
              
              document.addEventListener('mousemove', onMouseMove);
              document.addEventListener('mouseup', onMouseUp);
              document.body.style.cursor = 'col-resize';
            }}
          >
            <div className="w-[2px] h-8 bg-outline-variant/30 group-hover:bg-primary rounded-full pointer-events-none"></div>
          </div>
        )}
        
        {/* Canvas Area */}
        <div 
          className={`flex-col h-full relative z-10 ${viewMode === 'editor' ? 'hidden' : 'flex'}`}
          style={{ width: viewMode === 'split' ? `calc(${100 - splitWidth}% - 4px)` : '100%' }}
        >
          {renderCanvasArea()}
        </div>

      </div>
    );

    // Wrap main content with vertical flex container to ensure React doesn't unmount the editor
    return (
      <div className="flex flex-col h-full w-full bg-surface-dim relative overflow-hidden">
        <div className="flex-1 overflow-hidden min-h-0 relative z-10">
          {content}
        </div>
        {isBottomPanelOpen && (
          <>
            <div 
              className="h-1 bg-surface cursor-row-resize hover:bg-primary/50 transition-colors flex items-center justify-center relative z-40 group"
              onMouseDown={(e) => {
                const startY = e.clientY;
                const startHeight = bottomPanelHeight;
                
                const onMouseMove = (moveEvent: MouseEvent) => {
                  const delta = startY - moveEvent.clientY;
                  setBottomPanelHeight(Math.max(100, Math.min(600, startHeight + delta)));
                };
                
                const onMouseUp = () => {
                  document.removeEventListener('mousemove', onMouseMove);
                  document.removeEventListener('mouseup', onMouseUp);
                };
                
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
              }}
            >
              <div className="w-8 h-[2px] bg-outline-variant/30 group-hover:bg-primary rounded-full" />
            </div>
            <div style={{ height: `${bottomPanelHeight}px`, flexShrink: 0, overflow: 'hidden' }} className="relative z-30">
               <BottomPanel 
                  executionOutput={executionOutput} 
                  isExecuting={isExecuting} 
                  onClose={() => setIsBottomPanelOpen(false)} 
               />
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="bg-background text-on-surface h-screen w-screen overflow-hidden flex flex-col font-body-md text-body-md select-none">
      {/* Voice Chat Component */}
      {!isInitialLoad && roomId && <VoiceChat roomId={roomId} />}

      {/* Top Navigation Bar */}
      <header className="bg-surface/60 backdrop-blur-md shadow-sm border-b border-outline-variant/30 flex justify-between items-center px-gutter h-14 w-full flex-shrink-0 z-50 fixed top-0 left-0 right-0">
        {/* Left: Logo & Nav */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 cursor-pointer transition-opacity hover:opacity-80" onClick={() => navigate('/')}>
            <div className="h-8 w-8 rounded-md bg-gradient-to-br from-primary to-accent text-white flex items-center justify-center font-bold text-lg shadow-[0_2px_8px_rgba(208,188,255,0.4)]">
              S
            </div>
            <span className="font-headline-md text-headline-md font-bold text-primary tracking-tight">StreamSync</span>
          </div>
          
          <nav className="hidden md:flex items-center bg-surface-variant/30 p-1 rounded-lg border border-outline-variant/20">
            <button
              className={`px-4 py-1.5 rounded-md font-label-md transition-all duration-200 ${viewMode === 'editor' ? 'bg-surface shadow-sm text-primary font-bold' : 'text-on-surface-variant hover:text-on-surface'}`}
              onClick={() => setViewMode('editor')}
              title="Code Editor"
            >
              Code
            </button>
            <button
              className={`px-4 py-1.5 rounded-md font-label-md transition-all duration-200 ${viewMode === 'canvas' ? 'bg-surface shadow-sm text-primary font-bold' : 'text-on-surface-variant hover:text-on-surface'}`}
              onClick={() => setViewMode('canvas')}
              title="Canvas"
            >
              Canvas
            </button>
            <button
              className={`px-4 py-1.5 rounded-md font-label-md transition-all duration-200 ${viewMode === 'split' ? 'bg-surface shadow-sm text-primary font-bold' : 'text-on-surface-variant hover:text-on-surface'}`}
              onClick={() => setViewMode('split')}
              title="Split View"
            >
              Split
            </button>
          </nav>
        </div>

        {/* Right: Actions & Profile */}
        <div className="flex items-center gap-3">
          {roomData && roomData.ownerId === user?.id && (
            <button 
              className="hover:bg-surface-variant text-on-surface-variant hover:text-on-surface px-3 py-1.5 rounded-md flex items-center gap-2 transition-colors font-label-md"
              onClick={() => setIsInviteModalOpen(true)}
            >
              <MdShare size={16} />
              Share
            </button>
          )}

          <div className="w-[1px] h-6 bg-outline-variant/30 hidden md:block" />

          <button 
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 font-label-md transition-all active:scale-95 ${isExecuting || !activeFile ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={handleRunCode}
            disabled={isExecuting || !activeFile}
          >
            <MdPlayArrow size={18} />
            Run Code
          </button>
          
          <button 
            className="text-on-surface-variant hover:text-primary transition-colors p-1.5 rounded-md hover:bg-surface-variant/50"
            onClick={() => setIsBottomPanelOpen(!isBottomPanelOpen)} 
            title="Toggle Terminal"
          >
            <MdTerminal size={20} />
          </button>

          {/* Profile/Collaborators */}
          <div className="flex items-center pl-2 ml-1 border-l border-outline-variant/30">
            <div className="flex items-center -space-x-2 mr-3">
              {activeFileId && roomUsers.filter(u => u.userId !== user?.id).map((u, i) => (
                <div 
                  key={u.userId}
                  className="w-7 h-7 rounded-full border-2 border-surface flex items-center justify-center font-label-md text-[10px] bg-accent text-white shadow-sm hover:-translate-y-0.5 hover:scale-110 transition-transform"
                  style={{ zIndex: 20 - i }}
                  title={u.username}
                >
                  {u.username.charAt(0).toUpperCase()}
                </div>
              ))}
            </div>
            
            {user ? (
              <div className="z-30">
                <UserDropdown />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full border-2 border-surface bg-surface-variant text-on-surface-variant flex items-center justify-center font-label-md text-[12px] z-30">
                G
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area (Below Header) */}
      <div className="flex flex-1 pt-14 h-full w-full overflow-hidden relative">
        <ActivityBar activeView={activeActivityView} setActiveView={setActiveActivityView} />
        
        {isSidebarOpen && (
          <aside className="w-[260px] flex-shrink-0 bg-surface-container-low/80 backdrop-blur-md border-r border-outline-variant/20 flex flex-col h-full z-30">
            {renderSidebar()}
          </aside>
        )}
        
        <main className="flex-1 flex w-full h-full relative z-20 overflow-hidden bg-surface-dim">
           {renderMainArea()}
        </main>
      </div>

      {/* Modals */}
      {isInviteModalOpen && roomData && (
        <InviteModal roomId={roomData.id} onClose={() => setIsInviteModalOpen(false)} />
      )}
    </div>
  );
}
