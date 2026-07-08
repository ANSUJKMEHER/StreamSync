import { useEffect, useState, lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import AuthModal from './components/Auth/AuthModal';
import GlobalLoader from './components/Layout/GlobalLoader';

// Lazy load heavy route components
const Dashboard = lazy(() => import('./components/Dashboard/Dashboard'));
const Workspace = lazy(() => import('./components/Workspace/Workspace'));

function App() {
  const { isAuthenticated, restoreSession } = useAuthStore();
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    restoreSession();
    // Don't block rendering if we have cached credentials.
    // If we don't have them, the UI will just render the AuthModal instantly.
    setSessionChecked(true);
  }, [restoreSession]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('streamsync_theme') || 'obsidian';
    if (savedTheme === 'nord') {
      document.documentElement.setAttribute('data-theme', 'nord');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, []);

  // Show global loader while checking session
  if (!sessionChecked) {
    return <GlobalLoader />;
  }

  // Show auth modal if not authenticated (except for public rooms, but we handle that in Workspace for now.
  // Wait, if not authenticated, we can't show dashboard. Let's let Workspace render even if not authenticated, 
  // but AuthModal covers the whole screen if they go to / without auth.
  
  return (
    <Suspense fallback={<GlobalLoader />}>
      <Routes>
        <Route path="/" element={isAuthenticated ? <Dashboard /> : <AuthModal />} />
        <Route path="/room/:roomId" element={<Workspace />} />
      </Routes>
    </Suspense>
  );
}

export default App;
