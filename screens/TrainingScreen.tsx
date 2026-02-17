
import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
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

const PHASES: FlightPhase[] = [
  'Ground Ops', 'Takeoff & Climb', 'Cruise & Enroute', 'Descent & Approach', 'Landing & Taxi in', 'Go-around & Diversion'
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
    initialScenario, onConsumeScenario, difficulty, accentEnabled, cockpitNoise, language 
}) => {
  const [view, setView] = useState<'dashboard' | 'session'>('dashboard');
  const [selectedPhase, setSelectedPhase] = useState<FlightPhase | null>(null);
  const [selectedTag, setSelectedTag] = useState<TrainingTag | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ScenarioCategory | null>(null);
  const [airportCode, setAirportCode] = useState<string>('');
  const [activeAirport, setActiveAirport] = useState<Airport | null>(null);
  const [searchResults, setSearchResults] = useState<Airport[]>([]);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loadingScenarios, setLoadingScenarios] = useState(true);
  const [activeScenario, setActiveScenario] = useState<Scenario | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [isPaused, setIsPaused] = useState(false); 
  const [autoPaused, setAutoPaused] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [assessment, setAssessment] = useState<AssessmentData | null>(null);
  const [showHistory, setShowHistory] = useState(false); 
  
  const startTimeRef = useRef<number>(0);
  const lastInputTimeRef = useRef<number>(0);
  const liveClientRef = useRef<LiveClient | null>(null);
  const currentSessionIdRef = useRef<string>("");

  const statusRef = useRef<ConnectionStatus>(status);
  useEffect(() => { statusRef.current = status; }, [status]);
  useWakeLock(status === ConnectionStatus.CONNECTED || status === ConnectionStatus.CONNECTING);

  useEffect(() => {
    const loadScenarios = async () => {
        setLoadingScenarios(true);
        const data = await scenarioService.getAllScenarios();
        setScenarios(data);
        setLoadingScenarios(false);
    };
    loadScenarios();
    return () => { if (liveClientRef.current) liveClientRef.current.disconnect(); };
  }, []);

  useEffect(() => {
      if (view !== 'dashboard') return;
      const delayDebounce = setTimeout(async () => {
          if (airportCode.length >= 2) {
             const results = await airportService.searchAirports(airportCode);
             setSearchResults(results);
             setShowResults(true);
             if (airportCode.length === 4) {
                 const exact = results.find(a => a.icao_code === airportCode.toUpperCase());
                 setActiveAirport(exact || await airportService.getAirportByCode(airportCode));
             }
          } else {
             setSearchResults([]); setShowResults(false);
             if (airportCode.length === 0) setActiveAirport(null);
          }
      }, 300);
      return () => clearTimeout(delayDebounce);
  }, [airportCode, view]);

  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (searchRef.current && !searchRef.current.contains(event.target as Node)) setShowResults(false);
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
      if (initialScenario) { startTraining(initialScenario); if (onConsumeScenario) onConsumeScenario(); }
  }, [initialScenario]);

  useEffect(() => {
      if (status !== ConnectionStatus.CONNECTED || isPaused) return;
      const checkInterval = setInterval(() => {
          if (Date.now() - lastInputTimeRef.current > 45000) { 
              togglePause(); setAutoPaused(true);
          }
      }, 5000);
      return () => clearInterval(checkInterval);
  }, [status, isPaused]); 

  const selectAirport = (apt: Airport) => { setAirportCode(apt.icao_code); setActiveAirport(apt); setShowResults(false); };

  const togglePause = () => {
      if (status !== ConnectionStatus.CONNECTED) return;
      const newState = !isPaused;
      setIsPaused(newState);
      if (!newState) { setAutoPaused(false); lastInputTimeRef.current = Date.now(); }
      liveClientRef.current?.setInputMuted(newState);
  };

  const handleReconnect = async () => { if (activeScenario) startTraining(activeScenario); else setView('dashboard'); };

  const startTraining = async (scenario: Scenario) => {
    if (status === ConnectionStatus.CONNECTING) return;
    if (liveClientRef.current) { liveClientRef.current.disconnect(); liveClientRef.current = null; }

    const sessionId = Date.now().toString();
    currentSessionIdRef.current = sessionId;

    let sessionAirportCode = airportCode;
    if (!sessionAirportCode || sessionAirportCode.length < 3) {
        const randomApt = await airportService.getRandomAirport();
        sessionAirportCode = randomApt ? randomApt.icao_code : 'ZBAA';
    }

    setActiveScenario(scenario);
    setAirportCode(sessionAirportCode);
    setView('session');
    setStatus(ConnectionStatus.CONNECTING);
    setIsPaused(false); setAutoPaused(false); setShowExitDialog(false);
    if (status !== ConnectionStatus.ERROR) setMessages([]);
    setAssessment(null); setErrorMsg(null);
    startTimeRef.current = Date.now(); lastInputTimeRef.current = Date.now();

    liveClientRef.current = new LiveClient();
    liveClientRef.current.setBufferedMode(false);
    liveClientRef.current.setInputMuted(false); 

    const dynamicRules = scenario.phase ? await ruleService.getLogicRulesForPhase(scenario.phase) : "";
    const coachingInstruction = `
    # SYSTEM INSTRUCTION: FLIGHT INSTRUCTOR
    Current Scenario: ${scenario.title}
    Phase: ${scenario.phase}
    Details: ${scenario.details}
    
    1. Act as ATC.
    2. If user says "REQUEST_HINT", provide Standard ICAO phraseology hint prefixed with "💡 COACH: ".
    `;

    let isAiTurnStart = true;

    await liveClientRef.current.connect(scenario, {
      onOpen: () => {
          if (currentSessionIdRef.current !== sessionId) return;
          setStatus(ConnectionStatus.CONNECTED);
          startTimeRef.current = Date.now(); lastInputTimeRef.current = Date.now();
      },
      onClose: () => {
         if (currentSessionIdRef.current !== sessionId) return;
         if (statusRef.current !== ConnectionStatus.ANALYZING && statusRef.current !== ConnectionStatus.ERROR) {
             setView('dashboard'); setStatus(ConnectionStatus.DISCONNECTED);
         }
      },
      onError: (err) => {
          if (currentSessionIdRef.current !== sessionId) return;
          setStatus(ConnectionStatus.ERROR); setErrorMsg(err.message);
      },
      onAudioData: (level) => {
          if (currentSessionIdRef.current !== sessionId) return;
          setAudioLevel(level);
          if (level > 0.2) lastInputTimeRef.current = Date.now();
      },
      onTurnComplete: () => {
          if (currentSessionIdRef.current !== sessionId) return;
          setAudioLevel(0); isAiTurnStart = true;
      },
      onTranscript: (text, role, isPartial) => {
          if (currentSessionIdRef.current !== sessionId) return;
          if (role === 'user') { lastInputTimeRef.current = Date.now(); isAiTurnStart = true; }
          setMessages(prev => {
            const lastMsg = prev[prev.length - 1];
            if (role === 'user') {
                if (lastMsg && lastMsg.role === 'user' && lastMsg.isPartial) {
                    const newMsgs = [...prev]; newMsgs[newMsgs.length - 1] = { ...lastMsg, text, isPartial };
                    return (!isPartial && !text.trim()) ? prev : newMsgs;
                } else if (text.trim()) {
                    return [...prev, { id: Date.now().toString(), role, text, isPartial }];
                }
                return prev;
            }
            if (role === 'ai') {
                const shouldCreateNew = isAiTurnStart;
                if (shouldCreateNew) isAiTurnStart = false;
                const isHint = text.includes("💡 COACH:");
                if (shouldCreateNew) return [...prev, { id: Date.now().toString(), role, text, isHint }];
                else {
                    if (lastMsg && lastMsg.role === 'ai') {
                        const newMsgs = [...prev]; newMsgs[newMsgs.length - 1] = { ...lastMsg, text: lastMsg.text + text };
                        return newMsgs;
                    } else return [...prev, { id: Date.now().toString(), role, text, isHint }];
                }
            }
            return prev;
          });
      }
    }, difficulty, sessionAirportCode, accentEnabled, cockpitNoise, coachingInstruction, dynamicRules, language);
  };

  const generateReport = async () => {
      if (!activeScenario) return;
      setStatus(ConnectionStatus.ANALYZING);
      
      const transcriptText = messages
          .filter(m => !m.isPartial && m.text.trim())
          .map(m => `${m.role === 'user' ? 'Pilot' : 'ATC'}: ${m.text}`)
          .join('\n');

      try {
          const { data, error } = await supabase.functions.invoke('icao-evaluator', {
              body: { transcript: transcriptText, scenario: activeScenario }
          });

          if (error) throw error;
          if (!data || !data.evaluation) throw new Error("Invalid evaluator response");

          const result = data.evaluation;
          setAssessment(result);
          
          const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);
          await userService.saveSession(activeScenario.title, activeScenario.phase || 'General', result, duration, 'TRAINING');
          
          setStatus(ConnectionStatus.DISCONNECTED);
          liveClientRef.current?.disconnect();

      } catch (e: any) {
          console.error('Training Evaluation Failed:', e);
          setErrorMsg("报告生成失败，请重试。");
          setStatus(ConnectionStatus.ERROR);
      }
  };

  const handleQuitNow = () => {
      setShowExitDialog(false);
      liveClientRef.current?.disconnect();
      if (statusRef.current === ConnectionStatus.CONNECTED) {
           const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);
           userService.saveSession(activeScenario?.title || 'Training', activeScenario?.phase || 'General', null, duration, 'TRAINING');
      }
      setStatus(ConnectionStatus.DISCONNECTED);
      setView('dashboard');
  };

  const handleFinishWithReport = async () => {
      setShowExitDialog(false);
      if (status === ConnectionStatus.CONNECTED) {
          await generateReport();
      } else {
          handleQuitNow();
      }
  };

  const requestHint = () => {
      if (status === ConnectionStatus.CONNECTED) {
          liveClientRef.current?.sendText("REQUEST_HINT");
          lastInputTimeRef.current = Date.now();
      }
  };

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
      endSession: language === 'cn' ? '结束' : 'End', 
      brief: language === 'cn' ? '情景简报' : 'Situation Brief',
      liveTranscript: language === 'cn' ? '实时对话' : 'Live Transcript (ATC Only)',
      aiHint: language === 'cn' ? 'AI 提示' : 'AI Hint',
      generating: language === 'cn' ? '正在生成反馈' : 'Generating Feedback',
      analyzing: language === 'cn' ? '教员正在分析你的表现...' : 'Analyzing performance...',
      connectFail: language === 'cn' ? '连接失败' : 'Connection Failed',
      returnHome: language === 'cn' ? '返回主页' : 'Return Home',
      resumeSession: language === 'cn' ? '恢复会话' : 'Resume Session',
      openMic: language === 'cn' ? '麦克风已开启' : 'Mic Active',
      pausedText: language === 'cn' ? '已暂停' : 'Paused',
      autoPaused: language === 'cn' ? '已自动暂停' : 'Auto-Paused',
      connecting: language === 'cn' ? '连接中...' : 'Connecting...',
      quitConfirmTitle: language === 'cn' ? '结束本次训练?' : 'End Session?',
      quitConfirmDesc: language === 'cn' ? '您可以选择生成详细评估报告（需等待 AI 分析），或直接退出。' : 'Generate a detailed report (waits for AI) or just quit.',
      quitBtn: language === 'cn' ? '直接退出 (Quit)' : 'Quit (No Report)',
      reportBtn: language === 'cn' ? '生成报告 (Finish & Report)' : 'Finish & Report',
      cancel: language === 'cn' ? '取消' : 'Cancel',
  };

  const renderDashboard = () => {
      const validTagsForPhase = selectedPhase ? PHASE_LOGIC_CONFIG[selectedPhase] : null;
      const filteredScenarios = scenarios.filter(s => {
          const matchPhase = selectedPhase ? s.phase === selectedPhase : true;
          let matchTag = true;
          if (selectedTag) {
              const sTags = (s as any).tags as TrainingTag[];
              matchTag = sTags ? sTags.includes(selectedTag) : false;
          } else if (selectedCategory) {
              matchTag = s.category === selectedCategory;
          }
          return matchPhase && matchTag;
      });

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
              <div className="pt-12 pb-4 px-6 bg-white/80 backdrop-blur-md sticky top-0 z-10 border-b border-ios-border flex flex-col space-y-4">
                  <div className="flex justify-between items-center">
                      <div>
                          <h1 className="text-2xl font-bold text-ios-text">{t.title}</h1>
                          <div className="flex items-center space-x-2 mt-1">
                              <p className="text-sm text-ios-subtext">{t.subtext}</p>
                              <div className="text-[10px] font-bold text-ios-blue bg-blue-50 px-2 py-0.5 rounded border border-blue-100 uppercase">Mode: {difficulty}</div>
                          </div>
                      </div>
                      <button onClick={() => setShowHistory(true)} className="flex items-center space-x-1.5 bg-gradient-to-r from-ios-blue to-ios-indigo text-white px-4 py-2 rounded-full shadow-lg">
                         <span className="text-sm font-bold">{t.history}</span>
                      </button>
                  </div>
              </div>
              <div className="px-6 mb-4">
                  <div className="relative mb-6" ref={searchRef}>
                     <input type="text" placeholder={t.airportPlace} className="w-full pl-4 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-mono font-bold uppercase"
                        value={airportCode} onChange={(e) => { setAirportCode(e.target.value.toUpperCase()); setShowResults(true); }}
                        onFocus={() => { if(airportCode.length >= 2) setShowResults(true); }}
                     />
                     {showResults && searchResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 max-h-48 overflow-y-auto z-50">
                            {searchResults.map((apt) => (
                                <button key={apt.id} onClick={() => selectAirport(apt)} className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center justify-between border-b border-gray-50 last:border-0">
                                    <div><div className="font-bold text-sm text-gray-800"><span className="font-mono text-ios-blue mr-2">{apt.icao_code}</span>{apt.city}</div></div>
                                </button>
                            ))}
                        </div>
                     )}
                  </div>
                  <h3 className="text-sm font-bold text-ios-subtext uppercase tracking-widest mb-3">{t.flightPhase}</h3>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                      <button onClick={() => { setSelectedPhase(null); setSelectedTag(null); }} className={`col-span-2 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${!selectedPhase ? 'bg-ios-text text-white' : 'bg-white text-ios-subtext'}`}>{t.allPhases}</button>
                      {PHASES.map(phase => (
                          <button key={phase} onClick={() => { setSelectedPhase(phase); setSelectedTag(null); }} className={`py-2 px-2 rounded-xl text-xs font-bold transition-all shadow-sm truncate ${selectedPhase === phase ? 'bg-ios-blue text-white' : 'bg-white text-ios-subtext'}`}>{phase}</button>
                      ))}
                  </div>
                  <h3 className="text-sm font-bold text-ios-subtext uppercase tracking-widest mt-4 mb-3">{selectedPhase ? t.applicableFailures : t.category}</h3>
                  <div className="flex flex-wrap gap-2">
                      {selectedPhase && validTagsForPhase ? validTagsForPhase.map(tag => (
                              <button key={tag} onClick={() => setSelectedTag(selectedTag === tag ? null : tag)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${selectedTag === tag ? 'bg-red-50 text-red-600 border-red-200' : 'bg-white text-ios-text border-gray-200'}`}>{tag}</button>
                          )) : SCENARIO_CATEGORIES.map(cat => (
                              <button key={cat} onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${selectedCategory === cat ? 'bg-ios-blue/10 text-ios-blue border-ios-blue' : 'bg-white text-ios-text border-gray-200'}`}>{cat}</button>
                          ))}
                  </div>
              </div>
              <div className="px-6 pb-6 space-y-3">
                  {loadingScenarios ? <div className="text-center py-10 text-gray-400">Loading...</div> : filteredScenarios.map(scenario => (
                      <button key={scenario.id} onClick={() => startTraining(scenario)} className="w-full text-left bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all active:scale-[0.99]">
                          <div className="flex justify-between items-start mb-1">
                              <div className="flex items-center space-x-2">
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-ios-blue/5 text-ios-blue">{scenario.category}</span>
                                  {scenario.difficulty_level && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${getDifficultyColor(scenario.difficulty_level)}`}>{scenario.difficulty_level}</span>}
                              </div>
                              <span className="text-[10px] font-mono text-gray-400">{scenario.phase}</span>
                          </div>
                          <h4 className="font-bold text-ios-text mb-1">{scenario.title}</h4>
                      </button>
                  ))}
              </div>
          </div>
      );
  };

  const renderSession = () => (
      <div className="h-full flex flex-col relative bg-ios-bg overflow-hidden font-sans">
        {status === ConnectionStatus.ANALYZING && (
          <div className="absolute inset-0 z-50 bg-black/40 backdrop-blur-md flex flex-col items-center justify-center text-white">
              <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mb-6"></div>
              <h2 className="text-2xl font-bold mb-2">{t.generating}</h2>
              <p className="text-white/80 text-center max-w-xs">{t.analyzing}</p>
          </div>
        )}
        {showExitDialog && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6 flex flex-col items-center text-center">
                    <h3 className="text-lg font-bold text-gray-900 mb-2">{t.quitConfirmTitle}</h3>
                    <div className="w-full space-y-3">
                        <button onClick={handleFinishWithReport} className="w-full py-3 bg-ios-blue text-white rounded-xl font-bold">{t.reportBtn}</button>
                        <button onClick={handleQuitNow} className="w-full py-3 bg-white border border-gray-200 text-red-500 font-bold rounded-xl">{t.quitBtn}</button>
                        <button onClick={() => setShowExitDialog(false)} className="w-full py-2 text-gray-400 text-xs font-semibold">{t.cancel}</button>
                    </div>
                </div>
            </div>
        )}
        <div className="pt-14 px-6 pb-2 flex justify-between items-center z-10 shrink-0 h-24">
            <h1 className="text-sm font-bold text-ios-text truncate opacity-80">{activeScenario?.title}</h1>
        </div>
        <div className="flex-1 relative z-10 w-full overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[35%] flex flex-col items-center justify-end pb-4 px-4 space-y-4">
                <div className="flex-1 w-full flex items-center justify-center overflow-visible min-h-0 relative">
                    <div className="scale-[0.8] transform transition-transform">
                        <Visualizer isActive={(status === ConnectionStatus.CONNECTED || status === ConnectionStatus.ANALYZING) && !isPaused} audioLevel={audioLevel} />
                    </div>
                </div>
                <div className="w-full shrink-0 h-28 sm:h-32">
                    <CockpitDisplay active={status === ConnectionStatus.CONNECTED && !isPaused} scenario={activeScenario} airportCode={airportCode} airportData={activeAirport} />
                </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 top-[35%] px-4 pb-0">
                <div className="w-full h-full bg-white/70 backdrop-blur-xl border-t border-x border-white/60 rounded-t-[2rem] shadow-sm flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-white/50 shrink-0 bg-white/30 backdrop-blur-sm flex flex-col gap-3">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center space-x-3 flex-1 min-w-0 pr-2">
                                <span className="text-[9px] font-bold text-gray-400 flex items-center truncate">
                                    <span className={`w-1.5 h-1.5 rounded-full mr-1 shrink-0 ${status === ConnectionStatus.CONNECTED && !isPaused ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></span>
                                    {status === ConnectionStatus.CONNECTED ? (autoPaused ? t.autoPaused : (isPaused ? t.pausedText : t.openMic)) : t.connecting}
                                </span>
                            </div>
                            <div className="flex items-center space-x-2 shrink-0">
                                <button onClick={togglePause} disabled={status !== ConnectionStatus.CONNECTED} className={`flex items-center justify-center space-x-1.5 px-5 py-2 rounded-xl font-bold text-xs shadow-md transition-all active:scale-95 min-w-[100px] ${isPaused ? 'bg-green-500 text-white' : 'bg-orange-500 text-white'}`}>
                                    <span>{isPaused ? t.resume : t.pause}</span>
                                </button>
                                <button onClick={() => setShowExitDialog(true)} disabled={status === ConnectionStatus.ANALYZING} className="flex items-center justify-center space-x-1.5 px-5 py-2 rounded-xl bg-red-500 text-white font-bold text-xs shadow-md active:scale-95 transition-all min-w-[100px]">
                                    <span>{t.endSession}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 flex flex-col min-h-0 relative bg-white/30">
                        <div className="flex justify-between items-center px-3 py-2 shrink-0 border-b border-gray-100/50">
                            <span className="text-[10px] font-bold text-ios-subtext uppercase tracking-widest">{t.liveTranscript}</span>
                            <button onClick={requestHint} disabled={status !== ConnectionStatus.CONNECTED || isPaused} className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-lg text-[10px] font-bold uppercase">{t.aiHint}</button>
                        </div>
                        <div className="flex-1 overflow-hidden relative">
                           <Transcript messages={messages} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </div>
  );

  return (
    <>
      {view === 'dashboard' ? renderDashboard() : renderSession()}
      {assessment && <AssessmentReport data={assessment} onClose={() => { setAssessment(null); setView('dashboard'); }} language={language} />}
      {showHistory && <HistoryModal onClose={() => setShowHistory(false)} onSelectReport={(data) => { setAssessment(data); setShowHistory(false); }} initialFilter="TRAINING" />}
    </>
  );
};

export default TrainingScreen;
