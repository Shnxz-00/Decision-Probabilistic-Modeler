import React, { useState, useEffect } from 'react';
import { Option, Scenario } from '../types';
import { 
  Sliders, 
  RotateCcw, 
  Check, 
  TrendingUp, 
  AlertCircle, 
  Sparkles, 
  BarChart2, 
  ArrowRight, 
  Zap,
  Percent,
  Layers
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell, 
  ReferenceLine 
} from 'recharts';
import { motion } from 'motion/react';

interface ProbabilitySensitivityPlaygroundProps {
  options: Option[];
  onUpdateOptionProbabilities: (optionId: string, updatedScenarios: Scenario[]) => void;
}

interface LocalScenarioState {
  id: string;
  title: string;
  probability: number; // Decimal 0..1
  utility: number;
}

export default function ProbabilitySensitivityPlayground({
  options,
  onUpdateOptionProbabilities
}: ProbabilitySensitivityPlaygroundProps) {
  const [selectedOptionId, setSelectedOptionId] = useState<string>(options[0]?.id || '');
  
  // Local editable copy of scenarios per option: { [optionId]: LocalScenarioState[] }
  const [localScenariosMap, setLocalScenariosMap] = useState<Record<string, LocalScenarioState[]>>({});
  const [hasAppliedChanges, setHasAppliedChanges] = useState<Record<string, boolean>>({});

  // Sync with incoming options props on mount or option change
  useEffect(() => {
    if (options.length > 0) {
      if (!selectedOptionId || !options.find(o => o.id === selectedOptionId)) {
        setSelectedOptionId(options[0].id);
      }

      const map: Record<string, LocalScenarioState[]> = {};
      options.forEach(opt => {
        map[opt.id] = opt.scenarios.map(s => ({
          id: s.id,
          title: s.title,
          probability: s.probability,
          utility: s.utility
        }));
      });
      setLocalScenariosMap(map);
    }
  }, [options]);

  const currentOption = options.find(o => o.id === selectedOptionId);
  const currentScenarios = localScenariosMap[selectedOptionId] || [];

  // Calculate real-time Expected Value for an array of scenarios
  const calculateEV = (scenarios: LocalScenarioState[]) => {
    if (!scenarios || scenarios.length === 0) return 0;
    const rawSum = scenarios.reduce((acc, s) => acc + (s.probability * s.utility), 0);
    return Math.round(rawSum * 10) / 10;
  };

  // Calculate total probability sum
  const totalProb = currentScenarios.reduce((acc, s) => acc + s.probability, 0);

  // Update probability for a single scenario in local state
  const handleSliderChange = (scenarioId: string, newProbPercent: number) => {
    const decimalProb = Math.max(0, Math.min(1, newProbPercent / 100));
    setLocalScenariosMap(prev => {
      const optionScenarios = prev[selectedOptionId] || [];
      const updated = optionScenarios.map(s => {
        if (s.id === scenarioId) {
          return { ...s, probability: Math.round(decimalProb * 100) / 100 };
        }
        return s;
      });
      return { ...prev, [selectedOptionId]: updated };
    });

    setHasAppliedChanges(prev => ({ ...prev, [selectedOptionId]: false }));
  };

  // Normalize probabilities to sum exactly to 100%
  const handleNormalize = () => {
    if (totalProb === 0 || currentScenarios.length === 0) return;

    setLocalScenariosMap(prev => {
      const optionScenarios = prev[selectedOptionId] || [];
      const updated = optionScenarios.map(s => ({
        ...s,
        probability: Math.round((s.probability / totalProb) * 100) / 100
      }));
      return { ...prev, [selectedOptionId]: updated };
    });
  };

  // Reset local state to original model scenarios
  const handleReset = () => {
    if (!currentOption) return;
    setLocalScenariosMap(prev => ({
      ...prev,
      [selectedOptionId]: currentOption.scenarios.map(s => ({
        id: s.id,
        title: s.title,
        probability: s.probability,
        utility: s.utility
      }))
    }));
    setHasAppliedChanges(prev => ({ ...prev, [selectedOptionId]: false }));
  };

  // Apply changes to parent model
  const handleApplyToModel = () => {
    if (!selectedOptionId) return;
    const updated = (localScenariosMap[selectedOptionId] || []).map(s => ({
      id: s.id,
      title: s.title,
      probability: s.probability,
      utility: s.utility
    }));

    onUpdateOptionProbabilities(selectedOptionId, updated);
    setHasAppliedChanges(prev => ({ ...prev, [selectedOptionId]: true }));
  };

  // Prepare chart data comparing static baseline EV vs real-time sensitivity EV across options
  const chartData = options.map(opt => {
    const isSelected = opt.id === selectedOptionId;
    const activeScenarios = isSelected ? (localScenariosMap[opt.id] || opt.scenarios) : (localScenariosMap[opt.id] || opt.scenarios);
    const baselineEV = opt.scenarios.reduce((acc, s) => acc + (s.probability * s.utility), 0);
    const sensitivityEV = activeScenarios.reduce((acc, s) => acc + (s.probability * s.utility), 0);

    return {
      name: opt.title,
      id: opt.id,
      baselineEV: Math.round(baselineEV * 10) / 10,
      sensitivityEV: Math.round(sensitivityEV * 10) / 10,
      isSelected
    };
  });

  if (options.length === 0) {
    return (
      <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 text-center text-xs text-slate-400">
        Add options and outcome scenarios to unlock the Interactive Probability Sensitivity Playground.
      </div>
    );
  }

  const currentEV = calculateEV(currentScenarios);

  return (
    <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
              <Sliders className="w-5 h-5" />
            </div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
              Interactive Probability Sensitivity
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              Real-time EV Playground
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Drag scenario probability sliders to test how outcome likelihoods alter your Expected Value in real time.
          </p>
        </div>

        {/* Option Selector Pill Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {options.map(opt => (
            <button
              key={opt.id}
              onClick={() => setSelectedOptionId(opt.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                opt.id === selectedOptionId
                  ? 'bg-indigo-600 text-white shadow-xs shadow-indigo-600/30'
                  : 'bg-slate-100 dark:bg-[#1c1c20] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {opt.title}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Sliders Left (Span 7) & Live Chart Right (Span 5) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Sliders for selected option */}
        <div className="lg:col-span-7 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Active Option
              </span>
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                {currentOption?.title}
              </h4>
            </div>

            <div className="flex items-center gap-2">
              {Math.round(totalProb * 100) !== 100 && (
                <button
                  onClick={handleNormalize}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors cursor-pointer flex items-center gap-1"
                  title="Scale probabilities to sum to 100%"
                >
                  <Percent className="w-3 h-3" />
                  <span>Normalize ({Math.round(totalProb * 100)}%)</span>
                </button>
              )}

              <button
                onClick={handleReset}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Reset sliders to baseline"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {currentScenarios.length === 0 ? (
            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-[#08080a] border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
              No outcome branches found for this option. Add scenarios above to adjust probabilities.
            </div>
          ) : (
            <div className="space-y-4">
              {currentScenarios.map(sc => {
                const probPercent = Math.round(sc.probability * 100);
                const evContrib = Math.round((sc.probability * sc.utility) * 10) / 10;

                return (
                  <div 
                    key={sc.id}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-[#141417] border border-slate-200 dark:border-slate-800 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-slate-900 dark:text-white block">
                          {sc.title}
                        </span>
                        <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400 mt-0.5">
                          <span>Utility: {sc.utility > 0 ? `+${sc.utility}` : sc.utility}</span>
                          <span>EV Contrib: <strong className="text-indigo-600 dark:text-indigo-400">{evContrib > 0 ? `+${evContrib}` : evContrib}</strong></span>
                        </div>
                      </div>

                      <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-white dark:bg-[#1f1f24] border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 shrink-0">
                        {probPercent}%
                      </span>
                    </div>

                    {/* Interactive Drag Slider */}
                    <div className="space-y-1">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value={probPercent}
                        onChange={(e) => handleSliderChange(sc.id, parseInt(e.target.value, 10))}
                        className="w-full h-2 rounded-lg accent-indigo-600 bg-slate-200 dark:bg-slate-700 cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                        <span>0% (Impossible)</span>
                        <span>50%</span>
                        <span>100% (Certain)</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Action Bar */}
          <div className="flex items-center justify-between pt-2">
            <div className="text-xs font-mono text-slate-400">
              Total Probability: <strong className={Math.round(totalProb * 100) === 100 ? 'text-emerald-500' : 'text-amber-500'}>
                {Math.round(totalProb * 100)}%
              </strong>
            </div>

            <button
              onClick={handleApplyToModel}
              disabled={hasAppliedChanges[selectedOptionId]}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                hasAppliedChanges[selectedOptionId]
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 active:scale-98'
              }`}
            >
              {hasAppliedChanges[selectedOptionId] ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Saved to Decision Model</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Apply Sensitivity to Model</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Live Recharts EV Comparison */}
        <div className="lg:col-span-5 bg-slate-50 dark:bg-[#0e0e11] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4">
          
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <BarChart2 className="w-3.5 h-3.5 text-indigo-500" />
                <span>Live Expected Value (EV)</span>
              </span>

              <div className="text-right">
                <span className="text-[10px] text-slate-400 block font-mono">Sensitivity EV</span>
                <span className="text-base font-extrabold font-mono text-indigo-600 dark:text-indigo-400">
                  {currentEV > 0 ? `+${currentEV}` : currentEV}
                </span>
              </div>
            </div>

            {/* Recharts Bar Chart comparing options */}
            <div className="h-[220px] w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 10, fill: '#888' }} 
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis tick={{ fontSize: 10, fill: '#888' }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#18181b', 
                      borderColor: '#27272a', 
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '11px'
                    }}
                    formatter={(value: any) => [`${value > 0 ? '+' : ''}${value}`, 'Expected Value']}
                  />
                  <ReferenceLine y={0} stroke="#444" strokeDasharray="3 3" />
                  <Bar dataKey="sensitivityEV" radius={[6, 6, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={
                          entry.isSelected 
                            ? '#6366f1' 
                            : entry.sensitivityEV >= 0 ? '#38bdf8' : '#f43f5e'
                        } 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Sensitivity Insights Badge */}
          <div className="p-3.5 rounded-xl bg-white dark:bg-[#141417] border border-slate-200/80 dark:border-slate-800 text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Sensitivity Analysis</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              In decision theory, scenarios with extreme utility (+80 or -80) create the steepest EV slope. Modifying their probability yields the highest payoff change per percentage shift.
            </p>
          </div>

        </div>

      </div>

    </div>
  );
}
