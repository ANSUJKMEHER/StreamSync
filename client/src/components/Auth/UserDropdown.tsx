import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { MdSettings, MdLogout, MdKeyboardArrowDown } from 'react-icons/md';

export default function UserDropdown() {
  const { user, logout } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-surface-variant transition-colors group" 
        onClick={() => setIsOpen(!isOpen)}
      >
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt={user.username} className="w-6 h-6 rounded-full object-cover border border-outline-variant/30" />
        ) : (
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-inverse-primary flex items-center justify-center font-bold text-[10px] text-on-primary">
            {user.username.charAt(0).toUpperCase()}
          </div>
        )}
        <span className="font-label-md text-on-surface-variant group-hover:text-on-surface max-w-[100px] truncate hidden md:block">
          {user.username}
        </span>
        <MdKeyboardArrowDown className={`text-on-surface-variant transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} size={16} />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-56 bg-surface-container-highest border border-outline-variant/30 rounded-xl shadow-2xl z-[9999] py-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="px-4 py-3 flex flex-col gap-1">
            <span className="font-label-lg font-bold text-on-surface truncate">{user.username}</span>
            {user.githubId && (
              <span className="text-[10px] font-label-sm font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full w-max">
                GitHub Connected
              </span>
            )}
          </div>
          
          <div className="h-px bg-outline-variant/20 my-1" />
          
          <button 
            className="w-full flex items-center gap-3 px-4 py-2.5 text-on-surface-variant hover:bg-surface-variant hover:text-on-surface transition-colors font-label-md text-left" 
            onClick={() => {
              alert("Settings coming soon!");
              setIsOpen(false);
            }}
          >
            <MdSettings size={18} />
            Settings
          </button>
          
          <div className="h-px bg-outline-variant/20 my-1" />
          
          <button 
            className="w-full flex items-center gap-3 px-4 py-2.5 text-error hover:bg-error/10 transition-colors font-label-md text-left" 
            onClick={() => {
              setIsOpen(false);
              logout();
            }}
          >
            <MdLogout size={18} />
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
