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
      <div className="flex items-end h-9 bg-surface-container-lowest border-b border-outline-variant/20 px-2 pt-1 gap-1 overflow-x-auto no-scrollbar">
        <div className="text-on-surface-variant font-label-md px-4 py-1 text-xs">No open editors</div>
      </div>
    );
  }

  return (
    <div className="flex items-end h-9 bg-surface-container-lowest border-b border-outline-variant/20 px-2 pt-1 gap-1 overflow-x-auto no-scrollbar flex-shrink-0">
      {openFileIds.map((id) => {
        const file = files.find((f) => f.id === id);
        if (!file) return null;

        const { icon, color } = getFileIcon(file.name);
        const isActive = id === activeFileId;
        const isModified = modifiedFileIds.has(id);

        return (
          <div
            key={id}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-t-lg min-w-[120px] max-w-[200px] relative group cursor-pointer transition-colors ${
              isActive 
                ? 'bg-surface-dim border-t border-x border-outline-variant/20 border-b-2 border-b-primary text-on-surface' 
                : 'text-on-surface-variant hover:bg-surface-variant/30 border-b border-b-transparent'
            }`}
            onClick={() => setActiveFile(id)}
            onMouseDown={(e) => handleMiddleClick(id, e)}
          >
            <span className="flex items-center" style={{ color, width: 14, height: 14 }}>
              {icon}
            </span>
            <span className="font-body-md text-body-md truncate">{file.name}</span>
            {isModified && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 ml-1" />}
            <button
              className={`ml-auto p-0.5 rounded hover:bg-surface-variant text-on-surface-variant hover:text-on-surface transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
              onClick={(e) => handleClose(id, e)}
              aria-label={`Close ${file.name}`}
            >
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default FileTabs;
