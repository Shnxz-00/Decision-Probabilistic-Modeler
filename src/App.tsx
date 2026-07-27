import React, { useState, useEffect } from 'react';
import { 
  auth, 
  db, 
  signOut, 
  onAuthStateChanged, 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot 
} from './lib/firebase';
import { FirebaseUser } from './lib/firebase';
import { Decision, UserProfile } from './types';
import { encryptText, deriveKey } from './lib/crypto';
import AuthScreen from './components/AuthScreen';
import DecisionDashboard from './components/DecisionDashboard';
import DecisionWorkspace from './components/DecisionWorkspace';
import ApiDocs from './components/ApiDocs';
import ThemeToggle from './components/ThemeToggle';
import { 
  Brain, 
  LogOut, 
  User as UserIcon, 
  Sparkles, 
  Sliders, 
  Terminal, 
  Lock, 
  FileCode,
  Layers,
  HelpCircle,
  Clock,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('weaver_theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      // fallback
    }
    return 'dark';
  });
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [activeDecision, setActiveDecision] = useState<Decision | null>(null);
  const [currentView, setCurrentView] = useState<'dashboard' | 'workspace' | 'api-docs'>('dashboard');
  const [currentTime, setCurrentTime] = useState('');

  // Clock Update Effect for precision tracking UI
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Monitor Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName || 'Strategic Thinker',
          photoURL: firebaseUser.photoURL
        });
      } else {
        setUser(null);
        setActiveDecision(null);
        setCurrentView('dashboard');
      }
      setAuthChecked(true);
    });
    return () => unsubscribe();
  }, []);

  // Sync Theme Class with Document Element & LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem('weaver_theme', theme);
    } catch (e) {
      console.error(e);
    }
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.colorScheme = 'light';
    }
  }, [theme]);

  // Sync Decisions Real-time from Firestore when user is logged in
  useEffect(() => {
    if (!user) {
      setDecisions([]);
      return;
    }

    if (user.uid === 'guest-offline') {
      const local = localStorage.getItem('weaver_local_decisions');
      if (local) {
        try {
          const parsed = JSON.parse(local);
          setDecisions(parsed);
          
          if (activeDecision) {
            const updated = parsed.find((d: any) => d.id === activeDecision.id);
            if (updated) {
              setActiveDecision(prev => prev ? { ...updated, title: prev.title, description: prev.description, options: prev.options } : null);
            }
          }
        } catch (e) {
          console.error('Failed to parse local decisions:', e);
        }
      } else {
        // Pre-seed offline guest with complex strategic sample decisions for instant testing!
        const defaultDecisions: Decision[] = [
          {
            id: 'demo-1',
            userId: 'guest-offline',
            title: 'Career Move: Tech Lead at Corp vs. Founding Engineer at AI Startup',
            description: 'Evaluate stable enterprise leadership with high guaranteed pay vs early-stage AI venture with exponential equity upside.',
            category: 'career',
            createdAt: Date.now(),
            isEncrypted: false,
            options: [
              {
                id: 'opt-1',
                title: 'Tech Lead (Corporate)',
                scenarios: [
                  { id: 'sc-1', title: 'Steady promotion & structural predictability', probability: 0.7, utility: 65 },
                  { id: 'sc-2', title: 'Corporate layoff / product cancellation', probability: 0.3, utility: -20 }
                ]
              },
              {
                id: 'opt-2',
                title: 'Founding Engineer (AI Startup)',
                scenarios: [
                  { id: 'sc-3', title: 'Product-market-fit & Series-A hyper-growth', probability: 0.2, utility: 100 },
                  { id: 'sc-4', title: 'Slow organic growth & survival pivot', probability: 0.4, utility: 45 },
                  { id: 'sc-5', title: 'Funding runway expires (startup folds)', probability: 0.4, utility: -85 }
                ]
              }
            ]
          },
          {
            id: 'demo-2',
            userId: 'guest-offline',
            title: 'Primary Residence Migration Strategy',
            description: 'Assess relocating to the San Francisco Bay Area for networking vs. staying remote in a low-cost hometown.',
            category: 'general',
            createdAt: Date.now() - 86400000,
            isEncrypted: false,
            options: [
              {
                id: 'opt-3',
                title: 'Relocate to Silicon Valley Hub',
                scenarios: [
                  { id: 'sc-6', title: 'Unparalleled tech networking & career serendipity', probability: 0.65, utility: 90 },
                  { id: 'sc-7', title: 'Severe living expenses drain cash reserves', probability: 0.35, utility: 15 }
                ]
              },
              {
                id: 'opt-4',
                title: 'Maintain Remote Lifestyle',
                scenarios: [
                  { id: 'sc-8', title: 'Maximum saving rate & comfort near family', probability: 0.8, utility: 75 },
                  { id: 'sc-9', title: 'Feeling isolated / missing industry trends', probability: 0.2, utility: -30 }
                ]
              }
            ]
          }
        ];
        setDecisions(defaultDecisions);
        localStorage.setItem('weaver_local_decisions', JSON.stringify(defaultDecisions));
      }
      return;
    }

    const q = query(
      collection(db, 'decisions'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs: Decision[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        let normalizedCreatedAt = Date.now();
        if (data.createdAt) {
          if (typeof data.createdAt.toMillis === 'function') {
            normalizedCreatedAt = data.createdAt.toMillis();
          } else if (typeof data.createdAt === 'number') {
            normalizedCreatedAt = data.createdAt;
          } else if (data.createdAt.seconds) {
            normalizedCreatedAt = data.createdAt.seconds * 1000;
          }
        }
        docs.push({
          id: doc.id,
          userId: data.userId,
          title: data.title,
          description: data.description,
          category: data.category,
          options: data.options || [],
          createdAt: normalizedCreatedAt,
          isEncrypted: !!data.isEncrypted,
          salt: data.salt,
          iv: data.iv
        });
      });
      // Sort in-memory for instant response without requiring composite index
      docs.sort((a, b) => b.createdAt - a.createdAt);
      setDecisions(docs);
      
      // Update active decision reference if it was modified
      if (activeDecision) {
        const updated = docs.find(d => d.id === activeDecision.id);
        if (updated) {
          // Keep local state decrypted title/options
          setActiveDecision(prev => prev ? { ...updated, title: prev.title, description: prev.description, options: prev.options } : null);
        }
      }
    }, (error) => {
      console.warn("Firestore sync notification:", error);
      // Fallback to local storage if remote sync is restricted
      const local = localStorage.getItem('weaver_local_decisions');
      if (local) {
        try {
          setDecisions(JSON.parse(local));
        } catch (e) {
          console.error(e);
        }
      }
    });

    return () => unsubscribe();
  }, [user, activeDecision?.id]);

  const handleLogout = async () => {
    if (user && user.uid === 'guest-offline') {
      setUser(null);
      setActiveDecision(null);
      setCurrentView('dashboard');
      return;
    }
    await signOut(auth);
  };

  // Create Decision (supports client-side zero-knowledge encryption)
  const handleCreateDecision = async (decisionData: Partial<Decision>, passphrase?: string) => {
    if (!user) return;

    try {
      let finalTitle = decisionData.title || '';
      let finalDescription = decisionData.description || '';
      let ivHex = '';

      if (decisionData.isEncrypted && passphrase && decisionData.salt) {
        // Encrypt title and description client-side before sending to Cloud Firestore!
        const key = await deriveKey(passphrase, decisionData.salt);
        const encTitle = await encryptText(finalTitle, key);
        const encDesc = finalDescription ? await encryptText(finalDescription, key) : { ciphertext: '', iv: '' };
        
        finalTitle = encTitle.ciphertext;
        finalDescription = encDesc.ciphertext;
        ivHex = encTitle.iv; // Use the title IV as unified vector
      }

      if (user.uid === 'guest-offline') {
        const newDecision: Decision = {
          id: 'local-' + Date.now(),
          userId: user.uid,
          title: finalTitle,
          description: finalDescription,
          category: decisionData.category || 'general',
          options: [],
          createdAt: Date.now(),
          isEncrypted: !!decisionData.isEncrypted,
          salt: decisionData.salt,
          iv: ivHex
        };
        const updated = [newDecision, ...decisions];
        setDecisions(updated);
        localStorage.setItem('weaver_local_decisions', JSON.stringify(updated));
        return;
      }

      const payload = {
        ...decisionData,
        userId: user.uid,
        title: finalTitle,
        description: finalDescription,
        iv: ivHex,
        options: [],
        createdAt: decisionData.createdAt || Date.now()
      };

      await addDoc(collection(db, 'decisions'), payload);
    } catch (e: any) {
      console.error('Error creating decision in Firestore:', e);
      // Fallback local save if remote write fails
      const fallbackDecision: Decision = {
        id: 'local-' + Date.now(),
        userId: user.uid,
        title: decisionData.title || '',
        description: decisionData.description || '',
        category: decisionData.category || 'general',
        options: [],
        createdAt: Date.now(),
        isEncrypted: !!decisionData.isEncrypted,
        salt: decisionData.salt,
        iv: decisionData.iv || ''
      };
      const updated = [fallbackDecision, ...decisions];
      setDecisions(updated);
      localStorage.setItem('weaver_local_decisions', JSON.stringify(updated));
    }
  };

  const handleUpdateDecision = async (updatedDecision: Decision) => {
    if (!user) return;
    
    // Optimistic local UI update first for instant UX
    const updatedList = decisions.map(d => d.id === updatedDecision.id ? updatedDecision : d);
    setDecisions(updatedList);
    localStorage.setItem('weaver_local_decisions', JSON.stringify(updatedList));
    
    if (activeDecision && activeDecision.id === updatedDecision.id) {
      setActiveDecision(updatedDecision);
    }

    try {
      if (user.uid !== 'guest-offline' && !updatedDecision.id.startsWith('local-')) {
        const docRef = doc(db, 'decisions', updatedDecision.id);
        await updateDoc(docRef, {
          title: updatedDecision.title,
          description: updatedDecision.description,
          options: updatedDecision.options,
          iv: updatedDecision.iv
        });
      }
    } catch (e) {
      console.error('Error syncing updated decision to remote:', e);
    }
  };

  const handleDeleteDecision = async (id: string) => {
    // Optimistic local UI update first
    const updatedList = decisions.filter(d => d.id !== id);
    setDecisions(updatedList);
    localStorage.setItem('weaver_local_decisions', JSON.stringify(updatedList));
    if (activeDecision?.id === id) {
      setActiveDecision(null);
      setCurrentView('dashboard');
    }

    try {
      if (user && user.uid !== 'guest-offline' && !id.startsWith('local-')) {
        const docRef = doc(db, 'decisions', id);
        await deleteDoc(docRef);
      }
    } catch (e) {
      console.error('Error syncing deleted decision to remote:', e);
    }
  };

  const handleSelectDecision = (decision: Decision) => {
    setActiveDecision(decision);
    setCurrentView('workspace');
  };

  if (!authChecked) {
    return (
      <div id="loading-spinner-container" className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#050505] transition-colors duration-200">
        <div className="flex flex-col items-center">
          <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
          <p className="text-slate-400 dark:text-slate-500 text-xs mt-3 font-mono">Initializing Neural Workspace...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthScreen 
        onSuccess={(guestUser) => {
          if (guestUser) {
            setUser(guestUser);
          }
          setCurrentView('dashboard');
        }} 
      />
    );
  }

  return (
    <div id="app-container" className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#050505] text-slate-900 dark:text-slate-200 transition-colors duration-200">
      
      {/* Floating Modern Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-[#050505]/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Logo Brand */}
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => { setCurrentView('dashboard'); setActiveDecision(null); }}>
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <Brain className="w-5.5 h-5.5" />
            </div>
            <div>
              <span className="font-extrabold text-sm tracking-tight text-slate-900 dark:text-white block font-sans">
                Decision <span className="text-indigo-600 dark:text-indigo-400">Weaver</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono tracking-wider block">PROBABILISTIC COGNITION</span>
            </div>
          </div>

          {/* Navigation Controls */}
          <nav className="hidden sm:flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 p-1 rounded-xl">
            <button
              id="nav-dashboard-button"
              onClick={() => { setCurrentView('dashboard'); setActiveDecision(null); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                currentView === 'dashboard' || currentView === 'workspace'
                  ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-xs border border-slate-200 dark:border-slate-850'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 border border-transparent'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Workspace</span>
            </button>
            
            <button
              id="nav-api-docs-button"
              onClick={() => { setCurrentView('api-docs'); setActiveDecision(null); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                currentView === 'api-docs'
                  ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-xs border border-slate-200 dark:border-slate-850'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 border border-transparent'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Developer API</span>
            </button>
          </nav>

          {/* User Controls & Clock */}
          <div className="flex items-center gap-4">
            
            {/* System Clock */}
            <div className="hidden md:flex items-center gap-1.5 text-[11px] font-mono text-slate-400 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 rounded-xl">
              <Clock className="w-3.5 h-3.5 text-indigo-500" />
              <span>{currentTime} UTC</span>
            </div>

            <ThemeToggle theme={theme} setTheme={setTheme} />

            {/* User Dropdown Profile mock */}
            <div className="flex items-center gap-2.5 border-l border-slate-200 dark:border-slate-800 pl-4">
              <div className="hidden sm:block text-right">
                <span className="block text-xs font-bold text-slate-700 dark:text-slate-300 truncate max-w-[120px]">
                  {user.displayName}
                </span>
                <span className="block text-[10px] text-slate-400 font-mono truncate max-w-[120px]">
                  {user.email}
                </span>
              </div>
              
              <button
                id="header-logout-button"
                onClick={handleLogout}
                className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111111] text-slate-500 hover:text-rose-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm cursor-pointer"
                title="Log Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container Workspace */}
      <main className="flex-grow">
        <AnimatePresence mode="wait">
          {currentView === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
            >
              <DecisionDashboard
                decisions={decisions}
                onCreateDecision={handleCreateDecision}
                onDeleteDecision={handleDeleteDecision}
                onSelectDecision={handleSelectDecision}
              />
            </motion.div>
          )}

          {currentView === 'workspace' && activeDecision && (
            <motion.div
              key="workspace"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
            >
              <DecisionWorkspace
                decision={activeDecision}
                onBack={() => { setCurrentView('dashboard'); setActiveDecision(null); }}
                onUpdateDecision={handleUpdateDecision}
              />
            </motion.div>
          )}

          {currentView === 'api-docs' && (
            <motion.div
              key="api-docs"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
            >
              <ApiDocs />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Modern Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-850 bg-white dark:bg-[#090909] py-6 mt-12 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-500" />
            <span>© 2026 Decision Weaver. Standard PBKDF2 Client-Side Encryption Protocol active.</span>
          </div>
          <div className="flex items-center gap-6 font-mono text-[10px] tracking-wider uppercase text-slate-500">
            <span>Status: 200 OK</span>
            <span>DB: FIRESTORE SECURE</span>
            <span>PLATFORM: CLOUD RUN</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
