import React, { useState, useEffect } from 'react';
import { Option, Scenario } from '../types';
import { 
  Brain, 
  Sparkles, 
  X, 
  AlertTriangle, 
  ShieldAlert, 
  Plus, 
  HelpCircle, 
  RefreshCw, 
  CheckCircle2, 
  Send, 
  Bot, 
  User, 
  Lightbulb, 
  BookOpen, 
  ArrowRight,
  TrendingDown,
  Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface BiasAuditItem {
  biasType: string;
  targetOptionOrScenario: string;
  observation: string;
  debiasingAdvice: string;
  severity: 'high' | 'medium' | 'low';
}

export interface MissingScenarioItem {
  optionId: string;
  optionTitle: string;
  suggestedTitle: string;
  suggestedProbability: number;
  suggestedUtility: number;
  reasoning: string;
}

export interface CognitiveAuditResult {
  summary: string;
  biasAudit: BiasAuditItem[];
  missingScenarios: MissingScenarioItem[];
  reframingQuestions: string[];
}

interface DecisionAssistantSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  decisionTitle: string;
  decisionDescription: string;
  category: string;
  options: Option[];
  onAddScenario: (optionIdOrTitle: string, scenario: Omit<Scenario, 'id'>) => void;
}

export default function DecisionAssistantSidebar({
  isOpen,
  onClose,
  decisionTitle,
  decisionDescription,
  category,
  options,
  onAddScenario
}: DecisionAssistantSidebarProps) {
  const [activeTab, setActiveTab] = useState<'audit' | 'frameworks' | 'chat'>('audit');
  const [auditData, setAuditData] = useState<CognitiveAuditResult | null>(null);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [injectedScenarios, setInjectedScenarios] = useState<Set<string>>(new Set());

  // Chat State
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
    { role: 'assistant', content: 'Greetings! I am your Cognitive Assistant. Ask me how to counter optimism bias, assess black swan risks, or apply reference class forecasting to your choices.' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);

  // Fetch cognitive audit when sidebar opens or when decision tree updates
  const fetchAudit = async () => {
    if (options.length === 0) return;
    setIsLoadingAudit(true);
    setAuditError(null);

    try {
      const response = await fetch('/api/cognitive-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: decisionTitle,
          description: decisionDescription,
          category,
          options
        })
      });

      if (!response.ok) {
        throw new Error('Audit request failed');
      }

      const data: CognitiveAuditResult = await response.json();
      setAuditData(data);
    } catch (err: any) {
      console.error(err);
      setAuditError('Could not run cognitive audit. Please verify Gemini backend connection.');
    } finally {
      setIsLoadingAudit(false);
    }
  };

  useEffect(() => {
    if (isOpen && !auditData && options.length > 0) {
      fetchAudit();
    }
  }, [isOpen, options]);

  // Inject a suggested missing scenario directly into the model
  const handleInjectScenario = (item: MissingScenarioItem, index: number) => {
    onAddScenario(item.optionId || item.optionTitle, {
      title: item.suggestedTitle,
      probability: item.suggestedProbability,
      utility: item.suggestedUtility
    });

    const key = `${item.optionTitle}-${item.suggestedTitle}-${index}`;
    setInjectedScenarios(prev => new Set(prev).add(key));
  };

  // Send Chat message
  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isSendingChat) return;

    const userText = chatInput.trim();
    setChatInput('');
    const newHistory = [...chatMessages, { role: 'user' as const, content: userText }];
    setChatMessages(newHistory);
    setIsSendingChat(true);

    try {
      const response = await fetch('/api/decision-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decisionTitle,
          options,
          userMessage: userText,
          conversationHistory: newHistory.slice(-6)
        })
      });

      if (!response.ok) {
        throw new Error('Chat failed');
      }

      const data = await response.json();
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      console.error(err);
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Apologies, I encountered an issue analyzing your request. Please try again.' }]);
    } finally {
      setIsSendingChat(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-xs transition-opacity"
        />

        {/* Sidebar Panel */}
        <motion.aside 
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 220 }}
          className="relative w-full max-w-md sm:max-w-lg bg-white dark:bg-[#0f0f11] border-l border-slate-200 dark:border-slate-800/80 shadow-2xl flex flex-col h-full z-10"
        >
          {/* Header */}
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-[#141417]/80 backdrop-blur-md sticky top-0 z-20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600/10 dark:bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Brain className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                    Decision Assistant
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                    Gemini 3.5
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Cognitive Debiasing & Scenario Auditor
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchAudit}
                disabled={isLoadingAudit}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Re-analyze model"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingAudit ? 'animate-spin text-indigo-500' : ''}`} />
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Close sidebar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="grid grid-cols-3 p-1.5 bg-slate-100 dark:bg-[#161619] border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400">
            <button
              onClick={() => setActiveTab('audit')}
              className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'audit' 
                  ? 'bg-white dark:bg-[#202024] text-indigo-600 dark:text-indigo-400 shadow-xs' 
                  : 'hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Bias Audit</span>
            </button>
            
            <button
              onClick={() => setActiveTab('frameworks')}
              className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'frameworks' 
                  ? 'bg-white dark:bg-[#202024] text-indigo-600 dark:text-indigo-400 shadow-xs' 
                  : 'hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Frameworks</span>
            </button>

            <button
              onClick={() => setActiveTab('chat')}
              className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'chat' 
                  ? 'bg-white dark:bg-[#202024] text-indigo-600 dark:text-indigo-400 shadow-xs' 
                  : 'hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>Ask AI</span>
            </button>
          </div>

          {/* Main Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            
            {/* TAB 1: COGNITIVE BIAS AUDIT */}
            {activeTab === 'audit' && (
              <div className="space-y-6">
                
                {/* Initial Loading state */}
                {isLoadingAudit && (
                  <div className="py-12 text-center space-y-3">
                    <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mx-auto" />
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Evaluating Decision Tree against Cognitive Frameworks...
                    </p>
                    <p className="text-xs text-slate-400">
                      Checking for Optimism Bias, Planning Fallacy, and Missing Scenarios.
                    </p>
                  </div>
                )}

                {/* Error state */}
                {auditError && !isLoadingAudit && (
                  <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 text-xs space-y-2">
                    <div className="flex items-center gap-2 font-bold">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Audit Unavailable</span>
                    </div>
                    <p>{auditError}</p>
                    <button
                      onClick={fetchAudit}
                      className="px-3 py-1 bg-rose-600 text-white font-semibold rounded-lg text-xs hover:bg-rose-700 cursor-pointer"
                    >
                      Retry Audit
                    </button>
                  </div>
                )}

                {/* Audit Content */}
                {!isLoadingAudit && auditData && (
                  <>
                    {/* Executive Diagnosis Banner */}
                    <div className="p-4 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/40 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">
                        <Sparkles className="w-4 h-4 text-indigo-500" />
                        <span>Cognitive Model Health Summary</span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans">
                        {auditData.summary}
                      </p>
                    </div>

                    {/* Section 1: Detected Cognitive Biases */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                          <span>Detected Cognitive Biases ({auditData.biasAudit?.length || 0})</span>
                        </h3>
                      </div>

                      {auditData.biasAudit && auditData.biasAudit.length > 0 ? (
                        <div className="space-y-3">
                          {auditData.biasAudit.map((bias, idx) => (
                            <div 
                              key={idx}
                              className="p-4 rounded-2xl bg-slate-50 dark:bg-[#141417] border border-slate-200 dark:border-slate-800 space-y-2.5 transition-all hover:border-slate-300 dark:hover:border-slate-700"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <span className="text-sm font-bold text-slate-900 dark:text-white block">
                                    {bias.biasType}
                                  </span>
                                  <span className="text-[11px] font-mono text-slate-400 block mt-0.5">
                                    Target: {bias.targetOptionOrScenario}
                                  </span>
                                </div>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide shrink-0 ${
                                  bias.severity === 'high' ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20' :
                                  bias.severity === 'medium' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20' :
                                  'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                                }`}>
                                  {bias.severity} risk
                                </span>
                              </div>

                              <div className="text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-[#1a1a1e] p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/80">
                                <span className="font-semibold text-slate-800 dark:text-slate-200 block mb-0.5">Observation:</span>
                                {bias.observation}
                              </div>

                              <div className="text-xs text-indigo-900 dark:text-indigo-200 bg-indigo-50/50 dark:bg-indigo-950/20 p-2.5 rounded-xl border border-indigo-100 dark:border-indigo-900/30 flex gap-2 items-start">
                                <Lightbulb className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-semibold block mb-0.5">Debiasing Strategy:</span>
                                  {bias.debiasingAdvice}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#141417] text-center border border-slate-200 dark:border-slate-800 text-xs text-slate-400">
                          No glaring cognitive biases detected. Your model exhibits balanced initial assumptions!
                        </div>
                      )}
                    </div>

                    {/* Section 2: Missing Scenarios & Blind Spots */}
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-indigo-500" />
                          <span>Suggested Missing Scenarios ({auditData.missingScenarios?.length || 0})</span>
                        </h3>
                      </div>

                      {auditData.missingScenarios && auditData.missingScenarios.length > 0 ? (
                        <div className="space-y-3">
                          {auditData.missingScenarios.map((item, idx) => {
                            const scenarioKey = `${item.optionTitle}-${item.suggestedTitle}-${idx}`;
                            const isAdded = injectedScenarios.has(scenarioKey);

                            return (
                              <div 
                                key={idx}
                                className="p-4 rounded-2xl bg-slate-50 dark:bg-[#141417] border border-slate-200 dark:border-slate-800 space-y-3"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">
                                      For: {item.optionTitle}
                                    </span>
                                    <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                                      {item.suggestedTitle}
                                    </h4>
                                  </div>

                                  <button
                                    onClick={() => handleInjectScenario(item, idx)}
                                    disabled={isAdded}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all ${
                                      isAdded 
                                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs shadow-indigo-600/20'
                                    }`}
                                  >
                                    {isAdded ? (
                                      <>
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        <span>Added</span>
                                      </>
                                    ) : (
                                      <>
                                        <Plus className="w-3.5 h-3.5" />
                                        <span>Add to Model</span>
                                      </>
                                    )}
                                  </button>
                                </div>

                                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                                  {item.reasoning}
                                </p>

                                <div className="flex items-center gap-4 text-xs font-mono text-slate-500 dark:text-slate-400 bg-white dark:bg-[#1a1a1e] p-2 rounded-xl border border-slate-200/60 dark:border-slate-800/60">
                                  <span>Suggested Prob: {(item.suggestedProbability * 100).toFixed(0)}%</span>
                                  <span>Utility: {item.suggestedUtility > 0 ? `+${item.suggestedUtility}` : item.suggestedUtility}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#141417] text-center border border-slate-200 dark:border-slate-800 text-xs text-slate-400">
                          No critical missing scenarios detected.
                        </div>
                      )}
                    </div>

                    {/* Section 3: Debiasing Reframing Questions */}
                    <div className="space-y-3 pt-2">
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <HelpCircle className="w-3.5 h-3.5 text-teal-500" />
                        <span>Debiasing Reframing Questions</span>
                      </h3>

                      <div className="space-y-2">
                        {auditData.reframingQuestions?.map((q, idx) => (
                          <div 
                            key={idx}
                            className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#141417] border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2.5"
                          >
                            <span className="font-bold text-indigo-500 shrink-0">{idx + 1}.</span>
                            <span className="leading-relaxed">{q}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* TAB 2: FRAMEWORKS REFERENCE */}
            {activeTab === 'frameworks' && (
              <div className="space-y-5">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#141417] border border-slate-200 dark:border-slate-800 space-y-2">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-indigo-500" />
                    <span>Cognitive Frameworks Guide</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Standard cognitive theories incorporated into your Gemini Decision Assistant to eliminate subjective bias and illogical probability assignments.
                  </p>
                </div>

                {/* Framework 1 */}
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#141417] space-y-1.5">
                  <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                    Reference Class Forecasting
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    Instead of relying solely on intuitive predictions (the "inside view"), evaluate how similar decisions played out historically across comparable cohorts (the "outside baseline").
                  </p>
                </div>

                {/* Framework 2 */}
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#141417] space-y-1.5">
                  <div className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                    Planning Fallacy & Optimism Bias
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    People naturally overestimate positive outcome speeds and success probabilities while ignoring execution friction, delay factors, or market volatility.
                  </p>
                </div>

                {/* Framework 3 */}
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#141417] space-y-1.5">
                  <div className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                    Pre-Mortem Failure Projection
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    Assume you are 3 years in the future and your chosen path completely failed. Working backward from total failure reveals hidden assumptions you would normally suppress.
                  </p>
                </div>

                {/* Framework 4 */}
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#141417] space-y-1.5">
                  <div className="text-xs font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider">
                    Prospect Theory & Loss Aversion
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    Psychologically, losses hurt roughly twice as much as equivalent gains feel good. The assistant helps ensure loss aversion doesn't trap you in low-growth options.
                  </p>
                </div>
              </div>
            )}

            {/* TAB 3: CHAT ASSISTANT */}
            {activeTab === 'chat' && (
              <div className="flex flex-col h-[520px]">
                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  {chatMessages.map((msg, index) => (
                    <div 
                      key={index}
                      className={`flex items-start gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      {msg.role === 'assistant' && (
                        <div className="w-7 h-7 rounded-lg bg-indigo-600/10 text-indigo-500 border border-indigo-500/20 flex items-center justify-center shrink-0">
                          <Bot className="w-4 h-4" />
                        </div>
                      )}

                      <div className={`p-3 rounded-2xl text-xs max-w-[82%] leading-relaxed ${
                        msg.role === 'user' 
                          ? 'bg-indigo-600 text-white font-sans rounded-tr-xs' 
                          : 'bg-slate-100 dark:bg-[#18181c] text-slate-800 dark:text-slate-200 rounded-tl-xs border border-slate-200/60 dark:border-slate-800/60'
                      }`}>
                        {msg.content}
                      </div>

                      {msg.role === 'user' && (
                        <div className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                          <User className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  ))}

                  {isSendingChat && (
                    <div className="flex items-center gap-2 text-xs text-slate-400 p-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                      <span>Gemini Assistant is analyzing...</span>
                    </div>
                  )}
                </div>

                <form onSubmit={handleSendChatMessage} className="mt-4 flex gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask about biases, probabilities..."
                    className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#141417] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                  <button
                    type="submit"
                    disabled={isSendingChat || !chatInput.trim()}
                    className="px-3 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            )}

          </div>
        </motion.aside>
      </div>
    </AnimatePresence>
  );
}
