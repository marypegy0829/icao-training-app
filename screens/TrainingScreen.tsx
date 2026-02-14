
import React, { useState, useRef, useEffect } from 'react';
import { LiveClient } from '../services/liveClient';
import { SCENARIO_CATEGORIES, ScenarioCategory } from '../services/trainingData';
import { scenarioService } from '../services/scenarioService';
import { airportService, Airport } from '../services/airportService';
import { ConnectionStatus, ChatMessage, AssessmentData, Scenario, FlightPhase, DifficultyLevel } from '../types';
import Visualizer from '../components/Visualizer';
import CockpitDisplay from '../components/CockpitDisplay';
import Transcript from '../components/Transcript';
import AssessmentReport from '../components/AssessmentReport';
import HistoryModal from '../components/HistoryModal';
import { userService } from '../services/userService';
import { useWakeLock } from '../hooks/useWakeLock';

// UPDATED: 6-Stage Logical Phases
const PHASES: FlightPhase[] = [
  'Ground Ops',
  'Takeoff & Climb',
  'Cruise & Enroute',
  'Descent & Approach',
  'Landing & Taxi in',
  'Go-around & Diversion'
];

interface TrainingScreenProps {
    initialScenario?: Scenario | null;
    onConsumeScenario?: () => void;
    difficulty: DifficultyLevel;
    accentEnabled: boolean;
    cockpitNoise: boolean; 
}

