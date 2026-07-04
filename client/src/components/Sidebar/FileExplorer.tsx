import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useFileStore } from '../../store/fileStore';
import { useCanvasStore } from '../../store/canvasStore';
import { getFileIcon } from '../../utils/fileUtils';
import type { FileItem } from '../../types';
import './FileExplorer.css';

// --- Tree Data Structures ---
type TreeNode = {
  name: string;
  path: string;
  isFile: boolean;
  file?: FileItem;
  children: Record<string, TreeNode>;
};

function buildFileTree(files: FileItem[]): TreeNode {
  const root: TreeNode = { name: 'root', path: '', isFile: false, children: {} };

  files.forEach(file => {
    const parts = file.name.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const currentPath = parts.slice(0, i + 1).join('/');
      const isLast = i === parts.length - 1;

      if (!current.children[part]) {
        current.children[part] = {
          name: part,
          path: currentPath,
          isFile: isLast ? !file.isFolder : false,
          children: {}
        };
      }

      if (isLast) {
        current.children[part].file = file;
        current.children[part].isFile = !file.isFolder;
      }

      current = current.children[part];
    }
  });

  return root;
}

// --- Recursive Component ---
const FileTreeNodeUI = ({
  node,
  depth,
  expandedFolders,
  toggleFolder,
  onFileClick,
  onFileAction,
  activeFileId,
  activeFolderPath
}: {
  node: TreeNode;
  depth: number;
  expandedFolders: Set<string>;
  toggleFolder: (path: string) => void;
  onFileClick: (fileId: string) => void;
  onFileAction: (action: 'rename' | 'delete', fileId: string, name: string, e: React.MouseEvent) => void;
  activeFileId: string | null;
  activeFolderPath: string | null;
}) => {
  const isExpanded = expandedFolders.has(node.path);
  const isActiveFile = node.isFile && node.file?.id === activeFileId;
  const isActiveFolder = !node.isFile && node.path === activeFolderPath;
  const paddingLeft = depth * 12 + 8;

  const childrenNodes = Object.values(node.children).sort((a, b) => {
    // Folders first, then files alphabetically
    if (a.isFile === b.isFile) return a.name.localeCompare(b.name);
    return a.isFile ? 1 : -1;
  });

  return (
    <div>
      <div
        className={`tree-node ${isActiveFile ? 'active-file' : ''} ${isActiveFolder ? 'active-folder' : ''}`}
        style={{ paddingLeft: `${paddingLeft}px` }}
        onClick={(e) => {
          e.stopPropagation();
          if (node.isFile && node.file) {
            onFileClick(node.file.id);
          } else {
            toggleFolder(node.path);
          }
        }}
      >
        <span className="tree-node-icon">
          {!node.isFile ? (
            <span className={`folder-chevron ${isExpanded ? 'expanded' : ''}`}>▶</span>
          ) : (
            getFileIcon(node.name).icon
          )}
        </span>
        <span className="tree-node-name">{node.name}</span>

        {/* Inline Actions */}
        {node.file && (
          <div className="tree-node-actions">
            <button className="tree-node-action-btn" onClick={(e) => onFileAction('rename', node.file!.id, node.file!.name, e)}>✎</button>
            <button className="tree-node-action-btn delete" onClick={(e) => onFileAction('delete', node.file!.id, node.file!.name, e)}>✕</button>
          </div>
        )}
      </div>

      {!node.isFile && isExpanded && (
        <div className="tree-children">
          {childrenNodes.map(child => (
            <FileTreeNodeUI
              key={child.path}
              node={child}
              depth={depth + 1}
              expandedFolders={expandedFolders}
              toggleFolder={toggleFolder}
              onFileClick={onFileClick}
              onFileAction={onFileAction}
              activeFileId={activeFileId}
              activeFolderPath={activeFolderPath}
            />
          ))}
        </div>
      )}
    </div>
  );
};


