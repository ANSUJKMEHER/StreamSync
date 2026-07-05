import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFileStore } from '../../store/fileStore';
import { useAuthStore } from '../../store/authStore';
import { useRoomStore } from '../../store/roomStore';
import { wsService } from '../../services/websocket';
import { roomService, type Room } from '../../services/roomService';
import { useCanvasStore } from '../../store/canvasStore';
import { buildAutoGraph } from '../../services/graphEngine';
import SplitPane from '../Layout/SplitPane';
import FileExplorer from '../Sidebar/FileExplorer';
import ActivityBar from '../Sidebar/ActivityBar';
import FileTabs from '../Tabs/FileTabs';
import MonacoEditor from '../Editor/MonacoEditor';
import CanvasPanel from '../Canvas/CanvasPanel';
import StatusBar from '../StatusBar/StatusBar';
import BottomPanel from '../Panel/BottomPanel';
import UserDropdown from '../Auth/UserDropdown';
import InviteModal from './InviteModal';
import GitHubPanel from '../Sidebar/GitHubPanel';
import '../../App.css';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { LuShare2, LuPlay, LuTerminal, LuArchive, LuImage, LuGithub } from 'react-icons/lu';

type ViewMode = 'editor' | 'canvas' | 'split';
type ActivityView = 'explorer' | 'search' | 'github';

