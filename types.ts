
export enum ConnectionStatus {
  DISCONNECTED = 'DISCONNECTED',
  BRIEFING = 'BRIEFING',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ANALYZING = 'ANALYZING',
  ERROR = 'ERROR'
}

export type AppLanguage = 'cn' | 'en';

export interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  text: string;
  isPartial?: boolean;
  isHint?: boolean;
  baseText?: string; // New field to store committed text when merging turns
}

export type FlightPhase = 
  | 'Ground Ops' 
  | 'Takeoff & Climb' 
  | 'Cruise & Enroute' 
  | 'Descent & Approach' 
  | 'Landing & Taxi in' 
  | 'Go-around & Diversion';

export enum DifficultyLevel {
  LEVEL_3_TO_4 = 'ICAO Level 3 → 4 (Upgrade)',
  LEVEL_4_RECURRENT = 'ICAO Level 4 (Recurrent)',
  LEVEL_4_TO_5 = 'ICAO Level 4 → 5 (Upgrade)',
  LEVEL_5_TO_6 = 'ICAO Level 5 → 6 (Examiner)'
}

export interface Scenario {
  id: string;
  title: string;
  details: string;
  weather: string;
  callsign: string;
  category?: string;
  phase?: FlightPhase;
  difficulty_level?: 'Easy' | 'Medium' | 'Hard' | 'Extreme'; // New field from DB
}

export type Tab = 'home' | 'training' | 'assessment' | 'profile';

// Sub-interfaces for the Detailed Report
export interface ExecutiveSummary {
  assessment: string;
  safetyMargin: string;
  frictionPoints: string;
}

export interface DeepAnalysisItem {
  context: string;
  issue: string;
  theory: string;
  rootCause: string;
  correction: string;
}

export interface AssessmentData {
  // Scores
  overallScore: number;
  pronunciation: number;
  structure: number;
  vocabulary: number;
  fluency: number;
  comprehension: number;
  interactions: number;

  // New Structured Data
  executiveSummary: ExecutiveSummary;
  dimensionalDetails: {
    pronunciation: string;
    structure: string;
    vocabulary: string;
    fluency: string;
    comprehension: string;
    interactions: string;
  };
  deepAnalysis: DeepAnalysisItem[];
  remedialPlan: string[]; // List of actionable advice
  
  // Backward compatibility
  feedback?: string;
  
  // Context Injection
  scenarioTitle?: string;
}
