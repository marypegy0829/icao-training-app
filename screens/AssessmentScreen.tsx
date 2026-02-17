
import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { scenarioService } from '../services/scenarioService';
import { ruleService } from '../services/ruleService';
import { userService } from '../services/userService';
import { airportService, Airport } from '../services/airportService';
import { LiveClient } from '../services/liveClient';
import { ConnectionStatus, ChatMessage, AssessmentData, Scenario, DifficultyLevel, AppLanguage } from '../types';
import BriefingModal from '../components/BriefingModal';
import Visualizer from '../components/Visualizer';
import CockpitDisplay from '../components/CockpitDisplay';
import Transcript from '../components/Transcript';
import AssessmentReport from '../components/AssessmentReport';
import HistoryModal from '../components/HistoryModal';
import { useWakeLock } from '../hooks/useWakeLock';

interface AssessmentScreenProps {
    difficulty: DifficultyLevel;
    accentEnabled: boolean;
    cockpitNoise: boolean;
    language: AppLanguage;
}

const AssessmentScreen: React.FC<AssessmentScreenProps> = ({ difficulty, accentEnabled, cockpitNoise, language }) => {
    // Flow State
    const [view, setView] = useState<'lobby' | 'briefing' | 'exam' | 'report'>('lobby');
    const [showHistory, setShowHistory] = useState(false);
    const [isTimeout, setIsTimeout] = useState(false); 
    const [showExitDialog, setShowExitDialog] = useState(false);
    
    // Data State
    const [scenario, setScenario] = useState<Scenario | null>(null);
    const [activeAirport, setActiveAirport] = useState<Airport | null>(null);
    const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [audioLevel, setAudioLevel] = useState(0);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [assessment, setAssessment] = useState<AssessmentData | null>(null);

    // Live Client Refs
    const liveClientRef = useRef<LiveClient | null>(null);
    const currentSessionIdRef = useRef<string>("");
    const startTimeRef = useRef<number>(0);
    const lastActivityRef = useRef<number>(0);
    
    // PTT State
    const [isTransmitting, setIsTransmitting] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false); 
    const pttTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const sfxContextRef = useRef<AudioContext | null>(null);

    useWakeLock(view === 'exam');

    useEffect(() => {
        return () => {
            if (liveClientRef.current) {
                liveClientRef.current.disconnect();
                liveClientRef.current = null;
            }
            if (sfxContextRef.current) {
                sfxContextRef.current.close();
            }
        };
    }, []);

    // 3-Minute Inactivity Timer
    useEffect(() => {
        if (status !== ConnectionStatus.CONNECTED) return;
        const checkInterval = setInterval(() => {
            const idleTime = Date.now() - lastActivityRef.current;
            if (idleTime > 180000) {
                handleTimeoutDisconnect();
            }
        }, 5000);
        return () => clearInterval(checkInterval);
    }, [status]);

    const updateActivity = () => {
        lastActivityRef.current = Date.now();
    };

    const handleTimeoutDisconnect = () => {
        if (liveClientRef.current) {
            liveClientRef.current.disconnect();
        }
        setStatus(ConnectionStatus.DISCONNECTED);
        setIsTimeout(true);
    };

    const startNewAssessmentProcess = async () => {
        const randomScenario = await scenarioService.getRandomAssessmentScenario();
        setScenario(randomScenario);
        setView('briefing');
    };

    const handleAcceptBriefing = (airportCode: string) => {
        if (!scenario) return;
        startExam(scenario, airportCode);
    };

    const playPttSound = (type: 'ON' | 'OFF') => {
        try {
            if (!sfxContextRef.current) {
                sfxContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            }
            const ctx = sfxContextRef.current;
            if (ctx.state === 'suspended') ctx.resume();

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            if (type === 'ON') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(1200, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.05);
                gain.gain.setValueAtTime(0.1, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.06);
            } else {
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(150, ctx.currentTime);
                osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.1);
                gain.gain.setValueAtTime(0.15, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.1);
            }
        } catch (e) { /* ignore */ }
    };

    const startExam = async (examScenario: Scenario, airportCode: string) => {
        if (status === ConnectionStatus.CONNECTING) return;
        if (liveClientRef.current) {
            liveClientRef.current.disconnect();
            liveClientRef.current = null;
        }

        const sessionId = Date.now().toString();
        currentSessionIdRef.current = sessionId;

        setScenario(examScenario);
        setView('exam');
        setStatus(ConnectionStatus.CONNECTING);
        setMessages([]);
        setAssessment(null);
        setErrorMsg(null);
        setIsTimeout(false);
        setIsProcessing(false);
        setShowExitDialog(false);
        startTimeRef.current = Date.now();
        lastActivityRef.current = Date.now();

        liveClientRef.current = new LiveClient();
        liveClientRef.current.setBufferedMode(true);
        liveClientRef.current.setInputMuted(true);

        const [dynamicRules, airportData] = await Promise.all([
            ruleService.getLogicRulesForPhase(examScenario.phase || 'Ground Ops'),
            airportService.getAirportByCode(airportCode)
        ]);
        setActiveAirport(airportData);

        const assessmentInstruction = `
        # SYSTEM INSTRUCTION: ICAO EXAMINER
        You are an ICAO English Examiner and ATC.
        Conduct a formal assessment for the pilot.
        
        Scenario: ${examScenario.title}
        Phase: ${examScenario.phase}
        Details: ${examScenario.details}
        Weather: ${examScenario.weather}

        1. Act as ATC. Issue instructions clearly.
        2. Introduce complications based on the scenario details.
        3. DO NOT BREAK CHARACTER.
        `;

        await liveClientRef.current.connect(
            examScenario,
            {
                onOpen: () => {
                    if (currentSessionIdRef.current !== sessionId) return;
                    setStatus(ConnectionStatus.CONNECTED);
                    startTimeRef.current = Date.now();
                    updateActivity();
                },
                onClose: () => {
                   if (currentSessionIdRef.current !== sessionId) return;
                   if (status !== ConnectionStatus.ANALYZING && status !== ConnectionStatus.ERROR) {
                       // Handled by UI state
                   }
                },
                onError: (err) => {
                    if (currentSessionIdRef.current !== sessionId) return;
                    setStatus(ConnectionStatus.ERROR);
                    setErrorMsg(err.message);
                    setIsProcessing(false);
                },
                onAudioData: (level) => {
                    if (currentSessionIdRef.current !== sessionId) return;
                    setAudioLevel(level);
                },
                onTurnComplete: () => {
                    if (currentSessionIdRef.current !== sessionId) return;
                    setAudioLevel(0);
                    updateActivity();
                    setIsProcessing(false); 
                },
                onTranscript: (text, role, isPartial) => {
                    if (currentSessionIdRef.current !== sessionId) return;
                    updateActivity();
                    if (role === 'ai') setIsProcessing(false);

                    setMessages(prev => {
                        const lastMsg = prev[prev.length - 1];
                        if (role === 'user') {
                            if (lastMsg && lastMsg.role === 'user' && lastMsg.isPartial) {
                                const newMsgs = [...prev];
                                newMsgs[newMsgs.length - 1] = { ...lastMsg, text, isPartial };
                                if (!isPartial && !text) return prev;
                                return newMsgs;
                            } else if (text) {
                                return [...prev, { id: Date.now().toString(), role, text, isPartial }];
                            }
                        } else if (role === 'ai') {
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
                }
            },
            difficulty,
            airportCode,
            accentEnabled,
            cockpitNoise,
            assessmentInstruction,
            dynamicRules,
            language
        );
    };

    // --- NEW: Backend Evaluation Logic ---
    const generateAssessment = async () => {
        if (!scenario) return;
        
        setStatus(ConnectionStatus.ANALYZING);
        
        // 1. Prepare Transcript
        // Format: "Pilot: xxx \n ATC: yyy"
        const transcriptText = messages
            .filter(m => !m.isPartial && m.text.trim())
            .map(m => `${m.role === 'user' ? 'Pilot' : 'ATC'}: ${m.text}`)
            .join('\n');

        console.log("Submitting transcript for evaluation...", transcriptText.length);

        try {
            // 2. Call Supabase Edge Function
            const { data, error } = await supabase.functions.invoke('icao-evaluator', {
                body: { 
                    transcript: transcriptText, 
                    scenario: scenario
                }
            });

            if (error) {
                throw error;
            }

            if (!data || !data.evaluation) {
                throw new Error("Invalid response format from evaluator.");
            }

            const result = data.evaluation;
            
            // 3. Process Result
            setAssessment(result);
            setStatus(ConnectionStatus.DISCONNECTED);
            
            // 4. Save to DB
            const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);
            await userService.saveSession(
                scenario.title,
                scenario.phase || 'General',
                result,
                duration,
                'ASSESSMENT'
            );
            
            setView('report');

        } catch (e: any) {
            console.error('航线通信故障 (Evaluation Failed):', e);
            setErrorMsg("评测服务暂时不可用，请稍后重试。\n" + (e.message || "Unknown Backend Error"));
            setStatus(ConnectionStatus.ERROR);
        }
    };

    const handleAbort = () => {
        liveClientRef.current?.disconnect();
        setStatus(ConnectionStatus.DISCONNECTED);
        setView('lobby');
        setIsTimeout(false);
        setIsProcessing(false);
        setShowExitDialog(false);
    };

    const handleFinishManually = async () => {
        setShowExitDialog(false);
        if (liveClientRef.current) {
            liveClientRef.current.disconnect();
        }
        
        // Trigger Backend Evaluation
        await generateAssessment();
    };

    // ... PTT Logic ...
    const engagePtt = () => {
        updateActivity();
        playPttSound('ON');
        if (status === ConnectionStatus.CONNECTED) {
            setIsProcessing(false);
            if (pttTimeoutRef.current) {
                clearTimeout(pttTimeoutRef.current);
                pttTimeoutRef.current = null;
                setIsTransmitting(true);
                return;
            }
            if (!isTransmitting) {
                setIsTransmitting(true);
                liveClientRef.current?.startRecording();
            }
        }
    };

    const releasePtt = () => {
        playPttSound('OFF');
        if (status === ConnectionStatus.CONNECTED) {
            setIsTransmitting(false);
            setIsProcessing(true);
            pttTimeoutRef.current = setTimeout(() => {
                liveClientRef.current?.stopRecording();
                pttTimeoutRef.current = null;
            }, 1000);
        }
    };

    // Helper for Translations
    const t = {
        proficiencyCheck: language === 'cn' ? '能力评估' : 'Proficiency Check',
        icaoLevel: language === 'cn' ? 'ICAO 4-6级 模拟考试' : 'ICAO Level 4-6 Assessment',
        standardized: language === 'cn' ? '标准语音评估' : 'Standardized',
        voiceAssessment: language === 'cn' ? '' : 'Voice Assessment',
        desc: language === 'cn' ? '模拟特情与非正常情况，基于ICAO六大维度进行评分。' : 'Simulate emergency and non-routine situations. Rated on 6 ICAO dimensions.',
        time: language === 'cn' ? '约10分钟' : '~10 Mins',
        skills: language === 'cn' ? '6项技能' : '6 Skills',
        scoring: language === 'cn' ? '评分标准' : 'Scoring Criteria',
        begin: language === 'cn' ? '开始评估' : 'Begin Assessment',
        examSubmitted: language === 'cn' ? '考试已提交' : 'Exam Submitted',
        generating: language === 'cn' ? '正在生成官方报告...' : 'Generating Official Report...',
        liveExam: language === 'cn' ? '考试进行中' : 'LIVE EXAM',
        finish: language === 'cn' ? '结束考试' : 'Finish Exam',
        situation: language === 'cn' ? '情景简报' : 'Situation Brief',
        ptt: language === 'cn' ? '按住说话' : 'Push to Talk',
        transmitting: language === 'cn' ? '正在发送...' : 'Transmitting',
        holdToSpeak: language === 'cn' ? '按住发言' : 'Hold to Speak', 
        connectionError: language === 'cn' ? '连接错误' : 'Connection Error',
        returnLobby: language === 'cn' ? '返回大厅' : 'Return to Lobby',
        timeoutTitle: language === 'cn' ? '会话超时' : 'Session Timed Out',
        timeoutDesc: language === 'cn' ? '您已超过3分钟未活动，连接已断开以节省资源。' : 'Disconnected due to inactivity (3 mins).',
        refresh: language === 'cn' ? '重新开始' : 'Restart',
        standby: language === 'cn' ? '请回复 ATC' : 'Reply to ATC', 
        processing: language === 'cn' ? 'ATC 思考中...' : 'ATC Thinking...', 
        wait: language === 'cn' ? '请等待回复' : 'Please wait',
        quitConfirmTitle: language === 'cn' ? '提交或放弃?' : 'Submit or Abort?',
        quitConfirmDesc: language === 'cn' ? '您可以提交考试以生成评估报告，或者直接放弃本次考试。' : 'Submit to generate an assessment report, or abort without saving.',
        abortBtn: language === 'cn' ? '放弃考试 (Abort)' : 'Abort Exam',
        submitBtn: language === 'cn' ? '提交评估 (Submit)' : 'Submit Exam',
        cancel: language === 'cn' ? '取消' : 'Cancel',
        bgProcess: language === 'cn' ? '后台处理 (返回大厅)' : 'Run in Background (Return to Lobby)'
    };

    // --- RENDERERS ---

    const renderLobby = () => (
        <div className="h-full bg-ios-bg flex flex-col relative overflow-hidden font-sans">
            <div className="absolute top-[-20%] right-[-20%] w-[500px] h-[500px] bg-blue-100/50 rounded-full blur-[80px] pointer-events-none"></div>
            <div className="pt-12 px-6 pb-2 flex justify-between items-center z-10">
                <div>
                    <h1 className="text-3xl font-bold text-ios-text tracking-tight">{t.proficiencyCheck}</h1>
                    <p className="text-sm text-ios-subtext font-medium mt-1">{t.icaoLevel}</p>
                </div>
                <button onClick={() => setShowHistory(true)} className="w-10 h-10 bg-white rounded-full shadow-sm border border-gray-100 flex items-center justify-center text-ios-blue">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 relative z-10 pb-20">
                <div className="bg-white rounded-[2rem] p-6 shadow-soft border border-gray-100 relative overflow-hidden group">
                    <div className="flex justify-between items-start mb-4">
                        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-ios-blue/10 border border-ios-blue/20">
                            <span className="w-2 h-2 rounded-full bg-ios-blue animate-pulse"></span>
                            <span className="text-[10px] font-bold text-ios-blue uppercase tracking-wider">AI Examiner Ready</span>
                        </div>
                        <span className="text-2xl">👨‍✈️</span>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2 leading-tight">{t.standardized}<br/>{t.voiceAssessment}</h2>
                    <p className="text-sm text-gray-500 leading-relaxed mb-6 max-w-xs">{t.desc}</p>
                </div>
                <div className="py-2">
                    <button onClick={startNewAssessmentProcess} className="w-full bg-gradient-to-r from-ios-blue to-ios-indigo text-white py-4 rounded-2xl font-bold text-lg shadow-lg hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center">
                        <span className="relative z-10">{t.begin}</span>
                    </button>
                </div>
            </div>
        </div>
    );

    const renderExam = () => (
        <div className="h-full flex flex-col relative bg-ios-bg overflow-hidden font-sans">
            {isTimeout && (
                <div className="absolute inset-0 z-50 bg-white/90 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">{t.timeoutTitle}</h2>
                    <button onClick={handleAbort} className="px-8 py-3 bg-ios-text text-white rounded-xl font-bold shadow-lg">{t.refresh}</button>
                </div>
            )}
            {showExitDialog && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6 flex flex-col items-center text-center">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">{t.quitConfirmTitle}</h3>
                        <p className="text-sm text-gray-500 mb-6 leading-relaxed">{t.quitConfirmDesc}</p>
                        <div className="w-full space-y-3">
                            <button onClick={handleFinishManually} className="w-full py-3 bg-ios-blue text-white rounded-xl font-bold">{t.submitBtn}</button>
                            <button onClick={handleAbort} className="w-full py-3 bg-white border border-gray-200 text-red-500 font-bold rounded-xl">{t.abortBtn}</button>
                            <button onClick={() => setShowExitDialog(false)} className="w-full py-2 text-gray-400 text-xs font-semibold">{t.cancel}</button>
                        </div>
                    </div>
                </div>
            )}
            {status === ConnectionStatus.ANALYZING && (
                 <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-md flex flex-col items-center justify-center text-ios-text animate-fade-in p-6 text-center">
                     <div className="w-20 h-20 border-4 border-ios-blue border-t-transparent rounded-full animate-spin mb-6"></div>
                     <h2 className="text-2xl font-bold mb-2">{t.examSubmitted}</h2>
                     <p className="text-ios-subtext text-sm mb-8">{t.generating}</p>
                 </div>
            )}
            <div className="pt-12 px-6 pb-2 flex justify-between items-center z-10 shrink-0 h-24">
                <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2 bg-white/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/60 shadow-sm">
                        <div className="w-2 h-2 rounded-full bg-red-50 animate-pulse"></div>
                        <span className="text-[10px] font-bold text-red-50 uppercase tracking-widest">{t.liveExam}</span>
                    </div>
                </div>
                <button onClick={() => setShowExitDialog(true)} disabled={status !== ConnectionStatus.CONNECTED} className="bg-white/80 backdrop-blur-md text-ios-red border border-red-100 px-4 py-2 rounded-full text-xs font-bold shadow-sm flex items-center space-x-1">
                    <span className="uppercase tracking-wide">{t.finish}</span>
                </button>
            </div>
            <div className="flex-[3] flex flex-col items-center justify-center px-6 pt-2 pb-2 min-h-0 space-y-6 z-10">
                <div className="w-full flex-1 flex items-center justify-center overflow-visible">
                    <Visualizer isActive={status === ConnectionStatus.CONNECTED} audioLevel={audioLevel} />
                </div>
                <div className="w-full shrink-0">
                    <CockpitDisplay active={status === ConnectionStatus.CONNECTED} scenario={scenario} airportCode={activeAirport?.icao_code || '----'} airportData={activeAirport} />
                </div>
            </div>
            <div className="flex-[1] px-6 w-full min-h-0 mb-4 z-10">
                <div className="bg-white/70 backdrop-blur-xl border border-white/60 rounded-2xl p-4 shadow-sm h-full flex flex-col overflow-hidden">
                    <div className="flex items-center space-x-2 mb-2 opacity-80 shrink-0">
                        <span className="text-[10px] font-bold text-ios-subtext uppercase tracking-widest">{t.situation}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <h3 className="text-sm font-bold text-ios-text mb-1 truncate">{scenario?.title}</h3>
                        <div className="text-xs text-gray-700 leading-relaxed font-medium text-justify">{scenario?.details}</div>
                    </div>
                </div>
            </div>
            <div className="shrink-0 pt-4 pb-12 px-8 flex justify-center items-center relative z-20">
                 <button
                    onMouseDown={engagePtt}
                    onMouseUp={releasePtt}
                    onMouseLeave={releasePtt}
                    onTouchStart={engagePtt}
                    onTouchEnd={releasePtt}
                    onTouchCancel={releasePtt}
                    disabled={status !== ConnectionStatus.CONNECTED}
                    className={`group relative w-full max-w-sm h-20 rounded-full flex items-center justify-center shadow-lg transition-all ${isTransmitting ? 'bg-red-500 text-white' : isProcessing ? 'bg-amber-100 text-amber-900' : 'bg-green-50 text-green-700'}`}
                 >
                     <div className="flex flex-col items-center">
                         <span className="text-base font-bold uppercase tracking-wider">{isTransmitting ? t.transmitting : isProcessing ? t.processing : t.holdToSpeak}</span>
                     </div>
                 </button>
            </div>
        </div>
    );

    return (
        <div className="h-full w-full bg-ios-bg overflow-hidden relative font-sans">
            {view === 'lobby' && renderLobby()}
            {view === 'briefing' && scenario && (
                <BriefingModal scenario={scenario} onAccept={handleAcceptBriefing} onCancel={handleAbort} onRefresh={startNewAssessmentProcess} />
            )}
            {view === 'exam' && renderExam()}
            {view === 'report' && assessment && (
                <AssessmentReport data={assessment} onClose={() => setView('lobby')} language={language} />
            )}
            {status === ConnectionStatus.ERROR && (
                <div className="absolute inset-0 bg-white/90 backdrop-blur-md z-50 flex items-center justify-center flex-col p-8 text-center">
                    <h2 className="text-xl font-bold text-gray-900 mb-2">{t.connectionError}</h2>
                    <p className="text-gray-500 mb-6 text-sm">{errorMsg}</p>
                    <button onClick={() => setView('lobby')} className="px-8 py-3 bg-ios-text text-white rounded-xl font-bold">{t.returnLobby}</button>
                </div>
            )}
            {showHistory && (
                <HistoryModal onClose={() => setShowHistory(false)} initialFilter="ASSESSMENT" onSelectReport={(data) => { setAssessment(data); setShowHistory(false); setView('report'); }} />
            )}
        </div>
    );
};

export default AssessmentScreen;
