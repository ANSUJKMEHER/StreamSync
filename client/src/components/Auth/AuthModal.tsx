import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuthStore } from '../../store/authStore';
import { MdPerson, MdLock, MdError, MdSync } from 'react-icons/md';
import './AuthModal.css';

type AuthMode = 'login' | 'register';

function AuthModal() {
  const { login, register, isLoading, error, clearError } = useAuthStore();
  const [mode, setMode] = useState<AuthMode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-md p-4">
      <div className="w-full max-w-md bg-surface-container-low border border-outline-variant/30 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="flex flex-col items-center pt-10 pb-6 px-8 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-primary/10 blur-3xl rounded-full scale-150 -translate-y-1/2"></div>
          
          <div className="relative h-16 w-16 mb-4 rounded-2xl bg-gradient-to-br from-primary to-accent text-white flex items-center justify-center font-bold text-3xl shadow-[0_4px_24px_rgba(208,188,255,0.4)]">
            S
          </div>
          <h1 className="relative font-headline-md font-bold text-on-surface text-2xl tracking-tight mb-2">
            StreamSync
          </h1>
          <p className="relative text-on-surface-variant font-body-md">
            Collaborative Code + Canvas Workspace
          </p>
        </div>

        <div className="px-8 pb-8 flex flex-col gap-6">
          {/* Tabs */}
          <div className="flex p-1 bg-surface-container-highest rounded-xl">
            <button
              type="button"
              className={`flex-1 py-2.5 text-sm font-label-md rounded-lg transition-all ${
                mode === 'login'
                  ? 'bg-surface text-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
              onClick={() => switchMode('login')}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`flex-1 py-2.5 text-sm font-label-md rounded-lg transition-all ${
                mode === 'register'
                  ? 'bg-surface text-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
              onClick={() => switchMode('register')}
            >
              Create Account
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-on-surface-variant font-label-md text-xs uppercase tracking-wider pl-1">
                Username
              </label>
              <div className="relative mt-2">
                <MdPerson className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-xl" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isLoading}
                  minLength={2}
                  maxLength={30}
                  className="w-full bg-surface-container border border-outline-variant/30 rounded-xl py-3 pl-11 pr-4 text-on-surface placeholder-on-surface-variant/30 focus:outline-none focus:border-primary transition-colors font-code"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-on-surface-variant font-label-md text-xs uppercase tracking-wider pl-1">
                Password
              </label>
              <div className="relative mt-2">
                <MdLock className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-xl" />
                <input
                  type="password"
                  placeholder={mode === 'register' ? 'Create a password (4+ chars)' : 'Enter your password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  minLength={4}
                  className="w-full bg-surface-container border border-outline-variant/30 rounded-xl py-3 pl-11 pr-4 text-on-surface placeholder-on-surface-variant/30 focus:outline-none focus:border-primary transition-colors font-code"
                />
              </div>
            </div>

            {error && (
              <div className="mb-6 p-4 rounded-xl bg-error/10 border border-error/20 flex items-center gap-3 text-error">
                <MdError size={18} className="shrink-0" />
                <span className="text-body-sm font-medium">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !username.trim() || !password.trim()}
              className="w-full relative bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:hover:bg-primary text-on-primary font-label-lg font-bold rounded-xl py-4 transition-all shadow-[0_4px_16px_rgba(208,188,255,0.2)] hover:shadow-[0_4px_20px_rgba(208,188,255,0.3)] disabled:shadow-none overflow-hidden"
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <MdSync className="animate-spin text-xl" />
                  <span>{mode === 'login' ? 'Signing in...' : 'Creating account...'}</span>
                </div>
              ) : (
                mode === 'login' ? 'Sign In' : 'Create Account'
              )}
            </button>
          </form>

          <div className="relative flex items-center py-2">
            <div className="flex-grow border-t border-outline-variant/30"></div>
            <span className="flex-shrink-0 mx-4 text-on-surface-variant text-xs font-label-md uppercase tracking-widest">or</span>
            <div className="flex-grow border-t border-outline-variant/30"></div>
          </div>

          <button
            type="button"
            className="w-full flex items-center justify-center gap-3 bg-surface-container-highest hover:bg-surface-bright text-on-surface font-label-lg border border-outline-variant/20 rounded-xl py-3 transition-colors"
            onClick={() => {
              const width = 500;
              const height = 600;
              const left = window.screen.width / 2 - width / 2;
              const top = window.screen.height / 2 - height / 2;
              const API_BASE = (import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:3001' : 'https://streamsync-cxox.onrender.com')).replace(/\/$/, '');
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
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            Continue with GitHub
          </button>
        </div>
      </div>
    </div>
  );
}

export default AuthModal;

