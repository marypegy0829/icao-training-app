
import React, { useState, useEffect } from 'react';
import { DifficultyLevel } from '../types';
import { userService, UserProfile } from '../services/userService';
import { authService } from '../services/authService';

// --- Types ---
interface TrainingLog {
  id: string;
  created_at: string;
  scenario_title: string;
  phase: string;
  score: number;
  duration: string;
}

interface ProfileScreenProps {
  difficulty: DifficultyLevel;
  setDifficulty: (level: DifficultyLevel) => void;
}

const ProfileScreen: React.FC<ProfileScreenProps> = ({ difficulty, setDifficulty }) => {
  const [cockpitNoise, setCockpitNoise] = useState(true);
  const [notifications, setNotifications] = useState(true);
  
  // Real Data State
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [logs, setLogs] = useState<TrainingLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
        setLoading(true);
        const [profData, logsData] = await Promise.all([
            userService.getProfile(),
            userService.getHistory()
        ]);
        
        if (profData) setProfile(profData as UserProfile);
        if (logsData) setLogs(logsData as TrainingLog[]);
        setLoading(false);
    };
    fetchData();
  }, []);

  const handleSignOut = async () => {
      try {
          await authService.signOut();
          // App.tsx auth listener handles redirect
      } catch (e) {
          console.error("Sign out failed", e);
      }
  };

  // Format Date Helper
  const formatDate = (isoString: string) => {
      const date = new Date(isoString);
      const today = new Date();
      if (date.toDateString() === today.toDateString()) {
          return `Today, ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
      }
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  if (loading) {
      return (
          <div className="h-full flex items-center justify-center bg-ios-bg">
              <div className="flex flex-col items-center space-y-4">
                  <div className="w-8 h-8 border-4 border-ios-blue border-t-transparent rounded-full animate-spin"></div>
                  <div className="text-ios-subtext text-sm animate-pulse">Syncing Pilot Profile...</div>
              </div>
          </div>
      );
  }

  // Fallback if DB is empty or failed
  const displayProfile = profile || {
      user_id: 'guest',
      name: 'Pilot',
      rank: 'Cadet',
      flight_level: 'Cadet',
      airline: 'N/A',
      aircraft_type: 'N/A',
      current_icao_level: 4,
      flight_hours: 0,
      total_sorties: 0,
      streak: 0,
      skills: {}
  };

  return (
    <div className="h-full w-full bg-ios-bg overflow-y-auto pb-24 font-sans text-ios-text">
      
      {/* 1. Header Profile Card */}
      <div className="relative bg-white pb-6 pt-12 px-6 rounded-b-[2.5rem] shadow-soft mb-6 overflow-hidden">
        {/* Background Decor */}
        <div className="absolute top-[-50px] right-[-50px] w-64 h-64 bg-ios-blue/5 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="relative z-10 flex items-center space-x-5">
            <div className="relative">
                <img src={`https://ui-avatars.com/api/?name=${displayProfile.name}&background=007AFF&color=fff&rounded=true&bold=true`} alt="Avatar" className="w-20 h-20 rounded-full border-4 border-white shadow-lg" />
                <div className="absolute bottom-0 right-0 bg-ios-orange text-white text-[10px] font-bold px-1.5 py-0.5 rounded border border-white">
                    {displayProfile.aircraft_type || 'ATPL'}
                </div>
            </div>
            <div className="flex-1">
                <h1 className="text-2xl font-bold text-ios-text">{displayProfile.name}</h1>
                <p className="text-sm text-ios-subtext font-medium mb-1">
                    {displayProfile.airline} • {displayProfile.flight_level}
                </p>
                
                {/* Level Progress */}
                <div className="flex items-center space-x-3 mt-2">
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-ios-blue to-ios-indigo w-[70%]"></div>
                    </div>
                    <div className="text-xs font-bold font-mono whitespace-nowrap">
                        <span className="text-ios-blue">Lvl {displayProfile.current_icao_level}</span>
                        <span className="text-gray-300 mx-1">/</span>
                        <span className="text-gray-400">Target 6</span>
                    </div>
                </div>
            </div>
        </div>

        {/* Quick Stats Row */}
        <div className="grid grid-cols-3 gap-4 mt-8">
            <div className="text-center p-3 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="text-xl font-bold text-ios-text">{Number(displayProfile.flight_hours).toFixed(1)}</div>
                <div className="text-[10px] font-bold text-ios-subtext uppercase">Training Hrs</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="text-xl font-bold text-ios-text">{displayProfile.total_sorties}</div>
                <div className="text-[10px] font-bold text-ios-subtext uppercase">Sorties</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="text-xl font-bold text-ios-orange">{displayProfile.streak}</div>
                <div className="text-[10px] font-bold text-ios-subtext uppercase">Day Streak</div>
            </div>
        </div>
      </div>

      {/* 2. Pilot Logbook (History) */}
      <div className="px-6 mb-8">
         <div className="flex justify-between items-center mb-3">
             <h2 className="text-lg font-bold text-ios-text flex items-center">
                <svg className="w-5 h-5 mr-2 text-ios-subtext" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                Pilot Logbook
             </h2>
         </div>
         
         <div className="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden min-h-[100px]">
             {logs.length === 0 ? (
                 <div className="p-8 text-center text-gray-400 text-sm">
                     No flight records found. Start training to fill your logbook.
                 </div>
             ) : (
                 logs.map((log, idx) => (
                     <div key={log.id} className={`p-4 flex items-center justify-between hover:bg-gray-50 transition-colors ${idx !== logs.length - 1 ? 'border-b border-gray-100' : ''}`}>
                         <div className="flex items-center space-x-3">
                             <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ${log.score >= 4 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                 {log.score}
                             </div>
                             <div>
                                 <h3 className="text-sm font-bold text-gray-900 truncate max-w-[160px]">{log.scenario_title}</h3>
                                 <div className="flex items-center space-x-2 text-[10px] text-gray-500">
                                     <span>{formatDate(log.created_at)}</span>
                                     <span>•</span>
                                     <span className="uppercase">{log.phase}</span>
                                 </div>
                             </div>
                         </div>
                         <div className="text-right">
                             <div className="text-xs font-mono font-bold text-gray-400">{log.duration}</div>
                             <div className="text-[10px] text-ios-blue font-semibold">Review</div>
                         </div>
                     </div>
                 ))
             )}
         </div>
      </div>

      {/* 3. Flight Deck Configuration (Settings) */}
      <div className="px-6 mb-8">
         <h2 className="text-lg font-bold text-ios-text mb-3">Flight Deck Config</h2>
         <div className="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden">
             
             {/* Setting Item: Training Difficulty */}
             <div className="p-4 border-b border-gray-100">
                 <div className="flex items-center space-x-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    </div>
                    <span className="text-sm font-medium text-gray-900">Training Difficulty</span>
                 </div>
                 
                 <div className="relative">
                    <select 
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value as DifficultyLevel)}
                      className="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-700 py-3 px-4 pr-8 rounded-xl leading-tight focus:outline-none focus:bg-white focus:border-ios-blue text-sm font-semibold"
                    >
                        {Object.values(DifficultyLevel).map((level) => (
                           <option key={level} value={level}>{level}</option>
                        ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-700">
                      <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                    </div>
                 </div>
                 <p className="text-[10px] text-gray-500 mt-2 ml-1">
                    Affects ATC speaking speed, vocabulary complexity, and scenario intensity.
                 </p>
             </div>

             {/* Setting Item: Cockpit Noise */}
             <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                 <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                    </div>
                    <span className="text-sm font-medium text-gray-900">Cockpit Noise Simulation</span>
                 </div>
                 <button 
                   onClick={() => setCockpitNoise(!cockpitNoise)}
                   className={`w-11 h-6 rounded-full transition-colors relative ${cockpitNoise ? 'bg-ios-green' : 'bg-gray-200'}`}
                   style={{backgroundColor: cockpitNoise ? '#34C759' : '#E5E7EB'}}
                 >
                     <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-transform ${cockpitNoise ? 'translate-x-5.5 left-0.5' : 'left-0.5'}`}></div>
                 </button>
             </div>

             {/* Setting Item: Notifications */}
             <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                 <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                    </div>
                    <span className="text-sm font-medium text-gray-900">Training Reminders</span>
                 </div>
                 <button 
                   onClick={() => setNotifications(!notifications)}
                   className={`w-11 h-6 rounded-full transition-colors relative`}
                   style={{backgroundColor: notifications ? '#34C759' : '#E5E7EB'}}
                 >
                     <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-transform ${notifications ? 'translate-x-5.5 left-0.5' : 'left-0.5'}`}></div>
                 </button>
             </div>

             {/* Setting Item: Subscription */}
             <div className="p-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer">
                 <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-ios-blue/10 text-ios-blue flex items-center justify-center">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                    </div>
                    <span className="text-sm font-medium text-gray-900">Subscription Plan</span>
                 </div>
                 <div className="flex items-center text-gray-400">
                     <span className="text-xs mr-2 font-semibold text-ios-orange">PRO Member</span>
                     <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                 </div>
             </div>

         </div>
      </div>

      {/* 4. Logout / Danger Zone */}
      <div className="px-6 pb-6">
          <button 
            onClick={handleSignOut}
            className="w-full py-3 rounded-xl border border-gray-200 text-red-500 font-bold text-sm hover:bg-red-50 transition-colors"
          >
              Log Out
          </button>
          <p className="text-center text-[10px] text-gray-400 mt-4">
              ICAO Examiner AI v1.3.0 (Build 502)<br/>
              Connected to icao5_trainer DB
          </p>
      </div>

    </div>
  );
};

export default ProfileScreen;
