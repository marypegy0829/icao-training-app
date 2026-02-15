
import React, { useState, useRef, useEffect } from 'react';
import { LiveClient } from '../services/liveClient';
import { scenarioService } from '../services/scenarioService';
import { ruleService } from '../services/ruleService';
import { ConnectionStatus, ChatMessage, AssessmentData, Scenario, DifficultyLevel } from '../types';
import Visualizer from '../components/Visualizer';
import CockpitDisplay from '../components/CockpitDisplay';
import Transcript from '../components/Transcript';
import AssessmentReport from '../components/AssessmentReport';
import BriefingModal from '../components/BriefingModal';
import HistoryModal from '../components/HistoryModal';
import { userService } from '../services/userService';
import { useWakeLock } from '../hooks/useWakeLock';

interface AssessmentScreenProps {
  difficulty: DifficultyLevel;
  accentEnabled: boolean;
  cockpitNoise: boolean;
}

const AssessmentScreen: React.FC<AssessmentScreenProps> = ({ difficulty, accentEnabled, cockpitNoise }) => {
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [assessment, setAssessment] = useState<AssessmentData | null>(null);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const startTimeRef = useRef<number>(0);
  
  // Track selected airport internally for reconnect logic
  const [activeAirport, setActiveAirport] = useState<string>('ZBAA');

  // PTT State
  const [isTransmitting, setIsTransmitting] = useState(false);
  const pttTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const liveClientRef = useRef<LiveClient | null>(null);

  // --- PREVENT SCREEN SLEEP ---
  const isSessionActive = status === ConnectionStatus.BRIEFING || status === ConnectionStatus.CONNECTING || status === ConnectionStatus.CONNECTED || status === ConnectionStatus.ANALYZING;
  useWakeLock(isSessionActive);
  
  // Connection Watchdog Timer
  useEffect(() => {
      let watchdog: ReturnType<typeof setTimeout>;
      
      if (status === ConnectionStatus.CONNECTING) {
          watchdog = setTimeout(() => {
              if (status === ConnectionStatus.CONNECTING) {
                  console.error("Connection timed out.");
                  setStatus(ConnectionStatus.ERROR);
                  setErrorMsg("连接超时。请检查网络或 API Key 设置。");
                  liveClientRef.current?.disconnect();
              }
          }, 15000);
      }

      return () => clearTimeout(watchdog);
  }, [status]);

  // Get API KEY safely with Override support
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

  useEffect(() => {
    if (!API_KEY) {
      setErrorMsg("未找到 API Key。请检查设置。");
    }
    return () => {
      liveClientRef.current?.disconnect();
      if (pttTimeoutRef.current) clearTimeout(pttTimeoutRef.current);
    };
  }, []);

  // Safety Timeout for Analysis
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    if (status === ConnectionStatus.ANALYZING) {
      timeoutId = setTimeout(() => {
        setErrorMsg("分析超时。模型未返回报告，请重试。");
        setStatus(ConnectionStatus.ERROR);
        liveClientRef.current?.disconnect();
      }, 60000);
    }
    return () => clearTimeout(timeoutId);
  }, [status]);

  // PTT Logic Wrapper
  const engagePtt = () => {
      if (status === ConnectionStatus.CONNECTED) {
          if (pttTimeoutRef.current) {
              clearTimeout(pttTimeoutRef.current);
              pttTimeoutRef.current = null;
          }
          if (!isTransmitting) {
              setIsTransmitting(true);
              // Call startRecording (which handles AudioContext resume internally)
              liveClientRef.current?.startRecording();
          }
      }
  };

  const releasePtt = () => {
      if (status === ConnectionStatus.CONNECTED) {
          setIsTransmitting(false);
          // Add 1000ms tail padding to catch end of sentence (FIXED: increased from 500ms)
          pttTimeoutRef.current = setTimeout(() => {
              liveClientRef.current?.stopRecording();
          }, 1000);
      }
  };

  // Keyboard Listeners for Spacebar PTT
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
          engagePtt();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
          releasePtt();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [status, isTransmitting]);

  const saveToSupabase = async (finalAssessment: AssessmentData | null) => {
      if (!scenario) return;
      console.log("Saving session to history...", finalAssessment ? "With Report" : "No Report");
      const durationSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
      
      try {
          const result = await userService.saveSession(
              scenario.title,
              scenario.phase || 'Assessment',
              finalAssessment,
              durationSeconds,
              'ASSESSMENT'
          );
          if (!result.success) {
              console.error("SAVE FAILED:", result.error);
          } else {
              console.log("SESSION SAVED SUCCESSFULLY");
          }
      } catch (e) {
          console.error("Save Exception:", e);
      }
  };

  const startBriefing = async () => {
     try {
       const s = await scenarioService.getRandomAssessmentScenario();
       setScenario(s);
       setStatus(ConnectionStatus.BRIEFING);
       setErrorMsg(null);
     } catch (e) {
       console.error("Failed to load scenario", e);
       setErrorMsg("无法加载考试题目，请检查网络。");
       setStatus(ConnectionStatus.ERROR);
     }
  };
  
  const handleRefreshScenario = async () => {
      const s = await scenarioService.getRandomAssessmentScenario();
      setScenario(s);
  };

  const handleReconnect = async () => {
    if (scenario) {
      handleConnect(activeAirport);
    } else {
      startBriefing();
    }
  };

  const handleConnect = async (selectedAirportCode: string) => {
    if (!API_KEY) {
        setErrorMsg("缺少 API Key。请检查设置。");
        setStatus(ConnectionStatus.ERROR);
        return;
    }
    if (!scenario) return;
    
    setActiveAirport(selectedAirportCode);
    setStatus(ConnectionStatus.CONNECTING);
    setMessages([]); // Clear previous transcript
    
    liveClientRef.current = new LiveClient(API_KEY);
    
    // FORCE PTT BUFFERED MODE for Assessment
    liveClientRef.current.setBufferedMode(true);

    let dynamicRules = "";
    if (scenario.phase) {
        dynamicRules = await ruleService.getLogicRulesForPhase(scenario.phase);
    }

    try {
        await liveClientRef.current.connect(scenario, {
          onOpen: () => {
              console.log(`Connection Established at ${selectedAirportCode}`);
              setStatus(ConnectionStatus.CONNECTED);
              startTimeRef.current = Date.now();
          },
          onClose: () => { 
            setStatus(prev => {
                if (prev === ConnectionStatus.ANALYZING) return prev;
                return prev === ConnectionStatus.ERROR ? prev : ConnectionStatus.DISCONNECTED;
            }); 
            setAudioLevel(0);
          },
          onError: (err) => { 
            console.error("Connection Error (UI):", err);
            setStatus(ConnectionStatus.ERROR); 
            setErrorMsg(err.message || "连接失败。请检查控制台。"); 
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
            console.log("Assessment Received:", data);
            setAssessment(data);
            saveToSupabase(data);
            
            setTimeout(() => {
                setStatus(ConnectionStatus.DISCONNECTED);
                liveClientRef.current?.disconnect();
            }, 500);
          }
        }, difficulty, selectedAirportCode, accentEnabled, cockpitNoise, undefined, dynamicRules);
    } catch (err: any) {
        console.error("Immediate Connection Failure:", err);
        setStatus(ConnectionStatus.ERROR);
        setErrorMsg(err.message || "初始化连接失败。");
    }
  };

  const handleStop = async () => {
    if (liveClientRef.current && status === ConnectionStatus.CONNECTED) {
      setStatus(ConnectionStatus.ANALYZING);
      await liveClientRef.current.finalize();
    } else {
      const currentStatus = status; // Break potential TS narrowing
      if (currentStatus === ConnectionStatus.CONNECTED || currentStatus === ConnectionStatus.ANALYZING) {
          saveToSupabase(null);
      }
      setStatus(ConnectionStatus.DISCONNECTED);
      setAudioLevel(0);
      liveClientRef.current?.disconnect();
    }
  };

  // PTT Handlers (Mouse/Touch)
  const handlePttDown = (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    engagePtt();
  };
  const handlePttUp = (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    releasePtt();
  };

  // Helper for main button state
  const getMainActionState = () => {
      switch (status) {
          case ConnectionStatus.CONNECTED:
              return { label: '交卷', color: 'bg-red-500 hover:bg-red-600 shadow-red-200', icon: 'stop' };
          case ConnectionStatus.ANALYZING:
              return { label: '生成中...', color: 'bg-gray-400', icon: 'loading' };
          case ConnectionStatus.CONNECTING:
              return { label: '连接中...', color: 'bg-gray-400', icon: 'loading' };
          default:
              return { label: '开始测试', color: 'bg-ios-blue hover:bg-blue-600 shadow-blue-200', icon: 'play' };
      }
  };

  const actionState = getMainActionState();

  return (
    <div className="h-full w-full relative flex flex-col bg-ios-bg overflow-hidden text-ios-text font-sans">
      
      {/* Loading Overlay */}
      {status === ConnectionStatus.ANALYZING && (
          <div className="absolute inset-0 z-50 bg-black/40 backdrop-blur-md flex flex-col items-center justify-center text-white animate-fade-in">
              <div className="relative">
                  <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                     <span className="text-xs font-bold animate-pulse">AI</span>
                  </div>
              </div>
              <h2 className="text-2xl font-bold mt-6 mb-2">正在分析表现</h2>
              <p className="text-sm text-white/80">生成 ICAO 评估报告中...</p>
          </div>
      )}

      {/* Assessment Modal */}
      {assessment && (
        <AssessmentReport 
          data={assessment} 
          onClose={() => setAssessment(null)} 
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
             initialFilter="ASSESSMENT"
          />
      )}

      {/* Briefing Modal */}
      {status === ConnectionStatus.BRIEFING && scenario && (
        <BriefingModal 
            scenario={scenario} 
            onAccept={handleConnect}
            onCancel={() => setStatus(ConnectionStatus.DISCONNECTED)}
            onRefresh={handleRefreshScenario}
        />
      )}

      {/* Dynamic Background */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-sky-200/40 rounded-full blur-[100px] animate-blob mix-blend-multiply pointer-events-none"></div>
      <div className="absolute top-[10%] right-[-10%] w-[500px] h-[500px] bg-orange-100/60 rounded-full blur-[100px] animate-blob animation-delay-2000 mix-blend-multiply pointer-events-none"></div>
      
      {/* --- HEADER --- */}
      <header className="z-20 pt-12 pb-4 px-6 flex justify-between items-center bg-ios-bg/50 backdrop-blur-sm sticky top-0">
        <div>
           <div className="flex items-center space-x-2 mb-1">
             <div className={`w-2 h-2 rounded-full ${status === ConnectionStatus.CONNECTED ? 'bg-ios-orange animate-pulse' : 'bg-gray-400'}`}></div>
             <span className="text-[10px] font-bold tracking-widest text-ios-subtext uppercase">ICAO Level 5</span>
           </div>
           <h1 className="text-2xl font-bold tracking-tight text-ios-text">AI 模拟考官</h1>
        </div>
        
        {/* Top Right Controls - Combined Logic */}
        <div className="flex items-center space-x-2">
           
           {/* 1. Main Action Button (Start / Submit) */}
           <button 
                onClick={status === ConnectionStatus.CONNECTED ? handleStop : startBriefing}
                disabled={status === ConnectionStatus.CONNECTING || status === ConnectionStatus.ANALYZING || (!API_KEY && status === ConnectionStatus.DISCONNECTED)}
                className={`h-10 px-4 ${actionState.color} text-white rounded-full font-bold text-sm shadow-lg active:scale-95 transition-all flex items-center disabled:opacity-50 disabled:shadow-none min-w-[100px] justify-center`}
            >
                {actionState.icon === 'loading' ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                ) : actionState.icon === 'stop' ? (
                    <div className="w-3 h-3 bg-white rounded-sm mr-2"></div>
                ) : (
                    <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                )}
                {actionState.label}
            </button>

            {/* 2. History Report Button (Eye-catching) */}
            <button 
                onClick={() => setShowHistory(true)}
                className="h-10 px-4 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-full font-bold text-sm shadow-lg shadow-orange-200 hover:shadow-orange-300 active:scale-95 transition-all flex items-center"
            >
                <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 00-2-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
                历史报告
            </button>

        </div>
      </header>

      {/* --- MAIN CONTENT --- */}
      <main className="z-10 flex-1 flex flex-col relative overflow-hidden">
        
        {/* Upper: Visualizer & Cockpit */}
        <div className="shrink-0 pt-2 pb-4 px-6 flex flex-col items-center space-y-4">
           <Visualizer isActive={status === ConnectionStatus.CONNECTED || status === ConnectionStatus.ANALYZING} audioLevel={audioLevel} />
           <CockpitDisplay 
                active={status === ConnectionStatus.CONNECTED} 
                scenario={scenario} 
                airportCode={activeAirport} 
           />
        </div>

        {/* Lower: Transcript */}
        <div className="flex-1 flex flex-col bg-white/50 backdrop-blur-lg border-t border-white/20 rounded-t-[2.5rem] shadow-soft overflow-hidden mx-2 relative">
            <div className="px-6 py-3 border-b border-black/5 flex justify-between items-center bg-white/40 backdrop-blur-md z-20">
                <span className="text-xs font-semibold text-ios-subtext">实时对话记录 (Live Transcript)</span>
                {status === ConnectionStatus.CONNECTING && <span className="text-xs text-ios-blue animate-pulse">正在连接...</span>}
                {status === ConnectionStatus.CONNECTED && (
                    <span className="text-[10px] font-mono font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded border border-gray-200">
                        {activeAirport}
                    </span>
                )}
            </div>
            
            {/* Pinned Situation Box */}
            {scenario && (
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
                              {scenario.details}
                          </p>
                      </div>
                  </div>
              </div>
            )}
            
            {/* Error Overlay */}
            {status === ConnectionStatus.ERROR && errorMsg && (
              <div className="absolute inset-0 z-50 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
                <div className="w-12 h-12 bg-ios-red/10 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-ios-red" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-ios-text font-bold text-lg mb-2">连接失败</h3>
                <p className="text-ios-subtext text-sm mb-6 max-w-xs">{errorMsg}</p>
                <div className="flex space-x-3">
                  <button 
                    onClick={() => setStatus(ConnectionStatus.DISCONNECTED)}
                    className="px-6 py-2 bg-gray-200 text-gray-700 rounded-full text-sm font-semibold hover:bg-gray-300 transition-all"
                  >
                    取消
                  </button>
                  <button 
                    onClick={handleReconnect}
                    className="px-6 py-2 bg-ios-red text-white rounded-full text-sm font-semibold shadow-lg hover:shadow-ios-red/30 transition-all"
                  >
                    重试
                  </button>
                </div>
              </div>
            )}

            <Transcript messages={messages} />
        </div>

      </main>

      {/* --- FOOTER (CONTROLS) --- */}
      {status === ConnectionStatus.CONNECTED && (
          <footer className="z-20 py-4 px-6 bg-ios-bg border-t border-ios-border/50 animate-slide-up">
             {/* Simplified Footer: Just the PTT Button */}
             <div className="flex justify-center items-center h-16">
                 
                 {/* PTT Button (Main Interaction) */}
                 <button
                    onMouseDown={handlePttDown}
                    onMouseUp={handlePttUp}
                    onMouseLeave={handlePttUp}
                    onTouchStart={handlePttDown}
                    onTouchEnd={handlePttUp}
                    onTouchCancel={handlePttUp}
                    onContextMenu={(e) => e.preventDefault()}
                    className={`w-full max-w-sm rounded-2xl font-bold text-lg shadow-lg transition-all duration-100 flex flex-col items-center justify-center select-none touch-none ring-offset-2 h-full
                    ${isTransmitting 
                        ? 'bg-ios-orange text-white scale-95 ring-2 ring-ios-orange' 
                        : 'bg-white text-ios-text border border-gray-200 active:bg-gray-50'}`}
                 >
                    <span className="text-xl mb-0.5">
                        {isTransmitting ? '🎙️' : '🎤'}
                    </span>
                    <span className="text-xs uppercase tracking-wider opacity-80">
                        {isTransmitting ? '正在说话 (Recording...)' : '按住说话 (Hold to Speak)'}
                    </span>
                 </button>

             </div>
          </footer>
      )}
      
      {/* Empty Footer Placeholder when Disconnected (Optional for spacing/visual balance) */}
      {status === ConnectionStatus.DISCONNECTED && (
          <div className="py-6 text-center opacity-30 pointer-events-none">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Ready for Assessment</p>
          </div>
      )}

    </div>
  );
};

export default AssessmentScreen;
