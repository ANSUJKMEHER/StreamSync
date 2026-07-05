import './ActivityBar.css';

interface ActivityBarProps {
  activeView: 'explorer' | 'search' | 'github';
  setActiveView: (view: 'explorer' | 'search' | 'github') => void;
}

export default function ActivityBar({ activeView, setActiveView }: ActivityBarProps) {
  return (
    <aside className="w-16 flex-shrink-0 bg-surface-container-lowest border-r border-outline-variant/20 flex flex-col items-center py-4 gap-container-gap z-40 relative shadow-[1px_0_10px_rgba(0,0,0,0.5)]">
      {/* Top Actions */}
      <div className="flex flex-col gap-2 w-full items-center">
        <button 
          className={`w-10 h-10 rounded-lg flex items-center justify-center relative group transition-all ${activeView === 'explorer' ? 'text-primary bg-primary/10 border-l-2 border-primary' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/50'}`}
          onClick={() => setActiveView('explorer')}
          title="Explorer"
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: activeView === 'explorer' ? "'FILL' 1" : "'FILL' 0" }}>folder</span>
          <div className="absolute left-14 bg-surface-container-highest text-on-surface px-2 py-1 rounded text-label-md font-label-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">Explorer</div>
        </button>
        
        <button 
          className={`w-10 h-10 rounded-lg flex items-center justify-center relative group transition-all ${activeView === 'search' ? 'text-primary bg-primary/10 border-l-2 border-primary' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/50'}`}
          onClick={() => setActiveView('search')}
          title="Search"
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: activeView === 'search' ? "'FILL' 1" : "'FILL' 0" }}>search</span>
          <div className="absolute left-14 bg-surface-container-highest text-on-surface px-2 py-1 rounded text-label-md font-label-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">Search</div>
        </button>
        
        <button 
          className={`w-10 h-10 rounded-lg flex items-center justify-center relative group transition-all ${activeView === 'github' ? 'text-primary bg-primary/10 border-l-2 border-primary' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/50'}`}
          onClick={() => setActiveView('github')}
          title="Source Control"
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: activeView === 'github' ? "'FILL' 1" : "'FILL' 0" }}>account_tree</span>
          {/* Notification Badge */}
          <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full"></span>
          <div className="absolute left-14 bg-surface-container-highest text-on-surface px-2 py-1 rounded text-label-md font-label-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">Source Control</div>
        </button>
      </div>

      <div className="mt-auto flex flex-col gap-2 w-full items-center">
        <button className="w-10 h-10 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/50 transition-all flex items-center justify-center relative group" title="Settings">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>settings</span>
          <div className="absolute left-14 bg-surface-container-highest text-on-surface px-2 py-1 rounded text-label-md font-label-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">Settings</div>
        </button>
      </div>
    </aside>
  );
}
