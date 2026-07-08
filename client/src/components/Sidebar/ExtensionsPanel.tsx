import { useState } from 'react';
import { MdSearch, MdSettings, MdCheckCircle } from 'react-icons/md';

interface Extension {
  id: string;
  name: string;
  publisher: string;
  description: string;
  version: string;
  installed: boolean;
  downloads: string;
  rating: string;
}

export default function ExtensionsPanel() {
  const [searchQuery, setSearchQuery] = useState('');
  
  const [extensions, setExtensions] = useState<Extension[]>([
    {
      id: 'code-runner',
      name: 'Code Runner',
      publisher: 'Jun Han',
      description: 'Run code snippets or code files for multiple languages (JS, TS, Python, C, Go).',
      version: 'v0.12.0',
      installed: true,
      downloads: '22M',
      rating: '4.8',
    },
    {
      id: 'prettier',
      name: 'Prettier - Code formatter',
      publisher: 'Prettier',
      description: 'Opinionated code formatter using standard style rules.',
      version: 'v10.1.0',
      installed: true,
      downloads: '45M',
      rating: '4.7',
    },
    {
      id: 'material-icons',
      name: 'Material Icon Theme',
      publisher: 'Philipp Kief',
      description: 'Material Design Icons for files and folders in StreamSync.',
      version: 'v5.3.0',
      installed: true,
      downloads: '18M',
      rating: '4.9',
    },
    {
      id: 'gitlens',
      name: 'GitLens — Git supercharged',
      publisher: 'GitKraken',
      description: 'Visualize code authorship at a glance via Git blame annotations.',
      version: 'v14.0.1',
      installed: false,
      downloads: '29M',
      rating: '4.8',
    },
    {
      id: 'copilot',
      name: 'GitHub Copilot',
      publisher: 'GitHub',
      description: 'Your AI pair programmer assisting with context-aware autocomplete.',
      version: 'v1.150.0',
      installed: false,
      downloads: '10M',
      rating: '4.2',
    }
  ]);

  const handleInstall = (id: string) => {
    setExtensions(prev => prev.map(ext => ext.id === id ? { ...ext, installed: true } : ext));
  };

  const filteredExtensions = extensions.filter(ext => 
    ext.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ext.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const installedList = filteredExtensions.filter(e => e.installed);
  const recommendedList = filteredExtensions.filter(e => !e.installed);

  return (
    <div className="flex flex-col h-full bg-surface-container-low text-on-surface font-sans">
      {/* Title */}
      <div className="p-4 border-b border-outline-variant/15 flex justify-between items-center shrink-0">
        <h2 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Extensions Marketplace</h2>
        <MdSettings className="text-on-surface-variant hover:text-white cursor-pointer transition-colors" size={16} />
      </div>

      {/* Search Input */}
      <div className="p-3 shrink-0">
        <div className="flex items-center gap-2 bg-surface-container border border-outline-variant/15 rounded-xl px-3 py-1.5 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
          <MdSearch size={16} className="text-on-surface-variant/75" />
          <input
            type="text"
            placeholder="Search extensions in marketplace..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none outline-none text-on-surface w-full placeholder-on-surface-variant/25 text-xs font-code"
          />
        </div>
      </div>

      {/* Extension List */}
      <div className="flex-grow overflow-y-auto no-scrollbar px-3 pb-4 flex flex-col gap-5">
        {/* Installed Section */}
        {installedList.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60 px-1">Installed ({installedList.length})</h3>
            <div className="flex flex-col gap-2">
              {installedList.map(ext => (
                <div key={ext.id} className="flex gap-3 p-3 bg-surface border border-outline-variant/20 rounded-xl hover:border-primary/30 transition-all select-none group">
                  <div className="w-10 h-10 rounded-lg bg-surface-container-high border border-outline-variant/15 flex items-center justify-center font-bold text-sm text-primary group-hover:scale-95 transition-transform shrink-0">
                    {ext.name.charAt(0)}
                  </div>
                  <div className="flex-grow flex flex-col min-w-0">
                    <div className="flex justify-between items-center gap-1">
                      <span className="font-semibold text-xs text-white truncate max-w-[85%]">{ext.name}</span>
                      <MdCheckCircle className="text-success shrink-0" size={13} title="Installed & Active" />
                    </div>
                    <span className="text-[9px] text-on-surface-variant/65 font-medium mt-0.5">{ext.publisher} • {ext.version}</span>
                    <p className="text-[10px] text-on-surface-variant/75 mt-1.5 leading-relaxed line-clamp-2">{ext.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommended Section */}
        {recommendedList.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60 px-1">Recommended</h3>
            <div className="flex flex-col gap-2">
              {recommendedList.map(ext => (
                <div key={ext.id} className="flex gap-3 p-3 bg-surface border border-outline-variant/20 rounded-xl hover:border-primary/30 transition-all select-none group">
                  <div className="w-10 h-10 rounded-lg bg-surface-container-high border border-outline-variant/15 flex items-center justify-center font-bold text-sm text-on-surface-variant group-hover:scale-95 transition-transform shrink-0">
                    {ext.name.charAt(0)}
                  </div>
                  <div className="flex-grow flex flex-col min-w-0">
                    <div className="flex justify-between items-center gap-1">
                      <span className="font-semibold text-xs text-white truncate max-w-[70%]">{ext.name}</span>
                      <button 
                        onClick={() => handleInstall(ext.id)}
                        className="bg-primary hover:bg-primary/95 text-background text-[10px] font-bold px-2 py-0.5 rounded-md shadow-sm shrink-0 active:scale-95 transition-all"
                      >
                        Install
                      </button>
                    </div>
                    <span className="text-[9px] text-on-surface-variant/65 font-medium mt-0.5">{ext.publisher} • {ext.downloads} • ★{ext.rating}</span>
                    <p className="text-[10px] text-on-surface-variant/75 mt-1.5 leading-relaxed line-clamp-2">{ext.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
