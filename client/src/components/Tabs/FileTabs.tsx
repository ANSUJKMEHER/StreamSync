import { useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useFileStore } from '../../store/fileStore';
import { getFileIcon } from '../../utils/fileUtils';
import { MdClose } from 'react-icons/md';
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
      <div className="flex items-center h-9 bg-surface-container-lowest border-b border-outline-variant/20 px-3 gap-1 overflow-x-auto no-scrollbar select-none">
        <span className="text-on-surface-variant/60 font-mono text-[11px]">
          No open editors
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-end h-9 bg-surface-container-lowest border-b border-outline-variant/20 px-2 gap-1 overflow-x-auto no-scrollbar flex-shrink-0 select-none">
      <AnimatePresence initial={false} mode="popLayout">
        {openFileIds.map((id) => {
          const file = files.find((f) => f.id === id);
          if (!file) return null;

          const { icon, color } = getFileIcon(file.name);
          const isActive = id === activeFileId;
          const isModified = modifiedFileIds.has(id);

          return (
            <motion.div
              key={id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, width: 0 }}
              transition={{ type: 'spring', stiffness: 450, damping: 30 }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-t-lg min-w-[120px] max-w-[210px] relative group cursor-pointer transition-colors ${
                isActive
                  ? 'bg-surface border-t border-x border-outline-variant/25 text-on-surface'
                  : 'text-on-surface-variant hover:bg-surface-container-low/60 hover:text-on-surface'
              }`}
              onClick={() => setActiveFile(id)}
              onMouseDown={(e) => handleMiddleClick(id, e)}
            >
              {/* Sliding Bottom Active Underline Indicator */}
              {isActive && (
                <motion.div
                  layoutId="active-tab-highlight"
                  className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary z-10"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}

              <span
                className="flex items-center shrink-0"
                style={{ color, width: 14, height: 14 }}
              >
                {icon}
              </span>
              <span className="text-xs font-mono font-medium truncate">{file.name}</span>

              {/* Kokonut-style glowing modification pip */}
              {isModified && (
                <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 ml-1 shadow-[0_0_8px_rgba(223,171,108,0.5)] animate-pulse" />
              )}

              <motion.button
                whileHover={{ scale: 1.15, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                className={`ml-auto p-0.5 rounded hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface transition-opacity ${
                  isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
                onClick={(e) => handleClose(id, e)}
                aria-label={`Close ${file.name}`}
              >
                <MdClose size={13} />
              </motion.button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export default FileTabs;
