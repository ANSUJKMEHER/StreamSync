import { VscFiles, VscSearch, VscSourceControl, VscExtensions, VscSettingsGear, VscSparkle } from 'react-icons/vsc';
import { MdChatBubbleOutline, MdPeople } from 'react-icons/md';
import './ActivityBar.css';

interface ActivityBarProps {
  activeView: 'explorer' | 'search' | 'github' | 'extensions' | 'ai';
  setActiveView: (view: 'explorer' | 'search' | 'github' | 'extensions' | 'ai') => void;
  isRightSidebarOpen: boolean;
  setIsRightSidebarOpen: (open: boolean) => void;
  rightSidebarView: 'chat' | 'members';
  setRightSidebarView: (view: 'chat' | 'members') => void;
}

export default function ActivityBar({
  activeView,
  setActiveView,
  isRightSidebarOpen,
  setIsRightSidebarOpen,
  rightSidebarView,
  setRightSidebarView
}: ActivityBarProps) {
  
  const handleRightSidebarToggle = (view: 'chat' | 'members') => {
    if (isRightSidebarOpen && rightSidebarView === view) {
      setIsRightSidebarOpen(false);
    } else {
      setRightSidebarView(view);
      setIsRightSidebarOpen(true);
    }
  };

  return (
    <aside className="w-16 flex-shrink-0 bg-surface-container-lowest border-r border-outline-variant/20 flex flex-col items-center py-4 gap-container-gap z-40 relative shadow-[1px_0_10px_rgba(0,0,0,0.5)]">
      {/* Top Actions */}
      <div className="flex flex-col gap-2 w-full items-center">
        <button 
          className={`w-10 h-10 rounded-lg flex items-center justify-center relative group transition-all ${activeView === 'explorer' ? 'text-primary bg-primary/10 border-l-2 border-primary' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/50'}`}
          onClick={() => setActiveView('explorer')}
          title="Explorer"
        >
          <VscFiles className="text-2xl" />
          <div className="absolute left-14 bg-surface-container-highest text-on-surface px-2 py-1 rounded text-label-md font-label-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">Explorer</div>
        </button>
        
        <button 
          className={`w-10 h-10 rounded-lg flex items-center justify-center relative group transition-all ${activeView === 'search' ? 'text-primary bg-primary/10 border-l-2 border-primary' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/50'}`}
          onClick={() => setActiveView('search')}
          title="Search"
        >
          <VscSearch className="text-2xl" />
          <div className="absolute left-14 bg-surface-container-highest text-on-surface px-2 py-1 rounded text-label-md font-label-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">Search</div>
        </button>
        
        <button 
          className={`w-10 h-10 rounded-lg flex items-center justify-center relative group transition-all ${activeView === 'github' ? 'text-primary bg-primary/10 border-l-2 border-primary' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/50'}`}
          onClick={() => setActiveView('github')}
          title="Source Control"
        >
          <VscSourceControl className="text-2xl" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full"></span>
          <div className="absolute left-14 bg-surface-container-highest text-on-surface px-2 py-1 rounded text-label-md font-label-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">Source Control</div>
        </button>

        <button 
          className={`w-10 h-10 rounded-lg flex items-center justify-center relative group transition-all ${activeView === 'extensions' ? 'text-primary bg-primary/10 border-l-2 border-primary' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/50'}`}
          onClick={() => setActiveView('extensions')}
          title="Extensions"
        >
          <VscExtensions className="text-2xl" />
          <div className="absolute left-14 bg-surface-container-highest text-on-surface px-2 py-1 rounded text-label-md font-label-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">Extensions</div>
        </button>

        <button 
          className={`w-10 h-10 rounded-lg flex items-center justify-center relative group transition-all ${activeView === 'ai' ? 'text-primary bg-primary/10 border-l-2 border-primary' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/50'}`}
          onClick={() => setActiveView('ai')}
          title="AI Copilot"
        >
          <VscSparkle className="text-2xl" />
          <div className="absolute left-14 bg-surface-container-highest text-on-surface px-2 py-1 rounded text-label-md font-label-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">AI Copilot</div>
        </button>

        {/* Separator line */}
        <div className="w-8 h-[1px] bg-outline-variant/30 my-1" />

        {/* Right Sidebar Toggles */}
        <button 
          className={`w-10 h-10 rounded-lg flex items-center justify-center relative group transition-all ${isRightSidebarOpen && rightSidebarView === 'chat' ? 'text-primary bg-primary/10 border-l-2 border-primary' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/50'}`}
          onClick={() => handleRightSidebarToggle('chat')}
          title="Room Chat"
        >
          <MdChatBubbleOutline className="text-2xl" />
          <div className="absolute left-14 bg-surface-container-highest text-on-surface px-2 py-1 rounded text-label-md font-label-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">Room Chat</div>
        </button>

        <button 
          className={`w-10 h-10 rounded-lg flex items-center justify-center relative group transition-all ${isRightSidebarOpen && rightSidebarView === 'members' ? 'text-primary bg-primary/10 border-l-2 border-primary' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/50'}`}
          onClick={() => handleRightSidebarToggle('members')}
          title="Workspace Members"
        >
          <MdPeople className="text-2xl" />
          <div className="absolute left-14 bg-surface-container-highest text-on-surface px-2 py-1 rounded text-label-md font-label-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">Members</div>
        </button>
      </div>

      <div className="mt-auto flex flex-col gap-2 w-full items-center">
        <button className="w-10 h-10 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/50 transition-all flex items-center justify-center relative group" title="Settings">
          <VscSettingsGear className="text-2xl" />
          <div className="absolute left-14 bg-surface-container-highest text-on-surface px-2 py-1 rounded text-label-md font-label-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">Settings</div>
        </button>
      </div>
    </aside>
  );
}
