import { useCallback } from 'react';
import { useFileStore } from '../../store/fileStore';
import { getFileIcon } from '../../utils/fileUtils';
import './FileTabs.css';

function FileTabs() {
  const {
    files,
    openFileIds,
    activeFileId,
    modifiedFileIds,
    setActiveFile,
    closeFile,
  } = useFileStore();

  const handleClose = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      closeFile(id);
    },
    [closeFile]
  );

  const handleMiddleClick = useCallback(
    (id: string, e: React.MouseEvent) => {
      if (e.button === 1) {
        e.preventDefault();
        closeFile(id);
      }
    },
    [closeFile]
  );

  if (openFileIds.length === 0) {
    return (
      <div className="tabs-container">
        <div className="tabs-empty">No open editors</div>
      </div>
    );
  }

  return (
    <div className="tabs-container">
      {openFileIds.map((id) => {
        const file = files.find((f) => f.id === id);
        if (!file) return null;

        const { icon, color } = getFileIcon(file.name);
        const isActive = id === activeFileId;
        const isModified = modifiedFileIds.has(id);

        return (
          <div
            key={id}
            className={`tab ${isActive ? 'active' : ''}`}
            onClick={() => setActiveFile(id)}
            onMouseDown={(e) => handleMiddleClick(id, e)}
          >
            <span className="tab-icon" style={{ color }}>
              {icon}
            </span>
            <span className="tab-name">{file.name}</span>
            {isModified && <span className="tab-modified" />}
            <button
              className={`tab-close ${isModified ? 'has-modified' : ''}`}
              onClick={(e) => handleClose(id, e)}
              aria-label={`Close ${file.name}`}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default FileTabs;
