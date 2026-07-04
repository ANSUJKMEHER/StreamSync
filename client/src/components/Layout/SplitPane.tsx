import { useCallback, useRef, useState, useEffect } from 'react';
import { useFileStore } from '../../store/fileStore';
import './SplitPane.css';

interface SplitPaneProps {
  left: React.ReactNode;
  right: React.ReactNode;
}

function SplitPane({ left, right }: SplitPaneProps) {
  const { isSidebarOpen, sidebarWidth, setSidebarWidth } = useFileStore();
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newWidth = Math.max(180, Math.min(400, e.clientX - rect.left));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, setSidebarWidth]);

  return (
    <div className="split-pane" ref={containerRef}>
      <div
        className={`split-pane-left ${!isSidebarOpen ? 'collapsed' : ''}`}
        style={{ width: isSidebarOpen ? sidebarWidth : 0 }}
      >
        {left}
      </div>
      {isSidebarOpen && (
        <div
          className={`split-pane-divider ${isDragging ? 'dragging' : ''}`}
          onMouseDown={handleMouseDown}
        />
      )}
      <div className="split-pane-right">{right}</div>
    </div>
  );
}

export default SplitPane;
