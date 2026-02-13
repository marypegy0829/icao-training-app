
import React, { useState, useEffect, useRef } from 'react';
import { Tab, Scenario } from '../types';
import RadarChart from '../components/RadarChart';
import { scenarioService } from '../services/scenarioService';
import { userService } from '../services/userService';

interface Props {
  onNavigate: (tab: Tab) => void;
  onStartScenario: (scenario: Scenario) => void;
}

// --- Mock Data for Content ---
const DAILY_CASE_STUDY = {
  id: 'cactus-1549',
  title: 'Miracle on the Hudson',
  callsign: 'Cactus 1549',
  date: 'Jan 15, 2009',
  image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/US_Airways_Flight_1549_seen_from_tugboat.jpg/800px-US_Airways_Flight_1549_seen_from_tugboat.jpg',
  transcript: [
    { role: 'pilot', text: "Mayday, Mayday, Mayday. Cactus 1549, hit birds. We've lost thrust on both engines. We're turning back towards LaGuardia." },
    { role: 'atc', text: "Ok, yeah, you need to return to LaGuardia. Turn left heading 220." },
    { role: 'pilot', text: "220." },
    { role: 'atc', text: "Tower, stop your departures. We got an emergency returning." },
    { role: 'pilot', text: "We can't do it. We're gonna be in the Hudson." }
  ],
  learningPoint: "Notice the calm tone despite catastrophic failure. The phraseology is non-standard ('We're gonna be in the Hudson') due to extreme time pressure, yet communication remains effective."
};

const DAILY_QUOTE = {
  text: "Aviation in itself is not inherently dangerous. But to an even greater degree than the sea, it is terribly unforgiving of any carelessness, incapacity or neglect.",
  author: "Captain A. G. Lamplugh"
};

