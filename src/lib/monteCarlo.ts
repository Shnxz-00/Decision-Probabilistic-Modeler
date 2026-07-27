import { Option, Scenario, SimulationResult } from '../types';

/**
 * Standard normal distribution generator using Box-Muller transform
 */
function randomNormal(mean: number, stdDev: number): number {
  const u1 = Math.random() || 0.0001; // Avoid 0
  const u2 = Math.random();
  const randStdNormal = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return mean + stdDev * randStdNormal;
}

/**
 * Run a Monte Carlo simulation for a given list of options.
 * Defaults to Mutually Exclusive scenarios where exactly one scenario is selected per trial.
 * Adds random unmodeled noise to create continuous distributions.
 */
export function runMonteCarlo(
  options: Option[],
  iterations: number = 10000,
  noiseStdDev: number = 5 // Minor noise to smooth out discrete outputs
): SimulationResult[] {
  return options.map(option => {
    const { id: optionId, title: optionTitle, scenarios } = option;

    if (scenarios.length === 0) {
      return {
        optionId,
        optionTitle,
        expectedValue: 0,
        stdDev: 0,
        riskOfRegret: 0,
        greatOutcomeProb: 0,
        minVal: 0,
        maxVal: 0,
        distribution: Array.from({ length: 20 }, (_, i) => ({
          bin: `${-100 + i * 10} to ${-90 + i * 10}`,
          count: 0,
          value: -100 + i * 10 + 5,
        })),
      };
    }

    // Prepare probability boundaries for Mutually Exclusive sampling
    let probSum = scenarios.reduce((sum, s) => sum + s.probability, 0);
    const normalizedScenarios = scenarios.map(s => ({
      ...s,
      // If sum of probabilities is > 1 or < 1, we can handle it
      normProb: probSum > 0 ? s.probability / Math.max(probSum, 1) : 0,
    }));

    // If probSum is < 1, there is a remaining chance of "no scenario/baseline"
    const baselineProb = Math.max(0, 1 - probSum);

    const trials: number[] = [];
    let regretCount = 0;
    let greatCount = 0;

    for (let t = 0; t < iterations; t++) {
      let selectedUtility = 0;
      const rand = Math.random();

      // mutually exclusive sampling
      let cumProb = 0;
      let selected = false;

      for (const s of normalizedScenarios) {
        cumProb += s.normProb * (probSum > 1 ? 1 : probSum); // scale accordingly
        if (rand <= cumProb) {
          selectedUtility = s.utility;
          selected = true;
          break;
        }
      }

      // If no scenario selected (due to probability sum < 1), utility is 0 (baseline)
      if (!selected) {
        selectedUtility = 0;
      }

      // Add normal distribution noise to simulate unmodeled variables
      const finalUtility = Math.max(-100, Math.min(100, randomNormal(selectedUtility, noiseStdDev)));
      trials.push(finalUtility);

      if (finalUtility < 0) {
        regretCount++;
      }
      if (finalUtility >= 50) {
        greatCount++;
      }
    }

    // Sort trials to calculate stats
    trials.sort((a, b) => a - b);
    const sum = trials.reduce((s, val) => s + val, 0);
    const mean = sum / iterations;

    const sqDiffSum = trials.reduce((s, val) => s + Math.pow(val - mean, 2), 0);
    const stdDev = Math.sqrt(sqDiffSum / iterations);

    const minVal = trials[0];
    const maxVal = trials[iterations - 1];

    // Generate histogram data: 20 bins from -100 to 100 (each bin covers 10 units)
    const binCount = 20;
    const bins = Array.from({ length: binCount }, (_, i) => {
      const start = -100 + i * 10;
      const end = start + 10;
      return {
        bin: `${start} to ${end}`,
        count: 0,
        value: start + 5, // Midpoint for charting
      };
    });

    trials.forEach(val => {
      let binIdx = Math.floor((val + 100) / 10);
      if (binIdx < 0) binIdx = 0;
      if (binIdx >= binCount) binIdx = binCount - 1;
      bins[binIdx].count++;
    });

    return {
      optionId,
      optionTitle,
      expectedValue: parseFloat(mean.toFixed(2)),
      stdDev: parseFloat(stdDev.toFixed(2)),
      riskOfRegret: parseFloat(((regretCount / iterations) * 100).toFixed(1)),
      greatOutcomeProb: parseFloat(((greatCount / iterations) * 100).toFixed(1)),
      minVal: parseFloat(minVal.toFixed(1)),
      maxVal: parseFloat(maxVal.toFixed(1)),
      distribution: bins,
    };
  });
}

/**
 * Calculates static expected value (EV) of an option without any Monte Carlo simulation
 */
export function calculateStaticEV(scenarios: Scenario[]): number {
  if (scenarios.length === 0) return 0;
  
  let ev = 0;
  let totalProb = 0;
  
  scenarios.forEach(s => {
    ev += s.probability * s.utility;
    totalProb += s.probability;
  });
  
  // If sum of probabilities is less than 1, remaining goes to 0 utility
  return parseFloat(ev.toFixed(2));
}
