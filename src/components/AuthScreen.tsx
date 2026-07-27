import React, { useState } from 'react';
import { 
  auth, 
  googleProvider, 
  githubProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword 
} from '../lib/firebase';
import { Sparkles, Brain, Mail, Lock, AlertCircle, RefreshCw, Github, Chrome, Sliders } from 'lucide-react';
import { motion } from 'motion/react';
import { UserProfile } from '../types';

interface AuthScreenProps {
  onSuccess: (user?: UserProfile) => void;
}

export default function AuthScreen({ onSuccess }: AuthScreenProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Prefill credentials for seamless 1-click preview testing!
  const handleQuickDemoLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, 'demo@weaver.io', 'DemoWeaver123!');
      onSuccess();
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed') {
        // Automatically bypass to local offline guest if provider is disabled in Firebase!
        onSuccess({
          uid: 'guest-offline',
          email: 'guest@weaver.io',
          displayName: 'Offline Guest (Sandbox)',
          photoURL: null
        });
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        // If demo account doesn't exist, register it automatically on-the-fly!
        try {
          await createUserWithEmailAndPassword(auth, 'demo@weaver.io', 'DemoWeaver123!');
          onSuccess();
        } catch (regErr: any) {
          if (regErr.code === 'auth/operation-not-allowed') {
            onSuccess({
              uid: 'guest-offline',
              email: 'guest@weaver.io',
              displayName: 'Offline Guest (Sandbox)',
              photoURL: null
            });
          } else {
            setError(regErr.message);
          }
        }
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all email and password fields.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onSuccess();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/operation-not-allowed') {
        setError(
          'Email/Password sign-in is not enabled in your Firebase project. To enable it, go to Firebase Console > Authentication > Sign-in method and enable "Email/Password". In the meantime, you can use our 1-Click Sandbox Bypass below!'
        );
      } else {
        setError(err.message || 'Authentication failed. Please verify credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: 'google' | 'github') => {
    setLoading(true);
    setError(null);
    const selectedProvider = provider === 'google' ? googleProvider : githubProvider;
    
    try {
      await signInWithPopup(auth, selectedProvider);
      onSuccess();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/popup-blocked') {
        setError('Popup blocked by the browser. Please allow popups or use standard Email login.');
      } else if (err.code === 'auth/auth-domain-config-required') {
        setError('OAuth auth domain config missing. Please sign in with standard Email instead.');
      } else {
        setError(`OAuth Error inside sandboxed preview. Please use the quick-start Demo Email login below!`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="auth-screen-container" className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#050505] px-4 py-12 transition-colors duration-200">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-indigo-500/10 via-transparent to-transparent pointer-events-none" />
      
      <div className="w-full max-w-md relative font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl relative overflow-hidden"
        >
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white mb-3 shadow-lg shadow-indigo-500/25">
              <Brain className="w-6.5 h-6.5" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Decision <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">Weaver</span>
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 text-center font-medium">
              Probabilistic modeling for complex life decisions
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Core Auth Form */}
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="auth-email-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#050505]/50 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-sans"
                  placeholder="name@example.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="auth-password-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#050505]/50 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-sans"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              id="auth-submit-button"
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-indigo-600/10"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : isSignUp ? (
                'Create Account'
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Toggle Screen */}
          <div className="text-center mt-5">
            <button
              id="toggle-auth-mode"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold focus:outline-none"
            >
              {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
            </button>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-slate-800"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white dark:bg-[#111111] px-3 text-slate-500 font-semibold tracking-wider text-[10px]">Or continue with</span>
            </div>
          </div>

          {/* Social Sign-In */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              id="auth-google-oauth"
              onClick={() => handleOAuth('google')}
              disabled={loading}
              className="flex items-center justify-center gap-2 py-2.5 px-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-[#111111] text-slate-700 dark:text-slate-300 text-sm hover:bg-slate-50 dark:hover:bg-[#1c1c1e] transition-colors cursor-pointer"
            >
              <Chrome className="w-4 h-4 text-rose-500" />
              <span>Google</span>
            </button>
            <button
              id="auth-github-oauth"
              onClick={() => handleOAuth('github')}
              disabled={loading}
              className="flex items-center justify-center gap-2 py-2.5 px-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-[#111111] text-slate-700 dark:text-slate-300 text-sm hover:bg-slate-50 dark:hover:bg-[#1c1c1e] transition-colors cursor-pointer"
            >
              <Github className="w-4 h-4" />
              <span>GitHub</span>
            </button>
          </div>

          {/* Direct Sandbox demo trigger */}
          <div className="p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 text-center">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 mb-1">
              ⚡ Sandbox Quick Access
            </span>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
              If your Firebase Email Auth or Google popup is disabled/blocked, choose a mode below to start immediately:
            </p>
            <div className="flex flex-col gap-2">
              <button
                id="auth-demo-direct-button"
                onClick={handleQuickDemoLogin}
                disabled={loading}
                className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer shadow-md shadow-indigo-600/10"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>1-Click Firebase Demo Login</span>
              </button>
              
              <button
                id="auth-guest-bypass-button"
                onClick={() => {
                  onSuccess({
                    uid: 'guest-offline',
                    email: 'guest@weaver.io',
                    displayName: 'Offline Guest (Sandbox)',
                    photoURL: null
                  });
                }}
                disabled={loading}
                className="w-full py-2 px-3 border border-slate-200 dark:border-slate-850 bg-white dark:bg-[#151515] text-slate-700 dark:text-slate-300 font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-[#1c1c1e]"
              >
                <Sliders className="w-3.5 h-3.5 text-indigo-500" />
                <span>Bypass with Local Offline Mode</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
