
import React, { useState, useRef, useEffect } from 'react';
import { scenarioService } from '../services/scenarioService';
import { ruleService } from '../services/ruleService';
import { userService } from '../services/userService';
import { airportService, Airport } from '../services/airportService';
import { configService } from '../services/configService'; // Import configService
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
    const [isTimeout, setIsTimeout] = useState(false); // NEW: Timeout State
    
    // Data State
    const [scenario, setScenario] = useState<Scenario | null>(null);
    const [activeAirport, setActiveAirport] = useState<Airport | null>(null); // Store full airport object
    const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [audioLevel, setAudioLevel] = useState(0);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [assessment, setAssessment] = useState<AssessmentData | null>(null);

    // Live Client Refs
    const liveClientRef = useRef<LiveClient | null>(null);
    // NEW: Session ID Ref to prevent ghost callbacks
    const currentSessionIdRef = useRef<string>("");

    const startTimeRef = useRef<number>(0);
    
    // Inactivity Tracking (3 Minutes Rule)
    const lastActivityRef = useRef<number>(0);
    
    // PTT State
    const [isTransmitting, setIsTransmitting] = useState(false);
    // NEW: Processing State (ATC Thinking)
    const [isProcessing, setIsProcessing] = useState(false); 
    const pttTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Prevent Sleep during exam
    useWakeLock(view === 'exam');

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            // Force cleanup on unmount
            if (liveClientRef.current) {
                liveClientRef.current.disconnect();
                liveClientRef.current = null;
            }
        };
    }, []);

    // 3-Minute Inactivity Timer Hook
    useEffect(() => {
        if (status !== ConnectionStatus.CONNECTED) return;

        const checkInterval = setInterval(() => {
            const idleTime = Date.now() - lastActivityRef.current;
            // 3 minutes = 180,000 ms
            if (idleTime > 180000) {
                console.log("Assessment Session Timed Out due to inactivity.");
                handleTimeoutDisconnect();
            }
        }, 5000); // Check every 5 seconds

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

    const startExam = async (examScenario: Scenario, airportCode: string) => {
        // 0. Prevent Double Clicks
        if (status === ConnectionStatus.CONNECTING) return;

        // Fetch API Key (from DB or Env)
        const apiKey = await configService.getGoogleApiKey();
        
        if (!apiKey) {
            setErrorMsg("API Key Missing. Check Supabase config or .env.");
            setStatus(ConnectionStatus.ERROR);
            return;
        }

        // 1. STRICT TEARDOWN: Kill previous instance to prevent ghost connections
        if (liveClientRef.current) {
            liveClientRef.current.disconnect();
            liveClientRef.current = null;
        }

        // 2. SESSION TOKEN GENERATION
        const sessionId = Date.now().toString();
        currentSessionIdRef.current = sessionId;

        // Ensure state is synced
        setScenario(examScenario);
        setView('exam');
        setStatus(ConnectionStatus.CONNECTING);
        setMessages([]);
        setAssessment(null);
        setErrorMsg(null);
        setIsTimeout(false); // Reset timeout state
        setIsProcessing(false); // Reset processing
        startTimeRef.current = Date.now();
        lastActivityRef.current = Date.now(); // Reset Activity Timer

        // Initialize LiveClient with dynamic key
        liveClientRef.current = new LiveClient(apiKey);
        
        // PTT Only for Assessment (Standardization)
        liveClientRef.current.setBufferedMode(true);
        liveClientRef.current.setInputMuted(true);

        // Fetch Dynamic Data
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
        4. When the scenario is concluded or if the user fails critically, call 'reportAssessment' tool to finish.
        `;

        await liveClientRef.current.connect(
            examScenario,
            {
                onOpen: () => {
                    if (currentSessionIdRef.current !== sessionId) return; // GUARD
                    setStatus(ConnectionStatus.CONNECTED);
                    startTimeRef.current = Date.now();
                    updateActivity();
                },
                onClose: () => {
                   if (currentSessionIdRef.current !== sessionId) return; // GUARD
                   if (status !== ConnectionStatus.ANALYZING && status !== ConnectionStatus.ERROR) {
                       // Expected close logic
                   }
                },
                onError: (err) => {
                    if (currentSessionIdRef.current !== sessionId) return; // GUARD
                    setStatus(ConnectionStatus.ERROR);
                    setErrorMsg(err.message);
                    setIsProcessing(false); // Force clear on error
                },
                onAudioData: (level) => {
                    if (currentSessionIdRef.current !== sessionId) return; // GUARD
                    setAudioLevel(level);
                },
                onTurnComplete: () => {
                    if (currentSessionIdRef.current !== sessionId) return; // GUARD
                    setAudioLevel(0);
                    updateActivity();
                    // CRITICAL FIX: Ensure processing state is cleared when turn completes
                    // This handles cases where onTranscript might have been missed or delayed
                    setIsProcessing(false); 
                },
                onTranscript: (text, role, isPartial) => {
                    if (currentSessionIdRef.current !== sessionId) return; // GUARD
                    updateActivity(); // User speaking or AI responding counts as activity
                    
                    // NEW: If AI starts speaking, stop the "Processing" indicator
                    if (role === 'ai') {
                        setIsProcessing(false);
                    }

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
                },
                onAssessment: (data) => {
                    if (currentSessionIdRef.current !== sessionId) return; // GUARD
                    setAssessment(data);
                    setStatus(ConnectionStatus.DISCONNECTED);
                    liveClientRef.current?.disconnect();
                    setIsProcessing(false);
                    
                    // Save to DB
                    const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);
                    userService.saveSession(
                        examScenario.title,
                        examScenario.phase || 'General',
                        data,
                        duration,
                        'ASSESSMENT'
                    );
                    
                    setView('report');
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

    const handleAbort = () => {
        liveClientRef.current?.disconnect();
        setStatus(ConnectionStatus.DISCONNECTED);
        setView('lobby');
        setIsTimeout(false);
        setIsProcessing(false);
    };

    const handleFinishManually = async () => {
        if (liveClientRef.current && status === ConnectionStatus.CONNECTED) {
            setStatus(ConnectionStatus.ANALYZING);
            await liveClientRef.current.finalize();
        }
    };

    // PTT Logic Wrapper
    const engagePtt = () => {
        updateActivity(); // Reset inactivity timer
        if (status === ConnectionStatus.CONNECTED) {
            // Force clear processing state when user interrupts
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
        if (status === ConnectionStatus.CONNECTED) {
            setIsTransmitting(false);
            // Set Processing State immediately on release
            // This will be cleared by onTranscript (when AI speaks) or onTurnComplete (timeout)
            setIsProcessing(true);

            pttTimeoutRef.current = setTimeout(() => {
                liveClientRef.current?.stopRecording();
                pttTimeoutRef.current = null;
            }, 1000);
        }
    };

    // Translation Labels
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
        // NEW KEYS
        timeoutTitle: language === 'cn' ? '会话超时' : 'Session Timed Out',
        timeoutDesc: language === 'cn' ? '您已超过3分钟未活动，连接已断开以节省资源。' : 'Disconnected due to inactivity (3 mins).',
        refresh: language === 'cn' ? '重新开始' : 'Restart',
        standby: language === 'cn' ? '请回复 ATC' : 'Reply to ATC', 
        processing: language === 'cn' ? 'ATC 思考中...' : 'ATC Thinking...', 
        wait: language === 'cn' ? '请等待回复' : 'Please wait' 
    };

    // --- RENDERERS ---

    const renderLobby = () => (
        <div className="h-full bg-ios-bg flex flex-col relative overflow-hidden font-sans">
            {/* Background Blob */}
            <div className="absolute top-[-20%] right-[-20%] w-[500px] h-[500px] bg-blue-100/50 rounded-full blur-[80px] pointer-events-none"></div>
            
            {/* Header */}
            <div className="pt-12 px-6 pb-2 flex justify-between items-center z-10">
                <div>
                    <h1 className="text-3xl font-bold text-ios-text tracking-tight">{t.proficiencyCheck}</h1>
                    <p className="text-sm text-ios-subtext font-medium mt-1">{t.icaoLevel}</p>
                </div>
                <button 
                    onClick={() => setShowHistory(true)}
                    className="w-10 h-10 bg-white rounded-full shadow-sm border border-gray-100 flex items-center justify-center text-ios-blue hover:bg-gray-50 active:scale-95 transition-all"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 relative z-10 pb-20">
                
                {/* Hero Card */}
                <div className="bg-white rounded-[2rem] p-6 shadow-soft border border-gray-100 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-ios-blue to-ios-indigo opacity-5 group-hover:opacity-10 transition-opacity"></div>
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-4">
                            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-ios-blue/10 border border-ios-blue/20">
                                <span className="w-2 h-2 rounded-full bg-ios-blue animate-pulse"></span>
                                <span className="text-[10px] font-bold text-ios-blue uppercase tracking-wider">AI Examiner Ready</span>
                            </div>
                            <span className="text-2xl">👨‍✈️</span>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2 leading-tight">{t.standardized}<br/>{t.voiceAssessment}</h2>
                        <p className="text-sm text-gray-500 leading-relaxed mb-6 max-w-xs">
                            {t.desc}
                        </p>
                        <div className="flex items-center space-x-4 text-xs font-medium text-gray-400">
                            <span className="flex items-center"><svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> {t.time}</span>
                            <span className="flex items-center"><svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg> {t.skills}</span>
                        </div>
                    </div>
                </div>

                {/* Start Button Area (Moved UP) */}
                <div className="py-2">
                    <button 
                        onClick={startNewAssessmentProcess}
                        className="w-full bg-gradient-to-r from-ios-blue to-ios-indigo text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-blue-200 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center relative overflow-hidden"
                    >
                        <span className="relative z-10">{t.begin}</span>
                        <svg className="w-5 h-5 ml-2 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                        {/* Shine Effect */}
                        <div className="absolute top-0 left-[-100%] w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_2s_infinite]"></div>
                    </button>
                </div>

                {/* Criteria Grid */}
                <div>
                    <h3 className="text-xs font-bold text-ios-subtext uppercase tracking-widest mb-4 px-1">{t.scoring}</h3>
                    <div className="grid grid-cols-2 gap-3">
                        {[
                            { name: 'Pronunciation', icon: '🎙️', color: 'bg-orange-50 text-orange-600' },
                            { name: 'Structure', icon: '🏗️', color: 'bg-blue-50 text-blue-600' },
                            { name: 'Vocabulary', icon: '📖', color: 'bg-green-50 text-green-600' },
                            { name: 'Fluency', icon: '🌊', color: 'bg-purple-50 text-purple-600' },
                            { name: 'Comprehension', icon: '🧠', color: 'bg-pink-50 text-pink-600' },
                            { name: 'Interactions', icon: '🤝', color: 'bg-indigo-50 text-indigo-600' },
                        ].map((item) => (
                            <div key={item.name} className="bg-white p-3 rounded-2xl shadow-sm border border-gray-50 flex items-center space-x-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${item.color}`}>
                                    {item.icon}
                                </div>
                                <span className="text-sm font-bold text-gray-700">{item.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );

    const renderExam = () => (
        <div className="h-full flex flex-col relative bg-ios-bg overflow-hidden font-sans">
            {/* Dynamic Backgrounds */}
            <div className="absolute top-[-10%] left-[-20%] w-[600px] h-[600px] bg-purple-100/60 rounded-full blur-[100px] animate-blob mix-blend-multiply pointer-events-none"></div>
            <div className="absolute bottom-[-10%] right-[-20%] w-[500px] h-[500px] bg-blue-100/60 rounded-full blur-[100px] animate-blob animation-delay-2000 mix-blend-multiply pointer-events-none"></div>

            {/* Timeout Overlay */}
            {isTimeout && (
                <div className="absolute inset-0 z-50 bg-white/90 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center animate-fade-in">
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                        <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">{t.timeoutTitle}</h2>
                    <p className="text-gray-500 mb-8 max-w-xs">{t.timeoutDesc}</p>
                    <button 
                        onClick={handleAbort}
                        className="px-8 py-3 bg-ios-text text-white rounded-xl font-bold shadow-lg hover:scale-105 transition-all"
                    >
                        {t.refresh}
                    </button>
                </div>
            )}

            {/* Status Overlay (Loading) */}
            {status === ConnectionStatus.ANALYZING && (
                 <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-md flex flex-col items-center justify-center text-ios-text animate-fade-in">
                     <div className="relative mb-6">
                         <div className="w-20 h-20 border-4 border-gray-100 rounded-full"></div>
                         <div className="w-20 h-20 border-4 border-ios-blue border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
                     </div>
                     <h2 className="text-2xl font-bold mb-2">{t.examSubmitted}</h2>
                     <p className="text-ios-subtext text-sm">{t.generating}</p>
                 </div>
            )}
            
            {/* Header (Shrink-0) */}
            <div className="pt-12 px-6 pb-2 flex justify-between items-center z-10 shrink-0 h-24">
                <div className="flex items-center space-x-3">
                    {/* Status Indicator */}
                    <div className="flex items-center space-x-2 bg-white/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/60 shadow-sm">
                        <div className="w-2 h-2 rounded-full bg-red-50 animate-pulse"></div>
                        <span className="text-[10px] font-bold text-red-50 uppercase tracking-widest">{t.liveExam}</span>
                    </div>
                </div>
                
                {/* Finish Button - Top Right */}
                <button 
                    onClick={handleFinishManually}
                    disabled={status !== ConnectionStatus.CONNECTED}
                    className="bg-white/80 backdrop-blur-md text-ios-red border border-red-100 px-4 py-2 rounded-full text-xs font-bold shadow-sm hover:bg-red-50 active:scale-95 transition-all flex items-center space-x-1"
                >
                    <span className="uppercase tracking-wide">{t.finish}</span>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                </button>
            </div>

            {/* TOP SECTION: Visualizer & Cockpit (Priority: >= 2/3 of space) */}
            <div className="flex-[3] flex flex-col items-center justify-center px-6 pt-2 pb-2 min-h-0 space-y-6 z-10">
                {/* Visualizer (Full Size) */}
                <div className="w-full flex-1 flex items-center justify-center overflow-visible">
                    <div className="scale-100 transform transition-transform">
                        <Visualizer isActive={status === ConnectionStatus.CONNECTED} audioLevel={audioLevel} />
                    </div>
                </div>
                {/* Cockpit (Bottom of Top Section) */}
                <div className="w-full shrink-0">
                    <CockpitDisplay 
                        active={status === ConnectionStatus.CONNECTED} 
                        scenario={scenario} 
                        airportCode={activeAirport?.icao_code || '----'} // Use activeAirport code
                        airportData={activeAirport} // PASS FULL AIRPORT DATA
                    />
                </div>
            </div>

            {/* MIDDLE SECTION: Situation Brief Only (Priority: <= 1/5 of space) */}
            <div className="flex-[1] px-6 w-full min-h-0 mb-4 z-10">
                <div className="bg-white/70 backdrop-blur-xl border border-white/60 rounded-2xl p-4 shadow-[0_8px_30px_rgba(0,0,0,0.04)] h-full flex flex-col relative overflow-hidden group">
                    
                    <div className="flex items-center space-x-2 mb-2 opacity-80 shrink-0">
                        <div className="w-6 h-6 rounded-full bg-ios-blue/10 flex items-center justify-center text-ios-blue">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <span className="text-[10px] font-bold text-ios-subtext uppercase tracking-widest">{t.situation}</span>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                        <h3 className="text-sm font-bold text-ios-text mb-1 leading-tight truncate">
                            {scenario?.title || 'Unknown Scenario'}
                        </h3>
                        <div className="text-xs text-gray-700 leading-relaxed font-medium text-justify">
                            {scenario?.details || "Scenario details are loading or unavailable. Please proceed with the examination based on the initial briefing."}
                        </div>
                    </div>
                    
                    {/* Last Transmission Block Removed as per request */}
                </div>
            </div>

            {/* BOTTOM SECTION: PTT Button (Fixed Height, Safe Padding) */}
            <div className="shrink-0 pt-4 pb-12 px-8 flex justify-center items-center relative z-20 bg-gradient-to-t from-ios-bg to-transparent">
                 <button
                    onMouseDown={engagePtt}
                    onMouseUp={releasePtt}
                    onMouseLeave={releasePtt}
                    onTouchStart={engagePtt}
                    onTouchEnd={releasePtt}
                    onTouchCancel={releasePtt}
                    onContextMenu={(e) => e.preventDefault()}
                    disabled={status !== ConnectionStatus.CONNECTED}
                    className={`
                        group relative w-full max-w-sm h-20 rounded-full flex items-center justify-center transition-all duration-200 select-none touch-none shadow-lg
                        ${status !== ConnectionStatus.CONNECTED ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-95'}
                        ${isTransmitting 
                            ? 'bg-red-500 shadow-red-200 border-transparent text-white' 
                            : isProcessing 
                                ? 'bg-amber-100 shadow-amber-200 border border-amber-300 text-amber-900' // Processing State (Amber/Yellow)
                                : 'bg-green-50 shadow-green-100 border border-green-200 text-green-700' // Idle State (Light Green)
                        }
                    `}
                 >
                     <div className="flex items-center space-x-3 pointer-events-none relative z-10">
                         <div className={`p-2 rounded-full transition-colors ${
                             isTransmitting ? 'bg-white/20 text-white' : 
                             isProcessing ? 'bg-amber-200 text-amber-700' :
                             'bg-green-100 text-green-600'
                         }`}>
                             {isProcessing ? (
                                // Spinner Icon for Processing
                                <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                             ) : (
                                // Mic Icon for Idle/Transmitting
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                </svg>
                             )}
                         </div>
                         
                         <div className="flex flex-col items-start">
                             <span className={`text-base font-bold uppercase tracking-wider transition-colors`}>
                                 {isTransmitting 
                                    ? t.transmitting 
                                    : isProcessing 
                                        ? t.processing 
                                        : t.holdToSpeak
                                 }
                             </span>
                             <span className={`text-[10px] font-medium transition-colors ${isTransmitting ? 'text-white/80' : isProcessing ? 'text-amber-700/70' : 'text-green-700/70'}`}>
                                 {isTransmitting 
                                    ? t.holdToSpeak 
                                    : isProcessing 
                                        ? t.wait 
                                        : t.standby
                                 }
                             </span>
                         </div>
                     </div>
                     
                     {isTransmitting && (
                         <div className="absolute inset-[-6px] rounded-full border-2 border-red-500/30 animate-ping pointer-events-none"></div>
                     )}
                     
                     {isProcessing && (
                         <div className="absolute inset-[-6px] rounded-full border-2 border-amber-400/30 animate-pulse pointer-events-none"></div>
                     )}
                 </button>
            </div>
        </div>
    );

    return (
        <div className="h-full w-full bg-ios-bg overflow-hidden relative font-sans">
            
            {/* 1. Lobby */}
            {view === 'lobby' && renderLobby()}

            {/* 2. Briefing View */}
            {view === 'briefing' && scenario && (
                <BriefingModal 
                    scenario={scenario}
                    onAccept={handleAcceptBriefing}
                    onCancel={handleAbort}
                    onRefresh={startNewAssessmentProcess}
                />
            )}

            {/* 3. Exam View */}
            {view === 'exam' && renderExam()}

            {/* 4. Report View */}
            {view === 'report' && assessment && (
                <AssessmentReport 
                    data={assessment} 
                    onClose={() => setView('lobby')} 
                    language={language}
                />
            )}

            {/* 5. Error State */}
            {status === ConnectionStatus.ERROR && (
                <div className="absolute inset-0 bg-white/90 backdrop-blur-md z-50 flex items-center justify-center flex-col p-8 text-center animate-fade-in">
                    <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4 text-3xl shadow-sm">⚠️</div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">{t.connectionError}</h2>
                    <p className="text-gray-500 mb-6 text-sm leading-relaxed">{errorMsg || "Unknown error occurred."}</p>
                    <button 
                        onClick={() => setView('lobby')}
                        className="px-8 py-3 bg-ios-text text-white rounded-xl font-bold shadow-lg hover:scale-[1.02] active:scale-95 transition-all"
                    >
                        {t.returnLobby}
                    </button>
                </div>
            )}

            {/* History Modal Overlay */}
            {showHistory && (
                <HistoryModal 
                    onClose={() => setShowHistory(false)}
                    initialFilter="ASSESSMENT"
                    onSelectReport={(data) => {
                        setAssessment(data);
                        setShowHistory(false);
                        setView('report');
                    }}
                />
            )}

        </div>
    );
};

export default AssessmentScreen;
