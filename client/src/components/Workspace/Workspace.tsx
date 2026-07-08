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
import { MdPlayArrow, MdKeyboardArrowDown, MdPersonAdd, MdLogout, MdOutlineWbSunny } from 'react-icons/md';
import MonacoEditor from '../Editor/MonacoEditor';
import CanvasPanel from '../Canvas/CanvasPanel';
import BottomPanel from '../Panel/BottomPanel';
import UserDropdown from '../Auth/UserDropdown';
import GlobalLoader from '../Layout/GlobalLoader';
import InviteModal from './InviteModal';
import GitHubPanel from '../Sidebar/GitHubPanel';
import AICopilotPanel from '../Sidebar/AICopilotPanel';
import ExtensionsPanel from '../Sidebar/ExtensionsPanel';
import SearchPanel from '../Sidebar/SearchPanel';
import VoiceChat from './VoiceChat';
import RightSidebar from '../Sidebar/RightSidebar';
import type { ChatMessage } from '../Sidebar/RightSidebar';
import '../../App.css';

type ViewMode = 'editor' | 'canvas' | 'split';
type ActivityView = 'explorer' | 'search' | 'github' | 'extensions' | 'ai';

export default function Workspace() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { files, activeFileId, openFileIds, fetchFiles, isLoading, isSidebarOpen, toggleSidebar } = useFileStore();
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
  
  // Call State
  const [isInCall, setIsInCall] = useState(false);
  const [, setActiveCallUsers] = useState<Map<string, string>>(new Map());
  
  // Right Sidebar & Room Chat States
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isMembersOpen, setIsMembersOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  
  // Invite Modal
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  // Dynamic Theme state
  const [theme, setTheme] = useState<'obsidian' | 'nord'>(() => {
    return (localStorage.getItem('streamsync_theme') as 'obsidian' | 'nord') || 'obsidian';
  });

  useEffect(() => {
    if (theme === 'nord') {
      document.documentElement.setAttribute('data-theme', 'nord');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem('streamsync_theme', theme);
  }, [theme]);

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

  // Track active call participants in the room
  useEffect(() => {
    if (!roomId) return;

    const handleRoomMessage = (msg: any) => {
      const { payload } = msg;
      if (!payload || !payload.action) return;

      const { action, userId, username } = payload;

      if (action === 'call-query') {
        if (isInCall && user) {
          wsService.send({
            type: 'room-message',
            roomId,
            payload: {
              action: 'call-present',
              userId: user.id,
              username: user.username
            }
          });
        }
      } else if (action === 'call-joined' || action === 'call-present') {
        if (userId) {
          setActiveCallUsers(prev => {
            const next = new Map(prev);
            next.set(userId, username || 'User');
            return next;
          });
        }
      } else if (action === 'call-left') {
        if (userId) {
          setActiveCallUsers(prev => {
            const next = new Map(prev);
            next.delete(userId);
            return next;
          });
        }
      } else if (action === 'chat-message') {
        const { text } = payload;
        console.log('[Workspace] Received chat message:', { userId, username, text });
        setChatMessages(prev => [
          ...prev,
          {
            id: msg.id || Math.random().toString(),
            senderId: userId || '',
            senderName: username || 'User',
            text: text || '',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      }
    };

    const unsubscribe = wsService.on('room-message', handleRoomMessage);

    // Query active calls in the workspace after a brief delay
    const timer = setTimeout(() => {
      wsService.send({
        type: 'room-message',
        roomId,
        payload: {
          action: 'call-query'
        }
      });
    }, 1500);

    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, [roomId, isInCall, user]);

  // Handle local user joining/leaving call
  useEffect(() => {
    if (!isInCall || !user) return;

    setActiveCallUsers(prev => {
      const next = new Map(prev);
      next.set(user.id, user.username);
      return next;
    });

    wsService.send({
      type: 'room-message',
      roomId,
      payload: {
        action: 'call-joined',
        userId: user.id,
        username: user.username
      }
    });

    return () => {
      wsService.send({
        type: 'room-message',
        roomId,
        payload: {
          action: 'call-left',
          userId: user.id,
          username: user.username
        }
      });
      setActiveCallUsers(prev => {
        const next = new Map(prev);
        next.delete(user.id);
        return next;
      });
    };
  }, [roomId, isInCall, user]);

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

  useEffect(() => {
    console.log('[Workspace] roomUsers state updated:', roomUsers);
  }, [roomUsers]);

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

  const handleSendChatMessage = (text: string) => {
    if (!roomId || !user) {
      console.warn('[Workspace] Cannot send message: missing roomId or user profile');
      return;
    }
    
    console.log('[Workspace] Sending chat message:', text);
    wsService.send({
      type: 'room-message',
      roomId,
      payload: {
        action: 'chat-message',
        text
      }
    });

    setChatMessages(prev => [
      ...prev,
      {
        id: Math.random().toString(),
        senderId: user.id,
        senderName: user.username,
        text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
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
    if (activeActivityView === 'extensions') return <ExtensionsPanel />;
    if (activeActivityView === 'search') return <SearchPanel />;
    const viewName = activeActivityView as string;
    return (
      <div style={{ padding: '16px', color: 'var(--text-muted)' }}>
        {viewName.charAt(0).toUpperCase() + viewName.slice(1)} coming soon...
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
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background text-on-surface select-none">
      {/* Voice Chat Component */}
      {!isInitialLoad && roomId && isInCall && <VoiceChat roomId={roomId} onLeaveCall={() => setIsInCall(false)} />}

      {/* Top Navigation Bar */}
      <header className="bg-surface/85 backdrop-blur-xl border-b border-outline-variant/20 flex justify-between items-center px-6 h-14 w-full flex-shrink-0 z-50 fixed top-0 left-0 right-0 shadow-md">
        {/* Left: Logo & Project Dropdown */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 cursor-pointer transition-opacity hover:opacity-80" onClick={() => navigate('/')}>
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-inverse-primary text-white flex items-center justify-center font-bold text-lg shadow-[0_2px_12px_rgba(208,188,255,0.35)]">
              S
            </div>
            <span className="font-headline-md text-headline-md font-bold text-white tracking-tight">StreamSync</span>
          </div>

          <div className="w-[1px] h-5 bg-white/10 hidden md:block" />

          {/* Project dropdown picker */}
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition-colors cursor-pointer text-body-xs font-semibold text-on-surface-variant">
            <span>Project: <strong className="text-white">{roomData?.name || 'E-Commerce App'}</strong></span>
            <MdKeyboardArrowDown size={16} />
          </div>
        </div>

        {/* Center: Live Connection status & Stacked avatar cluster */}
        <div className="hidden md:flex items-center gap-4">
          <div className="flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-success/10 border border-success/20 text-success text-[10px] font-bold tracking-wide uppercase shadow-sm animate-pulse">
            <span className="w-1.5 h-1.5 bg-success rounded-full shadow-[0_0_8px_#4edea3]" />
            Connected: {roomUsers.length} users
          </div>

          {/* Stacked active users in call */}
          <div className="flex items-center -space-x-2.5">
            {roomUsers.slice(0, 3).map((u, i) => (
              <div 
                key={u.userId}
                className="w-7 h-7 rounded-full border-2 border-[#0f111a] flex items-center justify-center font-bold text-[10px] bg-gradient-to-br from-primary to-accent text-white shadow-md hover:-translate-y-0.5 transition-transform cursor-pointer"
                style={{ zIndex: 30 - i }}
                title={u.username}
              >
                {u.username.charAt(0).toUpperCase()}
              </div>
            ))}
            {roomUsers.length > 3 && (
              <div className="w-7 h-7 rounded-full border-2 border-[#0f111a] flex items-center justify-center font-bold text-[9px] bg-surface-container-highest text-on-surface shadow-md z-10">
                +{roomUsers.length - 3}
              </div>
            )}
          </div>
        </div>

        {/* Right: Actions & Profile */}
        <div className="flex items-center gap-3">
          <button 
            className="hover:bg-white/5 text-on-surface-variant hover:text-white px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-1.5 transition-all text-body-xs font-semibold"
            onClick={() => setIsInviteModalOpen(true)}
          >
            <MdPersonAdd size={15} />
            Invite
          </button>

          <div className="w-[1px] h-5 bg-white/10 hidden md:block" />

          {/* Run Code pill button */}
          <button 
            className={`flex items-center gap-1 px-4 py-1.5 rounded-full bg-gradient-to-br from-primary-container to-inverse-primary text-white hover:shadow-[0_0_15px_rgba(138,114,193,0.35)] hover:scale-[1.02] active:scale-[0.98] text-body-xs font-bold transition-all ${isExecuting || !activeFile ? 'opacity-50 cursor-not-allowed shadow-none scale-100' : ''}`}
            onClick={handleRunCode}
            disabled={isExecuting || !activeFile}
          >
            <MdPlayArrow size={16} />
            <span>Run</span>
            <MdKeyboardArrowDown size={14} className="border-l border-white/20 pl-0.5 ml-0.5" />
          </button>

          {/* Leave Room outlined pill button */}
          <button 
            className="border border-white/10 hover:border-error/40 text-on-surface-variant hover:text-error hover:bg-error/5 px-4 py-1.5 rounded-full transition-all text-body-xs font-semibold flex items-center gap-1"
            onClick={() => navigate('/')}
            title="Leave Room"
          >
            <MdLogout size={14} />
            <span>Leave Room</span>
          </button>

          <button 
            className="text-on-surface-variant hover:text-white transition-colors p-1.5 rounded-full hover:bg-white/5"
            onClick={() => setTheme(prev => prev === 'obsidian' ? 'nord' : 'obsidian')}
            title={`Switch to ${theme === 'obsidian' ? 'Nord Slate' : 'Obsidian Gold'}`}
          >
            <MdOutlineWbSunny size={18} className={theme === 'nord' ? 'text-primary rotate-45 transition-transform duration-300' : 'transition-transform duration-300'} />
          </button>
          
          {user && (
            <div className="z-30 border-l border-white/15 pl-2 ml-1">
              <UserDropdown />
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area (Below Header) */}
      <div className="flex flex-1 pt-14 h-full w-full overflow-hidden relative bg-background">
        <ActivityBar 
          activeView={activeActivityView} 
          setActiveView={setActiveActivityView}
          isChatOpen={isChatOpen}
          setIsChatOpen={setIsChatOpen}
          isMembersOpen={isMembersOpen}
          setIsMembersOpen={setIsMembersOpen}
        />
        
        {isSidebarOpen && (
          <aside className="w-[260px] flex-shrink-0 bg-surface-container-low/80 backdrop-blur-md border-r border-outline-variant/20 flex flex-col h-full z-30">
            {renderSidebar()}
          </aside>
        )}

        {/* Center Panel including Sub-Header View Navigation */}
        <div className="flex-1 flex flex-col h-full overflow-hidden relative z-20 bg-background">
          {/* Sub-Header View switcher navigation */}
          <div className="h-12 bg-surface/50 border-b border-outline-variant/15 flex items-center justify-center shrink-0 z-30 shadow-sm">
            <div className="flex items-center gap-1.5 bg-surface-container-low p-1 rounded-xl border border-outline-variant/25">
              <button
                className={`px-4 py-1.5 rounded-lg text-[11px] font-bold transition-all duration-200 ${
                  viewMode === 'editor' && !isChatOpen && !isMembersOpen
                    ? 'bg-primary/20 text-primary border border-primary/20'
                    : 'text-on-surface-variant hover:text-on-surface border border-transparent'
                }`}
                onClick={() => {
                  setViewMode('editor');
                  if (!isSidebarOpen) toggleSidebar();
                  setIsChatOpen(false);
                  setIsMembersOpen(false);
                }}
              >
                Code
              </button>
              <button
                className={`px-4 py-1.5 rounded-lg text-[11px] font-bold transition-all duration-200 ${
                  viewMode === 'canvas'
                    ? 'bg-primary/20 text-primary border border-primary/20'
                    : 'text-on-surface-variant hover:text-on-surface border border-transparent'
                }`}
                onClick={() => {
                  setViewMode('canvas');
                  if (isSidebarOpen) toggleSidebar();
                  setIsChatOpen(false);
                  setIsMembersOpen(false);
                }}
              >
                Whiteboard
              </button>
              <button
                className={`px-4 py-1.5 rounded-lg text-[11px] font-bold transition-all duration-200 ${
                  isChatOpen && !isMembersOpen
                    ? 'bg-primary/20 text-primary border border-primary/20'
                    : 'text-on-surface-variant hover:text-on-surface border border-transparent'
                }`}
                onClick={() => {
                  setIsChatOpen(true);
                  setIsMembersOpen(false);
                }}
              >
                Chat
              </button>
              <button
                className={`px-4 py-1.5 rounded-lg text-[11px] font-bold transition-all duration-200 ${
                  activeActivityView === 'explorer' && isSidebarOpen
                    ? 'bg-primary/20 text-primary border border-primary/20'
                    : 'text-on-surface-variant hover:text-on-surface border border-transparent'
                }`}
                onClick={() => {
                  setActiveActivityView('explorer');
                  if (!isSidebarOpen) toggleSidebar();
                  setIsChatOpen(false);
                  setIsMembersOpen(false);
                }}
              >
                Files
              </button>
              <button
                className={`px-4 py-1.5 rounded-lg text-[11px] font-bold transition-all duration-200 ${
                  isMembersOpen && !isChatOpen
                    ? 'bg-primary/20 text-primary border border-primary/20'
                    : 'text-on-surface-variant hover:text-on-surface border border-transparent'
                }`}
                onClick={() => {
                  setIsMembersOpen(true);
                  setIsChatOpen(false);
                }}
              >
                Activity
              </button>
            </div>
          </div>
          
          <main className="flex-1 flex w-full h-full relative overflow-hidden bg-surface-dim">
             {renderMainArea()}
          </main>
        </div>

        {(isChatOpen || isMembersOpen) && (
          <RightSidebar 
            isChatOpen={isChatOpen}
            setIsChatOpen={setIsChatOpen}
            isMembersOpen={isMembersOpen}
            setIsMembersOpen={setIsMembersOpen}
            messages={chatMessages}
            onSendMessage={handleSendChatMessage}
          />
        )}
      </div>

      {/* Modals */}
      {isInviteModalOpen && roomData && (
        <InviteModal roomId={roomData.id} onClose={() => setIsInviteModalOpen(false)} />
      )}
    </div>
  );
}