const TrainingScreen: React.FC<TrainingScreenProps> = ({ 
    initialScenario, 
    onConsumeScenario, 
    difficulty, 
    accentEnabled, 
    cockpitNoise 
}) => {
  // Navigation State
  const [view, setView] = useState<'dashboard' | 'session'>('dashboard');
  
  // Selection State
  const [selectedPhase, setSelectedPhase] = useState<FlightPhase | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ScenarioCategory | null>(null);
  const [airportCode, setAirportCode] = useState<string>('');
  
  // Airport Search State
  const [searchResults, setSearchResults] = useState<Airport[]>([]);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Data State
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loadingScenarios, setLoadingScenarios] = useState(true);

  // Session State
  const [activeScenario, setActiveScenario] = useState<Scenario | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  
  // NEW: Track status in ref to avoid closure staleness and TS type narrowing issues in callbacks
  const statusRef = useRef<ConnectionStatus>(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // --- PREVENT SCREEN SLEEP ---
  const isSessionActive = status === ConnectionStatus.CONNECTING || status === ConnectionStatus.CONNECTED || status === ConnectionStatus.ANALYZING;
  useWakeLock(isSessionActive);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [assessment, setAssessment] = useState<AssessmentData | null>(null);
  const [showHistory, setShowHistory] = useState(false); 
  const startTimeRef = useRef<number>(0);
  
  // PTT State
  const [isPttEnabled, setIsPttEnabled] = useState(false);
  const [isTransmitting, setIsTransmitting] = useState(false);

  const liveClientRef = useRef<LiveClient | null>(null);

  // Get API KEY safely with Override
  const getApiKey = () => {
    const localKey = localStorage.getItem('gemini_api_key');
    if (localKey && localKey.trim().length > 0) return localKey.trim();

    let key = '';
    try {
      const meta = import.meta as any;
      if (meta.env && meta.env.VITE_API_KEY) {
        key = meta.env.VITE_API_KEY;
      }
    } catch (e) {}
    
    if (!key && typeof process !== 'undefined' && process.env) {
      key = process.env.VITE_API_KEY || process.env.API_KEY || '';
    }
    return key.trim();
  };

  const API_KEY = getApiKey();

  // --- Effects for Session ---

  useEffect(() => {
    // Load Scenarios
    const loadScenarios = async () => {
        setLoadingScenarios(true);
        const data = await scenarioService.getAllScenarios();
        setScenarios(data);
        setLoadingScenarios(false);
    };
    loadScenarios();

    return () => {
      liveClientRef.current?.disconnect();
    };
  }, []);

  // Handle Airport Search
  useEffect(() => {
      const delayDebounce = setTimeout(async () => {
          if (airportCode.length >= 2) {
             const results = await airportService.searchAirports(airportCode);
             setSearchResults(results);
             setShowResults(true);
          } else {
             setSearchResults([]);
             setShowResults(false);
          }
      }, 300);
      return () => clearTimeout(delayDebounce);
  }, [airportCode]);

  // Click outside to close dropdown
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
              setShowResults(false);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle Initial Scenario Auto-Start
  useEffect(() => {
      if (initialScenario) {
          startTraining(initialScenario);
          if (onConsumeScenario) onConsumeScenario();
      }
  }, [initialScenario]);

  // Safety Timeout for Analysis (Same as AssessmentScreen)
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    if (status === ConnectionStatus.ANALYZING) {
      timeoutId = setTimeout(() => {
        setErrorMsg("分析超时，请重试。");
        setStatus(ConnectionStatus.ERROR);
        liveClientRef.current?.disconnect();
      }, 60000);
    }
    return () => clearTimeout(timeoutId);
  }, [status]);


  // Keyboard PTT
  useEffect(() => {
    if (view !== 'session') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && isPttEnabled && status === ConnectionStatus.CONNECTED) {
        if (!isTransmitting) {
          setIsTransmitting(true);
          liveClientRef.current?.setInputMuted(false);
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && isPttEnabled && status === ConnectionStatus.CONNECTED) {
        setIsTransmitting(false);
        liveClientRef.current?.setInputMuted(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isPttEnabled, status, isTransmitting, view]);

  // --- Actions ---

  // FIX: Accept scenario explicitly to avoid closure state traps
  const saveToSupabase = async (finalAssessment: AssessmentData | null, targetScenario: Scenario | null) => {
      // Use the passed targetScenario if available, otherwise fall back to state (for handleStop case)
      const scenarioToSave = targetScenario || activeScenario;
      
      if (!scenarioToSave) {
          console.warn("Cannot save session: No scenario context.");
          return;
      }

      console.log("Saving training session...", finalAssessment ? "With Report" : "No Report");
      const durationSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
      
      try {
          const result = await userService.saveSession(
              scenarioToSave.title,
              scenarioToSave.phase || 'General',
              finalAssessment,
              durationSeconds,
              'TRAINING' // Explicitly mark as Training
          );
          if (!result.success) {
              console.error("Training Save Failed:", result.error);
          } else {
              console.log("Training Session Saved Successfully");
          }
      } catch (e) {
          console.error("Training Save Exception:", e);
      }
  };

  const handleReconnect = async () => {
    if (activeScenario) {
       startTraining(activeScenario);
    } else {
       setView('dashboard');
    }
  };

  const startTraining = async (scenario: Scenario) => {
    if (!API_KEY) {
       alert("API Key missing. Please check settings.");
       return;
    }
    setActiveScenario(scenario);
    setView('session');
    setStatus(ConnectionStatus.CONNECTING);
    // Don't clear messages on reconnect if it's a resume-like action
    if (status !== ConnectionStatus.ERROR) {
       setMessages([]);
    }
    
    setAssessment(null);
    setErrorMsg(null);
    startTimeRef.current = Date.now();

    liveClientRef.current = new LiveClient(API_KEY);
    liveClientRef.current.setInputMuted(isPttEnabled);

    // COACHING INSTRUCTION WITH EXPLICIT REPORT TRIGGER
    const coachingInstruction = `
    # SYSTEM INSTRUCTION: FLIGHT INSTRUCTOR (COACHING MODE)
    The user is a pilot trainee. You are an ATC Instructor.
    
    Current Scenario: ${scenario.title} (${scenario.category})
    Phase: ${scenario.phase}
    Details: ${scenario.details}
    Weather: ${scenario.weather}
    
    1. Act as profesional ATC initially.
    2. *** HINT FEATURE ***: If the user sends a text message "REQUEST_HINT", you must BREAK CHARACTER.
       - Provide a short, direct tip on correct ICAO phraseology or procedure in English.
       - Prefix the hint with "💡 COACH: ".
       - Then immediately resume ATC character in the next sentence.
       
    3. *** CRITICAL: SESSION END & ASSESSMENT ***
       When you receive the system command "TERMINATE_SESSION_IMMEDIATELY", or if the user says "Training Finished":
       - STOP acting as ATC/Coach.
       - You MUST call the 'reportAssessment' tool.
       - You MUST evaluate the trainee on ALL 6 DIMENSIONS: Pronunciation, Structure, Vocabulary, Fluency, Comprehension, Interactions.
       - Provide a "Quick Assessment" in the report. Be concise but cover all 6 points.
    `;

    // Pass difficulty, airport, accent, AND NOISE SETTING
    await liveClientRef.current.connect(scenario, {
      onOpen: () => {
          setStatus(ConnectionStatus.CONNECTED);
          startTimeRef.current = Date.now(); // Reset start time on actual connection
      },
      onClose: () => {
         if (statusRef.current === ConnectionStatus.ANALYZING) {
             return;
         }
         if (statusRef.current !== ConnectionStatus.ERROR) {
             setView('dashboard');
             setStatus(ConnectionStatus.DISCONNECTED);
         }
      },
      onError: (err) => {
          setStatus(ConnectionStatus.ERROR);
          setErrorMsg(err.message);
      },
      onAudioData: (level) => setAudioLevel(level),
      onTurnComplete: () => setAudioLevel(0),
      onTranscript: (text, role, isPartial) => {
          setMessages(prev => {
            const lastMsg = prev[prev.length - 1];
            // Check for Coach Hint prefix
            const isHint = role === 'ai' && text.includes("💡 COACH:");
            
            if (role === 'user') {
                if (lastMsg && lastMsg.role === 'user' && lastMsg.isPartial) {
                    const newMsgs = [...prev];
                    newMsgs[newMsgs.length - 1] = { ...lastMsg, text, isPartial };
                    if (!isPartial && !text) return prev;
                    return newMsgs;
                } else if (text) {
                    return [...prev, { id: Date.now().toString(), role, text, isPartial }];
                }
            }
            if (role === 'ai') {
                if (lastMsg && lastMsg.role === 'ai') {
                    const newMsgs = [...prev];
                    newMsgs[newMsgs.length - 1] = { ...lastMsg, text: lastMsg.text + text };
                    return newMsgs;
                } else {
                    return [...prev, { id: Date.now().toString(), role, text, isHint }];
                }
            }
            return prev;
          });
      },
      onAssessment: (data) => {
          setAssessment(data);
          // FIX: Pass the local 'scenario' variable to avoid closure trap where activeScenario state might be null
          saveToSupabase(data, scenario);
          setStatus(ConnectionStatus.DISCONNECTED);
          liveClientRef.current?.disconnect();
      }
    }, difficulty, airportCode, accentEnabled, cockpitNoise, coachingInstruction);
  };

  const handleStop = async () => {
      if (liveClientRef.current && status === ConnectionStatus.CONNECTED) {
          setStatus(ConnectionStatus.ANALYZING);
          await liveClientRef.current.finalize();
      } else {
          if (status === ConnectionStatus.CONNECTED || status === ConnectionStatus.ANALYZING) {
              // Pass activeScenario here because handleStop is called on current render
              saveToSupabase(null, activeScenario);
          }
          setView('dashboard');
      }
  };

  const requestHint = () => {
      if (status === ConnectionStatus.CONNECTED) {
          liveClientRef.current?.sendText("REQUEST_HINT");
      }
  };

  // Toggle PTT
  const togglePtt = () => {
    const newState = !isPttEnabled;
    setIsPttEnabled(newState);
    if (liveClientRef.current) {
        liveClientRef.current.setInputMuted(newState); // If PTT ON, mute initial. If Open Mic, unmute.
        setIsTransmitting(false);
    }
  };

  const handlePttDown = (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    if (status === ConnectionStatus.CONNECTED) {
        setIsTransmitting(true);
        liveClientRef.current?.setInputMuted(false);
    }
  };
  const handlePttUp = (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    if (status === ConnectionStatus.CONNECTED) {
        setIsTransmitting(false);
        liveClientRef.current?.setInputMuted(true);
    }
  };

  // --- Renders ---

  const renderDashboard = () => {
      // Filter Scenarios
      const filteredScenarios = scenarios.filter(s => {
          const matchCategory = selectedCategory ? s.category === selectedCategory : true;
          const matchPhase = selectedPhase ? s.phase === selectedPhase : true;
          return matchCategory && matchPhase;
      });

      // Helper to color code difficulty
      const getDifficultyColor = (level?: string) => {
          switch(level) {
              case 'Easy': return 'bg-green-100 text-green-700';
              case 'Medium': return 'bg-blue-100 text-blue-700';
              case 'Hard': return 'bg-orange-100 text-orange-700';
              case 'Extreme': return 'bg-red-100 text-red-700';
              default: return 'bg-gray-100 text-gray-600';
          }
      };

      return (
          <div className="h-full overflow-y-auto bg-ios-bg pb-20 relative">
              
              {/* Header */}
              <div className="pt-12 pb-4 px-6 bg-white/80 backdrop-blur-md sticky top-0 z-10 border-b border-ios-border flex flex-col space-y-4">
                  <div className="flex justify-between items-center">
                      <div>
                          <h1 className="text-2xl font-bold text-ios-text">专项训练</h1>
                          <div className="flex items-center space-x-2 mt-1">
                              <p className="text-sm text-ios-subtext">针对性强化飞行特情通话能力</p>
                              <div className="text-[10px] font-bold text-ios-blue bg-blue-50 px-2 py-0.5 rounded border border-blue-100 uppercase">
                                Mode: {difficulty}
                              </div>
                          </div>
                      </div>
                      <button 
                        onClick={() => setShowHistory(true)}
                        className="flex items-center space-x-1.5 bg-gradient-to-r from-ios-blue to-ios-indigo text-white px-4 py-2 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all active:scale-95"
                      >
                         <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 00-2-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                         </svg>
                         <span className="text-sm font-bold">历史</span>
                      </button>
                  </div>
              </div>

              {/* Recommended Section (Mock Logic with DB fallback) */}
              <div className="px-6 py-6">
                  <div className="bg-gradient-to-r from-ios-indigo to-purple-600 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden">
                      <div className="relative z-10">
                          <div className="flex items-center space-x-2 mb-2">
                              <span className="px-2 py-0.5 bg-white/20 rounded text-[10px] font-bold uppercase tracking-wider">推荐训练</span>
                              <span className="text-xs opacity-80">Phase: Ground Ops</span>
                          </div>
                          <h3 className="text-xl font-bold mb-1">Complex Taxi Instructions</h3>
                          <p className="text-sm opacity-90 mb-4">针对条件性滑行指令的专项听力训练。</p>
                          <button 
                             onClick={() => startTraining(scenarios.find(s => s.id === 'taxi_giveway' || s.id === 'gnd_02') || scenarios[0])}
                             className="px-4 py-2 bg-white text-ios-indigo text-sm font-bold rounded-full shadow-sm hover:scale-105 transition-transform"
                          >
                              开始练习
                          </button>
                      </div>
                      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl transform translate-x-10 -translate-y-10"></div>
                  </div>
              </div>

              {/* Filters */}
              <div className="px-6 mb-4">
                  {/* Airport Selection Input */}
                  <div className="relative mb-6" ref={searchRef}>
                     <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                        <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                     </div>
                     <input 
                        type="text" 
                        placeholder="机场代码 (例如 ZBAA)" 
                        className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 focus:bg-white focus:border-ios-blue focus:ring-0 rounded-xl text-sm font-mono font-bold uppercase transition-colors shadow-sm relative z-0"
                        value={airportCode}
                        onChange={(e) => {
                            setAirportCode(e.target.value.toUpperCase());
                            setShowResults(true);
                        }}
                        onFocus={() => { if(airportCode.length >= 2) setShowResults(true); }}
                     />
                     {airportCode.length === 4 && (
                         <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                             <span className="text-[10px] font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded">LOCALIZED</span>
                         </div>
                     )}

                     {/* Search Dropdown */}
                     {showResults && searchResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 max-h-48 overflow-y-auto z-50">
                            {searchResults.map((apt) => (
                                <button
                                    key={apt.id}
                                    onClick={() => {
                                        setAirportCode(apt.icao_code);
                                        setShowResults(false);
                                    }}
                                    className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center justify-between border-b border-gray-50 last:border-0"
                                >
                                    <div>
                                        <div className="font-bold text-sm text-gray-800">
                                            <span className="font-mono text-ios-blue mr-2">{apt.icao_code}</span>
                                            {apt.city}
                                        </div>
                                        <div className="text-[10px] text-gray-500 truncate max-w-[140px]">{apt.name}</div>
                                    </div>
                                    <span className="text-[10px] font-bold text-gray-400">{apt.country}</span>
                                </button>
                            ))}
                        </div>
                     )}
                  </div>

                  <h3 className="text-sm font-bold text-ios-subtext uppercase tracking-widest mb-3">飞行阶段 (Flight Phase)</h3>
                  
                  {/* Phase Selector */}
                  <div className="flex space-x-2 overflow-x-auto pb-2 no-scrollbar">
                      <button 
                        onClick={() => setSelectedPhase(null)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${!selectedPhase ? 'bg-ios-text text-white' : 'bg-white text-ios-subtext border border-gray-200'}`}
                      >
                          全部阶段
                      </button>
                      {PHASES.map(phase => (
                          <button 
                            key={phase}
                            onClick={() => setSelectedPhase(phase)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${selectedPhase === phase ? 'bg-ios-text text-white' : 'bg-white text-ios-subtext border border-gray-200'}`}
                          >
                              {phase}
                          </button>
                      ))}
                  </div>

                  <h3 className="text-sm font-bold text-ios-subtext uppercase tracking-widest mt-4 mb-3">分类 (Category)</h3>
                  {/* Category Selector */}
                  <div className="flex flex-wrap gap-2">
                      {SCENARIO_CATEGORIES.map(cat => (
                          <button
                            key={cat}
                            onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${selectedCategory === cat ? 'bg-ios-blue/10 text-ios-blue border-ios-blue' : 'bg-white text-ios-text border-gray-200'}`}
                          >
                              {cat}
                          </button>
                      ))}
                  </div>
              </div>

              {/* Scenario List */}
              <div className="px-6 pb-6 space-y-3">
                  {loadingScenarios ? (
                      <div className="text-center py-10 text-gray-400 text-sm animate-pulse">Loading Scenarios...</div>
                  ) : filteredScenarios.length === 0 ? (
                      <div className="text-center py-10 text-ios-subtext text-sm">没有找到匹配的场景。</div>
                  ) : (
                      filteredScenarios.map(scenario => (
                          <button 
                            key={scenario.id}
                            onClick={() => startTraining(scenario)}
                            className="w-full text-left bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all active:scale-[0.99]"
                          >
                              <div className="flex justify-between items-start mb-1">
                                  <div className="flex items-center space-x-2">
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase
                                          ${scenario.category === 'Operational & Weather' ? 'bg-green-100 text-green-700' : 'bg-ios-blue/5 text-ios-blue'}
                                      `}>
                                          {scenario.category === 'Operational & Weather' ? 'OPS & WX' : scenario.category}
                                      </span>
                                      {scenario.difficulty_level && (
                                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${getDifficultyColor(scenario.difficulty_level)}`}>
                                              {scenario.difficulty_level}
                                          </span>
                                      )}
                                  </div>
                                  <span className="text-[10px] font-mono text-gray-400">{scenario.phase}</span>
                              </div>
                              <h4 className="font-bold text-ios-text mb-1">{scenario.title}</h4>
                              <p className="text-xs text-ios-subtext line-clamp-2">{scenario.details}</p>
                              {airportCode && airportCode.length >= 3 && (
                                  <div className="mt-2 text-[10px] text-gray-400 flex items-center">
                                      <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
                                      Training at {airportCode}
                                  </div>
                              )}
                          </button>
                      ))
                  )}
              </div>
          </div>
      );
  };

  const renderSession = () => {
    return (
      <div className="h-full w-full relative flex flex-col bg-ios-bg overflow-hidden text-ios-text font-sans">
        
        {/* Loading Overlay */}
        {status === ConnectionStatus.ANALYZING && (
          <div className="absolute inset-0 z-50 bg-black/40 backdrop-blur-md flex flex-col items-center justify-center text-white animate-fade-in">
              <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mb-6"></div>
              <h2 className="text-2xl font-bold mb-2">正在生成反馈</h2>
              <p className="text-white/80 text-center max-w-xs">教员正在分析你的表现...</p>
          </div>
        )}

        {/* Dynamic Background */}
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-sky-200/40 rounded-full blur-[100px] animate-blob mix-blend-multiply pointer-events-none"></div>
        <div className="absolute top-[10%] right-[-10%] w-[500px] h-[500px] bg-orange-100/60 rounded-full blur-[100px] animate-blob animation-delay-2000 mix-blend-multiply pointer-events-none"></div>
        
        {/* Header */}
        <header className="z-20 pt-12 pb-4 px-6 flex justify-between items-center bg-ios-bg/50 backdrop-blur-sm sticky top-0">
          <div>
             <div className="flex items-center space-x-2 mb-1">
               <button 
                 onClick={() => {
                     liveClientRef.current?.disconnect();
                     setView('dashboard');
                 }} 
                 className="flex items-center text-ios-blue hover:text-ios-blue/80 transition-colors"
               >
                 <svg className="w-5 h-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                 </svg>
                 <span className="text-sm font-bold">中断 (Abort)</span>
               </button>
               {airportCode && (
                   <span className="text-[10px] font-bold bg-white/50 px-2 py-0.5 rounded text-gray-500 border border-gray-200">{airportCode}</span>
               )}
             </div>
             <h1 className="text-xl font-bold tracking-tight text-ios-text truncate max-w-[200px]">{activeScenario?.title}</h1>
          </div>
          <div className="flex flex-col items-end">
             <div className="bg-white/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-ios-border shadow-sm mb-1">
                <span className="text-xs font-semibold text-ios-subtext">训练模式</span>
             </div>
             <button 
               onClick={togglePtt}
               className={`text-[10px] font-bold px-2 py-0.5 rounded border transition-colors ${isPttEnabled ? 'bg-ios-text text-white border-ios-text' : 'bg-transparent text-ios-subtext border-transparent hover:border-black/10'}`}
             >
               {isPttEnabled ? 'PTT 模式' : '开放麦'}
             </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="z-10 flex-1 flex flex-col relative overflow-hidden">
          
          {/* Upper: Visualizer & Cockpit */}
          <div className="shrink-0 pt-2 pb-4 px-6 flex flex-col items-center space-y-4">
             <Visualizer isActive={status === ConnectionStatus.CONNECTED || status === ConnectionStatus.ANALYZING} audioLevel={audioLevel} />
             <CockpitDisplay 
                active={status === ConnectionStatus.CONNECTED} 
                scenario={activeScenario} 
                airportCode={airportCode} // Pass airport code
             />
          </div>

          {/* Lower: Transcript */}
          <div className="flex-1 flex flex-col bg-white/50 backdrop-blur-lg border-t border-white/20 rounded-t-[2.5rem] shadow-soft overflow-hidden mx-2 relative">
              <div className="px-6 py-3 border-b border-black/5 flex justify-between items-center">
                  <span className="text-xs font-semibold text-ios-subtext">Live Transcript</span>
                  {status === ConnectionStatus.CONNECTING && <span className="text-xs text-ios-blue animate-pulse">Connecting...</span>}
              </div>
              
              {/* NEW: Pinned Situation Box (Matched to AssessmentScreen) */}
              {activeScenario && (
                <div className="px-6 py-4 bg-yellow-50/80 backdrop-blur-sm border-b border-yellow-100/50 z-10 shrink-0 shadow-sm transition-all animate-fade-in">
                    <div className="flex items-start space-x-3">
                        <div className="mt-1 shrink-0 bg-yellow-100 text-yellow-600 rounded-lg p-1.5">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div className="min-w-0 flex-1">
                            <span className="text-[10px] sm:text-xs font-bold text-yellow-700 uppercase tracking-wider block mb-1">Current Situation</span>
                            <p className="text-sm sm:text-base text-yellow-900 leading-relaxed font-medium line-clamp-4">
                                {activeScenario.details}
                            </p>
                        </div>
                    </div>
                </div>
              )}
              
              {/* Error Overlay */}
              {status === ConnectionStatus.ERROR && errorMsg && (
                <div className="absolute inset-0 z-50 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
                  <h3 className="text-ios-text font-bold text-lg mb-2">连接失败</h3>
                  <p className="text-ios-subtext text-sm mb-6 max-w-xs">{errorMsg}</p>
                   <div className="flex space-x-3">
                    <button 
                        onClick={() => setView('dashboard')}
                        className="px-6 py-2 bg-gray-200 text-gray-700 rounded-full text-sm font-semibold hover:bg-gray-300 transition-all"
                    >
                        返回主页
                    </button>
                    <button 
                        onClick={handleReconnect}
                        className="px-6 py-2 bg-ios-red text-white rounded-full text-sm font-semibold shadow-lg hover:shadow-ios-red/30 transition-all"
                    >
                        恢复会话
                    </button>
                  </div>
                </div>
              )}

              <Transcript messages={messages} />
          </div>

        </main>

        {/* Footer Controls */}
        <footer className="z-20 py-4 px-6 bg-ios-bg border-t border-ios-border/50">
           <div className="flex space-x-3">
             
             {/* Hint Button */}
             <button 
                onClick={requestHint}
                disabled={status !== ConnectionStatus.CONNECTED}
                className="w-12 h-12 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center shadow-sm active:scale-95 transition-transform disabled:opacity-50 disabled:scale-100"
             >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
             </button>

             {/* PTT Button - Only visible in PTT Mode */}
             {isPttEnabled && (
                 <button
                    onMouseDown={handlePttDown}
                    onMouseUp={handlePttUp}
                    onMouseLeave={handlePttUp}
                    onTouchStart={handlePttDown}
                    onTouchEnd={handlePttUp}
                    onTouchCancel={handlePttUp}
                    onContextMenu={(e) => e.preventDefault()}
                    disabled={status !== ConnectionStatus.CONNECTED}
                    className={`flex-1 h-12 rounded-full font-bold text-lg shadow-lg transition-all duration-100 flex items-center justify-center border select-none touch-none
                    ${isTransmitting 
                        ? 'bg-ios-orange text-white border-ios-orange scale-95' 
                        : 'bg-white text-ios-text border-gray-200'}`}
                 >
                    {isTransmitting ? '正在通话' : '按住说话'}
                 </button>
             )}

             <button
                onClick={handleStop}
                disabled={status === ConnectionStatus.ANALYZING}
                className={`${isPttEnabled ? 'w-14' : 'flex-1'} h-12 rounded-full border border-ios-border bg-white text-ios-red shadow-soft hover:bg-red-50 active:scale-95 transition-all flex items-center justify-center`}
             >
                {status === ConnectionStatus.ANALYZING ? (
                   <div className="animate-spin w-5 h-5 border-2 border-gray-300 border-t-ios-red rounded-full"></div>
                ) : (
                   isPttEnabled ? (
                       <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                   ) : (
                       <span className="font-semibold text-lg">完成训练</span>
                   )
                )}
             </button>
           </div>
        </footer>

      </div>
    );
  };

  return (
    <>
      {view === 'dashboard' ? renderDashboard() : renderSession()}
      
      {/* Assessment Modal - Rendered globally to support opening from History */}
      {assessment && (
        <AssessmentReport 
          data={assessment} 
          onClose={() => {
              setAssessment(null);
              // CRITICAL: Only when user closes the report, we go back to dashboard.
              setView('dashboard');
          }} 
        />
      )}

      {/* History Modal */}
      {showHistory && (
          <HistoryModal 
            onClose={() => setShowHistory(false)}
            onSelectReport={(data) => {
                setAssessment(data);
                setShowHistory(false);
            }}
            initialFilter="TRAINING"
          />
      )}
    </>
  );
};

export default TrainingScreen;
