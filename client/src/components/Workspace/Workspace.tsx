import { useEffect, useState, lazy, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useFileStore } from '../../store/fileStore';
import { useAuthStore } from '../../store/authStore';
import { useRoomStore } from '../../store/roomStore';
import { wsService } from '../../services/websocket';
import { yjsService } from '../../services/yjsService';
import { roomService, type Room } from '../../services/roomService';
import FileExplorer from '../Sidebar/FileExplorer';
import ActivityBar from '../Sidebar/ActivityBar';
import FileTabs from '../Tabs/FileTabs';
import { MdPlayArrow, MdPersonAdd, MdLogout, MdOutlineWbSunny, MdPhone, MdPhoneEnabled, MdPhoneCallback, MdClose, MdSync } from 'react-icons/md';
import UserDropdown from '../Auth/UserDropdown';
import GlobalLoader from '../Layout/GlobalLoader';
import { Badge } from '../ui/badge';
import type { ChatMessage } from '../Sidebar/RightSidebar';
import '../../App.css';

// Lazy loaded heavy components
const MonacoEditor = lazy(() => import('../Editor/MonacoEditor'));
const CanvasPanel = lazy(() => import('../Canvas/CanvasPanel'));
const BottomPanel = lazy(() => import('../Panel/BottomPanel'));
const InviteModal = lazy(() => import('./InviteModal'));
const GitHubPanel = lazy(() => import('../Sidebar/GitHubPanel'));
const AICopilotPanel = lazy(() => import('../Sidebar/AICopilotPanel'));
const ExtensionsPanel = lazy(() => import('../Sidebar/ExtensionsPanel'));
const SearchPanel = lazy(() => import('../Sidebar/SearchPanel'));
const VoiceChat = lazy(() => import('./VoiceChat'));
const RightSidebar = lazy(() => import('../Sidebar/RightSidebar'));

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
  const [incomingCall, setIncomingCall] = useState<{ userId: string; username: string } | null>(null);
  
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
          // Show join notification to users who are NOT already in the call
          if (!isInCall && userId !== user?.id) {
            setIncomingCall({ userId, username: username || 'Someone' });
          }
        }
      } else if (action === 'call-left') {
        if (userId) {
          setActiveCallUsers(prev => {
            const next = new Map(prev);
            next.delete(userId);
            return next;
          });
          // Dismiss incoming call notification if the initiator left
          setIncomingCall(prev => prev?.userId === userId ? null : prev);
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
    return (
      <Suspense fallback={<div className="p-4 text-xs text-on-surface-variant animate-pulse font-bold">Loading Panel...</div>}>
        {activeActivityView === 'explorer' && <FileExplorer />}
        {activeActivityView === 'github' && <GitHubPanel roomData={roomData} />}
        {activeActivityView === 'ai' && <AICopilotPanel />}
        {activeActivityView === 'extensions' && <ExtensionsPanel />}
        {activeActivityView === 'search' && <SearchPanel />}
      </Suspense>
    );
  };

  const renderEditorArea = () => (
    <div className="flex flex-col h-full w-full overflow-hidden">
      <FileTabs />
      <div className="flex-1 relative">
        <Suspense fallback={<div className="h-full w-full bg-surface-dim animate-pulse flex items-center justify-center text-xs text-on-surface-variant font-bold">Loading Code Editor...</div>}>
          <MonacoEditor />
        </Suspense>
      </div>
    </div>
  );

  const renderCanvasArea = () => (
    <div className="h-full w-full relative">
      <Suspense fallback={<div className="h-full w-full bg-surface-dim animate-pulse flex items-center justify-center text-xs text-on-surface-variant font-bold">Loading Architecture Board...</div>}>
        <CanvasPanel />
      </Suspense>
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
              <Suspense fallback={<div className="h-full w-full bg-surface-container flex items-center justify-center text-xs text-on-surface-variant font-bold">Loading Terminal Output...</div>}>
                <BottomPanel 
                    executionOutput={executionOutput} 
                    isExecuting={isExecuting} 
                    onClose={() => setIsBottomPanelOpen(false)} 
                />
              </Suspense>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background text-on-surface select-none">
      {/* Voice Chat Component */}
      {!isInitialLoad && roomId && isInCall && (
        <Suspense fallback={null}>
          <VoiceChat roomId={roomId} onLeaveCall={() => setIsInCall(false)} />
        </Suspense>
      )}

      {/* Incoming Call Toast — shown to users NOT yet in the call */}
      <AnimatePresence>
        {incomingCall && !isInCall && (
          <motion.div 
            initial={{ opacity: 0, y: 40, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999]"
          >
            <div className="flex items-center gap-4 px-5 py-3.5 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.6)] border border-emerald-500/30 bg-surface/95 backdrop-blur-2xl">
              {/* Pulsing avatar ring */}
              <div className="relative shrink-0">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                  <MdPhoneCallback size={20} className="text-emerald-400 animate-pulse" />
                </div>
                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-surface animate-ping" />
                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-surface" />
              </div>

              {/* Text */}
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-on-surface">
                  {incomingCall.username} started a call
                </span>
                <span className="text-[11px] text-on-surface-variant font-medium">Voice call is active in this room</span>
              </div>

              {/* Join button */}
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => { setIsInCall(true); setIncomingCall(null); }}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-background text-xs font-bold transition-all shadow-md shadow-emerald-500/20 flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <MdPhone size={14} />
                Join Call
              </motion.button>

              {/* Dismiss */}
              <button
                onClick={() => setIncomingCall(null)}
                className="p-1.5 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors shrink-0 cursor-pointer"
                title="Dismiss"
              >
                <MdClose size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Navigation Bar */}
      <header className="bg-surface/85 backdrop-blur-xl border-b border-outline-variant/20 flex justify-between items-center px-6 h-14 w-full flex-shrink-0 z-50 fixed top-0 left-0 right-0 shadow-sm">
        {/* Left: Logo & Project Dropdown */}
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2.5 cursor-pointer transition-opacity hover:opacity-85" onClick={() => navigate('/')}>
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary/30 to-primary/80 border border-primary/25 text-white flex items-center justify-center font-bold text-lg shadow-[0_2px_10px_rgba(223,171,108,0.2)]">
              S
            </div>
            <span className="font-headline-md font-bold text-primary tracking-tight text-xl">StreamSync</span>
          </div>

          <div className="w-[1px] h-5 bg-outline-variant/20 hidden md:block" />

          {/* Project pill */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-container-low border border-outline-variant/25 text-xs font-medium text-on-surface-variant">
            <span>Project: <strong className="text-on-surface font-semibold">{roomData?.name || 'Workspace'}</strong></span>
          </div>
        </div>

        {/* Center: View Switcher (Integrated into Header) */}
        <div className="hidden md:flex items-center gap-1 bg-surface-container-low p-1 rounded-xl border border-outline-variant/30 select-none shadow-inner">
          {[
            {
              id: 'editor',
              label: 'Code',
              isActive: viewMode === 'editor' && !isChatOpen && !isMembersOpen,
              onClick: () => {
                setViewMode('editor');
                if (!isSidebarOpen) toggleSidebar();
                setIsChatOpen(false);
                setIsMembersOpen(false);
              }
            },
            {
              id: 'canvas',
              label: 'Whiteboard',
              isActive: viewMode === 'canvas',
              onClick: () => {
                setViewMode('canvas');
                if (isSidebarOpen) toggleSidebar();
                setIsChatOpen(false);
                setIsMembersOpen(false);
              }
            },
            {
              id: 'chat',
              label: 'Chat',
              isActive: isChatOpen && !isMembersOpen,
              onClick: () => {
                setIsChatOpen(true);
                setIsMembersOpen(false);
              }
            },
            {
              id: 'files',
              label: 'Files',
              isActive: activeActivityView === 'explorer' && isSidebarOpen,
              onClick: () => {
                setActiveActivityView('explorer');
                if (!isSidebarOpen) toggleSidebar();
                setIsChatOpen(false);
                setIsMembersOpen(false);
              }
            },
            {
              id: 'activity',
              label: 'Activity',
              isActive: isMembersOpen && !isChatOpen,
              onClick: () => {
                setIsMembersOpen(true);
                setIsChatOpen(false);
              }
            }
          ].map((item) => (
            <button
              key={item.id}
              className={`relative px-3.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer select-none ${
                item.isActive
                  ? 'text-primary font-bold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
              onClick={item.onClick}
            >
              {item.isActive && (
                <motion.div
                  layoutId="workspace-view-pill"
                  className="absolute inset-0 bg-primary/15 border border-primary/25 rounded-lg shadow-sm -z-10"
                  transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                />
              )}
              {item.label}
            </button>
          ))}
        </div>

        {/* Right: Actions, Users & Profile */}
        <div className="flex items-center gap-2.5">
          {/* Live Connection status & Stacked avatar cluster */}
          <div className="hidden xl:flex items-center gap-3 mr-1">
            <Badge variant="success" dot={true} className="text-[10px] py-0.5 px-2.5">
              {roomUsers.length} online
            </Badge>

            {/* Stacked active users in call */}
            <div className="flex items-center -space-x-2">
              {roomUsers.slice(0, 3).map((u, i) => (
                <motion.div 
                  key={u.userId}
                  whileHover={{ y: -2, zIndex: 50 }}
                  className="w-6 h-6 rounded-full border-2 border-surface flex items-center justify-center font-bold text-[9px] bg-gradient-to-br from-primary to-primary-dark text-background shadow-md cursor-pointer select-none"
                  style={{ zIndex: 30 - i }}
                  title={u.username}
                >
                  {u.username.charAt(0).toUpperCase()}
                </motion.div>
              ))}
              {roomUsers.length > 3 && (
                <div className="w-6 h-6 rounded-full border-2 border-surface flex items-center justify-center font-bold text-[8px] bg-surface-container-high text-on-surface-variant shadow-md z-10">
                  +{roomUsers.length - 3}
                </div>
              )}
            </div>
          </div>
          <motion.button 
            whileTap={{ scale: 0.95 }}
            className="hover:bg-surface-container text-on-surface-variant hover:text-on-surface px-3 py-1.5 rounded-xl border border-outline-variant/30 flex items-center gap-1.5 transition-all text-xs font-semibold cursor-pointer"
            onClick={() => setIsInviteModalOpen(true)}
          >
            <MdPersonAdd size={15} />
            <span>Invite</span>
          </motion.button>

          <div className="w-[1px] h-4 bg-outline-variant/25 hidden md:block" />

          {/* Voice Call button */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all text-xs font-semibold cursor-pointer ${
              isInCall
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/25'
                : 'hover:bg-surface-container text-on-surface-variant hover:text-on-surface border-outline-variant/30'
            }`}
            onClick={() => setIsInCall(prev => !prev)}
            title={isInCall ? 'Leave Voice Call' : 'Join Voice Call'}
            aria-label={isInCall ? 'Leave Voice Call' : 'Join Voice Call'}
          >
            {isInCall ? <MdPhoneEnabled size={15} className="animate-pulse" /> : <MdPhone size={15} />}
            <span>{isInCall ? 'In Call' : 'Call'}</span>
          </motion.button>

          <div className="w-[1px] h-4 bg-outline-variant/25 hidden md:block" />

          {/* Run Code button */}
          <motion.button 
            whileTap={{ scale: isExecuting || !activeFile ? 1 : 0.96 }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary/95 text-background shadow-[0_2px_12px_rgba(223,171,108,0.2)] text-xs font-bold transition-all cursor-pointer ${
              isExecuting || !activeFile ? 'opacity-50 cursor-not-allowed shadow-none' : ''
            }`}
            onClick={handleRunCode}
            disabled={isExecuting || !activeFile}
          >
            {isExecuting ? <MdSync size={16} className="animate-spin" /> : <MdPlayArrow size={16} />}
            <span>Run</span>
          </motion.button>

          {/* Leave Room button */}
          <motion.button 
            whileTap={{ scale: 0.95 }}
            className="border border-outline-variant/30 hover:border-error/40 text-on-surface-variant hover:text-error hover:bg-error/10 px-3 py-1.5 rounded-xl transition-all text-xs font-semibold flex items-center gap-1 cursor-pointer"
            onClick={() => navigate('/')}
            title="Leave Room"
          >
            <MdLogout size={14} />
            <span className="hidden sm:inline">Leave</span>
          </motion.button>

          <motion.button 
            whileTap={{ scale: 0.92 }}
            className="text-on-surface-variant hover:text-on-surface transition-colors p-2 rounded-xl hover:bg-surface-container cursor-pointer border border-transparent hover:border-outline-variant/25"
            onClick={() => setTheme(prev => prev === 'obsidian' ? 'nord' : 'obsidian')}
            title={`Switch to ${theme === 'obsidian' ? 'Nord Slate' : 'Obsidian Gold'}`}
            aria-label={`Switch to ${theme === 'obsidian' ? 'Nord Slate' : 'Obsidian Gold'}`}
          >
            <MdOutlineWbSunny size={16} className={theme === 'nord' ? 'text-primary rotate-45 transition-transform duration-300' : 'transition-transform duration-300'} />
          </motion.button>
          
          {user && (
            <div className="z-30 border-l border-outline-variant/25 pl-1.5">
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

        {/* Center Panel */}
        <div className="flex-1 flex flex-col h-full overflow-hidden relative z-20 bg-background">
          
          <main className="flex-1 flex w-full h-full relative overflow-hidden bg-surface-dim">
             {renderMainArea()}
          </main>
        </div>

        {(isChatOpen || isMembersOpen) && (
          <Suspense fallback={<div className="w-[300px] flex-shrink-0 bg-surface-container border-l border-outline-variant/20 h-full animate-pulse" />}>
            <RightSidebar 
              isChatOpen={isChatOpen}
              setIsChatOpen={setIsChatOpen}
              isMembersOpen={isMembersOpen}
              setIsMembersOpen={setIsMembersOpen}
              messages={chatMessages}
              onSendMessage={handleSendChatMessage}
            />
          </Suspense>
        )}
      </div>

      {/* Modals */}
      {isInviteModalOpen && roomData && (
        <Suspense fallback={null}>
          <InviteModal roomId={roomData.id} onClose={() => setIsInviteModalOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}
