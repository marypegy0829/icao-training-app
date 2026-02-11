
import React, { useState, useRef, useEffect } from 'react';
import { LiveClient } from '../services/liveClient';
import { TRAINING_SCENARIOS, SCENARIO_CATEGORIES, ScenarioCategory } from '../services/trainingData';
import { ConnectionStatus, ChatMessage, AssessmentData, Scenario, FlightPhase, DifficultyLevel } from '../types';
import Visualizer from '../components/Visualizer';
import CockpitDisplay from '../components/CockpitDisplay';
import Transcript from '../components/Transcript';
import AssessmentReport from '../components/AssessmentReport';
import { userService } from '../services/userService';

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
}

const TrainingScreen: React.FC<TrainingScreenProps> = ({ initialScenario, onConsumeScenario, difficulty }) => {
  // Navigation State
  const [view, setView] = useState<'dashboard' | 'session'>('dashboard');
  
  // Selection State
  const [selectedPhase, setSelectedPhase] = useState<FlightPhase | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ScenarioCategory | null>(null);

  // Session State
  const [activeScenario, setActiveScenario] = useState<Scenario | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [assessment, setAssessment] = useState<AssessmentData | null>(null);
  const startTimeRef = useRef<number>(0);
  
  // PTT State
  const [isPttEnabled, setIsPttEnabled] = useState(false);
  const [isTransmitting, setIsTransmitting] = useState(false);

  // History State (Mock) - In real app this would also be fetched
  const [history] = useState([
    { id: 1, title: 'Engine Fire on Departure', date: '2 hrs ago', score: 4 },
    { id: 2, title: 'Complex Taxi Instructions', date: 'Yesterday', score: 5 },
  ]);

  const liveClientRef = useRef<LiveClient | null>(null);

  // Get API KEY safely
  const getApiKey = () => {
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
    return key;
  };

  const API_KEY = getApiKey();

  // --- Effects for Session ---

  useEffect(() => {
    return () => {
      liveClientRef.current?.disconnect();
    };
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
        setErrorMsg("Analysis timed out. Please try again.");
        setStatus(ConnectionStatus.ERROR);
        liveClientRef.current?.disconnect();
      }, 20000);
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

  const saveToSupabase = async (finalAssessment: AssessmentData | null) => {
      if (!activeScenario) return;
      const durationSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
      
      await userService.saveSession(
          activeScenario.title,
          activeScenario.phase || 'General',
          finalAssessment,
          durationSeconds
      );
  };

  const startTraining = async (scenario: Scenario) => {
    if (!API_KEY) {
       alert("API Key missing. Please check .env file");
       return;
    }
    setActiveScenario(scenario);
    setView('session');
    setStatus(ConnectionStatus.CONNECTING);
    setMessages([]);
    setAssessment(null);
    setErrorMsg(null);
    startTimeRef.current = Date.now();

    liveClientRef.current = new LiveClient(API_KEY);
    liveClientRef.current.setInputMuted(isPttEnabled);

    // COACHING INSTRUCTION
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
       
    3. If the user sends "EXAM_FINISHED", call the 'reportAssessment' tool.
       - Be lenient in grading.
       - Focus the feedback on teaching points.
    `;

    // Pass difficulty to connect
    await liveClientRef.current.connect(scenario, {
      onOpen: () => {
          setStatus(ConnectionStatus.CONNECTED);
          startTimeRef.current = Date.now(); // Reset start time on actual connection
      },
      onClose: () => {
         setStatus(ConnectionStatus.DISCONNECTED);
         if (status !== ConnectionStatus.ERROR) {
             // If closed cleanly without assessment (e.g. manual abort), don't show report
             if (!assessment) setView('dashboard'); 
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
          setStatus(ConnectionStatus.DISCONNECTED);
          saveToSupabase(data);
          liveClientRef.current?.disconnect();
      }
    }, difficulty, coachingInstruction);
  };

  const handleStop = async () => {
      if (liveClientRef.current && status === ConnectionStatus.CONNECTED) {
          setStatus(ConnectionStatus.ANALYZING);
          await liveClientRef.current.finalize();
      } else {
          // If unconnected or error, just go back. Record partial if needed? 
          // For now, only record if we were connected.
          if (status === ConnectionStatus.CONNECTED || status === ConnectionStatus.ANALYZING) {
              saveToSupabase(null);
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
      const filteredScenarios = TRAINING_SCENARIOS.filter(s => {
          const matchCategory = selectedCategory ? s.category === selectedCategory : true;
          const matchPhase = selectedPhase ? s.phase === selectedPhase : true;
          return matchCategory && matchPhase;
      });

      return (
          <div className="h-full overflow-y-auto bg-ios-bg pb-20">
              
              {/* Header */}
              <div className="pt-12 pb-4 px-6 bg-white/80 backdrop-blur-md sticky top-0 z-10 border-b border-ios-border">
                  <h1 className="text-2xl font-bold text-ios-text">专项训练</h1>
                  <p className="text-sm text-ios-subtext">针对性强化飞行特情通话能力</p>
                  <div className="mt-2 text-[10px] font-bold text-ios-blue bg-blue-50 inline-block px-2 py-0.5 rounded border border-blue-100 uppercase">
                      Current Difficulty: {difficulty}
                  </div>
              </div>

              {/* Recommended Section (Mock Logic) */}
              <div className="px-6 py-6">
                  <div className="bg-gradient-to-r from-ios-indigo to-purple-600 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden">
                      <div className="relative z-10">
                          <div className="flex items-center space-x-2 mb-2">
                              <span className="px-2 py-0.5 bg-white/20 rounded text-[10px] font-bold uppercase tracking-wider">Recommended</span>
                              <span className="text-xs opacity-80">Phase: Ground Ops</span>
                          </div>
                          <h3 className="text-xl font-bold mb-1">Complex Taxi Instructions</h3>
                          <p className="text-sm opacity-90 mb-4">Practice listening to conditional clearances.</p>
                          <button 
                             onClick={() => startTraining(TRAINING_SCENARIOS.find(s => s.id === 'taxi_giveway') || TRAINING_SCENARIOS[0])}
                             className="px-4 py-2 bg-white text-ios-indigo text-sm font-bold rounded-full shadow-sm hover:scale-105 transition-transform"
                          >
                              Start Practice
                          </button>
                      </div>
                      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl transform translate-x-10 -translate-y-10"></div>
                  </div>
              </div>

              {/* Filters */}
              <div className="px-6 mb-4">
                  <h3 className="text-sm font-bold text-ios-subtext uppercase tracking-widest mb-3">Flight Phase</h3>
                  
                  {/* Phase Selector */}
                  <div className="flex space-x-2 overflow-x-auto pb-2 no-scrollbar">
                      <button 
                        onClick={() => setSelectedPhase(null)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${!selectedPhase ? 'bg-ios-text text-white' : 'bg-white text-ios-subtext border border-gray-200'}`}
                      >
                          All Phases
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

                  <h3 className="text-sm font-bold text-ios-subtext uppercase tracking-widest mt-4 mb-3">Category</h3>
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
                  {filteredScenarios.length === 0 ? (
                      <div className="text-center py-10 text-ios-subtext text-sm">No scenarios match your filters.</div>
                  ) : (
                      filteredScenarios.map(scenario => (
                          <button 
                            key={scenario.id}
                            onClick={() => startTraining(scenario)}
                            className="w-full text-left bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all active:scale-[0.99]"
                          >
                              <div className="flex justify-between items-start mb-1">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase
                                      ${scenario.category === 'Operational & Weather' ? 'bg-green-100 text-green-700' : 'bg-ios-blue/5 text-ios-blue'}
                                  `}>
                                      {scenario.category === 'Operational & Weather' ? 'OPS & WX' : scenario.category}
                                  </span>
                                  <span className="text-[10px] font-mono text-gray-400">{scenario.phase}</span>
                              </div>
                              <h4 className="font-bold text-ios-text mb-1">{scenario.title}</h4>
                              <p className="text-xs text-ios-subtext line-clamp-2">{scenario.details}</p>
                          </button>
                      ))
                  )}
              </div>

              {/* History Mock */}
              <div className="px-6 pt-4 border-t border-gray-200">
                  <h3 className="text-sm font-bold text-ios-subtext uppercase tracking-widest mb-3">Recent History</h3>
                  <div className="space-y-3">
                      {history.map(h => (
                          <div key={h.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-100">
                              <div>
                                  <div className="text-sm font-semibold text-ios-text">{h.title}</div>
                                  <div className="text-xs text-ios-subtext">{h.date}</div>
                              </div>
                              <div className={`px-2 py-1 rounded text-xs font-bold ${h.score >= 4 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                  Level {h.score}
                              </div>
                          </div>
                      ))}
                  </div>
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
              <h2 className="text-2xl font-bold mb-2">Generating Feedback</h2>
              <p className="text-white/80 text-center max-w-xs">Instructor is analyzing your performance...</p>
          </div>
        )}

        {/* Assessment Modal */}
        {assessment && (
          <AssessmentReport 
            data={assessment} 
            onClose={() => {
                setAssessment(null);
                setView('dashboard');
            }} 
          />
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
                 <span className="text-sm font-bold">Abort</span>
               </button>
             </div>
             <h1 className="text-xl font-bold tracking-tight text-ios-text truncate max-w-[200px]">{activeScenario?.title}</h1>
          </div>
          <div className="flex flex-col items-end">
             <div className="bg-white/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-ios-border shadow-sm mb-1">
                <span className="text-xs font-semibold text-ios-subtext">Training Mode</span>
             </div>
             <button 
               onClick={togglePtt}
               className={`text-[10px] font-bold px-2 py-0.5 rounded border transition-colors ${isPttEnabled ? 'bg-ios-text text-white border-ios-text' : 'bg-transparent text-ios-subtext border-transparent hover:border-black/10'}`}
             >
               {isPttEnabled ? 'PTT ON' : 'OPEN MIC'}
             </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="z-10 flex-1 flex flex-col relative overflow-hidden">
          
          {/* Upper: Visualizer & Cockpit */}
          <div className="shrink-0 pt-2 pb-4 px-6 flex flex-col items-center space-y-4">
             <Visualizer isActive={status === ConnectionStatus.CONNECTED || status === ConnectionStatus.ANALYZING} audioLevel={audioLevel} />
             <CockpitDisplay active={status === ConnectionStatus.CONNECTED} scenario={activeScenario} />
          </div>

          {/* Lower: Transcript */}
          <div className="flex-1 flex flex-col bg-white/50 backdrop-blur-lg border-t border-white/20 rounded-t-[2.5rem] shadow-soft overflow-hidden mx-2 relative">
              <div className="px-6 py-3 border-b border-black/5 flex justify-between items-center">
                  <span className="text-xs font-semibold text-ios-subtext">Live Transcript</span>
                  {status === ConnectionStatus.CONNECTING && <span className="text-xs text-ios-blue animate-pulse">Connecting...</span>}
              </div>
              
              {/* Error Overlay */}
              {status === ConnectionStatus.ERROR && errorMsg && (
                <div className="absolute inset-0 z-50 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
                  <h3 className="text-ios-text font-bold text-lg mb-2">Connection Failed</h3>
                  <p className="text-ios-subtext text-sm mb-6 max-w-xs">{errorMsg}</p>
                  <button onClick={() => setView('dashboard')} className="px-6 py-2 bg-ios-red text-white rounded-full text-sm font-semibold shadow-lg">
                    Back to Dashboard
                  </button>
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
                    onContextMenu={(e) => e.preventDefault()}
                    disabled={status !== ConnectionStatus.CONNECTED}
                    className={`flex-1 h-12 rounded-full font-bold text-lg shadow-lg transition-all duration-100 flex items-center justify-center border select-none touch-none
                    ${isTransmitting 
                        ? 'bg-ios-orange text-white border-ios-orange scale-95' 
                        : 'bg-white text-ios-text border-gray-200'}`}
                 >
                    {isTransmitting ? 'TRANSMITTING' : 'HOLD TO TALK'}
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
                       <span className="font-semibold text-lg">Finish</span>
                   )
                )}
             </button>
           </div>
        </footer>

      </div>
    );
  };

  return view === 'dashboard' ? renderDashboard() : renderSession();
};

export default TrainingScreen;
