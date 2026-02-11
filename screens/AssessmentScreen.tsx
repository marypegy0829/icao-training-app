
import React, { useState, useRef, useEffect } from 'react';
import { LiveClient } from '../services/liveClient';
import { getRandomAssessmentScenario } from '../services/trainingData';
import { ConnectionStatus, ChatMessage, AssessmentData, Scenario, DifficultyLevel } from '../types';
import Visualizer from '../components/Visualizer';
import CockpitDisplay from '../components/CockpitDisplay';
import Transcript from '../components/Transcript';
import AssessmentReport from '../components/AssessmentReport';
import BriefingModal from '../components/BriefingModal';
import { userService } from '../services/userService';

interface AssessmentScreenProps {
  difficulty: DifficultyLevel;
}

const AssessmentScreen: React.FC<AssessmentScreenProps> = ({ difficulty }) => {
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [assessment, setAssessment] = useState<AssessmentData | null>(null);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const startTimeRef = useRef<number>(0);
  
  // PTT State
  const [isPttEnabled, setIsPttEnabled] = useState(false);
  const [isTransmitting, setIsTransmitting] = useState(false);

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

  useEffect(() => {
    if (!API_KEY) {
      setErrorMsg("API Key Missing. Please check your .env file.");
    }
    return () => {
      liveClientRef.current?.disconnect();
    };
  }, []);

  // Safety Timeout for Analysis
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    if (status === ConnectionStatus.ANALYZING) {
      // If we don't get a result within 20 seconds, assume failure and reset
      timeoutId = setTimeout(() => {
        setErrorMsg("Analysis timed out. The model failed to return a report.");
        setStatus(ConnectionStatus.ERROR);
        liveClientRef.current?.disconnect();
      }, 20000);
    }
    return () => clearTimeout(timeoutId);
  }, [status]);

  // Keyboard Listeners for PTT
  useEffect(() => {
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
  }, [isPttEnabled, status, isTransmitting]);

  const saveToSupabase = async (finalAssessment: AssessmentData | null) => {
      if (!scenario) return;
      const durationSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
      
      await userService.saveSession(
          scenario.title,
          scenario.phase || 'Assessment',
          finalAssessment,
          durationSeconds
      );
  };

  const startBriefing = () => {
     // Pull a random complex scenario from the main database
     const s = getRandomAssessmentScenario();
     setScenario(s);
     setStatus(ConnectionStatus.BRIEFING);
     setErrorMsg(null);
  };

  const handleConnect = async () => {
    if (!API_KEY || !scenario) return;
    
    setStatus(ConnectionStatus.CONNECTING);
    liveClientRef.current = new LiveClient(API_KEY);
    
    // Initial mute state based on PTT setting
    liveClientRef.current.setInputMuted(isPttEnabled);

    // Connect with the global difficulty setting
    await liveClientRef.current.connect(scenario, {
      onOpen: () => {
          setStatus(ConnectionStatus.CONNECTED);
          startTimeRef.current = Date.now();
      },
      onClose: () => { 
        setStatus(prev => {
            // Keep ERROR state if set, otherwise go to DISCONNECTED
            return prev === ConnectionStatus.ERROR ? prev : ConnectionStatus.DISCONNECTED;
        }); 
        setAudioLevel(0);
      },
      onError: (err) => { 
        setStatus(ConnectionStatus.ERROR); 
        setErrorMsg(err.message); 
        setAudioLevel(0);
      },
      onAudioData: (level) => setAudioLevel(level),
      onTurnComplete: () => setAudioLevel(0),
      onTranscript: (text, role, isPartial) => {
        setMessages(prev => {
          const lastMsg = prev[prev.length - 1];
          if (role === 'user') {
             if (lastMsg && lastMsg.role === 'user' && lastMsg.isPartial) {
                 const newMsgs = [...prev];
                 newMsgs[newMsgs.length - 1] = { ...lastMsg, text: text, isPartial: isPartial };
                 if (!isPartial && text === "") return prev; 
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
                 return [...prev, { id: Date.now().toString(), role, text }];
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
    }, difficulty); // Pass difficulty here
  };

  const handleStop = async () => {
    if (liveClientRef.current && status === ConnectionStatus.CONNECTED) {
      setStatus(ConnectionStatus.ANALYZING);
      await liveClientRef.current.finalize();
    } else {
      if (status === ConnectionStatus.CONNECTED || status === ConnectionStatus.ANALYZING) {
          saveToSupabase(null);
      }
      setStatus(ConnectionStatus.DISCONNECTED);
      setAudioLevel(0);
      liveClientRef.current?.disconnect();
    }
  };

  // Toggle PTT Mode
  const togglePtt = () => {
    const newState = !isPttEnabled;
    setIsPttEnabled(newState);
    if (!newState && liveClientRef.current) {
        liveClientRef.current.setInputMuted(false);
        setIsTransmitting(false);
    }
    if (newState && liveClientRef.current) {
        liveClientRef.current.setInputMuted(true);
        setIsTransmitting(false);
    }
  };

  // Handle onTouchStart/End for mobile PTT button
  const handlePttDown = (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault(); // Prevent text selection/menu
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

  return (
    <div className="h-full w-full relative flex flex-col bg-ios-bg overflow-hidden text-ios-text font-sans">
      
      {/* Loading Overlay */}
      {status === ConnectionStatus.ANALYZING && (
          <div className="absolute inset-0 z-50 bg-black/40 backdrop-blur-md flex flex-col items-center justify-center text-white animate-fade-in">
              <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mb-6"></div>
              <h2 className="text-2xl font-bold mb-2">Analyzing Performance</h2>
              <p className="text-white/80 text-center max-w-xs">Generating ICAO Level 5 assessment report... This may take up to 20 seconds.</p>
          </div>
      )}

      {/* Assessment Modal */}
      {assessment && (
        <AssessmentReport 
          data={assessment} 
          onClose={() => setAssessment(null)} 
        />
      )}

      {/* Briefing Modal */}
      {status === ConnectionStatus.BRIEFING && scenario && (
        <BriefingModal 
            scenario={scenario} 
            onAccept={handleConnect}
            onCancel={() => setStatus(ConnectionStatus.DISCONNECTED)}
        />
      )}

      {/* Dynamic Background */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-sky-200/40 rounded-full blur-[100px] animate-blob mix-blend-multiply pointer-events-none"></div>
      <div className="absolute top-[10%] right-[-10%] w-[500px] h-[500px] bg-orange-100/60 rounded-full blur-[100px] animate-blob animation-delay-2000 mix-blend-multiply pointer-events-none"></div>
      
      {/* Header */}
      <header className="z-20 pt-12 pb-4 px-6 flex justify-between items-center bg-ios-bg/50 backdrop-blur-sm sticky top-0">
        <div>
           <div className="flex items-center space-x-2 mb-1">
             <div className={`w-2 h-2 rounded-full ${status === ConnectionStatus.CONNECTED ? 'bg-ios-orange animate-pulse' : 'bg-gray-400'}`}></div>
             <span className="text-[10px] font-bold tracking-widest text-ios-subtext uppercase">ICAO Level 5</span>
           </div>
           <h1 className="text-2xl font-bold tracking-tight text-ios-text">Examiner</h1>
        </div>
        <div className="flex flex-col items-end">
           <div className="bg-white/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-ios-border shadow-sm mb-1">
              <span className="text-xs font-semibold text-ios-subtext">{difficulty}</span>
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
           <CockpitDisplay active={status === ConnectionStatus.CONNECTED} scenario={scenario} />
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
                <div className="w-12 h-12 bg-ios-red/10 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-ios-red" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-ios-text font-bold text-lg mb-2">Connection Failed</h3>
                <p className="text-ios-subtext text-sm mb-6 max-w-xs">{errorMsg}</p>
                <button onClick={startBriefing} className="px-6 py-2 bg-ios-red text-white rounded-full text-sm font-semibold shadow-lg hover:shadow-ios-red/30 transition-all">
                  Retry
                </button>
              </div>
            )}

            <Transcript messages={messages} />
        </div>

      </main>

      {/* Footer Controls for Assessment */}
      <footer className="z-20 py-4 px-6 bg-ios-bg border-t border-ios-border/50">
        {status === ConnectionStatus.DISCONNECTED || status === ConnectionStatus.ERROR ? (
           <button
             onClick={startBriefing}
             disabled={!API_KEY}
             className="w-full h-12 rounded-full bg-ios-text text-white font-semibold text-lg shadow-lg hover:scale-[1.02] active:scale-95 transition-all duration-300 flex items-center justify-center space-x-2 disabled:opacity-50"
           >
             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
             </svg>
             <span>Start Interview</span>
           </button>
        ) : status === ConnectionStatus.BRIEFING ? (
            <div className="w-full h-12 flex items-center justify-center text-ios-subtext text-sm animate-pulse">
                Reviewing Mission...
            </div>
        ) : (
           <div className="flex space-x-3">
             
             {/* PTT Button - Only visible in PTT Mode */}
             {isPttEnabled && (
                 <button
                    onMouseDown={handlePttDown}
                    onMouseUp={handlePttUp}
                    onMouseLeave={handlePttUp}
                    onTouchStart={handlePttDown}
                    onTouchEnd={handlePttUp}
                    onContextMenu={(e) => e.preventDefault()}
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
                       <span className="font-semibold text-lg">End Session</span>
                   )
                )}
             </button>
           </div>
        )}
      </footer>

    </div>
  );
};

export default AssessmentScreen;
