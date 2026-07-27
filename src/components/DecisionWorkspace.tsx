import React, { useState, useEffect } from 'react';
import { Decision, Option, Scenario, SimulationResult } from '../types';
import { 
  ArrowLeft, 
  Trash2, 
  Plus, 
  Sparkles, 
  Sliders, 
  HelpCircle, 
  Lock, 
  Unlock, 
  Key, 
  TrendingUp, 
  Activity, 
  Play, 
  AlertCircle, 
  CheckCircle,
  FileText,
  RefreshCw,
  Lightbulb,
  Brain,
  HardDrive,
  CheckCircle2
} from 'lucide-react';
import DecisionAssistantSidebar from './DecisionAssistantSidebar';
import ProbabilitySensitivityPlayground from './ProbabilitySensitivityPlayground';
import { motion } from 'motion/react';
import { runMonteCarlo, calculateStaticEV } from '../lib/monteCarlo';
import { deriveKey, encryptText, decryptText } from '../lib/crypto';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  CartesianGrid 
} from 'recharts';

interface DecisionWorkspaceProps {
  decision: Decision;
  onBack: () => void;
  onUpdateDecision: (updated: Decision) => void;
}

// Simple custom Markdown parser to avoid external library dependency issues in React 19
function SimpleMarkdown({ content }: { content: string }) {
  const lines = content.split('\n');
  return (
    <div className="space-y-4 font-sans text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
      {lines.map((line, idx) => {
        // Heading 3
        if (line.startsWith('### ')) {
          return <h4 key={idx} className="text-base font-bold text-slate-900 dark:text-white mt-4 mb-2">{line.slice(4)}</h4>;
        }
        // Heading 2
        if (line.startsWith('## ')) {
          return <h3 key={idx} className="text-lg font-bold text-slate-900 dark:text-white mt-6 mb-3 border-b border-slate-100 dark:border-slate-800 pb-1">{line.slice(3)}</h3>;
        }
        // Heading 1
        if (line.startsWith('# ')) {
          return <h2 key={idx} className="text-xl font-extrabold text-slate-900 dark:text-white mt-8 mb-4">{line.slice(2)}</h2>;
        }
        // Bullet list
        if (line.startsWith('- ') || line.startsWith('* ')) {
          const content = line.slice(2).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
          return (
            <ul key={idx} className="list-disc pl-5 space-y-1.5">
              <li dangerouslySetInnerHTML={{ __html: content }} />
            </ul>
          );
        }
        // Numbered list
        if (/^\d+\.\s/.test(line)) {
          const content = line.replace(/^\d+\.\s/, '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
          return (
            <ol key={idx} className="list-decimal pl-5 space-y-1.5">
              <li dangerouslySetInnerHTML={{ __html: content }} />
            </ol>
          );
        }
        // Empty lines
        if (!line.trim()) {
          return null;
        }
        // Normal paragraph
        const parsedParagraph = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        return <p key={idx} dangerouslySetInnerHTML={{ __html: parsedParagraph }} className="text-justify" />;
      })}
    </div>
  );
}

export default function DecisionWorkspace({
  decision,
  onBack,
  onUpdateDecision
}: DecisionWorkspaceProps) {
  // State for passphrase decryption
  const [passphrase, setPassphrase] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(!decision.isEncrypted);
  const [activeKey, setActiveKey] = useState<CryptoKey | null>(null);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  // Decrypted Decision fields
  const [decryptedTitle, setDecryptedTitle] = useState(decision.title);
  const [decryptedDescription, setDecryptedDescription] = useState(decision.description);
  const [options, setOptions] = useState<Option[]>([]);

  // Editing UI states
  const [newOptionTitle, setNewOptionTitle] = useState('');
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [newScenarioTitle, setNewScenarioTitle] = useState('');
  const [newScenarioProb, setNewScenarioProb] = useState(0.25);
  const [newScenarioUtil, setNewScenarioUtil] = useState(0);

  // Simulation & Analysis states
  const [simResults, setSimResults] = useState<SimulationResult[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [reportModelUsed, setReportModelUsed] = useState<string>('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [evaluationDepth, setEvaluationDepth] = useState<'fast' | 'general' | 'complex'>('general');
  const [isBrainstorming, setIsBrainstorming] = useState<string | null>(null); // OptionID currently brainstorming
  
  // Pre-Mortem & Assistant Sidebar state
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [preMortemModal, setPreMortemModal] = useState<{ optionTitle: string; report: string } | null>(null);
  const [isGeneratingPreMortem, setIsGeneratingPreMortem] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
    { role: 'assistant', content: 'Hello! I am your Decision Coach. Ask me anything about risk trade-offs, expected values, or what research you should do next.' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatSending, setIsChatSending] = useState(false);

  // Auto-Save State & LocalStorage Persistence
  const [lastAutoSaveTime, setLastAutoSaveTime] = useState<number | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [unrestoredDraft, setUnrestoredDraft] = useState<{
    title: string;
    description: string;
    options: Option[];
    timestamp: number;
  } | null>(null);

  // Check for auto-saved local draft when decision unlocks or loads
  useEffect(() => {
    if (isUnlocked && decision.id) {
      try {
        const draftKey = `weaver_autosave_${decision.id}`;
        const rawDraft = localStorage.getItem(draftKey);
        if (rawDraft) {
          const parsed = JSON.parse(rawDraft);
          const cloudTime = decision.updatedAt || decision.createdAt || 0;
          if (parsed && parsed.timestamp && parsed.timestamp > cloudTime + 1000) {
            const currentStr = JSON.stringify({ title: decision.title, options: decision.options || [] });
            const draftStr = JSON.stringify({ title: parsed.title, options: parsed.options || [] });
            if (currentStr !== draftStr) {
              setUnrestoredDraft({
                title: parsed.title || '',
                description: parsed.description || '',
                options: parsed.options || [],
                timestamp: parsed.timestamp
              });
            }
          }
        }
      } catch (e) {
        console.error('Error reading auto-save draft:', e);
      }
    }
  }, [isUnlocked, decision.id]);

  // Auto-save interval: executes every 10 seconds to persist current decision state to localStorage
  useEffect(() => {
    if (!isUnlocked || !decision.id) return;

    const intervalId = setInterval(() => {
      try {
        setAutoSaveStatus('saving');
        const draftKey = `weaver_autosave_${decision.id}`;
        const draftPayload = {
          id: decision.id,
          title: decryptedTitle,
          description: decryptedDescription,
          options,
          timestamp: Date.now()
        };
        localStorage.setItem(draftKey, JSON.stringify(draftPayload));
        const now = Date.now();
        setLastAutoSaveTime(now);
        setAutoSaveStatus('saved');
        
        // Also perform background sync with Firestore/Cloud
        syncWithCloud(options);
      } catch (e) {
        console.error('Failed auto-saving draft to localStorage:', e);
        setAutoSaveStatus('idle');
      }
    }, 10000); // 10 seconds interval

    return () => clearInterval(intervalId);
  }, [isUnlocked, decision.id, decryptedTitle, decryptedDescription, options]);

  // Restore Draft Action
  const handleRestoreDraft = () => {
    if (!unrestoredDraft) return;
    setDecryptedTitle(unrestoredDraft.title);
    setDecryptedDescription(unrestoredDraft.description);
    setOptions(unrestoredDraft.options);
    syncWithCloud(unrestoredDraft.options);
    setUnrestoredDraft(null);
  };

  // Discard Draft Action
  const handleDiscardDraft = () => {
    if (decision.id) {
      localStorage.removeItem(`weaver_autosave_${decision.id}`);
    }
    setUnrestoredDraft(null);
  };

  // Update scenario probabilities from Probability Sensitivity Playground
  const handleUpdateOptionProbabilities = (optionId: string, updatedScenarios: Scenario[]) => {
    const updatedOptions = options.map(opt => {
      if (opt.id === optionId) {
        return { ...opt, scenarios: updatedScenarios };
      }
      return opt;
    });
    setOptions(updatedOptions);
    syncWithCloud(updatedOptions);
  };

  // Inject scenario from Decision Assistant
  const handleAddScenarioFromAssistant = (optionIdOrTitle: string, newSc: Omit<Scenario, 'id'>) => {
    const target = optionIdOrTitle.toLowerCase().trim();
    const updatedOptions = options.map(opt => {
      if (opt.id === optionIdOrTitle || opt.title.toLowerCase().trim() === target) {
        const addedScenario: Scenario = {
          id: `sc_ai_injected_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          title: newSc.title,
          probability: newSc.probability,
          utility: newSc.utility
        };
        return {
          ...opt,
          scenarios: [...opt.scenarios, addedScenario]
        };
      }
      return opt;
    });

    setOptions(updatedOptions);
    syncWithCloud(updatedOptions);
  };

  // Decrypt the decision when unlocked
  useEffect(() => {
    if (!decision.isEncrypted) {
      setDecryptedTitle(decision.title);
      setDecryptedDescription(decision.description);
      setOptions(decision.options || []);
    } else {
      setOptions([]);
    }
  }, [decision]);

  // Run Monte Carlo simulation whenever options/scenarios change
  useEffect(() => {
    if (isUnlocked && options.length > 0) {
      setIsSimulating(true);
      const timer = setTimeout(() => {
        try {
          const results = runMonteCarlo(options, 10000, 4);
          setSimResults(results);
        } catch (e) {
          console.error(e);
        } finally {
          setIsSimulating(false);
        }
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setSimResults([]);
    }
  }, [options, isUnlocked]);

  // Handle local decryption
  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphrase.trim()) return;
    setUnlockError(null);

    try {
      // Derive crypto key from salt
      const key = await deriveKey(passphrase, decision.salt || '');
      
      // Decrypt Title and Description
      const decTitle = await decryptText(decision.title, decision.iv || '', key);
      const decDesc = decision.description 
        ? await decryptText(decision.description, decision.iv || '', key) 
        : '';

      // Decrypt options titles and scenarios details
      const decOptions: Option[] = [];
      for (const opt of decision.options || []) {
        const decOptTitle = await decryptText(opt.title, decision.iv || '', key);
        const decScenarios: Scenario[] = [];
        
        for (const sc of opt.scenarios || []) {
          const decScTitle = await decryptText(sc.title, decision.iv || '', key);
          decScenarios.push({
            ...sc,
            title: decScTitle
          });
        }
        decOptions.push({
          ...opt,
          title: decOptTitle,
          scenarios: decScenarios
        });
      }

      setDecryptedTitle(decTitle);
      setDecryptedDescription(decDesc);
      setOptions(decOptions);
      setActiveKey(key);
      setIsUnlocked(true);
    } catch (err) {
      console.error(err);
      setUnlockError('Invalid decryption key. Please try again.');
    }
  };

  // Helper to re-encrypt and sync with Firestore
  const syncWithCloud = async (newOptions: Option[]) => {
    try {
      if (decision.isEncrypted && activeKey) {
        // Re-encrypt title, description, and nested options structure
        const encTitleResult = await encryptText(decryptedTitle, activeKey);
        const encDescResult = decryptedDescription 
          ? await encryptText(decryptedDescription, activeKey)
          : { ciphertext: '', iv: '' };

        const encOptions: Option[] = [];
        for (const opt of newOptions) {
          const encOptTitle = await encryptText(opt.title, activeKey);
          const encScenarios: Scenario[] = [];

          for (const sc of opt.scenarios) {
            const encScTitle = await encryptText(sc.title, activeKey);
            encScenarios.push({
              ...sc,
              title: encScTitle.ciphertext
            });
          }

          encOptions.push({
            ...opt,
            title: encOptTitle.ciphertext,
            scenarios: encScenarios
          });
        }

        onUpdateDecision({
          ...decision,
          title: encTitleResult.ciphertext,
          description: encDescResult.ciphertext,
          iv: encTitleResult.iv, // store new unified IV
          options: encOptions
        });
      } else {
        // Plaintext sync
        onUpdateDecision({
          ...decision,
          options: newOptions
        });
      }
    } catch (e) {
      console.error('Failed to sync changes:', e);
    }
  };

  const handleAddOption = () => {
    if (!newOptionTitle.trim()) return;
    const newOption: Option = {
      id: `opt_${Date.now()}`,
      title: newOptionTitle.trim(),
      scenarios: []
    };
    const updatedOptions = [...options, newOption];
    setOptions(updatedOptions);
    setNewOptionTitle('');
    setSelectedOptionId(newOption.id);
    syncWithCloud(updatedOptions);
  };

  const handleDeleteOption = (optId: string) => {
    const updatedOptions = options.filter(o => o.id !== optId);
    setOptions(updatedOptions);
    if (selectedOptionId === optId) setSelectedOptionId(null);
    syncWithCloud(updatedOptions);
  };

  const handleAddScenario = () => {
    if (!selectedOptionId || !newScenarioTitle.trim()) return;
    const newScenario: Scenario = {
      id: `sc_${Date.now()}`,
      title: newScenarioTitle.trim(),
      probability: parseFloat(newScenarioProb.toFixed(2)),
      utility: newScenarioUtil
    };

    const updatedOptions = options.map(opt => {
      if (opt.id === selectedOptionId) {
        return {
          ...opt,
          scenarios: [...opt.scenarios, newScenario]
        };
      }
      return opt;
    });

    setOptions(updatedOptions);
    setNewScenarioTitle('');
    setNewScenarioProb(0.25);
    setNewScenarioUtil(0);
    syncWithCloud(updatedOptions);
  };

  const handleDeleteScenario = (optId: string, scId: string) => {
    const updatedOptions = options.map(opt => {
      if (opt.id === optId) {
        return {
          ...opt,
          scenarios: opt.scenarios.filter(sc => sc.id !== scId)
        };
      }
      return opt;
    });
    setOptions(updatedOptions);
    syncWithCloud(updatedOptions);
  };

  // Call Gemini Backend to brainstorm scenarios
  const handleBrainstormScenarios = async (opt: Option) => {
    setIsBrainstorming(opt.id);
    try {
      const response = await fetch('/api/suggest-scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decisionTitle: decryptedTitle,
          decisionDescription: decryptedDescription,
          optionTitle: opt.title
        })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch brainstorming response');
      }

      const data = await response.json();
      if (data && Array.isArray(data.scenarios)) {
        // Map suggested scenarios
        const suggested: Scenario[] = data.scenarios.map((sc: any, idx: number) => ({
          id: `sc_ai_${Date.now()}_${idx}`,
          title: sc.title,
          probability: sc.probability,
          utility: sc.utility
        }));

        const updatedOptions = options.map(o => {
          if (o.id === opt.id) {
            return {
              ...o,
              scenarios: [...o.scenarios, ...suggested]
            };
          }
          return o;
        });

        setOptions(updatedOptions);
        syncWithCloud(updatedOptions);
      }
    } catch (err) {
      console.error(err);
      alert('Could not suggest outcomes. Is your Gemini API active?');
    } finally {
      setIsBrainstorming(null);
    }
  };

  // Call Gemini Backend to generate a complete report
  const handleGenerateReport = async (depthOverride?: 'fast' | 'general' | 'complex') => {
    if (options.length === 0) return;
    setIsGeneratingReport(true);
    setReport(null);

    const activeDepth = depthOverride || evaluationDepth;

    try {
      const response = await fetch('/api/analyze-decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: decryptedTitle,
          description: decryptedDescription,
          category: decision.category,
          options,
          simulationResults: simResults,
          depth: activeDepth
        })
      });

      if (!response.ok) {
        throw new Error('Analysis request failed.');
      }

      const data = await response.json();
      setReport(data.report);
      setReportModelUsed(data.modelUsed || 'gemini-3.5-flash');
    } catch (err) {
      console.error(err);
      alert('Could not perform Gemini analysis. Please try again.');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // Pre-Mortem Worst-Case Analysis
  const handlePreMortem = async (opt: Option) => {
    setIsGeneratingPreMortem(opt.id);
    try {
      const response = await fetch('/api/pre-mortem-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decisionTitle: decryptedTitle,
          optionTitle: opt.title,
          scenarios: opt.scenarios
        })
      });

      if (!response.ok) {
        throw new Error('Pre-mortem request failed.');
      }

      const data = await response.json();
      setPreMortemModal({ optionTitle: opt.title, report: data.preMortem });
    } catch (err) {
      console.error(err);
      alert('Could not run pre-mortem analysis.');
    } finally {
      setIsGeneratingPreMortem(null);
    }
  };

  // Send message to Decision Chat Assistant
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatSending) return;

    const userText = chatInput.trim();
    setChatInput('');
    const newHistory = [...chatMessages, { role: 'user' as const, content: userText }];
    setChatMessages(newHistory);
    setIsChatSending(true);

    try {
      const response = await fetch('/api/decision-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decisionTitle: decryptedTitle,
          options,
          userMessage: userText,
          conversationHistory: newHistory.slice(-6)
        })
      });

      if (!response.ok) {
        throw new Error('Chat request failed.');
      }

      const data = await response.json();
      setChatMessages([...newHistory, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      console.error(err);
      setChatMessages([...newHistory, { role: 'assistant', content: 'Sorry, I ran into an error processing your query.' }]);
    } finally {
      setIsChatSending(false);
    }
  };

  // Format Recharts data across all options
  const getChartData = () => {
    if (simResults.length === 0) return [];
    
    // Standard bins (20 of them, covers -100 to 100)
    const chartData = Array.from({ length: 20 }, (_, idx) => {
      const val = -100 + idx * 10 + 5;
      const dataPoint: any = { value: val, name: `${-100 + idx * 10} to ${-90 + idx * 10}` };
      
      simResults.forEach(res => {
        const bin = res.distribution[idx];
        dataPoint[res.optionTitle] = bin ? bin.count : 0;
      });
      
      return dataPoint;
    });

    return chartData;
  };

  // Lock Screen view
  if (!isUnlocked) {
    return (
      <div id="workspace-locked-screen" className="max-w-md mx-auto px-4 py-20 font-sans">
        <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl text-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mx-auto mb-6 shadow-md">
            <Lock className="w-6 h-6" />
          </div>
          
          <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Decryption Key Required</h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 mb-6">
            This decision model was encrypted client-side using a PBKDF2 salt. Please enter your passphrase to unlock.
          </p>

          {unlockError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 text-rose-600 dark:text-rose-400 text-xs flex gap-2 justify-center items-center">
              <AlertCircle className="w-4 h-4 text-rose-500" />
              <span>{unlockError}</span>
            </div>
          )}

          <form onSubmit={handleUnlock} className="space-y-4">
            <input
              id="unlock-passphrase-input"
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#050505]/50 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              placeholder="Enter private passphrase..."
              required
            />
            
            <div className="flex gap-3">
              <button
                id="unlock-back-button"
                type="button"
                onClick={onBack}
                className="w-1/2 py-2 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold text-sm rounded-xl hover:bg-slate-50 dark:hover:bg-[#1c1c1e] transition-colors cursor-pointer"
              >
                Go Back
              </button>
              
              <button
                id="unlock-submit-button"
                type="submit"
                className="w-1/2 py-2 bg-indigo-600 text-white font-semibold text-sm rounded-xl hover:bg-indigo-700 transition-colors flex justify-center items-center gap-1.5 cursor-pointer shadow-md shadow-indigo-600/10"
              >
                <Key className="w-4 h-4" />
                <span>Decrypt</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  const chartColors = ['#4f46e5', '#7c3aed', '#ea580c', '#2563eb'];

  return (
    <div id="decision-workspace" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 font-sans">
      {/* Header Back Link */}
      <button
        id="workspace-back-button"
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 mb-6 font-semibold cursor-pointer transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Return to Dashboard</span>
      </button>

      {/* Auto-Save Unrestored Draft Recovery Banner */}
      {unrestoredDraft && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <HardDrive className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Auto-saved local draft found ({new Date(unrestoredDraft.timestamp).toLocaleTimeString()})
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                An unsynced local version of this decision from auto-save was detected.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleRestoreDraft}
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Restore Draft
            </button>
            <button
              onClick={handleDiscardDraft}
              className="px-3.5 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Decision Summary Info */}
      <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 mb-8 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 flex items-center gap-2">
          {/* Auto-Save Status Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold rounded-full">
            {autoSaveStatus === 'saving' ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                <span>Auto-saving draft...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>
                  {lastAutoSaveTime 
                    ? `Auto-saved (${new Date(lastAutoSaveTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`
                    : 'Auto-save active (10s)'}
                </span>
              </>
            )}
          </div>

          {decision.isEncrypted ? (
            <span className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-semibold rounded-full">
              <Lock className="w-3.5 h-3.5" />
              <span>Decrypted Vault Mode</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 dark:bg-[#050505]/60 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs font-semibold rounded-full">
              <Unlock className="w-3.5 h-3.5" />
              <span>Standard Model</span>
            </span>
          )}
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight pr-28">
          {decryptedTitle}
        </h1>
        
        <p className="text-slate-500 dark:text-slate-400 text-sm sm:text-base mt-2 max-w-4xl leading-relaxed">
          {decryptedDescription || 'Provide details about your decision scenarios to run analysis.'}
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <button
            id="open-decision-assistant-button"
            onClick={() => setIsAssistantOpen(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs sm:text-sm rounded-2xl transition-all cursor-pointer flex items-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-98"
          >
            <Brain className="w-4.5 h-4.5 text-indigo-200" />
            <span>Decision Assistant Sidebar</span>
            <span className="ml-1 px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-bold uppercase tracking-wider">
              Gemini Cognitive Audit
            </span>
          </button>
        </div>
      </div>

      {/* Main Workspace Layout Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Hand: Options & Scenarios Configuration (Column Span 7) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight mb-4 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-indigo-500" />
              <span>Configure Decision Options</span>
            </h3>

            {/* Quick Option Creation */}
            <div className="flex gap-3 mb-6">
              <input
                id="option-title-input"
                type="text"
                value={newOptionTitle}
                onChange={(e) => setNewOptionTitle(e.target.value)}
                className="flex-1 px-4 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#050505]/50 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                placeholder="Add a new choice option (e.g., Stay at current company)"
              />
              <button
                id="add-option-button"
                onClick={handleAddOption}
                className="px-4 py-2 bg-indigo-600 text-white font-semibold text-sm rounded-xl hover:bg-indigo-700 transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-indigo-600/10"
              >
                <Plus className="w-4 h-4" />
                <span>Add Option</span>
              </button>
            </div>

            {/* List of Options */}
            {options.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                <p className="text-slate-400 text-xs">No options defined yet. Add at least two choices to compare.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {options.map((opt) => (
                  <div
                    id={`option-container-${opt.id}`}
                    key={opt.id}
                    className={`border rounded-2xl p-5 transition-all ${
                      selectedOptionId === opt.id
                        ? 'border-indigo-500 bg-indigo-500/3 dark:bg-indigo-950/5 shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div 
                        className="font-bold text-slate-900 dark:text-white text-base cursor-pointer hover:text-indigo-500 transition-colors"
                        onClick={() => setSelectedOptionId(opt.id)}
                      >
                        {opt.title}
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Pre-Mortem Button */}
                        <button
                          id={`ai-premortem-button-${opt.id}`}
                          onClick={() => handlePreMortem(opt)}
                          disabled={isGeneratingPreMortem !== null}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/40 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                          title="Run Pre-Mortem failure analysis with Gemini 3.5 Flash"
                        >
                          {isGeneratingPreMortem === opt.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <AlertCircle className="w-3.5 h-3.5" />
                          )}
                          <span className="hidden sm:inline">Pre-Mortem</span>
                        </button>

                        {/* Brainstorm Button */}
                        <button
                          id={`ai-brainstorm-button-${opt.id}`}
                          onClick={() => handleBrainstormScenarios(opt)}
                          disabled={isBrainstorming !== null}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100/80 dark:hover:bg-indigo-900/40 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                          title="Generate plausible outcomes with Gemini 3.1 Flash-Lite"
                        >
                          {isBrainstorming === opt.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5" />
                          )}
                          <span>AI Scenarios</span>
                        </button>

                        <button
                          id={`delete-option-${opt.id}`}
                          onClick={() => handleDeleteOption(opt.id)}
                          className="text-slate-400 hover:text-rose-500 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Expand option scenarios if selected */}
                    {selectedOptionId === opt.id && (
                      <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-4 space-y-4">
                        <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                          Outcomes & Probability Tree Branches
                        </div>

                        {/* Outcomes list */}
                        {opt.scenarios.length === 0 ? (
                          <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#050505]/40 text-center border border-dashed border-slate-200 dark:border-slate-800">
                            <span className="block text-xs font-medium text-slate-400">No outcomes defined.</span>
                            <span className="block text-[11px] text-slate-400 mt-1">Add scenarios manually or click "AI Brainstorm" to populate automatically!</span>
                          </div>
                        ) : (
                          <div className="space-y-2.5">
                            {opt.scenarios.map((sc) => (
                              <div
                                id={`scenario-row-${sc.id}`}
                                key={sc.id}
                                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 bg-slate-50 dark:bg-[#050505]/40 border border-slate-100 dark:border-slate-800 rounded-xl"
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                    {sc.title}
                                  </div>
                                  <div className="flex items-center gap-4 text-xs font-mono text-slate-400 mt-1">
                                    <span>Prob: {(sc.probability * 100).toFixed(0)}%</span>
                                    <span>Utility: {sc.utility > 0 ? `+${sc.utility}` : sc.utility}</span>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                                  {/* Color Indicator */}
                                  <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${
                                    sc.utility >= 50 ? 'bg-emerald-500/15 text-emerald-500' :
                                    sc.utility >= 0 ? 'bg-indigo-500/15 text-indigo-500' :
                                    sc.utility >= -40 ? 'bg-orange-500/15 text-orange-500' :
                                    'bg-rose-500/15 text-rose-500'
                                  }`}>
                                    {sc.utility >= 50 ? 'Excellent' :
                                     sc.utility >= 0 ? 'Favorable' :
                                     sc.utility >= -40 ? 'Costly' : 'Catastrophic'}
                                  </span>

                                  <button
                                    id={`delete-scenario-${sc.id}`}
                                    onClick={() => handleDeleteScenario(opt.id, sc.id)}
                                    className="text-slate-400 hover:text-rose-500 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}

                            {/* Total Prob Warning */}
                            {opt.scenarios.reduce((sum, s) => sum + s.probability, 0) !== 1 && (
                              <div className="text-xs text-amber-500 dark:text-amber-400 flex items-center gap-1.5 p-2 rounded-lg bg-amber-500/5 border border-amber-500/10 font-medium">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                <span>
                                  Probabilities sum to {(opt.scenarios.reduce((sum, s) => sum + s.probability, 0) * 100).toFixed(0)}%. Monte Carlo will scale and normalize these to equal 100%.
                                </span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Add Scenario Form */}
                        <div className="bg-slate-50 dark:bg-[#050505] p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            Add Custom Outcome Scenario
                          </div>

                          <div>
                            <input
                              id="scenario-title-input"
                              type="text"
                              value={newScenarioTitle}
                              onChange={(e) => setNewScenarioTitle(e.target.value)}
                              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111111] text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                              placeholder="Describe outcome (e.g., Company goes bankrupt/restructs)"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                                Probability: {Math.round(newScenarioProb * 100)}%
                              </label>
                              <input
                                id="scenario-probability-slider"
                                type="range"
                                min="0.01"
                                max="1"
                                step="0.01"
                                value={newScenarioProb}
                                onChange={(e) => setNewScenarioProb(parseFloat(e.target.value))}
                                className="w-full accent-indigo-600 h-1.5 rounded-lg bg-slate-200"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                                Satisfaction/Utility: {newScenarioUtil > 0 ? `+${newScenarioUtil}` : newScenarioUtil}
                              </label>
                              <input
                                id="scenario-utility-slider"
                                type="range"
                                min="-100"
                                max="100"
                                step="5"
                                value={newScenarioUtil}
                                onChange={(e) => setNewScenarioUtil(parseInt(e.target.value))}
                                className="w-full accent-indigo-600 h-1.5 rounded-lg bg-slate-200"
                              />
                              <div className="flex justify-between text-[9px] text-slate-400 mt-1 font-mono">
                                <span>-100 (Disaster)</span>
                                <span>+100 (Stellar)</span>
                              </div>
                            </div>
                          </div>

                          <button
                            id="add-scenario-button"
                            onClick={handleAddScenario}
                            className="w-full py-1.5 bg-slate-850 hover:bg-slate-900 dark:bg-[#1c1c1e] dark:hover:bg-[#2c2c2e] text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer"
                          >
                            Append Branch Outcome
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Hand: Simulation Analytics Dashboard (Column Span 5) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Quick Expected Value Scoreboard */}
          <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight mb-4 flex items-center gap-1.5">
              <TrendingUp className="w-4.5 h-4.5 text-indigo-500" />
              <span>Mathematical Expected Value (EV)</span>
            </h3>

            {options.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4 font-mono">Define options to see calculated EV.</p>
            ) : (
              <div className="space-y-3.5">
                {options.map((opt) => {
                  const ev = calculateStaticEV(opt.scenarios);
                  return (
                    <div id={`ev-summary-${opt.id}`} key={opt.id} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                        <span className="truncate max-w-[200px]">{opt.title}</span>
                        <span className="font-mono">{ev > 0 ? `+${ev}` : ev}</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 dark:bg-[#050505] rounded-full overflow-hidden relative">
                        {/* Bi-directional progress bar centered around 0 */}
                        <div 
                          className={`absolute top-0 bottom-0 rounded-full transition-all duration-500 ${
                            ev >= 30 ? 'bg-emerald-500' :
                            ev >= 0 ? 'bg-indigo-500' :
                            ev >= -30 ? 'bg-orange-500' : 'bg-rose-500'
                          }`}
                          style={{
                            left: ev >= 0 ? '50%' : `${50 - Math.min(50, Math.abs(ev) / 2)}%`,
                            right: ev >= 0 ? `${50 - Math.min(50, ev / 2)}%` : '50%'
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Monte Carlo Simulated Probability Distribution Curves */}
          <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight mb-4 flex items-center gap-1.5">
              <Activity className="w-4.5 h-4.5 text-indigo-500" />
              <span>Simulated Probability Curves</span>
            </h3>

            {options.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-12 font-mono">No simulation data. Populate options first.</p>
            ) : (
              <div className="space-y-4">
                <div className="h-60 w-full text-xs">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={getChartData()} margin={{ top: 10, right: 5, left: -20, bottom: 0 }}>
                      <defs>
                        {chartColors.map((color, i) => (
                          <linearGradient key={i} id={`grad_${i}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={color} stopOpacity={0.25}/>
                            <stop offset="95%" stopColor={color} stopOpacity={0}/>
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" strokeOpacity={0.6} />
                      <XAxis dataKey="value" stroke="var(--chart-axis)" fontSize={10} tickLine={false} />
                      <YAxis stroke="var(--chart-axis)" fontSize={10} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'var(--tooltip-bg)', 
                          borderRadius: '12px', 
                          borderColor: 'var(--tooltip-border)',
                          color: 'var(--tooltip-text)',
                          fontFamily: 'monospace',
                          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                        }} 
                      />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                      {simResults.map((res, i) => (
                        <Area
                           key={res.optionId}
                           type="monotone"
                           dataKey={res.optionTitle}
                           stroke={chartColors[i % chartColors.length]}
                           fillOpacity={1}
                           fill={`url(#grad_${i})`}
                           strokeWidth={2.5}
                        />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="text-[10px] text-slate-400 text-center font-mono">
                  Continuous probability density curves derived from 10,000 randomized Monte Carlo trials.
                </div>
              </div>
            )}
          </div>

          {/* Detailed Risk Profile Stats Table */}
          <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm overflow-hidden">
            <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight mb-4 flex items-center gap-1.5">
              <Sliders className="w-4.5 h-4.5 text-indigo-500" />
              <span>Advanced Risk Profile</span>
            </h3>

            {simResults.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6 font-mono">Define outcome parameters first.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-semibold">
                      <th className="py-2 pr-2">Option</th>
                      <th className="py-2 px-2 text-right">Regret (V&lt;0)</th>
                      <th className="py-2 px-2 text-right">Great (V&ge;50)</th>
                      <th className="py-2 pl-2 text-right">Volatility (SD)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {simResults.map((res, idx) => (
                      <tr id={`risk-row-${res.optionId}`} key={res.optionId} className="border-b border-slate-50 dark:border-slate-850 last:border-0 font-medium text-slate-700 dark:text-slate-300">
                        <td className="py-3 pr-2 truncate max-w-[120px] font-semibold text-slate-900 dark:text-slate-200" title={res.optionTitle}>
                          {res.optionTitle}
                        </td>
                        <td className="py-3 px-2 text-right font-mono text-rose-500">
                          {res.riskOfRegret}%
                        </td>
                        <td className="py-3 px-2 text-right font-mono text-emerald-500">
                          {res.greatOutcomeProb}%
                        </td>
                        <td className="py-3 pl-2 text-right font-mono">
                          {res.stdDev}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Full Analytical Decision Report Card */}
          {options.length > 0 && (
            <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  <span>Gemini Evaluation Depth</span>
                </span>
              </div>

              {/* Depth Selector Pills */}
              <div className="grid grid-cols-3 gap-2 p-1 bg-slate-50 dark:bg-[#050505] border border-slate-200 dark:border-slate-800 rounded-2xl">
                <button
                  id="depth-fast"
                  onClick={() => setEvaluationDepth('fast')}
                  className={`py-2 px-2 text-[11px] font-bold rounded-xl transition-all cursor-pointer ${
                    evaluationDepth === 'fast'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Fast (3.1 Lite)
                </button>
                <button
                  id="depth-general"
                  onClick={() => setEvaluationDepth('general')}
                  className={`py-2 px-2 text-[11px] font-bold rounded-xl transition-all cursor-pointer ${
                    evaluationDepth === 'general'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  General (3.5)
                </button>
                <button
                  id="depth-complex"
                  onClick={() => setEvaluationDepth('complex')}
                  className={`py-2 px-2 text-[11px] font-bold rounded-xl transition-all cursor-pointer ${
                    evaluationDepth === 'complex'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Deep (3.1 Pro)
                </button>
              </div>

              <button
                id="generate-gemini-report-button"
                onClick={() => handleGenerateReport()}
                disabled={isGeneratingReport}
                className="w-full py-3.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-violet-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-indigo-500/15 hover:shadow-indigo-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer focus:outline-none"
              >
                {isGeneratingReport ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 animate-pulse" />
                )}
                <span>Evaluate with {evaluationDepth === 'fast' ? 'Gemini 3.1 Flash-Lite' : evaluationDepth === 'complex' ? 'Gemini 3.1 Pro' : 'Gemini 3.5 Flash'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Interactive Probability Sensitivity Playground */}
      <div className="mt-8">
        <ProbabilitySensitivityPlayground
          options={options}
          onUpdateOptionProbabilities={handleUpdateOptionProbabilities}
        />
      </div>

      {/* Floating Decision Chat Coach Drawer Toggle */}
      <div className="fixed bottom-6 right-6 z-40">
        {!showChat ? (
          <button
            id="open-decision-chat-button"
            onClick={() => setShowChat(true)}
            className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-2xl transition-all cursor-pointer border border-indigo-400/30"
          >
            <Lightbulb className="w-4 h-4 text-amber-300" />
            <span>Ask Decision Coach</span>
          </button>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-3xl w-80 sm:w-96 shadow-2xl overflow-hidden flex flex-col h-[450px]"
          >
            {/* Header */}
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span className="font-bold text-xs">Decision Coach (Gemini 3.5 Flash)</span>
              </div>
              <button
                id="close-decision-chat"
                onClick={() => setShowChat(false)}
                className="text-slate-400 hover:text-white text-xs font-semibold p-1"
              >
                Close
              </button>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 text-xs font-sans">
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] p-3 rounded-2xl leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-none'
                        : 'bg-slate-100 dark:bg-[#050505] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-bl-none'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {isChatSending && (
                <div className="flex justify-start">
                  <div className="bg-slate-100 dark:bg-[#050505] p-3 rounded-2xl text-slate-400 text-xs flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                    <span>Coach is thinking...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-100 dark:border-slate-800 flex gap-2">
              <input
                id="decision-chat-input"
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask about risk, trade-offs..."
                className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#050505] border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                id="decision-chat-send"
                type="submit"
                disabled={isChatSending}
                className="px-3 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors cursor-pointer"
              >
                Send
              </button>
            </form>
          </motion.div>
        )}
      </div>

      {/* Pre-Mortem Report Modal */}
      {preMortemModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-[#111111] border border-rose-200 dark:border-rose-900/40 rounded-3xl p-6 sm:p-8 w-full max-w-2xl max-h-[80vh] flex flex-col justify-between shadow-2xl relative"
          >
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950 flex items-center justify-center text-rose-500">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">Pre-Mortem Failure Analysis</h3>
                  <p className="text-[10px] text-slate-400 font-mono">CHOICE: "{preMortemModal.optionTitle}" • GEMINI 3.5 FLASH</p>
                </div>
              </div>
              <button
                id="close-premortem-modal"
                onClick={() => setPreMortemModal(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs font-semibold p-1 rounded-lg border border-slate-200 dark:border-slate-800 cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-3">
              <SimpleMarkdown content={preMortemModal.report} />
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800 pt-3 mt-4 flex justify-end">
              <button
                id="premortem-dismiss-button"
                onClick={() => setPreMortemModal(null)}
                className="px-5 py-2 bg-slate-900 dark:bg-[#1c1c1e] text-white font-bold rounded-xl text-xs cursor-pointer"
              >
                Acknowledge & Mitigate
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Decision Analysis Report Modal */}
      {report && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 w-full max-w-3xl h-[80vh] flex flex-col justify-between shadow-2xl relative"
          >
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4 mb-6">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-indigo-600">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">Gemini Strategic Evaluation</h3>
                  <p className="text-[10px] text-slate-400 font-mono">ENGINE: {reportModelUsed.toUpperCase()} • PROBABILISTIC INFERENCE</p>
                </div>
              </div>
              <button
                id="close-report-button"
                onClick={() => setReport(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-sm font-semibold p-1.5 bg-slate-50 dark:bg-[#050505] border border-slate-200 dark:border-slate-800 rounded-lg cursor-pointer"
              >
                Close Report
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
              <SimpleMarkdown content={report} />
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800 pt-4 mt-6 flex justify-end">
              <button
                id="report-dismiss-button"
                onClick={() => setReport(null)}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all text-sm cursor-pointer shadow-md shadow-indigo-600/10"
              >
                Accept Advice
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Gemini Decision Assistant Sidebar */}
      <DecisionAssistantSidebar
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        decisionTitle={decryptedTitle}
        decisionDescription={decryptedDescription}
        category={decision.category}
        options={options}
        onAddScenario={handleAddScenarioFromAssistant}
      />
    </div>
  );
}