// --- Main Component ---
export default function FileExplorer() {
  const { roomId } = useParams<{ roomId: string }>();
  const {
    files,
    activeFileId,
    activeFolderPath,
    setActiveFolderPath,
    openFile,
    createFile,
    createFolder,
    deleteFile,
    renameFile,
  } = useFileStore();

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [isCreating, setIsCreating] = useState<'file' | 'folder' | null>(null);
  const [newName, setNewName] = useState('');
  
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  
  const inputRef = useRef<HTMLInputElement>(null);
  const { shapes, updateShape } = useCanvasStore();

  const rootNode = useMemo(() => buildFileTree(files), [files]);

  // Expand folders that contain the active file
  useEffect(() => {
    if (activeFileId) {
      const activeFile = files.find(f => f.id === activeFileId);
      if (activeFile) {
        const parts = activeFile.name.split('/');
        const newExpanded = new Set(expandedFolders);
        let path = '';
        for (let i = 0; i < parts.length - 1; i++) {
          path = path ? `${path}/${parts[i]}` : parts[i];
          newExpanded.add(path);
        }
        setExpandedFolders(newExpanded);
      }
    }
  }, [activeFileId, files]);

  useEffect(() => {
    if (isCreating || renamingId) {
      inputRef.current?.focus();
      if (renamingId) inputRef.current?.select();
    }
  }, [isCreating, renamingId]);

  const toggleFolder = useCallback((path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
    setActiveFolderPath(path);
  }, [setActiveFolderPath]);

  const handleCreate = useCallback(() => {
    if (newName.trim() && roomId && isCreating) {
      const fullPath = activeFolderPath ? `${activeFolderPath}/${newName.trim()}` : newName.trim();
      
      if (isCreating === 'file') {
        createFile(roomId, fullPath);
      } else {
        createFolder(roomId, fullPath);
        setExpandedFolders(prev => new Set(prev).add(fullPath));
      }
      
      setNewName('');
      setIsCreating(null);
    } else {
      setIsCreating(null);
    }
  }, [newName, isCreating, activeFolderPath, roomId, createFile, createFolder]);

  const handleFileAction = useCallback((action: 'rename' | 'delete', id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (action === 'delete') {
      if (window.confirm(`Delete "${name}"?`)) {
        deleteFile(id);
      }
    } else if (action === 'rename') {
      setRenamingId(id);
      setRenameValue(name);
    }
  }, [deleteFile]);

  const submitRename = useCallback(() => {
    if (renamingId && renameValue.trim()) {
      const oldFile = files.find(f => f.id === renamingId);
      if (oldFile && oldFile.name !== renameValue.trim()) {
        renameFile(renamingId, renameValue.trim());
        
        shapes.forEach((shape) => {
          if (shape.fileId === renamingId) {
            updateShape(shape.id, { label: renameValue.trim().split('/').pop()?.replace(/\.[^/.]+$/, '') });
          }
        });
      }
    }
    setRenamingId(null);
  }, [renamingId, renameValue, files, renameFile, shapes, updateShape]);

  return (
    <div className="file-explorer" onClick={() => setActiveFolderPath(null)}>
      {/* Header */}
      <div className="explorer-header" onClick={(e) => e.stopPropagation()}>
        <span className="explorer-title">EXPLORER</span>
        <div className="explorer-actions">
          <button className="explorer-action-btn" onClick={() => setIsCreating('file')} title="New File">📄</button>
          <button className="explorer-action-btn" onClick={() => setIsCreating('folder')} title="New Folder">📁</button>
          <button className="explorer-action-btn" onClick={() => setExpandedFolders(new Set())} title="Collapse All">➖</button>
        </div>
      </div>

      {/* Tree View */}
      <div className="explorer-files">
        {Object.values(rootNode.children).map(node => (
          <FileTreeNodeUI
            key={node.path}
            node={node}
            depth={0}
            expandedFolders={expandedFolders}
            toggleFolder={toggleFolder}
            onFileClick={openFile}
            onFileAction={handleFileAction}
            activeFileId={activeFileId}
            activeFolderPath={activeFolderPath}
          />
        ))}

        {/* Create Input */}
        {isCreating && (
          <div className="tree-create-input-wrapper" style={{ paddingLeft: activeFolderPath ? '20px' : '8px' }}>
            <span className="tree-node-icon">{isCreating === 'folder' ? '📁' : '📄'}</span>
            <input
              ref={inputRef}
              className="tree-create-input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={handleCreate}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') setIsCreating(null);
              }}
              placeholder={isCreating === 'file' ? 'File name' : 'Folder name'}
            />
          </div>
        )}

        {/* Rename Input */}
        {renamingId && (
          <div className="tree-rename-overlay">
            <div className="tree-rename-box">
              <input
                ref={inputRef}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={submitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitRename();
                  if (e.key === 'Escape') setRenamingId(null);
                }}
              />
            </div>
          </div>
        )}

        {files.length === 0 && !isCreating && (
          <div className="explorer-empty" onClick={() => setIsCreating('file')}>
            No files. Click to create one.
          </div>
        )}
      </div>
    </div>
  );
}
