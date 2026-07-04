import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuthStore } from '../../store/authStore';
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
    <div className="auth-overlay">
      <div className="auth-modal">
        {/* Header */}
        <div className="auth-header">
          <div className="auth-logo">S</div>
          <div className="auth-title">StreamSync</div>
          <div className="auth-subtitle">
            Collaborative Code + Canvas Workspace
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="auth-tabs">
          <button
            className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => switchMode('login')}
          >
            Sign In
          </button>
          <button
            className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
            onClick={() => switchMode('register')}
          >
            Create Account
          </button>
        </div>

        {/* Form */}
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label className="auth-label" htmlFor="auth-username">
              Username
            </label>
            <input
              ref={inputRef}
              id="auth-username"
              className="auth-input"
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              disabled={isLoading}
              minLength={2}
              maxLength={30}
            />
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="auth-password">
              Password
            </label>
            <input
              id="auth-password"
              className="auth-input"
              type="password"
              placeholder={
                mode === 'register'
                  ? 'Create a password (4+ chars)'
                  : 'Enter your password'
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              disabled={isLoading}
              minLength={4}
            />
          </div>

          <button
            className="auth-submit"
            type="submit"
            disabled={isLoading || !username.trim() || !password.trim()}
          >
            {isLoading ? (
              <span className="auth-submit-loading">
                <span className="auth-spinner" />
                {mode === 'login' ? 'Signing in…' : 'Creating account…'}
              </span>
            ) : mode === 'login' ? (
              'Sign In'
            ) : (
              'Create Account'
            )}
          </button>

          {error && <div className="auth-error">{error}</div>}
        </form>

        <div className="auth-divider">
          <span>OR</span>
        </div>

        <button
          className="auth-github-btn"
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
                // Since login expects just one param usually or sets state, let's update authStore manually
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

        {/* Footer */}
        <div className="auth-footer">
          <div className="auth-footer-text">
            {mode === 'login' ? (
              <>
                Don't have an account?{' '}
                <span
                  className="auth-footer-link"
                  onClick={() => switchMode('register')}
                >
                  Create one
                </span>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <span
                  className="auth-footer-link"
                  onClick={() => switchMode('login')}
                >
                  Sign in
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AuthModal;

