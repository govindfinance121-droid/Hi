import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Login: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [error, setError] = useState('');
  const { login, signup } = useAuth();
  const navigate = useNavigate();

  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    });
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallBtn(false);
    }
    setDeferredPrompt(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await signup(email, username, password, referralCode);
      }
      navigate('/');
    } catch (err) {
      setError('Authentication failed. Check credentials.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-dark">
      <div className="w-full max-w-md bg-secondary p-8 rounded-2xl shadow-xl border border-gray-800">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-primary">
            <i className="fas fa-gamepad text-4xl text-primary"></i>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Real Esports</h1>
          <p className="text-gray-400 text-sm">Welcome to the ultimate Free Fire arena</p>
        </div>

        {/* INSTALL APP BUTTON */}
        {showInstallBtn && (
          <button 
            onClick={handleInstallClick}
            className="w-full mb-6 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white font-bold py-3 rounded-xl shadow-lg flex items-center justify-center gap-2 animate-pulse"
          >
            <i className="fas fa-download"></i> INSTALL APP NOW
          </button>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-500 p-3 rounded-lg mb-4 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-primary outline-none transition-colors"
                  placeholder="Enter username"
                  required={!isLogin}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Referral Code (Optional)</label>
                <input
                  type="text"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value)}
                  className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-primary outline-none transition-colors"
                  placeholder="Enter friend's User ID"
                />
              </div>
            </>
          )}
          
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-primary outline-none transition-colors"
              placeholder="Enter email"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-primary outline-none transition-colors"
              placeholder="Enter password"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-primary hover:bg-orange-600 text-black font-bold py-3 rounded-lg transition-colors mt-6"
          >
            {isLogin ? 'Login' : 'Create Account'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-400">
            {isLogin ? "Don't have an account?" : "Already have an account?"}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="ml-2 text-primary font-medium hover:underline"
            >
              {isLogin ? 'Sign Up' : 'Login'}
            </button>
          </p>
          {isLogin && (
            <button className="mt-2 text-xs text-gray-500 hover:text-gray-300">
              Forgot Password?
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;