import { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Dashboard from './components/Dashboard/Dashboard';
import Workspace from './components/Workspace/Workspace';
import AuthModal from './components/Auth/AuthModal';

function App() {
  const { isAuthenticated, restoreSession } = useAuthStore();
  const [sessionChecked, setSessionChecked] = useState(false);

  // Restore session on mount
  useEffect(() => {
    restoreSession().finally(() => setSessionChecked(true));
  }, [restoreSession]);

  // Show loading while checking session
  if (!sessionChecked) {
    return (
      <div className="app-loading">
        <div className="app-loading-logo">S</div>
        <div className="app-loading-text">STREAMSYNC</div>
        <div className="app-loading-bar">
          <div className="app-loading-bar-fill" />
        </div>
      </div>
    );
  }

  // Show auth modal if not authenticated (except for public rooms, but we handle that in Workspace for now.
  // Wait, if not authenticated, we can't show dashboard. Let's let Workspace render even if not authenticated, 
  // but AuthModal covers the whole screen if they go to / without auth.
  
  return (
    <>
      <Routes>
        <Route path="/" element={isAuthenticated ? <Dashboard /> : <AuthModal />} />
        <Route path="/room/:roomId" element={<Workspace />} />
      </Routes>
    </>
  );
}

export default App;
