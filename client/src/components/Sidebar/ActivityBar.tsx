import { motion } from 'motion/react';
import { VscFiles, VscSearch, VscSourceControl, VscExtensions, VscSparkle } from 'react-icons/vsc';
import { MdChatBubbleOutline, MdPeople } from 'react-icons/md';
import './ActivityBar.css';

interface ActivityBarProps {
  activeView: 'explorer' | 'search' | 'github' | 'extensions' | 'ai';
  setActiveView: (view: 'explorer' | 'search' | 'github' | 'extensions' | 'ai') => void;
  isChatOpen: boolean;
  setIsChatOpen: (open: boolean) => void;
  isMembersOpen: boolean;
  setIsMembersOpen: (open: boolean) => void;
}

export default function ActivityBar({
  activeView,
  setActiveView,
  isChatOpen,
  setIsChatOpen,
  isMembersOpen,
  setIsMembersOpen
}: ActivityBarProps) {
  
  interface ActionItem {
    id: 'explorer' | 'search' | 'github' | 'extensions' | 'ai';
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    highlight?: boolean;
    badge?: boolean;
  }

  const mainActions: ActionItem[] = [
    { id: 'explorer', label: 'Explorer', icon: VscFiles },
    { id: 'search', label: 'Search', icon: VscSearch },
    { id: 'github', label: 'Source Control', icon: VscSourceControl, badge: true },
    { id: 'extensions', label: 'Extensions', icon: VscExtensions },
    { id: 'ai', label: 'AI Copilot', icon: VscSparkle, highlight: true },
  ];

  return (
    <aside className="w-14 flex-shrink-0 bg-surface-container-lowest border-r border-outline-variant/20 flex flex-col items-center py-3 gap-2 z-40 relative select-none">
      {/* Top Actions */}
      <div className="flex flex-col gap-1 w-full items-center">
        {mainActions.map((action) => {
          const Icon = action.icon;
          const isActive = activeView === action.id;

          return (
            <motion.button 
              key={action.id}
              whileTap={{ scale: 0.92 }}
              className={`w-10 h-10 rounded-xl flex items-center justify-center relative group transition-colors cursor-pointer ${
                isActive 
                  ? 'text-primary bg-primary/10' 
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
              }`}
              onClick={() => setActiveView(action.id)}
              title={action.label}
              aria-label={action.label}
            >
              {/* Motion.dev Sliding Vertical Left Bar */}
              {isActive && (
                <motion.div 
                  layoutId="activity-active-indicator"
                  className="absolute left-0 w-1 h-5 bg-primary rounded-r-full shadow-[0_0_8px_rgba(223,171,108,0.5)]"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}

              <Icon className={`text-xl ${action.highlight && isActive ? 'text-primary animate-pulse' : ''}`} />

              {/* Kokonut-style Notification Badge */}
              {action.badge && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full shadow-[0_0_6px_rgba(223,171,108,0.6)]" />
              )}

              {/* Tooltip */}
              <div className="absolute left-14 bg-surface border border-outline-variant/30 text-on-surface px-2.5 py-1 rounded-md text-[11px] font-mono opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg">
                {action.label}
              </div>
            </motion.button>
          );
        })}

        {/* Separator line */}
        <div className="w-6 h-px bg-outline-variant/25 my-1.5" />

        {/* Right Sidebar Toggles */}
        <motion.button 
          whileTap={{ scale: 0.92 }}
          className={`w-10 h-10 rounded-xl flex items-center justify-center relative group transition-colors cursor-pointer ${
            isChatOpen 
              ? 'text-primary bg-primary/10' 
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
          }`}
          onClick={() => setIsChatOpen(!isChatOpen)}
          title="Room Chat"
          aria-label="Room Chat"
        >
          {isChatOpen && (
            <motion.div 
              layoutId="activity-active-indicator-chat"
              className="absolute left-0 w-1 h-5 bg-primary rounded-r-full shadow-[0_0_8px_rgba(223,171,108,0.5)]"
              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            />
          )}
          <MdChatBubbleOutline className="text-xl" />
          <div className="absolute left-14 bg-surface border border-outline-variant/30 text-on-surface px-2.5 py-1 rounded-md text-[11px] font-mono opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg">
            Room Chat
          </div>
        </motion.button>

        <motion.button 
          whileTap={{ scale: 0.92 }}
          className={`w-10 h-10 rounded-xl flex items-center justify-center relative group transition-colors cursor-pointer ${
            isMembersOpen 
              ? 'text-primary bg-primary/10' 
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
          }`}
          onClick={() => setIsMembersOpen(!isMembersOpen)}
          title="Workspace Members"
          aria-label="Workspace Members"
        >
          {isMembersOpen && (
            <motion.div 
              layoutId="activity-active-indicator-members"
              className="absolute left-0 w-1 h-5 bg-primary rounded-r-full shadow-[0_0_8px_rgba(223,171,108,0.5)]"
              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            />
          )}
          <MdPeople className="text-xl" />
          <div className="absolute left-14 bg-surface border border-outline-variant/30 text-on-surface px-2.5 py-1 rounded-md text-[11px] font-mono opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg">
            Members
          </div>
        </motion.button>
      </div>
    </aside>
  );
}
