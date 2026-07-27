import React, { useState, useEffect, useMemo } from 'react';
import { Decision } from '../types';
import { 
  Plus, 
  Search, 
  Lock, 
  Unlock, 
  TrendingUp, 
  Folder, 
  Trash2, 
  Calendar, 
  Sparkles, 
  Key,
  Shield,
  HelpCircle,
  FileSpreadsheet,
  LayoutGrid,
  FolderTree,
  Tag,
  ArrowUpDown,
  X,
  Check
} from 'lucide-react';
import { motion } from 'motion/react';
import { generateSaltHex } from '../lib/crypto';

interface DecisionDashboardProps {
  decisions: Decision[];
  onCreateDecision: (decisionData: Partial<Decision>, passphrase?: string) => void;
  onDeleteDecision: (id: string) => void;
  onSelectDecision: (decision: Decision) => void;
}

const BUILT_IN_CATEGORIES = [
  { value: 'career', label: 'Career & Work', icon: '💼' },
  { value: 'finance', label: 'Finance & Investments', icon: '💰' },
  { value: 'relationship', label: 'Relationships & Family', icon: '❤️' },
  { value: 'health', label: 'Health & Wellbeing', icon: '🌿' },
  { value: 'education', label: 'Education & Growth', icon: '🎓' },
  { value: 'general', label: 'General Choice', icon: '⚡' }
];

