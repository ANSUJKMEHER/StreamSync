import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useFileStore } from '../../store/fileStore';
import { useCanvasStore } from '../../store/canvasStore';
import type { FileItem } from '../../types';
import './FileExplorer.css';

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

import { VscFolder, VscFolderOpened, VscFile, VscJson, VscMarkdown, VscSettingsGear } from 'react-icons/vsc';
import { SiJavascript, SiTypescript, SiHtml5, SiCss, SiPython, SiGo, SiRust, SiReact } from 'react-icons/si';

const getVscFileIcon = (filename: string) => {
  const parts = filename.split('.');
  const ext = parts.length > 1 ? parts.pop()!.toLowerCase() : '';
  const size = 16;
  
  if (filename.includes('vite.config') || filename.includes('eslint.config')) return <SiJavascript size={size} color="#f7df1e" />;
  if (filename === 'package.json' || filename === 'package-lock.json') return <VscJson size={size} color="#cb3837" />;
  
  switch (ext) {
    case 'js': return <SiJavascript size={size} color="#f7df1e" />;
    case 'jsx': return <SiReact size={size} color="#61dafb" />;
    case 'ts': return <SiTypescript size={size} color="#3178c6" />;
    case 'tsx': return <SiReact size={size} color="#61dafb" />;
    case 'py': return <SiPython size={size} color="#3776ab" />;
    case 'go': return <SiGo size={size} color="#00add8" />;
    case 'rs': return <SiRust size={size} color="#ce422b" />;
    case 'html': return <SiHtml5 size={size} color="#e34f26" />;
    case 'css': return <SiCss size={size} color="#264de4" />;
    case 'json': return <VscJson size={size} color="#cb3837" />;
    case 'md': return <VscMarkdown size={size} color="#ffffff" />;
    case 'gitignore': return <VscSettingsGear size={size} color="#a1a1aa" />;
    default: return <VscFile size={size} color="#71717a" />;
  }
};

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
  const paddingLeft = depth * 12 + 16;

  const childrenNodes = Object.values(node.children).sort((a, b) => {
    if (a.isFile === b.isFile) return a.name.localeCompare(b.name);
    return a.isFile ? 1 : -1;
  });

  return (
    <div>
      <div
        className={`flex items-center py-1.5 cursor-pointer rounded-r-md ml-1 my-0.5 relative group ${isActiveFile ? 'text-primary bg-primary/10 border-l-2 border-primary font-medium' : isActiveFolder ? 'bg-surface-variant/30 text-on-surface' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/30'}`}
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
        {!node.isFile && (
          <span className={`material-symbols-outlined text-[18px] text-outline mr-1 transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
            arrow_right
          </span>
        )}
        
        <span className="flex items-center justify-center mr-2">
          {!node.isFile ? (
            isExpanded ? <VscFolderOpened size={16} color="#dcb67a" /> : <VscFolder size={16} color="#dcb67a" />
          ) : (
            <span style={{ width: '16px', height: '16px', display: 'flex', alignItems: 'center' }}>
               {getVscFileIcon(node.name)}
            </span>
          )}
        </span>
        
        <span className="font-body-md text-body-md truncate">{node.name}</span>

        {/* Inline Actions */}
        {node.file && (
          <div className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-surface-container/80 backdrop-blur-sm rounded">
            <button className="text-[14px] hover:text-primary p-0.5" onClick={(e) => onFileAction('rename', node.file!.id, node.file!.name, e)}><span className="material-symbols-outlined text-[14px]">edit</span></button>
            <button className="text-[14px] hover:text-error p-0.5" onClick={(e) => onFileAction('delete', node.file!.id, node.file!.name, e)}><span className="material-symbols-outlined text-[14px]">close</span></button>
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
    <div className="h-full flex flex-col" onClick={() => setActiveFolderPath(null)}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-outline-variant/10" onClick={(e) => e.stopPropagation()}>
        <span className="font-label-md text-label-md font-bold tracking-wider text-on-surface-variant uppercase">Project</span>
        <div className="flex gap-2 text-on-surface-variant">
          <button className="hover:text-primary transition-colors" onClick={() => setIsCreating('file')} title="New File"><span className="material-symbols-outlined text-[16px]">note_add</span></button>
          <button className="hover:text-primary transition-colors" onClick={() => setIsCreating('folder')} title="New Folder"><span className="material-symbols-outlined text-[16px]">create_new_folder</span></button>
          <button className="hover:text-primary transition-colors" onClick={() => setExpandedFolders(new Set())} title="Collapse All"><span className="material-symbols-outlined text-[16px]">unfold_less</span></button>
        </div>
      </div>

      {/* Tree View */}
      <div className="flex-1 overflow-y-auto py-2">
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
          <div className="flex items-center px-4 py-1.5" style={{ paddingLeft: activeFolderPath ? '20px' : '16px' }}>
            <span className="material-symbols-outlined text-[16px] text-tertiary-fixed-dim mr-2">{isCreating === 'folder' ? 'folder' : 'description'}</span>
            <input
              ref={inputRef}
              className="bg-surface-variant text-on-surface font-body-md border border-outline-variant rounded px-2 py-0.5 w-full outline-none focus:border-primary"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/50 backdrop-blur-sm">
            <div className="bg-surface-container-high p-4 rounded-lg shadow-xl border border-outline-variant w-80">
              <input
                ref={inputRef}
                className="bg-surface-dim text-on-surface w-full px-3 py-2 rounded border border-outline focus:border-primary outline-none"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={submitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitRename();
                  if (e.key === 'Escape') setRenamingId(null);
                }}
              />
              <div className="text-on-surface-variant text-xs mt-2 text-right">Press Enter to save, Esc to cancel</div>
            </div>
          </div>
        )}

        {files.length === 0 && !isCreating && (
          <div className="px-4 py-4 text-center text-on-surface-variant text-sm cursor-pointer hover:text-primary" onClick={() => setIsCreating('file')}>
            No files. Click to create one.
          </div>
        )}
      </div>
    </div>
  );
}
