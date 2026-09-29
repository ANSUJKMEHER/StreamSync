import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuthStore } from '../../store/authStore';
import { MdSettings, MdLogout, MdKeyboardArrowDown } from 'react-icons/md';
import { FaGithub } from 'react-icons/fa';
import { Badge } from '../ui/badge';

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
    <div className="relative select-none" ref={dropdownRef}>
      <motion.button
        whileTap={{ scale: 0.97 }}
        className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-surface-container transition-all group cursor-pointer border border-transparent hover:border-outline-variant/30"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <div className="relative">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.username}
              className="w-7 h-7 rounded-full object-cover ring-2 ring-primary/40 group-hover:ring-primary/80 transition-all"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center font-bold text-[11px] text-background ring-2 ring-primary/30">
              {user.username.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-surface" />
        </div>

        <span className="text-xs font-semibold text-on-surface-variant group-hover:text-on-surface max-w-[110px] truncate hidden md:block transition-colors">
          {user.username}
        </span>

        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        >
          <MdKeyboardArrowDown className="text-on-surface-variant group-hover:text-on-surface text-lg transition-colors" />
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 480, damping: 30 }}
            className="absolute top-full right-0 mt-2 w-60 bg-surface border border-outline-variant/40 rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.45)] z-[9999] py-2 overflow-hidden backdrop-blur-xl"
          >
            {/* User Profile Header */}
            <div className="px-4 py-3 flex flex-col gap-1.5 bg-surface-container-low/50 border-b border-outline-variant/20">
              <span className="text-xs font-bold text-on-surface truncate">
                {user.username}
              </span>
              {user.githubId ? (
                <Badge variant="primary" dot className="w-max text-[9px] py-0.5 px-2">
                  <FaGithub size={10} className="mr-1" /> GitHub Connected
                </Badge>
              ) : (
                <span className="text-[10px] text-on-surface-variant/70">Local Account</span>
              )}
            </div>

            <div className="p-1 flex flex-col gap-0.5">
              <button
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-lg transition-colors text-left cursor-pointer"
                onClick={() => {
                  alert('Settings coming soon!');
                  setIsOpen(false);
                }}
              >
                <MdSettings size={16} className="text-on-surface-variant" />
                <span>Settings</span>
              </button>

              <div className="h-px bg-outline-variant/20 my-1 mx-2" />

              <button
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors text-left cursor-pointer"
                onClick={() => {
                  setIsOpen(false);
                  logout();
                }}
              >
                <MdLogout size={16} />
                <span>Sign Out</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