export default function DecisionDashboard({
  decisions,
  onCreateDecision,
  onDeleteDecision,
  onSelectDecision
}: DecisionDashboardProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'grouped'>('grid');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'title' | 'options'>('newest');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [customCategories, setCustomCategories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('weaver_custom_categories');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Save custom categories to localStorage whenever changed
  useEffect(() => {
    try {
      localStorage.setItem('weaver_custom_categories', JSON.stringify(customCategories));
    } catch (err) {
      console.error('Error saving custom categories:', err);
    }
  }, [customCategories]);
  
  // Create Form State
  const [creationMode, setCreationMode] = useState<'manual' | 'ai'>('manual');
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('general');
  const [isAddingInlineCategory, setIsAddingInlineCategory] = useState(false);
  const [inlineCategoryText, setInlineCategoryText] = useState('');
  const [isEncrypted, setIsEncrypted] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Dynamic merged category list (Built-in + Saved Custom + Categories present in decisions)
  const allCategoriesList = useMemo(() => {
    const list = [...BUILT_IN_CATEGORIES];
    const knownValues = new Set(list.map(c => c.value.toLowerCase()));

    // Add custom stored categories
    customCategories.forEach(custom => {
      const val = custom.trim();
      if (val && !knownValues.has(val.toLowerCase())) {
        knownValues.add(val.toLowerCase());
        list.push({ value: val, label: val, icon: '🏷️' });
      }
    });

    // Add categories present in decisions if missing
    decisions.forEach(d => {
      const cat = d.category?.trim();
      if (cat && !knownValues.has(cat.toLowerCase())) {
        knownValues.add(cat.toLowerCase());
        list.push({ value: cat, label: cat, icon: '🏷️' });
      }
    });

    return list;
  }, [customCategories, decisions]);

  const handleAddCustomCategory = (categoryName: string) => {
    const trimmed = categoryName.trim();
    if (!trimmed) return;
    
    // Check if exists
    const exists = allCategoriesList.some(c => c.value.toLowerCase() === trimmed.toLowerCase());
    if (!exists) {
      setCustomCategories(prev => [...prev, trimmed]);
    }
    setNewCategoryInput('');
    setShowAddCategoryModal(false);
    setSelectedCategory(trimmed);
  };

  const handleDeleteCustomCategory = (categoryValue: string) => {
    setCustomCategories(prev => prev.filter(c => c.toLowerCase() !== categoryValue.toLowerCase()));
    if (selectedCategory.toLowerCase() === categoryValue.toLowerCase()) {
      setSelectedCategory('all');
    }
  };

  const handleAIGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) {
      setError('Please enter a choice dilemma for Gemini AI.');
      return;
    }

    setIsGeneratingAI(true);
    setError(null);

    try {
      const response = await fetch('/api/generate-decision-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt.trim() })
      });

      if (!response.ok) {
        throw new Error('AI Generation failed');
      }

      const data = await response.json();

      const newDecision: Partial<Decision> = {
        title: data.title || aiPrompt,
        description: data.description || '',
        category: (data.category as Decision['category']) || 'general',
        isEncrypted,
        options: (data.options || []).map((opt: any, optIdx: number) => ({
          id: `opt_ai_${Date.now()}_${optIdx}`,
          title: opt.title,
          scenarios: (opt.scenarios || []).map((sc: any, scIdx: number) => ({
            id: `sc_ai_${Date.now()}_${optIdx}_${scIdx}`,
            title: sc.title,
            probability: typeof sc.probability === 'number' ? sc.probability : 0.25,
            utility: typeof sc.utility === 'number' ? sc.utility : 0
          }))
        })),
        createdAt: Date.now()
      };

      if (isEncrypted) {
        newDecision.salt = generateSaltHex();
      }

      onCreateDecision(newDecision, isEncrypted ? passphrase : undefined);

      // Reset
      setAiPrompt('');
      setShowCreateModal(false);
      setIsGeneratingAI(false);
    } catch (err: any) {
      console.error(err);
      setError('Could not auto-generate model with Gemini. Please check connection or try manual creation.');
      setIsGeneratingAI(false);
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide a decision title.');
      return;
    }
    if (isEncrypted && !passphrase.trim()) {
      setError('Please provide a secure passphrase for encryption.');
      return;
    }

    let finalCategory = category;
    if (isAddingInlineCategory) {
      if (!inlineCategoryText.trim()) {
        setError('Please type a custom category name or cancel.');
        return;
      }
      finalCategory = inlineCategoryText.trim();
      handleAddCustomCategory(finalCategory);
    }

    const newDecision: Partial<Decision> = {
      title,
      description,
      category: finalCategory,
      isEncrypted,
      options: [],
      createdAt: Date.now()
    };

    if (isEncrypted) {
      newDecision.salt = generateSaltHex();
    }

    onCreateDecision(newDecision, isEncrypted ? passphrase : undefined);
    
    // Reset Form
    setTitle('');
    setDescription('');
    setCategory('general');
    setIsAddingInlineCategory(false);
    setInlineCategoryText('');
    setIsEncrypted(false);
    setPassphrase('');
    setError(null);
    setShowCreateModal(false);
  };

  // Filter & Sort decisions
  const filteredDecisions = useMemo(() => {
    return decisions
      .filter(d => {
        const matchesSearch = d.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              d.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              (d.category || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === 'all' || (d.category || '').toLowerCase() === selectedCategory.toLowerCase();
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') return b.createdAt - a.createdAt;
        if (sortBy === 'oldest') return a.createdAt - b.createdAt;
        if (sortBy === 'title') return a.title.localeCompare(b.title);
        if (sortBy === 'options') return (b.options?.length || 0) - (a.options?.length || 0);
        return 0;
      });
  }, [decisions, searchTerm, selectedCategory, sortBy]);

  // Group decisions by category for grouped view mode
  const groupedDecisions = useMemo<Record<string, Decision[]>>(() => {
    const groups: Record<string, Decision[]> = {};
    filteredDecisions.forEach(d => {
      const catKey = d.category || 'general';
      if (!groups[catKey]) groups[catKey] = [];
      groups[catKey].push(d);
    });
    return groups;
  }, [filteredDecisions]);

  const getCategoryColor = (cat: string) => {
    switch ((cat || '').toLowerCase()) {
      case 'career': return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25';
      case 'finance': return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25';
      case 'relationship': return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25';
      case 'health': return 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/25';
      case 'education': return 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/25';
      case 'general': return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/25';
      default: {
        const palette = [
          'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25',
          'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/25',
          'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/25',
          'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/25',
          'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/25',
          'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/25',
        ];
        let hash = 0;
        for (let i = 0; i < (cat || '').length; i++) hash = cat.charCodeAt(i) + ((hash << 5) - hash);
        const index = Math.abs(hash) % palette.length;
        return palette[index];
      }
    }
  };

  const getCategoryLabel = (cat: string) => {
    const found = allCategoriesList.find(c => c.value.toLowerCase() === (cat || '').toLowerCase());
    return found ? found.label : cat;
  };

  const getCategoryIcon = (cat: string) => {
    const found = allCategoriesList.find(c => c.value.toLowerCase() === (cat || '').toLowerCase());
    return found ? found.icon : '🏷️';
  };

  return (
    <div id="decision-dashboard" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 font-sans">
      {/* Upper Grid Block: Actionable Welcome Call */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-indigo-500 dark:text-indigo-400 mb-1.5 block">Probabilistic Engine</span>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Decision Workspace
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Build probability trees, evaluate utilities, and execute Monte Carlo trials.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            id="open-ai-create-decision-modal"
            onClick={() => {
              setCreationMode('ai');
              setShowCreateModal(true);
            }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/35 cursor-pointer focus:outline-none"
          >
            <Sparkles className="w-4 h-4 animate-pulse" />
            <span>AI Auto-Build</span>
          </button>

          <button
            id="open-create-decision-modal"
            onClick={() => {
              setCreationMode('manual');
              setShowCreateModal(true);
            }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-[#1c1c1e] dark:hover:bg-[#2c2c2e] text-white font-semibold text-sm transition-all border border-slate-200 dark:border-slate-800 cursor-pointer focus:outline-none"
          >
            <Plus className="w-4 h-4" />
            <span>Manual Model</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar with View Mode & Custom Categories */}
      <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-3xl p-5 mb-8 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          {/* Search Input */}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              id="decision-search-input"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#050505]/50 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-sans"
              placeholder="Search decisions or categories..."
            />
          </div>

          {/* Controls: View Mode & Sorting */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-end">
            {/* Sort Selector */}
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-[#050505]/50 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-xl">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <select
                id="sort-decisions-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
              >
                <option value="newest" className="bg-white dark:bg-[#111111] text-slate-900 dark:text-slate-100">Newest First</option>
                <option value="oldest" className="bg-white dark:bg-[#111111] text-slate-900 dark:text-slate-100">Oldest First</option>
                <option value="title" className="bg-white dark:bg-[#111111] text-slate-900 dark:text-slate-100">Title A-Z</option>
                <option value="options" className="bg-white dark:bg-[#111111] text-slate-900 dark:text-slate-100">Most Options</option>
              </select>
            </div>

            {/* View Mode Toggle: Grid vs Grouped */}
            <div className="flex bg-slate-100 dark:bg-[#050505] p-1 rounded-xl border border-slate-200 dark:border-slate-800">
              <button
                id="view-mode-grid"
                type="button"
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-[#111111] text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Standard Grid View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Grid</span>
              </button>

              <button
                id="view-mode-grouped"
                type="button"
                onClick={() => setViewMode('grouped')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'grouped'
                    ? 'bg-white dark:bg-[#111111] text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Group decisions by category section"
              >
                <FolderTree className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Grouped</span>
              </button>
            </div>
          </div>
        </div>
        
        {/* Category tags horizontal scroller + Add Custom Category button */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none border-t border-slate-100 dark:border-slate-800/80 pt-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 shrink-0 mr-1 flex items-center gap-1">
            <Tag className="w-3 h-3" />
            Categories:
          </span>

          <button
            id="category-filter-all"
            onClick={() => setSelectedCategory('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all whitespace-nowrap cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-slate-900 dark:bg-indigo-600 text-white border-slate-900 dark:border-indigo-600 shadow-sm'
                : 'bg-slate-50 dark:bg-[#050505]/50 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-850'
            }`}
          >
            All Projects ({decisions.length})
          </button>

          {allCategoriesList.map((cat) => {
            const isCustom = !BUILT_IN_CATEGORIES.some(b => b.value === cat.value);
            const count = decisions.filter(d => (d.category || '').toLowerCase() === cat.value.toLowerCase()).length;
            const isSelected = selectedCategory.toLowerCase() === cat.value.toLowerCase();

            return (
              <div key={cat.value} className="relative group shrink-0 flex items-center">
                <button
                  id={`category-filter-${cat.value}`}
                  onClick={() => setSelectedCategory(cat.value)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-slate-900 dark:bg-indigo-600 text-white border-slate-900 dark:border-indigo-600 shadow-sm'
                      : 'bg-slate-50 dark:bg-[#050505]/50 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-850'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                  <span className="opacity-60 text-[10px]">({count})</span>
                </button>

                {isCustom && (
                  <button
                    id={`delete-custom-category-${cat.value}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCustomCategory(cat.value);
                    }}
                    className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-400 hover:text-rose-500 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                    title={`Delete custom category "${cat.label}"`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}

          {/* Add Custom Category Button */}
          <button
            id="open-add-category-modal"
            onClick={() => setShowAddCategoryModal(true)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-dashed border-indigo-300 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-all whitespace-nowrap cursor-pointer flex items-center gap-1 shrink-0 ml-1"
          >
            <Plus className="w-3 h-3" />
            <span>New Category</span>
          </button>
        </div>
      </div>

      {/* Grid vs Grouped View Render */}
      {filteredDecisions.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-slate-50 dark:bg-[#050505]/50 flex items-center justify-center text-slate-400 dark:text-slate-600 mx-auto mb-4 border border-slate-100 dark:border-slate-850">
            <Folder className="w-8 h-8 text-indigo-500" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">No decision models found</h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 max-w-sm mx-auto">
            {searchTerm || selectedCategory !== 'all' 
              ? "No decisions match your search filters or selected category. Try clearing some filters."
              : "Let's create your first probabilistic decision model. Think of a complex choice you need to weigh."}
          </p>
          {!searchTerm && selectedCategory === 'all' && (
            <button
              id="empty-state-create-button"
              onClick={() => setShowCreateModal(true)}
              className="mt-5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm hover:opacity-90 transition-opacity cursor-pointer shadow-md shadow-indigo-600/10"
            >
              Get Started
            </button>
          )}
        </div>
      ) : viewMode === 'grouped' ? (
        /* Grouped View Section */
        <div className="space-y-10">
          {(Object.entries(groupedDecisions) as [string, Decision[]][]).map(([catKey, categoryDecisions]) => (
            <div key={catKey} className="space-y-4">
              {/* Category Group Header */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">{getCategoryIcon(catKey)}</span>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight capitalize">
                    {getCategoryLabel(catKey)}
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {categoryDecisions.length} {categoryDecisions.length === 1 ? 'Model' : 'Models'}
                  </span>
                </div>
              </div>

              {/* Grid of decision cards for this category */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {categoryDecisions.map((decision) => (
                  <motion.div
                    id={`decision-card-${decision.id}`}
                    key={decision.id}
                    whileHover={{ y: -4 }}
                    className="group bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative cursor-pointer hover:border-indigo-500/40 dark:hover:border-indigo-500/40"
                    onClick={() => onSelectDecision(decision)}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border uppercase tracking-wider ${getCategoryColor(decision.category)}`}>
                          {getCategoryLabel(decision.category)}
                        </span>
                        
                        <div className="flex items-center gap-2">
                          {decision.isEncrypted ? (
                            <div className="flex items-center text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-500/25 p-1 rounded-md" title="Zero-Knowledge Client Encrypted">
                              <Lock className="w-3.5 h-3.5" />
                            </div>
                          ) : (
                            <div className="flex items-center text-slate-400 p-1" title="Plain text storage">
                              <Unlock className="w-3.5 h-3.5" />
                            </div>
                          )}
                          
                          <button
                            id={`delete-decision-${decision.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm('Are you absolutely sure you want to delete this decision model? This action is irreversible.')) {
                                onDeleteDecision(decision.id);
                              }
                            }}
                            className="text-slate-400 hover:text-rose-500 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Delete model"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">
                        {decision.title}
                      </h3>
                      
                      <p className="text-slate-500 dark:text-slate-400 text-sm mt-1.5 line-clamp-2 h-10 overflow-hidden leading-relaxed">
                        {decision.description || 'No description provided.'}
                      </p>
                    </div>

                    <div className="border-t border-slate-100 dark:border-slate-800 mt-5 pt-4 flex items-center justify-between text-xs text-slate-400 font-mono">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {new Date(decision.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                      
                      <span className="flex items-center gap-1.5 bg-slate-50 dark:bg-[#050505]/60 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-800">
                        <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
                        <span>{decision.options?.length || 0} Options</span>
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Standard Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDecisions.map((decision) => (
            <motion.div
              id={`decision-card-${decision.id}`}
              key={decision.id}
              whileHover={{ y: -4 }}
              className="group bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative cursor-pointer hover:border-indigo-500/40 dark:hover:border-indigo-500/40"
              onClick={() => onSelectDecision(decision)}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border uppercase tracking-wider ${getCategoryColor(decision.category)}`}>
                    {getCategoryLabel(decision.category)}
                  </span>
                  
                  <div className="flex items-center gap-2">
                    {decision.isEncrypted ? (
                      <div className="flex items-center text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-500/25 p-1 rounded-md" title="Zero-Knowledge Client Encrypted">
                        <Lock className="w-3.5 h-3.5" />
                      </div>
                    ) : (
                      <div className="flex items-center text-slate-400 p-1" title="Plain text storage">
                        <Unlock className="w-3.5 h-3.5" />
                      </div>
                    )}
                    
                    <button
                      id={`delete-decision-${decision.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('Are you absolutely sure you want to delete this decision model? This action is irreversible.')) {
                          onDeleteDecision(decision.id);
                        }
                      }}
                      className="text-slate-400 hover:text-rose-500 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Delete model"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">
                  {decision.title}
                </h3>
                
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1.5 line-clamp-2 h-10 overflow-hidden leading-relaxed">
                  {decision.description || 'No description provided.'}
                </p>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 mt-5 pt-4 flex items-center justify-between text-xs text-slate-400 font-mono">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {new Date(decision.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
                
                <span className="flex items-center gap-1.5 bg-slate-50 dark:bg-[#050505]/60 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-800">
                  <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
                  <span>{decision.options?.length || 0} Options</span>
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add Custom Category Modal */}
      {showAddCategoryModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-500">
                  <Tag className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Create Custom Category</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-xs">Organize decision models into tailored categories.</p>
                </div>
              </div>
              <button
                id="close-add-category-modal"
                onClick={() => setShowAddCategoryModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAddCustomCategory(newCategoryInput);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Category Name</label>
                <input
                  id="custom-category-input"
                  type="text"
                  value={newCategoryInput}
                  onChange={(e) => setNewCategoryInput(e.target.value)}
                  placeholder="e.g. Real Estate, Side Hustle, Venture..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#050505]/50 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  autoFocus
                  required
                />
              </div>

              <button
                id="submit-create-custom-category"
                type="submit"
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>Save Category</span>
              </button>
            </form>
          </motion.div>
        </div>
      )}

      {/* Create Decision Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl relative overflow-hidden"
          >
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Create Decision Model</h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">Specify your decision parameters, optionally locking it with zero-knowledge keys.</p>
              </div>
              <button
                id="close-create-modal"
                onClick={() => {
                  setShowCreateModal(false);
                  setError(null);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Creation Mode Tabs */}
            <div className="flex bg-slate-100 dark:bg-[#050505] p-1 rounded-2xl mb-6 border border-slate-200 dark:border-slate-800">
              <button
                id="tab-mode-ai"
                type="button"
                onClick={() => setCreationMode('ai')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  creationMode === 'ai'
                    ? 'bg-white dark:bg-[#111111] text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Instant Setup</span>
              </button>
              <button
                id="tab-mode-manual"
                type="button"
                onClick={() => setCreationMode('manual')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  creationMode === 'manual'
                    ? 'bg-white dark:bg-[#111111] text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Manual Assembly</span>
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 text-rose-600 dark:text-rose-400 text-xs flex gap-2">
                <Shield className="w-4 h-4 mt-0.5 text-rose-500" />
                <span>{error}</span>
              </div>
            )}

            {creationMode === 'ai' ? (
              <form onSubmit={handleAIGenerate} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Describe your dilemma</label>
                  <textarea
                    id="ai-prompt-input"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#050505]/50 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 h-28 resize-none"
                    placeholder="e.g. Should I accept an offer for $140k at an early-stage AI startup or stay at my stable corporate engineering manager position ($170k)?"
                    required
                  />
                  <p className="text-[11px] text-slate-400 mt-1.5 leading-normal">
                    Powered by <strong>Gemini 3.1 Flash-Lite</strong>. AI will construct your options, probability scenarios, and utility scores instantly.
                  </p>
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      id="ai-decision-encrypted-toggle"
                      type="checkbox"
                      checked={isEncrypted}
                      onChange={(e) => setIsEncrypted(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 w-4 h-4"
                    />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5 text-indigo-500" />
                      Zero-Knowledge Encrypt
                    </span>
                  </label>
                </div>

                {isEncrypted && (
                  <div className="p-3 rounded-xl border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/50 dark:bg-indigo-950/10 space-y-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Passphrase</label>
                    <input
                      id="ai-decision-passphrase"
                      type="password"
                      value={passphrase}
                      onChange={(e) => setPassphrase(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      placeholder="Enter a private decryption key..."
                      required
                    />
                  </div>
                )}

                <button
                  id="submit-ai-create-decision"
                  type="submit"
                  disabled={isGeneratingAI}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-violet-600 text-white font-bold text-sm hover:opacity-95 transition-all cursor-pointer flex justify-center items-center gap-2 shadow-lg shadow-indigo-600/15"
                >
                  {isGeneratingAI ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Synthesizing Model...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Generate Model with Gemini</span>
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Decision Title</label>
                <input
                  id="new-decision-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#050505]/50 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  placeholder="Should I move to Munich for the Senior role?"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Context / Details</label>
                <textarea
                  id="new-decision-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#050505]/50 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 h-20 resize-none"
                  placeholder="Summarize the core trade-offs, timelines, and primary anxieties..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Category</label>
                    <button
                      id="toggle-inline-custom-category"
                      type="button"
                      onClick={() => setIsAddingInlineCategory(!isAddingInlineCategory)}
                      className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                    >
                      {isAddingInlineCategory ? 'Select Existing' : '+ New Category'}
                    </button>
                  </div>

                  {isAddingInlineCategory ? (
                    <input
                      id="inline-custom-category-input"
                      type="text"
                      value={inlineCategoryText}
                      onChange={(e) => setInlineCategoryText(e.target.value)}
                      placeholder="e.g. Travel, Side Hustle..."
                      className="w-full px-3 py-2 rounded-xl border border-indigo-300 dark:border-indigo-800 bg-slate-50 dark:bg-[#050505]/50 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      required
                    />
                  ) : (
                    <select
                      id="new-decision-category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#050505]/50 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    >
                      {allCategoriesList.map(c => (
                        <option key={c.value} value={c.value} className="bg-white dark:bg-[#111111] text-slate-900 dark:text-slate-100">
                          {c.icon} {c.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2.5 cursor-pointer py-2 px-1">
                    <input
                      id="new-decision-encrypted-toggle"
                      type="checkbox"
                      checked={isEncrypted}
                      onChange={(e) => setIsEncrypted(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 w-4.5 h-4.5"
                    />
                    <div className="flex items-center gap-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <Lock className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Zero-Knowledge Encrypt</span>
                    </div>
                  </label>
                </div>
              </div>

              {isEncrypted && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/50 dark:bg-indigo-950/10 space-y-3"
                >
                  <div className="flex gap-2 items-start text-[11px] text-indigo-700 dark:text-indigo-400">
                    <Key className="w-4 h-4 shrink-0 mt-0.5 text-indigo-500" />
                    <span>
                      Decisions are encrypted client-side using PBKDF2 + AES-GCM 256. <strong>Your passphrase is never sent to our servers.</strong> If lost, the decision data cannot be decrypted.
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Passphrase</label>
                    <input
                      id="new-decision-passphrase"
                      type="password"
                      value={passphrase}
                      onChange={(e) => setPassphrase(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      placeholder="Enter a private decryption key..."
                      required
                    />
                  </div>
                </motion.div>
              )}

              <button
                id="submit-create-decision"
                type="submit"
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm hover:opacity-90 transition-opacity cursor-pointer flex justify-center items-center shadow-md shadow-indigo-600/10"
              >
                Assemble Model
              </button>
            </form>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}
