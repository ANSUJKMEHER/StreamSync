import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuthStore } from '../../store/authStore';
import { MdPerson, MdLock, MdError, MdSync, MdVisibility, MdVisibilityOff } from 'react-icons/md';
import { FaGithub } from 'react-icons/fa';
import './AuthModal.css';

type AuthMode = 'login' | 'register';

function AuthModal() {
  const { login, register, isLoading, error, clearError } = useAuthStore();
  const [mode, setMode] = useState<AuthMode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [mode]);

  const switchMode = useCallback(
    (newMode: AuthMode) => {
      setMode(newMode);
      setUsername('');
      setPassword('');
      clearError();
    },
    [clearError]
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!username.trim() || !password.trim()) return;

      if (mode === 'login') {
        await login(username.trim(), password);
      } else {
        await register(username.trim(), password);
      }
    },
    [mode, username, password, login, register]
  );

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Motion Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="fixed inset-0 bg-background/80 backdrop-blur-md"
      />

      {/* Modern Spotlight Modal Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 16 }}
        transition={{ type: 'spring', stiffness: 420, damping: 28 }}
        className="relative z-10 w-full max-w-md bg-surface border border-outline-variant/35 rounded-3xl shadow-[0_16px_50px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col"
      >
        {/* Subtle Ambient Radial Highlight */}
        <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />

        {/* Header */}
        <div className="flex flex-col items-center pt-9 pb-5 px-8 text-center relative z-10">
          <motion.div
            whileHover={{ scale: 1.05, rotate: 2 }}
            transition={{ type: 'spring', stiffness: 350, damping: 20 }}
            className="h-14 w-14 mb-3.5 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/80 border border-primary/25 text-white flex items-center justify-center font-bold text-2xl shadow-[0_4px_20px_rgba(223,171,108,0.2)] cursor-default select-none"
          >
            S
          </motion.div>
          <h1 className="font-headline-md font-bold text-on-surface text-2xl tracking-tight mb-1">
            StreamSync
          </h1>
          <p className="text-on-surface-variant text-xs font-medium">
            Collaborative Code + Canvas Workspace
          </p>
        </div>

        <div className="px-8 pb-8 flex flex-col gap-5 relative z-10">
          {/* Motion.dev Sliding Segmented Tab Pill */}
          <div className="relative flex p-1 bg-surface-container rounded-xl border border-outline-variant/20">
            {(['login', 'register'] as const).map((tabMode) => {
              const isActive = mode === tabMode;
              const label = tabMode === 'login' ? 'Sign In' : 'Create Account';
              return (
                <button
                  key={tabMode}
                  type="button"
                  onClick={() => switchMode(tabMode)}
                  className={`relative flex-1 py-2 text-xs font-semibold rounded-lg transition-colors select-none z-10 ${
                    isActive ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="auth-tab-pill"
                      className="absolute inset-0 bg-surface-container-high rounded-lg border border-outline-variant/35 shadow-sm -z-10"
                      transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                    />
                  )}
                  {label}
                </button>
              );
            })}
          </div>

          {/* Form with Origin UI input polish */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-1">
              <label className="text-on-surface-variant/80 font-semibold text-[10px] uppercase tracking-wider pl-1">
                Username
              </label>
              <div className="relative">
                <MdPerson className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-lg" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isLoading}
                  minLength={2}
                  maxLength={30}
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl py-2.5 pl-10 pr-3.5 text-on-surface placeholder-on-surface-variant/30 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15 transition-all text-xs font-mono"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-on-surface-variant/80 font-semibold text-[10px] uppercase tracking-wider pl-1">
                Password
              </label>
              <div className="relative">
                <MdLock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-lg" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={mode === 'register' ? 'Create a password (4+ chars)' : 'Enter your password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  minLength={4}
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl py-2.5 pl-10 pr-10 text-on-surface placeholder-on-surface-variant/30 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15 transition-all text-xs font-mono"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60 hover:text-on-surface transition-colors p-1"
                >
                  {showPassword ? <MdVisibilityOff size={16} /> : <MdVisibility size={16} />}
                </button>
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0, y: -4 }}
                  animate={{ opacity: 1, height: 'auto', y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -4 }}
                  className="p-3 rounded-xl bg-error/10 border border-error/25 flex items-center gap-2.5 text-error overflow-hidden"
                >
                  <MdError size={16} className="shrink-0" />
                  <span className="text-[11px] font-medium leading-tight">{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              whileTap={{ scale: isLoading ? 1 : 0.98 }}
              type="submit"
              disabled={isLoading || !username.trim() || !password.trim()}
              className="w-full relative bg-primary hover:bg-primary/95 disabled:opacity-50 text-background font-bold text-xs rounded-xl py-3 mt-1.5 transition-all shadow-[0_4px_16px_rgba(223,171,108,0.2)] hover:shadow-[0_4px_22px_rgba(223,171,108,0.3)] disabled:shadow-none overflow-hidden cursor-pointer"
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <MdSync className="animate-spin text-lg" />
                  <span>{mode === 'login' ? 'Signing in...' : 'Creating account...'}</span>
                </div>
              ) : (
                mode === 'login' ? 'Sign In' : 'Create Account'
              )}
            </motion.button>
          </form>

          <div className="relative flex items-center py-1">
            <div className="flex-grow border-t border-outline-variant/30"></div>
            <span className="flex-shrink-0 mx-3 text-on-surface-variant/70 text-[10px] font-semibold uppercase tracking-widest">
              or
            </span>
            <div className="flex-grow border-t border-outline-variant/30"></div>
          </div>

          <motion.button
            whileTap={{ scale: 0.98 }}
            type="button"
            className="w-full flex items-center justify-center gap-2.5 bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-semibold border border-outline-variant/30 rounded-xl py-2.5 transition-all hover:border-primary/40 cursor-pointer shadow-sm"
            onClick={() => {
              const width = 500;
              const height = 600;
              const left = window.screen.width / 2 - width / 2;
              const top = window.screen.height / 2 - height / 2;
              const API_BASE = (
                import.meta.env.VITE_API_URL ||
                (window.location.hostname === 'localhost'
                  ? 'http://localhost:3001'
                  : 'https://streamsync-cxox.onrender.com')
              ).replace(/\/$/, '');
              const popup = window.open(
                `${API_BASE}/api/v1/oauth/github`,
                'GitHub OAuth',
                `width=${width},height=${height},top=${top},left=${left}`
              );

              if (!popup || popup.closed || typeof popup.closed === 'undefined') {
                alert('Popup blocked! Please enable popups in your browser settings to log in with GitHub.');
                return;
              }

              const handleMessage = (event: MessageEvent) => {
                if (event.data?.type === 'OAUTH_SUCCESS') {
                  const { token, user } = event.data.payload;
                  useAuthStore.getState().setAuth(user, token);
                  window.removeEventListener('message', handleMessage);
                }
              };
              window.addEventListener('message', handleMessage);
            }}
          >
            <FaGithub size={16} />
            <span>Continue with GitHub</span>
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}

export default AuthModal;
