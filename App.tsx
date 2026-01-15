import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { db, ref, onValue } from './services/firebase';
import Home from './pages/Home';
import Wallet from './pages/Wallet';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import Login from './pages/Login';
import Community from './pages/Community';
import Rules from './pages/Rules';
import Leaderboard from './pages/Leaderboard';

// Bottom Navigation Component
const BottomNav = () => {
  const location = useLocation();
  const { isAdmin } = useAuth();
  
  if (location.pathname === '/login') return null;

  const navItems = [
    { path: '/', icon: 'fa-home', label: 'Home' },
    { path: '/community', icon: 'fa-comments', label: 'Chat' },
    { path: '/leaderboard', icon: 'fa-trophy', label: 'Rank' },
    { path: '/wallet', icon: 'fa-wallet', label: 'Wallet' },
    { path: '/profile', icon: 'fa-user', label: 'Profile' },
  ];

  if (isAdmin) {
    navItems.push({ path: '/admin', icon: 'fa-shield-halved', label: 'Admin' });
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-secondary border-t border-gray-800 pb-safe z-50">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex flex-col items-center justify-center w-full h-full transition-colors duration-200 ${
              location.pathname === item.path ? 'text-primary' : 'text-gray-500'
            }`}
          >
            <i className={`fas ${item.icon} text-xl mb-1`}></i>
            <span className="text-xs font-medium">{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
};

// Maintenance Screen
const MaintenanceScreen = () => (
  <div className="h-screen bg-dark flex flex-col items-center justify-center p-6 text-center">
    <i className="fas fa-power-off text-6xl text-red-500 mb-6 animate-pulse"></i>
    <h1 className="text-3xl font-bold text-white mb-2">Server Maintenance</h1>
    <p className="text-gray-400">The app is currently unavailable for updates. Please try again later.</p>
  </div>
);

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, isAdmin } = useAuth();
  const [maintenance, setMaintenance] = useState(false);

  useEffect(() => {
    if (db) {
      const settingsRef = ref(db, 'settings/maintenanceMode');
      onValue(settingsRef, (snapshot) => {
         setMaintenance(snapshot.val() === true);
      });
    }
  }, []);
  
  if (loading) return <div className="flex items-center justify-center h-screen bg-dark text-white">Loading...</div>;
  
  if (maintenance && !isAdmin) {
    return <MaintenanceScreen />;
  }

  if (!user) return <Navigate to="/login" />;
  
  return <>{children}</>;
};

// Admin Route Component
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAdmin, loading } = useAuth();
  
  if (loading) return <div>Loading...</div>;
  if (!user || !isAdmin) return <Navigate to="/" />;
  
  return <>{children}</>;
};

const AppContent = () => {
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const html = document.documentElement;
    if (savedTheme === 'light') {
      html.classList.remove('dark');
    } else {
      html.classList.add('dark');
    }
  }, []);

  return (
    <div className="min-h-screen bg-dark text-white pb-20 transition-colors duration-300">
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route path="/" element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        } />
        
        <Route path="/community" element={
          <ProtectedRoute>
            <Community />
          </ProtectedRoute>
        } />

        <Route path="/leaderboard" element={
          <ProtectedRoute>
            <Leaderboard />
          </ProtectedRoute>
        } />
        
        <Route path="/wallet" element={
          <ProtectedRoute>
            <Wallet />
          </ProtectedRoute>
        } />
        
        <Route path="/profile" element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        } />

        <Route path="/rules" element={
          <ProtectedRoute>
            <Rules />
          </ProtectedRoute>
        } />
        
        <Route path="/admin" element={
          <AdminRoute>
            <Admin />
          </AdminRoute>
        } />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>

      <BottomNav />
      <div className="fixed bottom-16 w-full text-center py-1 text-[10px] text-gray-600 bg-transparent pointer-events-none">
        © Real Esports | Owner: Govind
      </div>
    </div>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
};

export default App;