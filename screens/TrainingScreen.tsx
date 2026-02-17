
import React, { useState, useRef, useEffect } from 'react';
import { LiveClient } from '../services/liveClient';
import { SCENARIO_CATEGORIES, ScenarioCategory, PHASE_LOGIC_CONFIG, TrainingTag } from '../services/trainingData';
import { scenarioService } from '../services/scenarioService';
import { airportService, Airport } from '../services/airportService';
import { ruleService } from '../services/ruleService';
import { ConnectionStatus, ChatMessage, AssessmentData, Scenario, FlightPhase, DifficultyLevel, AppLanguage } from '../types';
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
    language: AppLanguage;
}

const TrainingScreen: React.FC<TrainingScreenProps> = ({ 
    initialScenario, 
    onConsumeScenario, 
    difficulty, 
    accentEnabled, 
    cockpitNoise,
    language 
}) => {
  // Navigation State
  const [view, setView] = useState<'dashboard' | 'session'>('dashboard');
  
  // Selection State
  const [selectedPhase, setSelectedPhase] = useState<FlightPhase | null>(null);
  const [selectedTag, setSelectedTag] = useState<TrainingTag | null>(null); // New Tag Filter
  const [selectedCategory, setSelectedCategory] = useState<ScenarioCategory | null>(null); // Legacy support
  const [airportCode, setAirportCode] = useState<string>('');
  const [activeAirport, setActiveAirport] = useState<Airport | null>(null); // Full Airport Object
  
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
  const [isPaused, setIsPaused] = useState(false); 
  const [autoPaused, setAutoPaused] = useState(false); // NEW: Track if paused automatically
  const [showExitDialog, setShowExitDialog] = useState(false); // NEW: Exit Dialog
  
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
  // NEW: Session ID Ref to prevent ghost callbacks
  const currentSessionIdRef = useRef<string>("");

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
      // Force cleanup on unmount
      if (liveClientRef.current) {
          liveClientRef.current.disconnect();
          liveClientRef.current = null;
      }
    };
  }, []);

  // Handle Airport Search & Sync
  useEffect(() => {
      // Don't search if not in dashboard view to prevent unnecessary calls during training
      if (view !== 'dashboard') return;

      const delayDebounce = setTimeout(async () => {
          if (airportCode.length >= 2) {
             const results = await airportService.searchAirports(airportCode);
             setSearchResults(results);
             setShowResults(true);
             
             // Auto-select if exact match 4-letter ICAO
             if (airportCode.length === 4) {
                 const exact = results.find(a => a.icao_code === airportCode.toUpperCase());
                 if (exact) {
                     setActiveAirport(exact);
                 } else {
                     // Try direct fetch if search didn't return (edge case)
                     const direct = await airportService.getAirportByCode(airportCode);
                     setActiveAirport(direct);
                 }
             }
          } else {
             setSearchResults([]);
             setShowResults(false);
             if (airportCode.length === 0) setActiveAirport(null);
          }
      }, 300);
      return () => clearTimeout(delayDebounce);
  }, [airportCode, view]);

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

  // --- Auto-Pause on Inactivity Logic ---
  useEffect(() => {
      if (status !== ConnectionStatus.CONNECTED) return;
      if (isPaused) return; 

      const checkInterval = setInterval(() => {
          const timeSinceLastInput = Date.now() - lastInputTimeRef.current;
          // Optimization B: Aggressive Auto-Pause after 45 seconds
          if (timeSinceLastInput > 45000) { 
              console.log("Auto-pausing session due to inactivity (45s).");
              togglePause();
              setAutoPaused(true);
          }
      }, 5000); // Check every 5 seconds

      return () => clearInterval(checkInterval);
  }, [status, isPaused]); 


  // --- Actions ---

  const selectAirport = (apt: Airport) => {
      setAirportCode(apt.icao_code);
      setActiveAirport(apt);
      setShowResults(false);
  };

  const togglePause = () => {
      if (status !== ConnectionStatus.CONNECTED) return;
      
      const newState = !isPaused;
      setIsPaused(newState);
      if (!newState) {
          // If resuming, clear auto-pause flag
          setAutoPaused(false);
          lastInputTimeRef.current = Date.now(); // Reset timer on resume
      }
      
      if (liveClientRef.current) {
          liveClientRef.current.setInputMuted(newState);
      }
  };

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
    // 0. Prevent Double Clicks
    if (status === ConnectionStatus.CONNECTING) return;

    // 1. STRICT TEARDOWN: Kill previous instance to prevent ghost connections
    if (liveClientRef.current) {
        liveClientRef.current.disconnect();
        liveClientRef.current = null;
    }

    // 2. SESSION TOKEN GENERATION
    const sessionId = Date.now().toString();
    currentSessionIdRef.current = sessionId;

    // --- ACCENT FIX: Ensure we have an airport code ---
    let sessionAirportCode = airportCode;
    let sessionAirportData = activeAirport;

    // If no airport selected manually, pick a random one to ensure accents work
    if (!sessionAirportCode || sessionAirportCode.length < 3) {
        try {
            const randomApt = await airportService.getRandomAirport();
            if (randomApt) {
                sessionAirportCode = randomApt.icao_code;
                sessionAirportData = randomApt;
                console.log("Training: Auto-assigned random airport for accent context:", randomApt.icao_code);
            } else {
                // Fallback to ZBAA (Beijing) if DB fails, to ensure at least one accent path exists
                sessionAirportCode = 'ZBAA'; 
            }
        } catch (e) {
            console.warn("Failed to fetch random airport:", e);
            sessionAirportCode = 'ZBAA';
        }
    }

    // Update state to match session context (so visualizer/cockpit shows correct data)
    setActiveScenario(scenario);
    setAirportCode(sessionAirportCode);
    setActiveAirport(sessionAirportData);
    
    setView('session');
    setStatus(ConnectionStatus.CONNECTING);
    setIsPaused(false); // Reset Pause State
    setAutoPaused(false);
    setShowExitDialog(false); // Reset Exit Dialog
    
    // Don't clear messages on reconnect if it's a resume-like action
    if (status !== ConnectionStatus.ERROR) {
       setMessages([]);
    }
    
    setAssessment(null);
    setErrorMsg(null);
    startTimeRef.current = Date.now();
    lastInputTimeRef.current = Date.now(); // Reset inactivity timer

    // Initialize LiveClient (Key is now env based)
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

    // Turn Separation Logic Flag
    let isAiTurnStart = true;

    // Pass difficulty, airport, accent, NOISE, RULES and LANGUAGE
    await liveClientRef.current.connect(scenario, {
      onOpen: () => {
          if (currentSessionIdRef.current !== sessionId) return; // GUARD
          setStatus(ConnectionStatus.CONNECTED);
          startTimeRef.current = Date.now();
          lastInputTimeRef.current = Date.now();
      },
      onClose: () => {
         if (currentSessionIdRef.current !== sessionId) return; // GUARD
         if (statusRef.current === ConnectionStatus.ANALYZING) {
             return;
         }
         if (statusRef.current !== ConnectionStatus.ERROR) {
             setView('dashboard');
             setStatus(ConnectionStatus.DISCONNECTED);
         }
      },
      onError: (err) => {
          if (currentSessionIdRef.current !== sessionId) return; // GUARD
          setStatus(ConnectionStatus.ERROR);
          setErrorMsg(err.message);
      },
      onAudioData: (level) => {
          if (currentSessionIdRef.current !== sessionId) return; // GUARD
          setAudioLevel(level);
          // Update inactivity timer if audio detected (threshold to avoid silence noise)
          if (level > 0.2) {
              lastInputTimeRef.current = Date.now();
          }
      },
      onTurnComplete: () => {
          if (currentSessionIdRef.current !== sessionId) return; // GUARD
          setAudioLevel(0);
          // End of turn: Next AI speech should be a new paragraph
          isAiTurnStart = true;
      },
      onTranscript: (text, role, isPartial) => {
          if (currentSessionIdRef.current !== sessionId) return; // GUARD

          // Reset inactivity timer on user interaction
          if (role === 'user') {
              lastInputTimeRef.current = Date.now();
              isAiTurnStart = true; // User spoke, so next AI response is new turn
              // FIXED: Removed early return to allow user text to show in transcript
          }

          setMessages(prev => {
            const lastMsg = prev[prev.length - 1];
            
            // --- USER MESSAGE LOGIC ---
            if (role === 'user') {
                if (lastMsg && lastMsg.role === 'user' && lastMsg.isPartial) {
                    // Update existing partial message
                    const newMsgs = [...prev];
                    newMsgs[newMsgs.length - 1] = { ...lastMsg, text, isPartial };
                    // If finished and empty, don't keep it (unless it had content)
                    if (!isPartial && !text.trim()) return prev;
                    return newMsgs;
                } else if (text.trim()) {
                    // Start new message
                    return [...prev, { id: Date.now().toString(), role, text, isPartial }];
                }
                return prev;
            }

            // --- AI MESSAGE LOGIC ---
            if (role === 'ai') {
                // Determine if we should start a new message (bubble) or append to the last one
                const shouldCreateNew = isAiTurnStart;
                
                // If we are starting a new message, flip the flag immediately so subsequent chunks append
                if (shouldCreateNew) {
                    isAiTurnStart = false;
                }

                // Check for Coach Hint prefix
                const isHint = text.includes("💡 COACH:");
                
                if (shouldCreateNew) {
                    // Create NEW bubble
                    return [...prev, { id: Date.now().toString(), role, text, isHint }];
                } else {
                    // APPEND to existing AI bubble
                    if (lastMsg && lastMsg.role === 'ai') {
                        const newMsgs = [...prev];
                        newMsgs[newMsgs.length - 1] = { ...lastMsg, text: lastMsg.text + text };
                        return newMsgs;
                    } else {
                        // Fallback (e.g. initial message)
                        return [...prev, { id: Date.now().toString(), role, text, isHint }];
                    }
                }
            }
            return prev;
          });
      },
      onAssessment: (data) => {
          if (currentSessionIdRef.current !== sessionId) return; // GUARD
          setAssessment(data);
          // FIX: Pass the local 'scenario' variable to avoid closure trap where activeScenario state might be null
          saveToSupabase(data, scenario);
          setStatus(ConnectionStatus.DISCONNECTED);
          liveClientRef.current?.disconnect();
      }
    }, difficulty, sessionAirportCode, accentEnabled, cockpitNoise, coachingInstruction, dynamicRules, language);
  };

  // --- EXIT LOGIC ---

  // 1. FAST EXIT: Quit without report
  const handleQuitNow = () => {
      setShowExitDialog(false);
      // Force clean disconnect
      if (liveClientRef.current) {
          liveClientRef.current.disconnect();
          liveClientRef.current = null;
      }
      
      // Save basic session log (duration only) if actually connected
      if (statusRef.current === ConnectionStatus.CONNECTED || statusRef.current === ConnectionStatus.ANALYZING) {
           saveToSupabase(null, activeScenario);
      }
      
      setStatus(ConnectionStatus.DISCONNECTED);
      setView('dashboard');
  };

  // 2. SLOW EXIT: Finish with AI Report
  const handleFinishWithReport = async () => {
      setShowExitDialog(false);
      
      if (liveClientRef.current && status === ConnectionStatus.CONNECTED) {
          setStatus(ConnectionStatus.ANALYZING);
          await liveClientRef.current.finalize(); // Triggers AI tool call -> onAssessment -> saveToSupabase
      } else {
          // Fallback if disconnected
          handleQuitNow();
      }
  };

  const requestHint = () => {
      if (status === ConnectionStatus.CONNECTED) {
          liveClientRef.current?.sendText("REQUEST_HINT");
          // Do not add hint message to transcript as per "No User Text" rule
          lastInputTimeRef.current = Date.now(); // Reset timer on hint request
      }
  };

  // Translation Labels
  const t = {
      title: language === 'cn' ? '专项训练' : 'Scenario Training',
      subtext: language === 'cn' ? '针对性强化飞行特情通话能力' : 'Targeted Flight Scenario Practice',
      history: language === 'cn' ? '历史' : 'History',
      recLabel: language === 'cn' ? '推荐训练' : 'Recommended',
      startRec: language === 'cn' ? '开始练习' : 'Start Practice',
      airportPlace: language === 'cn' ? '机场代码 (例如 ZBAA)' : 'Airport Code (e.g. ZBAA)',
      flightPhase: language === 'cn' ? '飞行阶段 (Flight Phase)' : 'Flight Phase',
      allPhases: language === 'cn' ? '全部阶段 (All Phases)' : 'All Phases',
      applicableFailures: language === 'cn' ? '可选故障 (Applicable Failures)' : 'Applicable Failures',
      category: language === 'cn' ? '分类 (Category)' : 'Category',
      noScenario: language === 'cn' ? '没有找到匹配的场景。' : 'No matching scenarios found.',
      finish: language === 'cn' ? '结束训练' : 'Finish',
      pause: language === 'cn' ? '暂停' : 'Pause',
      resume: language === 'cn' ? '继续' : 'Resume',
      endSession: language === 'cn' ? '结束' : 'End', // Shortened
      brief: language === 'cn' ? '情景简报' : 'Situation Brief',
      liveTranscript: language === 'cn' ? '实时对话' : 'Live Transcript (ATC Only)',
      aiHint: language === 'cn' ? 'AI 提示' : 'AI Hint',
      generating: language === 'cn' ? '正在生成反馈' : 'Generating Feedback',
      analyzing: language === 'cn' ? '教员正在分析你的表现...' : 'Analyzing performance...',
      connectFail: language === 'cn' ? '连接失败' : 'Connection Failed',
      returnHome: language === 'cn' ? '返回主页' : 'Return Home',
      resumeSession: language === 'cn' ? '恢复会话' : 'Resume Session',
      openMic: language === 'cn' ? '麦克风已开启' : 'Mic Active', // Shortened
      pausedText: language === 'cn' ? '已暂停' : 'Paused',
      autoPaused: language === 'cn' ? '已自动暂停' : 'Auto-Paused',
      connecting: language === 'cn' ? '连接中...' : 'Connecting...',
      // Exit Dialog Translations
      quitConfirmTitle: language === 'cn' ? '结束本次训练?' : 'End Session?',
      quitConfirmDesc: language === 'cn' ? '您可以选择生成详细评估报告（需等待 AI 分析），或直接退出。' : 'Generate a detailed report (waits for AI) or just quit.',
      quitBtn: language === 'cn' ? '直接退出 (Quit)' : 'Quit (No Report)',
      reportBtn: language === 'cn' ? '生成报告 (Finish & Report)' : 'Finish & Report',
      cancel: language === 'cn' ? '取消' : 'Cancel',
  };

  // --- Renders ---

  const renderDashboard = () => {
      // 1. Get Valid Tags for the Selected Phase (Anti-Error Logic)
      const validTagsForPhase = selectedPhase ? PHASE_LOGIC_CONFIG[selectedPhase] : null;

      // 2. Filter Scenarios
      const filteredScenarios = scenarios.filter(s => {
          // Phase Filter
          const matchPhase = selectedPhase ? s.phase === selectedPhase : true;
          
          // Tag/Category Filter
          // If a specific tag is selected, check if scenario tags include it
          let matchTag = true;
          if (selectedTag) {
              const sTags = (s as any).tags as TrainingTag[];
              matchTag = sTags ? sTags.includes(selectedTag) : false;
          } else if (selectedCategory) {
              // Fallback to category if no specific tag selected (legacy)
              matchTag = s.category === selectedCategory;
          }

          return matchPhase && matchTag;
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
                          <h1 className="text-2xl font-bold text-ios-text">{t.title}</h1>
                          <div className="flex items-center space-x-2 mt-1">
                              <p className="text-sm text-ios-subtext">{t.subtext}</p>
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
                         <span className="text-sm font-bold">{t.history}</span>
                      </button>
                  </div>
              </div>

              {/* Recommended Section (Mock Logic with DB fallback) */}
              <div className="px-6 py-6">
                  <div className="bg-gradient-to-r from-ios-indigo to-purple-600 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden">
                      <div className="relative z-10">
                          <div className="flex items-center space-x-2 mb-2">
                              <span className="px-2 py-0.5 bg-white/20 rounded text-[10px] font-bold uppercase tracking-wider">{t.recLabel}</span>
                              <span className="text-xs opacity-80">Phase: Ground Ops</span>
                          </div>
                          <h3 className="text-xl font-bold mb-1">Complex Taxi Instructions</h3>
                          <p className="text-sm opacity-90 mb-4">针对条件性滑行指令的专项听力训练。</p>
                          <button 
                             onClick={() => startTraining(scenarios.find(s => s.id === 'taxi_giveway' || s.id === 'gnd_02') || scenarios[0])}
                             className="px-4 py-2 bg-white text-ios-indigo text-sm font-bold rounded-full shadow-sm hover:scale-105 transition-transform"
                          >
                              {t.startRec}
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
                        placeholder={t.airportPlace}
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
                                    onClick={() => selectAirport(apt)}
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

                  <h3 className="text-sm font-bold text-ios-subtext uppercase tracking-widest mb-3">{t.flightPhase}</h3>
                  
                  {/* Phase Selector - UPDATED to Grid Layout for Mobile View */}
                  <div className="grid grid-cols-2 gap-2 mb-2">
                      <button 
                        onClick={() => {
                            setSelectedPhase(null);
                            setSelectedTag(null);
                        }}
                        className={`col-span-2 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
                            !selectedPhase 
                            ? 'bg-ios-text text-white ring-2 ring-ios-text ring-offset-1' 
                            : 'bg-white text-ios-subtext border border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                          {t.allPhases}
                      </button>
                      {PHASES.map(phase => (
                          <button 
                            key={phase}
                            onClick={() => {
                                setSelectedPhase(phase);
                                setSelectedTag(null);
                            }}
                            className={`py-2 px-2 rounded-xl text-xs font-bold transition-all shadow-sm truncate ${
                                selectedPhase === phase 
                                ? 'bg-ios-blue text-white ring-2 ring-ios-blue ring-offset-1' 
                                : 'bg-white text-ios-subtext border border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                              {phase}
                          </button>
                      ))}
                  </div>

                  <h3 className="text-sm font-bold text-ios-subtext uppercase tracking-widest mt-4 mb-3">
                      {selectedPhase ? t.applicableFailures : t.category}
                  </h3>
                  
                  {/* Category/Tag Selector - Dynamic based on Phase Logic */}
                  <div className="flex flex-wrap gap-2">
                      {selectedPhase && validTagsForPhase ? (
                          // Show granular tags if Phase is selected (Anti-Error Logic)
                          validTagsForPhase.map(tag => (
                              <button
                                key={tag}
                                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${selectedTag === tag ? 'bg-red-50 text-red-600 border-red-200' : 'bg-white text-ios-text border-gray-200'}`}
                              >
                                  {tag}
                              </button>
                          ))
                      ) : (
                          // Fallback to broad categories if no phase selected
                          SCENARIO_CATEGORIES.map(cat => (
                              <button
                                key={cat}
                                onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${selectedCategory === cat ? 'bg-ios-blue/10 text-ios-blue border-ios-blue' : 'bg-white text-ios-text border-gray-200'}`}
                              >
                                  {cat}
                              </button>
                          ))
                      )}
                  </div>
              </div>

              {/* Scenario List */}
              <div className="px-6 pb-6 space-y-3">
                  {loadingScenarios ? (
                      <div className="text-center py-10 text-gray-400 text-sm animate-pulse">Loading Scenarios...</div>
                  ) : filteredScenarios.length === 0 ? (
                      <div className="text-center py-10 text-ios-subtext text-sm">
                          {selectedTag ? `当前阶段没有关于 ${selectedTag} 的场景。` : t.noScenario}
                      </div>
                  ) : (
                      filteredScenarios.map(scenario => (
                          <button 
                            key={scenario.id}
                            onClick={() => startTraining(scenario)}
                            className="w-full text-left bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all active:scale-[0.99]"
                          >
                              <div className="flex justify-between items-start mb-1">
                                  <div className="flex items-center space-x-2">
                                      {/* Primary Category Badge */}
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase
                                          ${scenario.category === 'Operational & Weather' ? 'bg-green-100 text-green-700' : 'bg-ios-blue/5 text-ios-blue'}
                                      `}>
                                          {scenario.category === 'Operational & Weather' ? 'OPS & WX' : scenario.category}
                                      </span>
                                      
                                      {/* Show first Tag if available */}
                                      {(scenario as any).tags && (scenario as any).tags.length > 0 && (
                                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase bg-red-50 text-red-600 border border-red-100">
                                              {(scenario as any).tags[0]}
                                          </span>
                                      )}

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
              <h2 className="text-2xl font-bold mb-2">{t.generating}</h2>
              <p className="text-white/80 text-center max-w-xs">{t.analyzing}</p>
          </div>
        )}

        {/* Exit Confirmation Dialog */}
        {showExitDialog && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6 flex flex-col items-center text-center">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-500">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">{t.quitConfirmTitle}</h3>
                    <p className="text-sm text-gray-500 mb-6 leading-relaxed">{t.quitConfirmDesc}</p>
                    
                    <div className="w-full space-y-3">
                        <button 
                            onClick={handleFinishWithReport}
                            className="w-full py-3 bg-ios-blue text-white rounded-xl font-bold shadow-lg hover:shadow-blue-200 active:scale-95 transition-all flex items-center justify-center"
                        >
                            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            {t.reportBtn}
                        </button>
                        
                        <button 
                            onClick={handleQuitNow}
                            className="w-full py-3 bg-white border border-gray-200 text-red-500 font-bold rounded-xl hover:bg-gray-50 active:scale-95 transition-all"
                        >
                            {t.quitBtn}
                        </button>

                        <button 
                            onClick={() => setShowExitDialog(false)}
                            className="w-full py-2 text-gray-400 text-xs font-semibold mt-2"
                        >
                            {t.cancel}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Error Overlay */}
        {status === ConnectionStatus.ERROR && errorMsg && (
            <div className="absolute inset-0 z-50 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
                <h3 className="text-ios-text font-bold text-lg mb-2">{t.connectFail}</h3>
                <p className="text-ios-subtext text-sm mb-6 max-w-xs">{errorMsg}</p>
                <div className="flex space-x-3">
                <button 
                    onClick={() => setView('dashboard')}
                    className="px-6 py-2 bg-gray-200 text-gray-700 rounded-full text-sm font-semibold hover:bg-gray-300 transition-all"
                >
                    {t.returnHome}
                </button>
                <button 
                    onClick={handleReconnect}
                    className="px-6 py-2 bg-ios-red text-white rounded-full text-sm font-semibold shadow-lg hover:shadow-ios-red/30 transition-all"
                >
                    {t.resumeSession}
                </button>
                </div>
            </div>
        )}
        
        {/* Header - Fixed Height with increased Top Padding for layout adjustment */}
        <div className="pt-14 px-6 pb-2 flex justify-between items-center z-10 shrink-0 h-24">
            <div className="flex items-center space-x-3 w-full">
                {/* Scenario Title */}
                <h1 className="text-sm font-bold text-ios-text truncate opacity-80">{activeScenario?.title}</h1>
            </div>
        </div>

        {/* Main Layout Container - Takes remaining height, Absolute Positioning for robustness */}
        <div className="flex-1 relative z-10 w-full overflow-hidden">
            
            {/* 1. TOP SECTION (35% of space) - Reduced to give more room to text */}
            <div className="absolute top-0 left-0 right-0 h-[35%] flex flex-col items-center justify-end pb-4 px-4 space-y-4">
                {/* Visualizer (Takes available space in this section) */}
                <div className="flex-1 w-full flex items-center justify-center overflow-visible min-h-0 relative">
                    <div className="scale-[0.8] transform transition-transform">
                        {/* Pause state passed to visualizer to freeze animation */}
                        <Visualizer isActive={(status === ConnectionStatus.CONNECTED || status === ConnectionStatus.ANALYZING) && !isPaused} audioLevel={audioLevel} />
                    </div>
                </div>
                {/* Cockpit - Fixed Height Container to prevent wobble */}
                <div className="w-full shrink-0 h-28 sm:h-32">
                    <CockpitDisplay 
                        active={status === ConnectionStatus.CONNECTED && !isPaused} 
                        scenario={activeScenario} 
                        airportCode={airportCode}
                        airportData={activeAirport} // PASS FULL AIRPORT DATA
                    />
                </div>
            </div>

            {/* 2. BOTTOM SECTION (65% of space) - Extended to maximum */}
            <div className="absolute bottom-0 left-0 right-0 top-[35%] px-4 pb-0">
                {/* Card Container: Rounded Top, Flat Bottom, Full Height */}
                <div className="w-full h-full bg-white/70 backdrop-blur-xl border-t border-x border-white/60 rounded-t-[2rem] shadow-[0_-10px_40px_rgba(0,0,0,0.05)] flex flex-col overflow-hidden">
                    
                    {/* A. HEADER: Situation Brief & Controls */}
                    <div className="p-4 border-b border-white/50 shrink-0 bg-white/30 backdrop-blur-sm flex flex-col gap-3">
                        {/* Top Row: Title + Controls */}
                        <div className="flex justify-between items-center">
                            {/* Left: Title & Status */}
                            <div className="flex items-center space-x-3 flex-1 min-w-0 pr-2">
                                <div className="w-8 h-8 rounded-full bg-ios-blue/10 flex items-center justify-center text-ios-blue shrink-0">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <div className="min-w-0">
                                    <span className="text-[10px] font-bold text-ios-subtext uppercase tracking-widest block truncate">{t.brief}</span>
                                    {/* Compact Status Indicator */}
                                    <span className="text-[9px] font-bold text-gray-400 flex items-center truncate">
                                        <span className={`w-1.5 h-1.5 rounded-full mr-1 shrink-0 ${status === ConnectionStatus.CONNECTED && !isPaused ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></span>
                                        {status === ConnectionStatus.CONNECTED 
                                            ? (autoPaused ? t.autoPaused : (isPaused ? t.pausedText : t.openMic)) 
                                            : t.connecting}
                                    </span>
                                </div>
                            </div>

                            {/* Right: Controls (Wide & Visible) */}
                            <div className="flex items-center space-x-2 shrink-0">
                                {/* Pause/Resume Button */}
                                <button 
                                    onClick={togglePause}
                                    disabled={status !== ConnectionStatus.CONNECTED}
                                    className={`
                                        flex items-center justify-center space-x-1.5 px-5 py-2 rounded-xl font-bold text-xs shadow-md transition-all active:scale-95 min-w-[100px]
                                        ${isPaused 
                                            ? 'bg-gradient-to-br from-green-400 to-green-600 text-white shadow-green-200 hover:shadow-lg' // Resume Look (Green)
                                            : 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-orange-200 hover:shadow-lg'} // Pause Look (Amber)
                                    `}
                                >
                                    {isPaused ? (
                                        <>
                                            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                            <span>{t.resume}</span>
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                                            <span>{t.pause}</span>
                                        </>
                                    )}
                                </button>

                                {/* End Session Button */}
                                <button 
                                    onClick={() => setShowExitDialog(true)}
                                    disabled={status === ConnectionStatus.ANALYZING}
                                    className="flex items-center justify-center space-x-1.5 px-5 py-2 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 text-white font-bold text-xs shadow-md shadow-red-200 hover:shadow-lg active:scale-95 transition-all min-w-[100px]"
                                >
                                    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M6 6h12v12H6z" /></svg>
                                    <span>{t.endSession}</span>
                                </button>
                            </div>
                        </div>

                        {/* Detail Text */}
                        <div className="max-h-[60px] overflow-y-auto custom-scrollbar">
                            <p className="text-sm text-gray-700 leading-relaxed font-medium text-justify">
                                {activeScenario?.details || "No details available."}
                            </p>
                        </div>
                    </div>

                    {/* B. TRANSCRIPT (Maximized Area) */}
                    <div className="flex-1 flex flex-col min-h-0 relative bg-white/30">
                        {/* Transcript Header */}
                        <div className="flex justify-between items-center px-3 py-2 shrink-0 border-b border-gray-100/50">
                            <div className="flex items-center space-x-2 opacity-80">
                                <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                                    </svg>
                                </div>
                                <span className="text-[10px] font-bold text-ios-subtext uppercase tracking-widest">{t.liveTranscript}</span>
                            </div>
                            
                            {/* Hint Button */}
                            <button 
                                onClick={requestHint}
                                disabled={status !== ConnectionStatus.CONNECTED || isPaused}
                                className="flex items-center space-x-1 px-2 py-1 bg-yellow-100 hover:bg-yellow-200 text-yellow-700 rounded-lg transition-colors disabled:opacity-50"
                                title="Request Standard Phraseology Hint"
                            >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                                <span className="text-[10px] font-bold uppercase">{t.aiHint}</span>
                            </button>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-hidden relative">
                           <Transcript messages={messages} />
                        </div>
                    </div>
                    
                    {/* C. FOOTER REMOVED - Controls are now in Header */}
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
          language={language}
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