export default function Workspace() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { files, activeFileId, fetchFiles, isLoading, isSidebarOpen } = useFileStore();
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

  // Join room when active file changes
  useEffect(() => {
    if (!activeFileId) {
      setActiveRoom(null);
      return;
    }

    setActiveRoom(activeFileId);
    wsService.joinRoom(activeFileId);

    return () => {
      wsService.leaveRoom(activeFileId);
    };
  }, [activeFileId, setActiveRoom]);

  const handleExportZip = async () => {
    if (files.length === 0) return;
    const zip = new JSZip();
    files.forEach(f => {
      if (!f.isFolder) {
        zip.file(f.name, f.content);
      }
    });
    const blob = await zip.generateAsync({ type: 'blob' });
    saveAs(blob, `${roomData?.name || 'project'}-export.zip`);
  };

  const handleExportPng = () => {
    const stage = (window as any).__KONVA_STAGE__;
    if (stage) {
      const dataUrl = stage.toDataURL({ pixelRatio: 2 });
      saveAs(dataUrl, `${roomData?.name || 'canvas'}-diagram.png`);
    } else {
      alert("Canvas not found. Open the canvas view to export it.");
    }
  };

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

  // Run Live Dependency Graph Engine
  useEffect(() => {
    if (files.length === 0) return;
    
    // Debounce the graph analysis
    const timeout = setTimeout(() => {
      try {
        const existingAutoShapes = useCanvasStore.getState().shapes.filter(s => s.isAutoGenerated);
        const { shapes: autoShapes, arrows: autoArrows } = buildAutoGraph(files, existingAutoShapes);
        
        useCanvasStore.getState().setAutoGraph(autoShapes, autoArrows);
      } catch (err) {
        console.error('Graph engine error:', err);
      }
    }, 500);
    
    return () => clearTimeout(timeout);
  }, [files]); // We only trigger on files change, not shapes/arrows, to avoid infinite loops!

  if (isInitialLoad && isLoading) {
    return (
      <div className="app-loading">
        <div className="app-loading-logo">S</div>
        <div className="app-loading-text">STREAMSYNC</div>
        <div className="app-loading-bar">
          <div className="app-loading-bar-fill" />
        </div>
      </div>
    );
  }

  // --- Rendering Architecture ---
  
  const renderSidebar = () => {
    if (!isSidebarOpen) return null;
    if (activeActivityView === 'explorer') return <FileExplorer />;
    if (activeActivityView === 'github') return <GitHubPanel roomData={roomData} />;
    return (
      <div style={{ padding: '16px', color: 'var(--text-muted)' }}>
        {activeActivityView.charAt(0).toUpperCase() + activeActivityView.slice(1)} coming soon...
      </div>
    );
  };

  const renderEditorArea = () => (
    <div className="editor-area">
      <FileTabs />
      <div className="editor-panel">
        <MonacoEditor />
      </div>
    </div>
  );

  const renderCanvasArea = () => (
    <div className="canvas-area">
      <CanvasPanel />
    </div>
  );

  const renderMainArea = () => {
    // Use a stable DOM structure for editor and canvas to prevent React from unmounting components when switching modes
    let content = (
      <div className={viewMode === 'split' ? 'split-workspace' : ''} style={{ display: 'flex', width: '100%', height: '100%' }}>
        
        {/* Editor Area */}
        <div 
          className={viewMode === 'split' ? 'split-workspace-left' : ''} 
          style={{ 
            display: viewMode === 'canvas' ? 'none' : 'flex', 
            flexDirection: 'column',
            flex: viewMode === 'split' ? 1 : 1, // Let SplitPane styles handle flex when in split mode
            width: viewMode === 'split' ? undefined : '100%',
            height: '100%'
          }}
        >
          {renderEditorArea()}
        </div>
        
        {/* Divider */}
        {viewMode === 'split' && <div className="split-workspace-divider" />}
        
        {/* Canvas Area */}
        <div 
          className={viewMode === 'split' ? 'split-workspace-right' : ''} 
          style={{ 
            display: viewMode === 'editor' ? 'none' : 'block', 
            flex: viewMode === 'split' ? 1 : 1,
            width: viewMode === 'split' ? undefined : '100%',
            height: '100%'
          }}
        >
          {renderCanvasArea()}
        </div>

      </div>
    );

    // Wrap main content with vertical flex container to ensure React doesn't unmount the editor
    return (
      <div className="editor-with-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
        <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
          {content}
        </div>
        {isBottomPanelOpen && (
          <>
            <div 
              className="panel-resizer" 
              style={{ 
                height: '4px', 
                background: 'var(--border-subtle)', 
                cursor: 'row-resize',
                zIndex: 10
              }} 
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
            />
            <div style={{ height: `${bottomPanelHeight}px`, flexShrink: 0, overflow: 'hidden' }}>
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
    <div className="app-root">
      {/* Title Bar */}
      <div className="titlebar">
        <div className="titlebar-left">
          <div className="titlebar-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
            <div className="titlebar-logo-icon">S</div>
            <span className="titlebar-logo-text" style={{ fontSize: '14px' }}>StreamSync</span>
          </div>
          
          <div className="titlebar-divider" />
          
          {roomData && (
             <div className="titlebar-project-info">
               <span className="titlebar-roomname">{roomData.name}</span>
               {roomData.access === 'VIEW' && <span className="titlebar-badge read-only">Read-Only</span>}
               {roomData.githubRepo && (
                 <span className="titlebar-badge github" title={`Connected to ${roomData.githubRepo}`}>
                   <LuGithub size={12} />
                 </span>
               )}
             </div>
          )}
        </div>

        <div className="titlebar-center">
          {/* View mode toggle */}
          <div className="view-toggle">
            <button
              className={`view-toggle-btn ${viewMode === 'editor' ? 'active' : ''}`}
              onClick={() => setViewMode('editor')}
              title="Code Editor"
            >
              Code
            </button>
            <button
              className={`view-toggle-btn ${viewMode === 'split' ? 'active' : ''}`}
              onClick={() => setViewMode('split')}
              title="Split View"
            >
              Split
            </button>
            <button
              className={`view-toggle-btn ${viewMode === 'canvas' ? 'active' : ''}`}
              onClick={() => setViewMode('canvas')}
              title="Canvas"
            >
              Canvas
            </button>
          </div>
        </div>

        <div className="titlebar-right">
          {/* Share Action */}
          {roomData && roomData.ownerId === user?.id && (
            <button 
              className="titlebar-btn action-share" 
              onClick={() => setIsInviteModalOpen(true)} 
              title="Share Project"
            >
              <LuShare2 size={14} />
              <span>Share</span>
            </button>
          )}

          {/* Run Action */}
          <button 
            className="titlebar-btn action-run" 
            onClick={handleRunCode} 
            title="Run Code"
            disabled={isExecuting || !activeFile}
          >
            <LuPlay size={14} />
            <span>Run</span>
          </button>
          
          {/* Terminal Toggle */}
          <button 
            className="titlebar-btn action-terminal" 
            onClick={() => setIsBottomPanelOpen(!isBottomPanelOpen)} 
            title="Toggle Panel"
          >
            <LuTerminal size={14} />
            <span>Terminal</span>
          </button>
          
          <div className="titlebar-divider" />
          
          {/* Export Actions */}
          <div className="titlebar-icon-group">
            <button className="titlebar-icon-btn" onClick={handleExportZip} title="Export Code as ZIP">
              <LuArchive size={15} />
            </button>
            <button className="titlebar-icon-btn" onClick={handleExportPng} title="Export Canvas as PNG">
              <LuImage size={15} />
            </button>
          </div>
          
          <div className="titlebar-divider" />

          {/* Active room users */}
          {activeFileId && roomUsers.filter(u => u.userId !== user?.id).length > 0 && (
            <div className="titlebar-active-users">
              {roomUsers.filter(u => u.userId !== user?.id).map((u, i) => (
                <div 
                  key={u.userId} 
                  className="titlebar-user-avatar remote-user" 
                  title={u.username}
                  style={{ zIndex: 10 - i }}
                >
                  {u.username.charAt(0).toUpperCase()}
                </div>
              ))}
              <div className="titlebar-divider" />
            </div>
          )}

          {/* User info */}
          {user ? (
            <UserDropdown />
          ) : (
            <div className="titlebar-user">
              <span className="titlebar-user-name">Guest</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="main-content" style={{ display: 'flex', flexDirection: 'row', height: 'calc(100vh - 40px - 24px)' }}>
        <ActivityBar activeView={activeActivityView} setActiveView={setActiveActivityView} />
        
        <div style={{ flex: 1, display: 'flex', flexDirection: 'row', height: '100%', overflow: 'hidden' }}>
          <SplitPane
            left={renderSidebar()}
            right={renderMainArea()}
          />
        </div>
      </div>

      {/* Status Bar */}
      <StatusBar />
      
      {/* Modals */}
      {isInviteModalOpen && roomData && (
        <InviteModal roomId={roomData.id} onClose={() => setIsInviteModalOpen(false)} />
      )}
    </div>
  );
}
