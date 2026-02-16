
import React, { useState, useEffect, useCallback } from 'react';
import { DifficultyLevel, AssessmentData } from '../types';
import { userService, UserProfile } from '../services/userService';
import { authService } from '../services/authService';
import { achievementService, Achievement } from '../services/achievementService';
import { mistakeService, MistakeEntry } from '../services/mistakeService';
import { AchievementsModal, MistakeBookModal } from '../components/ProfileModals';
import HistoryModal from '../components/HistoryModal';
import AssessmentReport from '../components/AssessmentReport';

interface ProfileScreenProps {
  difficulty: DifficultyLevel;
  setDifficulty: (level: DifficultyLevel) => void;
  accentEnabled: boolean;
  setAccentEnabled: (enabled: boolean) => void;
  cockpitNoise: boolean;
  setCockpitNoise: (enabled: boolean) => void;
}

const ProfileScreen: React.FC<ProfileScreenProps> = ({ 
    difficulty, 
    setDifficulty, 
    accentEnabled, 
    setAccentEnabled,
    cockpitNoise,
    setCockpitNoise
}) => {
  // Real Data State
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [mistakes, setMistakes] = useState<MistakeEntry[]>([]);
  const [historyCount, setHistoryCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [activeModal, setActiveModal] = useState<'achievements' | 'mistakes' | 'logs' | null>(null);
  const [selectedReport, setSelectedReport] = useState<AssessmentData | null>(null);

  const fetchProfileData = useCallback(async () => {
        // Don't set global loading here to avoid flashing UI on refresh
        const uid = await userService.getCurrentUserId();
        if (!uid) return;
        
        try {
            const [profData, logsData, achData, mistakesData] = await Promise.all([
                userService.getProfile(),
                userService.getHistory(),
                achievementService.getUserAchievements(uid),
                mistakeService.getMistakes(uid)
            ]);
            
            if (profData) setProfile(profData as UserProfile);
            setHistoryCount(logsData ? logsData.length : 0);
            setAchievements(achData);
            setMistakes(mistakesData);
        } catch (e) {
            console.error("Profile data load error", e);
        }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchProfileData().finally(() => setLoading(false));
  }, [fetchProfileData]);

  // Handle closing report and refreshing data (to show newly added mistakes)
  const handleCloseReport = () => {
      setSelectedReport(null);
      fetchProfileData();
  };

  const handleCloseModal = () => {
      setActiveModal(null);
      // Also refresh when closing mistake book in case items were deleted
      fetchProfileData();
  };

  const handleSignOut = async () => {
      try {
          await authService.signOut();
      } catch (e) {
          console.error("Sign out failed", e);
      }
  };

  const handleToggleMistake = async (id: string, currentStatus: boolean) => {
      try {
          await mistakeService.toggleMastered(id, !currentStatus);
          // Optimistic update
          setMistakes(prev => prev.map(m => {
              if (m.id === id) {
                  return { 
                      ...m, 
                      is_mastered: !currentStatus, 
                      review_count: m.review_count + 1 // Increment locally
                  };
              }
              return m;
          }));
      } catch (e) {
          console.error("Failed to update mistake", e);
      }
  };

  const handleDeleteMistake = async (id: string) => {
      try {
          await mistakeService.deleteMistake(id);
          setMistakes(prev => prev.filter(m => m.id !== id));
      } catch (e) {
          console.error("Failed to delete mistake", e);
      }
  };

  if (loading) {
      return (
          <div className="h-full flex items-center justify-center bg-ios-bg">
              <div className="flex flex-col items-center space-y-4">
                  <div className="w-8 h-8 border-4 border-ios-blue border-t-transparent rounded-full animate-spin"></div>
                  <div className="text-ios-subtext text-sm animate-pulse">正在同步飞行员数据...</div>
              </div>
          </div>
      );
  }

  // Fallback if DB is empty or failed
  const displayProfile = profile || {
      user_id: 'guest',
      name: 'Pilot',
      airline: 'N/A',
      aircraft_type: 'N/A',
      flight_level: 'Cadet',
      current_icao_level: 4,
      flight_hours: 0,
      total_sorties: 0,
      streak: 0,
      skills: { Pronunciation:3, Structure:3, Vocabulary:3, Fluency:3, Comprehension:3, Interactions:3 }
  };

  const unlockedAchievements = achievements.filter(a => a.unlocked_at).length;
  const pendingMistakes = mistakes.filter(m => !m.is_mastered).length;

  return (
    <div className="h-full w-full bg-ios-bg overflow-y-auto pb-24 font-sans text-ios-text">
      
      {/* 1. Header Profile Card */}
      <div className="relative bg-white pb-8 pt-12 px-6 rounded-b-[2.5rem] shadow-soft mb-6 overflow-hidden">
        {/* Background Decor */}
        <div className="absolute top-[-50px] right-[-50px] w-64 h-64 bg-ios-blue/5 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="relative z-10 flex items-center space-x-5">
            <div className="relative">
                <img src={`https://ui-avatars.com/api/?name=${displayProfile.name}&background=007AFF&color=fff&rounded=true&bold=true`} alt="Avatar" className="w-20 h-20 rounded-full border-4 border-white shadow-lg" />
                <div className="absolute bottom-0 right-0 bg-ios-orange text-white text-[10px] font-bold px-1.5 py-0.5 rounded border border-white shadow-sm">
                    {displayProfile.aircraft_type || 'ATPL'}
                </div>
            </div>
            <div className="flex-1">
                <h1 className="text-2xl font-bold text-ios-text tracking-tight">{displayProfile.name}</h1>
                <p className="text-sm text-ios-subtext font-medium mb-1 flex items-center">
                    {displayProfile.airline} 
                    <span className="mx-1.5 opacity-30">|</span> 
                    {displayProfile.flight_level}
                </p>
                
                {/* Level Progress */}
                <div className="mt-3">
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider mb-1">
                        <span className="text-ios-blue">ICAO Level {displayProfile.current_icao_level}</span>
                        <span className="text-gray-400">Target Level 6</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-gradient-to-r from-ios-blue to-ios-indigo rounded-full transition-all duration-1000" 
                            style={{width: `${(displayProfile.current_icao_level! / 6) * 100}%`}}
                        ></div>
                    </div>
                </div>
            </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3 mt-6">
            <div className="bg-gray-50 rounded-xl p-2.5 text-center border border-gray-100">
                <div className="text-lg font-black text-gray-800">{Number(displayProfile.flight_hours).toFixed(1)}</div>
                <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Hours</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-2.5 text-center border border-gray-100">
                <div className="text-lg font-black text-gray-800">{displayProfile.total_sorties}</div>
                <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Sorties</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-2.5 text-center border border-gray-100">
                <div className="text-lg font-black text-ios-orange">{displayProfile.streak}</div>
                <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Streak</div>
            </div>
        </div>
      </div>

      {/* 2. Feature Cards (Horizontal) */}
      <div className="px-6 mb-8">
          <h2 className="text-sm font-bold text-ios-subtext uppercase tracking-widest mb-3 px-1">My Dashboard</h2>
          <div className="grid grid-cols-3 gap-3 h-32">
              
              {/* Card 1: Achievements */}
              <button 
                onClick={() => setActiveModal('achievements')}
                className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 shadow-lg shadow-orange-200 p-3 flex flex-col justify-between text-left transition-transform active:scale-95 group"
              >
                  <div className="absolute top-0 right-0 p-2 opacity-20 text-white transform group-hover:scale-110 transition-transform">
                      <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.699-3.181a1 1 0 011.827 1.035L17.47 5.88 20 7.401a1 1 0 01.53 1.74l-4.157 3.272 1.254 5.373a1 1 0 01-1.454 1.229l-4.97-1.513a1 1 0 01-.606 0l-4.97 1.513a1 1 0 01-1.454-1.229l1.254-5.373-4.157-3.272a1 1 0 01.53-1.74l2.53-1.52 1.006-2.122a1 1 0 011.827-1.035l1.699 3.181L9 4.323V3a1 1 0 011-1z" clipRule="evenodd" /></svg>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white">
                      <span className="text-lg">🏆</span>
                  </div>
                  <div className="text-white relative z-10">
                      <div className="text-xl font-bold leading-none mb-0.5">{unlockedAchievements}</div>
                      <div className="text-[10px] font-semibold opacity-90">勋章墙</div>
                  </div>
              </button>

              {/* Card 2: Mistake Book */}
              <button 
                onClick={() => setActiveModal('mistakes')}
                className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-400 to-pink-500 shadow-lg shadow-pink-200 p-3 flex flex-col justify-between text-left transition-transform active:scale-95 group"
              >
                  <div className="absolute top-0 right-0 p-2 opacity-20 text-white transform group-hover:scale-110 transition-transform">
                      <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white">
                      <span className="text-lg">📖</span>
                  </div>
                  <div className="text-white relative z-10">
                      <div className="text-xl font-bold leading-none mb-0.5">{pendingMistakes}</div>
                      <div className="text-[10px] font-semibold opacity-90">错题本</div>
                  </div>
              </button>

              {/* Card 3: Logbook */}
              <button 
                onClick={() => setActiveModal('logs')}
                className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-400 to-indigo-500 shadow-lg shadow-blue-200 p-3 flex flex-col justify-between text-left transition-transform active:scale-95 group"
              >
                  <div className="absolute top-0 right-0 p-2 opacity-20 text-white transform group-hover:scale-110 transition-transform">
                      <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 00-2-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white">
                      <span className="text-lg">✈️</span>
                  </div>
                  <div className="text-white relative z-10">
                      <div className="text-xl font-bold leading-none mb-0.5">{historyCount}</div>
                      <div className="text-[10px] font-semibold opacity-90">飞行日志</div>
                  </div>
              </button>

          </div>
      </div>

      {/* 3. Flight Deck Configuration (Settings) */}
      <div className="px-6 mb-8">
         <h2 className="text-sm font-bold text-ios-subtext uppercase tracking-widest mb-3 px-1">Settings</h2>
         <div className="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden">
             
             {/* Setting Item: Training Difficulty */}
             <div className="p-4 border-b border-gray-100">
                 <div className="flex items-center space-x-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    </div>
                    <span className="text-sm font-medium text-gray-900">训练难度 (Difficulty)</span>
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
             </div>

             {/* Setting Item: Controller Accent */}
             <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                 <div className="flex flex-col">
                     <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <span className="text-sm font-medium text-gray-900">区域口音 (Accent)</span>
                     </div>
                 </div>
                 <button 
                   onClick={() => setAccentEnabled(!accentEnabled)}
                   className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ml-2`}
                   style={{backgroundColor: accentEnabled ? '#34C759' : '#E5E7EB'}}
                 >
                     <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-transform ${accentEnabled ? 'translate-x-5.5 left-0.5' : 'left-0.5'}`}></div>
                 </button>
             </div>

             {/* Setting Item: Cockpit Noise */}
             <div className="p-4 flex items-center justify-between">
                 <div className="flex flex-col">
                    <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                        </div>
                        <span className="text-sm font-medium text-gray-900">驾驶舱噪音 (Sim)</span>
                    </div>
                 </div>
                 <button 
                   onClick={() => setCockpitNoise(!cockpitNoise)}
                   className={`w-11 h-6 rounded-full transition-colors relative`}
                   style={{backgroundColor: cockpitNoise ? '#34C759' : '#E5E7EB'}}
                 >
                     <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-transform ${cockpitNoise ? 'translate-x-5.5 left-0.5' : 'left-0.5'}`}></div>
                 </button>
             </div>

         </div>
      </div>

      {/* 4. Logout */}
      <div className="px-6 pb-6">
          <button 
            onClick={handleSignOut}
            className="w-full py-3 rounded-xl border border-gray-200 text-red-500 font-bold text-sm hover:bg-red-50 transition-colors"
          >
              Log Out
          </button>
          <p className="text-center text-[10px] text-gray-400 mt-4">
              v3.3 • Connected to Supabase
          </p>
      </div>

      {/* --- MODALS --- */}
      
      {activeModal === 'achievements' && (
          <AchievementsModal 
            achievements={achievements} 
            onClose={handleCloseModal} 
          />
      )}

      {activeModal === 'mistakes' && (
          <MistakeBookModal 
            mistakes={mistakes}
            onToggleMastered={handleToggleMistake}
            onDelete={handleDeleteMistake}
            onClose={handleCloseModal}
          />
      )}

      {activeModal === 'logs' && (
          <HistoryModal 
            onClose={handleCloseModal}
            initialFilter="ALL"
            onSelectReport={(data) => {
                setSelectedReport(data);
                // Don't clear modal type immediately, transition to report
                setActiveModal(null);
            }}
          />
      )}

      {selectedReport && (
          <AssessmentReport 
            data={selectedReport} 
            onClose={handleCloseReport}
          />
      )}

    </div>
  );
};

export default ProfileScreen;
