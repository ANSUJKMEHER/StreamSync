const EXTENSION_ICONS: Record<string, { icon: string; color: string }> = {
  js: { icon: 'JS', color: '#f7df1e' },
  jsx: { icon: 'JSX', color: '#61dafb' },
  ts: { icon: 'TS', color: '#3178c6' },
  tsx: { icon: 'TSX', color: '#3178c6' },
  py: { icon: 'PY', color: '#3776ab' },
  go: { icon: 'GO', color: '#00add8' },
  rs: { icon: 'RS', color: '#ce422b' },
  html: { icon: '◇', color: '#e34f26' },
  css: { icon: '#', color: '#264de4' },
  json: { icon: '{ }', color: '#a1a1aa' },
  md: { icon: 'M↓', color: '#ffffff' },
  yaml: { icon: '⊞', color: '#cb171e' },
  yml: { icon: '⊞', color: '#cb171e' },
  sql: { icon: 'DB', color: '#f29111' },
  sh: { icon: '$', color: '#4eaa25' },
  bash: { icon: '$', color: '#4eaa25' },
  txt: { icon: '¶', color: '#a1a1aa' },
};

export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
}

export function getFileIcon(filename: string): { icon: string; color: string } {
  const ext = getFileExtension(filename);
  return EXTENSION_ICONS[ext] || { icon: '◦', color: '#71717a' };
}

export function getLanguageFromFilename(filename: string): string {
  const ext = getFileExtension(filename);
  const langMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    go: 'go',
    rs: 'rust',
    html: 'html',
    css: 'css',
    json: 'json',
    md: 'markdown',
    yaml: 'yaml',
    yml: 'yaml',
    sql: 'sql',
    sh: 'shell',
    bash: 'shell',
    txt: 'plaintext',
  };
  return langMap[ext] || 'plaintext';
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
