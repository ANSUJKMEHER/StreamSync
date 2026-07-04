import { useState, useEffect } from 'react';
import { useFileStore } from '../../store/fileStore';
import { useAuthStore } from '../../store/authStore';
import { useDriftStore } from '../../store/driftStore';
import { wsService } from '../../services/websocket';
import './StatusBar.css';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

function StatusBar() {
  const { files, activeFileId, cursorPosition } = useFileStore();
  const { user } = useAuthStore();
  const { driftEdges, isAnalyzing } = useDriftStore();
  const activeFile = files.find((f) => f.id === activeFileId);
  const [wsStatus, setWsStatus] = useState<ConnectionStatus>('disconnected');

  useEffect(() => {
    const unsub = wsService.onStatusChange((status) => {
      setWsStatus(status);
    });
    return unsub;
  }, []);

  const statusConfig = {
    connected: { label: 'StreamSync', className: 'connected', dot: true },
    connecting: { label: 'Connecting…', className: 'connecting', dot: true },
    disconnected: { label: 'Offline', className: 'disconnected', dot: false },
  };

  const config = statusConfig[wsStatus];

  return (
    <div className="statusbar">
      {/* Left section */}
      <div className="statusbar-left">
        {/* Connection status */}
        <div className={`statusbar-remote ${config.className}`}>
          {config.dot && <span className="statusbar-remote-dot" />}
          {!config.dot && <span className="statusbar-offline-icon">⊘</span>}
          <span>{config.label}</span>
        </div>

        {/* User display */}
        {user && (
          <div className="statusbar-item">
            <span className="statusbar-user-icon">◉</span>
            <span className="statusbar-username">{user.username}</span>
          </div>
        )}

        <div className="statusbar-divider" />

        {/* Drift Indicator */}
        <div className="statusbar-item" style={{ color: driftEdges.length > 0 ? '#ef4444' : '#22c55e' }}>
          <span style={{ marginRight: '6px' }}>📐</span>
          <span>
            {isAnalyzing ? 'Analyzing...' : `${driftEdges.length} Drifts`}
          </span>
        </div>
      </div>

      {/* Right section */}
      <div className="statusbar-right">
        {activeFile && (
          <>
            {/* Cursor position */}
            <div className="statusbar-item">
              <span>
                Ln {cursorPosition.lineNumber}, Col {cursorPosition.column}
              </span>
            </div>

            <div className="statusbar-divider" />

            {/* Encoding */}
            <div className="statusbar-item">
              <span>UTF-8</span>
            </div>

            <div className="statusbar-divider" />

            {/* Indentation */}
            <div className="statusbar-item clickable">
              <span>Spaces: 2</span>
            </div>

            <div className="statusbar-divider" />

            {/* Language */}
            <div className="statusbar-item clickable">
              <span className="statusbar-language">
                {activeFile.language}
              </span>
            </div>
          </>
        )}

        {!activeFile && (
          <div className="statusbar-item">
            <span>Ready</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default StatusBar;
