/**
 * Core type definitions for the Probabilistic Decision Weaver application.
 */

export interface Scenario {
  id: string;
  title: string; // May be encrypted if IsEncrypted is true
  probability: number; // 0.0 to 1.0 (Sum of probabilities of a single option's scenarios doesn't strictly have to equal 1 if independent, but expected value calculates EV sum. We will validate/normalize or display warning)
  utility: number; // -100 to +100 representing utility/satisfaction value
}

export interface Option {
  id: string;
  title: string; // May be encrypted if IsEncrypted is true
  scenarios: Scenario[];
}

export interface Decision {
  id: string;
  userId: string;
  title: string; // Encrypted or plain text
  description: string; // Encrypted or plain text
  category: 'career' | 'finance' | 'relationship' | 'health' | 'education' | 'general' | (string & {});
  options: Option[];
  createdAt: number;
  updatedAt?: number;
  isEncrypted: boolean;
  
  // Cryptographic parameters for AES-GCM encryption
  salt?: string; // Hex/Base64 string of the salt used for key derivation
  iv?: string;   // Hex/Base64 string of the initialization vector
}

export interface SimulationResult {
  optionId: string;
  optionTitle: string;
  expectedValue: number;
  stdDev: number;
  riskOfRegret: number; // Probability of utility < 0 (%)
  greatOutcomeProb: number; // Probability of utility >= 50 (%)
  minVal: number;
  maxVal: number;
  distribution: { bin: string; count: number; value: number }[]; // Histogram bins for charting
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}
