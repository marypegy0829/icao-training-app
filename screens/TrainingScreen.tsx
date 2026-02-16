
import React, { useState, useRef, useEffect } from 'react';
import { LiveClient } from '../services/liveClient';
import { SCENARIO_CATEGORIES, ScenarioCategory } from '../services/trainingData';
import { scenarioService } from '../services/scenarioService';
import { airportService, Airport } from '../services/airportService';
import { ruleService } from '../services/ruleService';
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
  
  // Track status in ref to avoid closure staleness
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
  
  // Inactivity Timer State
  const lastInputTimeRef = useRef<number>(0);
  
  const liveClientRef = useRef<LiveClient | null>(null);

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

  // --- Auto-Close on Inactivity Logic ---
  useEffect(() => {
      if (status !== ConnectionStatus.CONNECTED) return;

      const checkInterval = setInterval(() => {
          const timeSinceLastInput = Date.now() - lastInputTimeRef.current;
          // 2 minutes = 120,000 ms
          if (timeSinceLastInput > 120000) {
              console.log("Auto-closing session due to inactivity.");
              handleStop(true); // Pass flag for inactivity
          }
      }, 5000); // Check every 5 seconds

      return () => clearInterval(checkInterval);
  }, [status]);


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
    if (!process.env.API_KEY) {
       alert("API Key missing. Please check configuration.");
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
    lastInputTimeRef.current = Date.now(); // Reset inactivity timer

    // Initialize LiveClient (Key is handled internally)
    liveClientRef.current = new LiveClient();
    
    // TRAINING MODE: Always Open Mic, No PTT buffering
    liveClientRef.current.setBufferedMode(false);
    liveClientRef.current.setInputMuted(false); 

    // FETCH DYNAMIC RULES FROM SUPABASE
    let dynamicRules = "";
    if (scenario.phase) {
        console.log(`Fetching rules for phase: ${scenario.phase}`);
        dynamicRules = await ruleService.getLogicRulesForPhase(scenario.phase);
    }

    // COACHING INSTRUCTION WITH EXPLICIT REPORT TRIGGER
    // UPDATED for better Hint logic
    const coachingInstruction = `
    # SYSTEM INSTRUCTION: FLIGHT INSTRUCTOR (COACHING MODE)
    The user is a pilot trainee. You are an ATC Instructor.
    
    Current Scenario: ${scenario.title} (${scenario.category})
    Phase: ${scenario.phase}
    Details: ${scenario.details}
    Weather: ${scenario.weather}
    
    1. Act as profesional ATC initially.
    
    2. *** HINT FEATURE (CONTEXT AWARE) ***: 
       If the user sends a text message "REQUEST_HINT", you must BREAK CHARACTER immediately.
       - Analyze the current state of the conversation (what ATC said last, what the pilot needs to respond).
       - Provide the **EXACT** Standard ICAO phraseology the pilot should say next.
       - Do NOT give generic advice like "Read back the instruction". Give the actual words.
       - Prefix the hint with "💡 COACH: ".
       - After the hint, stay silent and wait for the pilot to speak (or repeat the ATC instruction if needed).
       
    3. *** CRITICAL: SESSION END & ASSESSMENT ***
       When you receive the system command "TERMINATE_SESSION_IMMEDIATELY", or if the user says "Training Finished":
       - STOP acting as ATC/Coach.
       - You MUST call the 'reportAssessment' tool.
       - You MUST evaluate the trainee on ALL 6 DIMENSIONS: Pronunciation, Structure, Vocabulary, Fluency, Comprehension, Interactions.
       - Provide a "Quick Assessment" in the report. Be concise but cover all 6 points.
    `;

    // Pass difficulty, airport, accent, NOISE, and RULES
    await liveClientRef.current.connect(scenario, {
      onOpen: () => {
          setStatus(ConnectionStatus.CONNECTED);
          startTimeRef.current = Date.now();
          lastInputTimeRef.current = Date.now();
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
      onAudioData: (level) => {
          setAudioLevel(level);
          // Update inactivity timer if audio detected (threshold to avoid silence noise)
          if (level > 0.2) {
              lastInputTimeRef.current = Date.now();
          }
      },
      onTurnComplete: () => setAudioLevel(0),
      onTranscript: (text, role, isPartial) => {
          // Reset inactivity timer on user interaction
          if (role === 'user') {
              lastInputTimeRef.current = Date.now();
          }

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
    }, difficulty, airportCode, accentEnabled, cockpitNoise, coachingInstruction, dynamicRules);
  };

  const handleStop = async (dueToInactivity = false) => {
      if (dueToInactivity) {
          alert("检测到长时间未发言，训练已自动结束。\nSession ended due to inactivity (2 mins).");
      }

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
          // Add explicit hint message to transcript for visual feedback
          setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', text: '💡 Hint Requested...' }]);
          lastInputTimeRef.current = Date.now(); // Reset timer on hint request
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
                                      <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                      </svg>
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
      <div className="h-full flex flex-col relative bg-ios-bg overflow-hidden font-sans">
        
        {/* Dynamic Backgrounds */}
        <div className="absolute top-[-10%] left-[-20%] w-[600px] h-[600px] bg-sky-100/60 rounded-full blur-[100px] animate-blob mix-blend-multiply pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-20%] w-[500px] h-[500px] bg-green-100/60 rounded-full blur-[100px] animate-blob animation-delay-2000 mix-blend-multiply pointer-events-none"></div>

        {/* Loading Overlay */}
        {status === ConnectionStatus.ANALYZING && (
          <div className="absolute inset-0 z-50 bg-black/40 backdrop-blur-md flex flex-col items-center justify-center text-white animate-fade-in">
              <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mb-6"></div>
              <h2 className="text-2xl font-bold mb-2">正在生成反馈</h2>
              <p className="text-white/80 text-center max-w-xs">教员正在分析你的表现...</p>
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
        
        {/* Header - Fixed Height */}
        <div className="pt-12 px-6 pb-2 flex justify-between items-center z-10 shrink-0 h-24">
            <div className="flex items-center space-x-3 max-w-[70%]">
                {/* Status Indicator */}
                <div className="flex items-center space-x-2 bg-white/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/60 shadow-sm shrink-0">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="text-[10px] font-bold text-green-600 uppercase tracking-widest">LIVE TRAINING</span>
                </div>
                {/* Scenario Title */}
                <h1 className="text-sm font-bold text-ios-text truncate opacity-80 hidden sm:block">{activeScenario?.title}</h1>
            </div>
            
            {/* Finish Button - Top Right */}
            <button 
                onClick={() => handleStop()}
                disabled={status === ConnectionStatus.ANALYZING}
                className="bg-white/80 backdrop-blur-md text-ios-blue border border-blue-100 px-4 py-2 rounded-full text-xs font-bold shadow-sm hover:bg-blue-50 active:scale-95 transition-all flex items-center space-x-1"
            >
                <span className="uppercase tracking-wide">Finish Training</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
            </button>
        </div>

        {/* Main Layout Container - Takes remaining height, Absolute Positioning for robustness */}
        <div className="flex-1 relative z-10 w-full overflow-hidden">
            
            {/* 1. TOP SECTION (45% of space) - Absolute Top */}
            <div className="absolute top-0 left-0 right-0 h-[45%] flex flex-col items-center justify-end pb-6 px-4 space-y-6">
                {/* Visualizer (Takes available space in this section) */}
                <div className="flex-1 w-full flex items-center justify-center overflow-visible min-h-0 relative">
                    <div className="scale-[0.8] transform transition-transform">
                        <Visualizer isActive={status === ConnectionStatus.CONNECTED || status === ConnectionStatus.ANALYZING} audioLevel={audioLevel} />
                    </div>
                </div>
                {/* Cockpit - Fixed Height Container to prevent wobble */}
                <div className="w-full shrink-0 h-28 sm:h-32">
                    <CockpitDisplay active={status === ConnectionStatus.CONNECTED} scenario={activeScenario} airportCode={airportCode} />
                </div>
            </div>

            {/* 2. BOTTOM SECTION (55% of space) - Absolute Fixed at Bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-[55%] px-4">
                {/* Card Container: Rounded Top, Flat Bottom, Full Height */}
                <div className="w-full h-full bg-white/70 backdrop-blur-xl border-t border-x border-white/60 rounded-t-[2.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.05)] flex flex-col overflow-hidden">
                    
                    {/* A. SITUATION BRIEF HEADER (Fixed Top of Card) */}
                    <div className="p-4 border-b border-white/50 shrink-0 bg-white/30 backdrop-blur-sm">
                        <div className="flex items-center space-x-2 mb-2 opacity-80">
                            <div className="w-5 h-5 rounded-full bg-ios-blue/10 flex items-center justify-center text-ios-blue">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <span className="text-[10px] font-bold text-ios-subtext uppercase tracking-widest">Situation Brief</span>
                        </div>
                        <div className="max-h-[60px] overflow-y-auto custom-scrollbar">
                            <p className="text-sm text-gray-700 leading-relaxed font-medium text-justify">
                                {activeScenario?.details || "No details available."}
                            </p>
                        </div>
                    </div>

                    {/* B. TRANSCRIPT (Scrollable Area) */}
                    <div className="flex-1 flex flex-col min-h-0 relative bg-white/30">
                        {/* Transcript Header */}
                        <div className="flex justify-between items-center px-4 py-2 shrink-0">
                            <div className="flex items-center space-x-2 opacity-80">
                                <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                                    </svg>
                                </div>
                                <span className="text-[10px] font-bold text-ios-subtext uppercase tracking-widest">Live Transcript</span>
                            </div>
                            
                            {/* Hint Button */}
                            <button 
                                onClick={requestHint}
                                disabled={status !== ConnectionStatus.CONNECTED}
                                className="flex items-center space-x-1 px-2 py-1 bg-yellow-100 hover:bg-yellow-200 text-yellow-700 rounded-lg transition-colors disabled:opacity-50"
                                title="Request Standard Phraseology Hint"
                            >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                                <span className="text-[10px] font-bold uppercase">AI Hint</span>
                            </button>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-hidden relative">
                           <Transcript messages={messages} />
                        </div>
                    </div>
                    
                    {/* C. STATUS BAR (Fixed Bottom of Card) */}
                    <div className="px-6 py-2 bg-white/50 border-t border-white/50 text-center shrink-0">
                        <span className="text-[9px] font-bold text-gray-400 animate-pulse uppercase tracking-wider flex items-center justify-center">
                            <span className={`w-1.5 h-1.5 rounded-full mr-2 ${status === ConnectionStatus.CONNECTED ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                            {status === ConnectionStatus.CONNECTED ? "Open Mic Active - Auto Close in 2m inactive" : "Connecting..."}
                        </span>
                    </div>
                </div>
            </div>
        </div>
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