const HomeScreen: React.FC<Props> = ({ onNavigate, onStartScenario }) => {
  const [greeting, setGreeting] = useState('');
  const [showCaseStudy, setShowCaseStudy] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Real User Data Analysis
  const [userSkills, setUserSkills] = useState<{ [key: string]: number }>({
    Pronunciation: 3.0,
    Structure: 3.0,
    Vocabulary: 3.0,
    Fluency: 3.0,
    Comprehension: 3.0,
    Interactions: 3.0
  });

  const [userName, setUserName] = useState('Captain');
  const [streak, setStreak] = useState(0);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);

  // --- Audio Player State ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentLineIndex, setCurrentLineIndex] = useState(-1);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    // 1. Set Greeting
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('早上好, Captain');
    else if (hour < 18) setGreeting('下午好, Captain');
    else setGreeting('晚上好, Captain');

    // 2. Fetch User Profile & Scenarios
    const loadData = async () => {
        try {
            const [profile, allScenarios] = await Promise.all([
                userService.getProfile(),
                scenarioService.getAllScenarios()
            ]);
            
            if (profile) {
                setUserName(profile.name || 'Captain');
                setStreak(profile.streak || 0);
                if (profile.skills) {
                    // Ensure skills are numbers and not strings/nulls
                    const cleanSkills: any = {};
                    const defaults = { Pronunciation: 3, Structure: 3, Vocabulary: 3, Fluency: 3, Comprehension: 3, Interactions: 3 };
                    Object.keys(defaults).forEach(k => {
                        const val = (profile.skills as any)[k];
                        cleanSkills[k] = typeof val === 'number' ? val : 3;
                    });
                    setUserSkills(cleanSkills);
                }
            }
            setScenarios(allScenarios);

        } catch (e) {
            console.error("Failed to load profile for Home", e);
        } finally {
            setLoading(false);
        }
    };
    loadData();

    // Initialize Speech Synth
    if (typeof window !== 'undefined' && window.speechSynthesis) {
        synthRef.current = window.speechSynthesis;
    }

    return () => {
        stopAudio();
    };
  }, []);

  // Stop audio when modal closes
  useEffect(() => {
      if (!showCaseStudy) {
          stopAudio();
      }
  }, [showCaseStudy]);

  // Auto-scroll to active line
  useEffect(() => {
      if (currentLineIndex >= 0 && transcriptRef.current) {
          const activeEl = transcriptRef.current.children[currentLineIndex] as HTMLElement;
          if (activeEl) {
              activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
      }
  }, [currentLineIndex]);

  const stopAudio = () => {
      if (synthRef.current) {
          synthRef.current.cancel();
      }
      setIsPlaying(false);
      setCurrentLineIndex(-1);
  };

  const playCaseStudy = () => {
      if (!synthRef.current) return;

      // If already playing, stop (Toggle logic)
      if (isPlaying) {
          stopAudio();
          return;
      }

      setIsPlaying(true);
      speakLine(0);
  };

  const speakLine = (index: number) => {
      if (!synthRef.current || index >= DAILY_CASE_STUDY.transcript.length) {
          setIsPlaying(false);
          setCurrentLineIndex(-1);
          return;
      }

      setCurrentLineIndex(index);
      const line = DAILY_CASE_STUDY.transcript[index];
      const utter = new SpeechSynthesisUtterance(line.text);
      
      // Voice & Pitch Tweak
      utter.lang = 'en-US';
      utter.rate = 1.1; // Slightly faster for aviation context
      
      if (line.role === 'pilot') {
          utter.pitch = 0.9; // Lower pitch for pilot
      } else {
          utter.pitch = 1.2; // Higher/Standard for ATC (Simulated radio filter effect via pitch)
      }

      utter.onend = () => {
          speakLine(index + 1);
      };

      utteranceRef.current = utter;
      synthRef.current.speak(utter);
  };


  // Logic to find weakness and recommend scenario
  const getRecommendation = () => {
      let minScore = 7;
      let weakness = '';
      
      Object.entries(userSkills).forEach(([key, score]) => {
          if (score < minScore) {
              minScore = score;
              weakness = key;
          }
      });

      // Map weakness to scenario category/ID
      let scenarioId = '';
      let reason = '';

      switch (weakness) {
          case 'Pronunciation':
              scenarioId = 'medical'; // Fallback logic will handle missing IDs by picking default
              reason = '复杂的医疗术语需要更精准的发音。';
              break;
          case 'Structure':
              scenarioId = 'eng_fire'; 
              reason = '标准用语结构在引擎故障等紧急情况下至关重要。';
              break;
          case 'Vocabulary':
              scenarioId = 'hyd_fail'; 
              reason = '建议扩展关于飞机系统的技术词汇。';
              break;
          case 'Fluency':
              scenarioId = 'push_complex'; 
              reason = '练习条件性指令以提高语音处理速度。';
              break;
          case 'Comprehension':
              scenarioId = 'taxi_giveway'; 
              reason = '加强对复杂地面滑行指令的听力理解。';
              break;
          case 'Interactions':
              scenarioId = 'unruly';
              reason = '在非正常情况下的自信表达与协商技巧。';
              break;
          default:
              scenarioId = 'eng_fire';
              reason = '全面提升通话能力。';
      }

      // Find the full scenario object from loaded scenarios
      // Use includes search or fallback to first scenario
      const recommendedScenario = scenarios.find(s => s.id.includes(scenarioId)) || scenarios[0] || {
          id: 'fallback',
          title: 'General Training',
          details: 'Standard ICAO procedure training.',
          phase: 'Cruise & Enroute',
          weather: 'VMC',
          callsign: 'Training 001'
      };

      return { weakness, minScore, recommendedScenario, reason };
  };

  const recommendation = getRecommendation();

  const handleQuickFire = () => {
      // Pick a random scenario
      if (scenarios.length > 0) {
          const random = scenarios[Math.floor(Math.random() * scenarios.length)];
          onStartScenario(random);
      }
  };

  const handleCaseStudyPractice = () => {
      // Try to find a related scenario
      const scenario = scenarios.find(s => s.id.includes('bird') || s.id.includes('eng')) || scenarios[0];
      setShowCaseStudy(false);
      if (scenario) onStartScenario(scenario);
  };

  return (
    <div className="h-full w-full bg-ios-bg overflow-y-auto pb-24 relative">
      
      {/* 1. Header Section - UPDATED PADDING for Global Header */}
      <div className="pt-4 px-6 pb-4 bg-white rounded-b-[2.5rem] shadow-soft mb-6 relative overflow-hidden">
         <div className="absolute top-0 right-0 w-40 h-40 bg-ios-blue/5 rounded-full blur-3xl -translate-y-10 translate-x-10 pointer-events-none"></div>

         <div className="relative z-10">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-xs font-bold text-ios-subtext uppercase tracking-widest mb-1">{new Date().toDateString()}</p>
                <h1 className="text-2xl font-bold text-ios-text">
                    {greeting.replace('Captain', userName)}
                </h1>
              </div>
              <div className="flex items-center bg-orange-50 px-3 py-1.5 rounded-full border border-orange-100 shadow-sm">
                <svg className="w-4 h-4 text-ios-orange mr-1 animate-pulse" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd"/></svg>
                <span className="text-xs font-bold text-ios-orange">{streak} Day Streak</span>
              </div>
            </div>

            <div className="mb-2 pl-4 border-l-2 border-ios-blue/30">
                <p className="text-xs text-ios-text italic font-serif leading-relaxed opacity-80">
                    "{DAILY_QUOTE.text}"
                </p>
                <p className="text-[10px] text-ios-subtext mt-1 font-bold">— {DAILY_QUOTE.author}</p>
            </div>
         </div>
      </div>

      {/* 2. Daily Operations Grid (Moved UP) */}
      <div className="px-6 mb-6">
         <h2 className="text-lg font-bold text-ios-text mb-3">今日必修 (Daily Ops)</h2>
         <div className="grid grid-cols-2 gap-4">
             {/* Task 1: Quick Fire */}
             <button 
                onClick={handleQuickFire}
                className="bg-white p-4 rounded-[1.5rem] shadow-sm border border-gray-100 flex flex-col justify-between h-40 hover:shadow-md transition-shadow active:scale-95 text-left group"
             >
                 <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-500 mb-3 group-hover:bg-red-500 group-hover:text-white transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                 </div>
                 <div>
                     <h3 className="font-bold text-gray-800 text-sm mb-1">特情速答挑战</h3>
                     <p className="text-[10px] text-gray-500 leading-tight">Start Practice. Quick fire vocabulary.</p>
                 </div>
             </button>

             {/* Task 2: Case Study */}
             <button 
                onClick={() => setShowCaseStudy(true)}
                className="bg-white p-4 rounded-[1.5rem] shadow-sm border border-gray-100 flex flex-col justify-between h-40 hover:shadow-md transition-shadow active:scale-95 text-left group"
             >
                 <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-ios-blue mb-3 group-hover:bg-ios-blue group-hover:text-white transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                 </div>
                 <div>
                     <h3 className="font-bold text-gray-800 text-sm mb-1">真实陆空对话</h3>
                     <p className="text-[10px] text-gray-500 leading-tight">Case Study: {DAILY_CASE_STUDY.callsign}</p>
                 </div>
             </button>
         </div>
      </div>

      {/* 3. 6-Dimension Assessment */}
      <div className="px-6 mb-8">
        <h2 className="text-lg font-bold text-ios-text mb-3 flex items-center">
           <svg className="w-5 h-5 mr-2 text-ios-indigo" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
           6大维度能力评估
        </h2>
        <div className="bg-white rounded-[2rem] p-5 shadow-soft border border-gray-100 relative overflow-hidden">
           
           {loading ? (
               <div className="h-40 flex items-center justify-center text-gray-400 text-sm animate-pulse">
                   Loading Pilot Profile...
               </div>
           ) : (
             <>
               <div className="flex flex-col md:flex-row items-center">
                  {/* Left: Radar Chart */}
                  <div className="shrink-0 mb-4 md:mb-0 md:mr-6 relative">
                     <RadarChart data={userSkills} size={160} color="#5856D6" />
                     <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                         <div className="text-center bg-white/80 backdrop-blur-sm p-1 rounded-lg shadow-sm">
                             <div className="text-[10px] text-gray-500 uppercase font-bold">AVG</div>
                             <div className="text-xl font-bold text-ios-indigo">
                                 {(Object.values(userSkills).reduce((a, b) => a + b, 0) / 6).toFixed(1)}
                             </div>
                         </div>
                     </div>
                  </div>

                  {/* Right: Analysis & Action */}
                  <div className="flex-1 w-full">
                     <div className="mb-4">
                         <div className="flex justify-between items-center mb-1">
                             <span className="text-xs font-bold text-gray-400 uppercase">薄弱环节 (Weakest)</span>
                             <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded">Level {recommendation.minScore}</span>
                         </div>
                         <h3 className="text-xl font-bold text-ios-text mb-1">{recommendation.weakness}</h3>
                         <p className="text-xs text-gray-500 leading-relaxed">
                            {recommendation.reason}
                         </p>
                     </div>

                     {/* One-Click Improve Button */}
                     <button 
                       onClick={() => onStartScenario(recommendation.recommendedScenario)}
                       className="w-full bg-gradient-to-r from-ios-indigo to-purple-600 text-white p-3 rounded-xl shadow-lg shadow-indigo-200 hover:shadow-indigo-300 active:scale-95 transition-all flex items-center justify-between group"
                     >
                         <div className="flex flex-col text-left">
                             <span className="text-[10px] text-indigo-200 font-bold uppercase">一键专项提升</span>
                             <span className="text-sm font-bold truncate max-w-[150px]">{recommendation.recommendedScenario.title}</span>
                         </div>
                         <div className="bg-white/20 p-2 rounded-full group-hover:bg-white/30 transition-colors">
                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                         </div>
                     </button>
                  </div>
               </div>

               {/* Dimensions Grid (Bottom) */}
               <div className="grid grid-cols-3 gap-2 mt-6 pt-4 border-t border-gray-100">
                  {Object.entries(userSkills).map(([key, score]) => (
                      <div key={key} className="text-center">
                          <div className="text-[9px] text-gray-400 uppercase font-bold truncate">{key}</div>
                          <div className={`text-sm font-bold ${score < 4 ? 'text-orange-500' : 'text-gray-800'}`}>{score}</div>
                      </div>
                  ))}
               </div>
             </>
           )}

        </div>
      </div>

      {/* --- Case Study Modal --- */}
      {showCaseStudy && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6 animate-fade-in">
              <div className="bg-white w-full max-w-lg rounded-[2rem] overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
                  {/* Modal Header Image */}
                  <div className="h-48 bg-gray-200 relative">
                      <img src={DAILY_CASE_STUDY.image} alt="Case Study" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-6">
                          <div>
                              <div className="text-xs font-bold text-white/80 uppercase mb-1">Real-World Case Study</div>
                              <h2 className="text-2xl font-bold text-white">{DAILY_CASE_STUDY.title}</h2>
                          </div>
                      </div>
                      <button 
                        onClick={() => setShowCaseStudy(false)}
                        className="absolute top-4 right-4 w-8 h-8 bg-black/30 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-black/50 transition-colors"
                      >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                  </div>

                  {/* Audio Player */}
                  <div className="bg-gray-900 p-4 flex items-center space-x-4">
                      <button 
                        onClick={playCaseStudy}
                        className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-black shadow-lg hover:scale-105 active:scale-95 transition-transform"
                      >
                          {isPlaying ? (
                             <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                          ) : (
                             <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
                          )}
                      </button>
                      
                      {/* Visualizer Bars */}
                      <div className="flex-1 h-8 flex items-center space-x-0.5 overflow-hidden">
                          {[...Array(30)].map((_, i) => (
                              <div 
                                key={i} 
                                className={`w-1 bg-white/40 rounded-full transition-all duration-300 ${isPlaying ? 'animate-pulse' : ''}`}
                                style={{
                                    height: isPlaying ? `${Math.max(20, Math.random() * 100)}%` : '20%', 
                                    animationDuration: `${0.2 + Math.random() * 0.3}s`,
                                    animationDelay: `${i * 0.05}s`
                                }} 
                              />
                          ))}
                      </div>
                      <span className="text-xs text-white font-mono">
                          {isPlaying ? 'PLAYING' : 'AUDIO'}
                      </span>
                  </div>

                  {/* Content */}
                  <div className="p-6 overflow-y-auto space-y-6 flex-1">
                      <div>
                          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-3">对话重点 (Transcript Highlight)</h3>
                          <div className="space-y-3 max-h-[200px] overflow-y-auto scroll-smooth pr-1" ref={transcriptRef}>
                              {DAILY_CASE_STUDY.transcript.map((line, idx) => (
                                  <div 
                                    key={idx} 
                                    className={`flex space-x-3 text-sm p-2 rounded-lg transition-colors ${currentLineIndex === idx ? 'bg-yellow-50 border border-yellow-100 shadow-sm' : 'opacity-80'}`}
                                  >
                                      <span className={`w-12 font-bold uppercase shrink-0 text-right text-xs pt-0.5 ${line.role === 'pilot' ? 'text-ios-blue' : 'text-ios-orange'}`}>
                                          {line.role}
                                      </span>
                                      <span className={`leading-relaxed font-mono ${currentLineIndex === idx ? 'text-gray-900 font-bold' : 'text-gray-600'}`}>
                                          {line.text}
                                      </span>
                                  </div>
                              ))}
                          </div>
                      </div>

                      <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100">
                          <h4 className="text-xs font-bold text-yellow-800 uppercase mb-2 flex items-center">
                              <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              学习要点 (Learning Point)
                          </h4>
                          <p className="text-sm text-yellow-900 leading-relaxed">
                              {DAILY_CASE_STUDY.learningPoint}
                          </p>
                      </div>
                  </div>
                  
                  <div className="p-4 border-t border-gray-100 bg-white">
                      <button 
                        onClick={handleCaseStudyPractice}
                        className="w-full py-3 bg-ios-text text-white rounded-xl font-bold shadow-lg active:scale-[0.98] transition-transform"
                      >
                          练习相关场景
                      </button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default HomeScreen;
