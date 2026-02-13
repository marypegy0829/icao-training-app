
import React, { useState, useEffect } from 'react';
import { supabase } from './services/supabaseClient';
import { userService } from './services/userService';
import AssessmentScreen from './screens/AssessmentScreen';
import HomeScreen from './screens/HomeScreen';
import TrainingScreen from './screens/TrainingScreen';
import ProfileScreen from './screens/ProfileScreen';
import AuthScreen from './screens/AuthScreen';
import CompleteProfileScreen from './screens/CompleteProfileScreen';
import { Tab, Scenario, DifficultyLevel } from './types';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [profileComplete, setProfileComplete] = useState<boolean>(false);
  const [checkingProfile, setCheckingProfile] = useState<boolean>(false);

  // App Tabs State
  const [currentTab, setCurrentTab] = useState<Tab>('home'); 
  const [pendingScenario, setPendingScenario] = useState<Scenario | null>(null);
  
  // Settings State
  const [difficulty, setDifficulty] = useState<DifficultyLevel>(DifficultyLevel.LEVEL_4_RECURRENT);
  const [accentEnabled, setAccentEnabled] = useState<boolean>(false); 
  const [cockpitNoise, setCockpitNoise] = useState<boolean>(true); // New Noise State

  // Helper to check profile status
  const checkProfile = async () => {
      setCheckingProfile(true);
      try {
          const profile = await userService.getProfile();
          // Assume profile is complete if a name exists (as it's required)
          if (profile && profile.name) {
              setProfileComplete(true);
          } else {
              setProfileComplete(false);
          }
      } catch (e) {
          console.error("Profile check failed", e);
          setProfileComplete(false);
      } finally {
          setCheckingProfile(false);
      }
  };

  useEffect(() => {
    // 1. Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
          checkProfile().then(() => setLoading(false));
      } else {
          setLoading(false);
      }
    });

    // 2. Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
          // Re-check profile on login events
          checkProfile();
      } else {
          setProfileComplete(false);
      }
      if (_event === 'PASSWORD_RECOVERY') {
         // Optionally handle password recovery UI specifically here
      }
    });
    
    // 3. Load settings from local storage
    const savedAccent = localStorage.getItem('icao_accent_enabled');
    if (savedAccent) setAccentEnabled(savedAccent === 'true');

    const savedNoise = localStorage.getItem('icao_cockpit_noise');
    if (savedNoise) setCockpitNoise(savedNoise === 'true');

    return () => subscription.unsubscribe();
  }, []);

  // Persist settings
  const handleSetAccent = (enabled: boolean) => {
      setAccentEnabled(enabled);
      localStorage.setItem('icao_accent_enabled', String(enabled));
  };

  const handleSetNoise = (enabled: boolean) => {
      setCockpitNoise(enabled);
      localStorage.setItem('icao_cockpit_noise', String(enabled));
  };

  const handleStartScenario = (scenario: Scenario) => {
    setPendingScenario(scenario);
    setCurrentTab('training');
  };

  // NEW: Handler for profile completion to avoid reload logic
  const handleProfileComplete = () => {
      setProfileComplete(true);
      // Optionally run a background check to sync exact data, but let user in immediately
      checkProfile();
  };

  if (loading || checkingProfile) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-ios-bg">
         <div className="flex flex-col items-center space-y-4">
            <div className="w-8 h-8 border-4 border-ios-blue border-t-transparent rounded-full animate-spin"></div>
            {checkingProfile && <p className="text-xs text-gray-400">Verifying Pilot Profile...</p>}
         </div>
      </div>
    );
  }

  // Render Auth Screen if not logged in
  if (!session) {
    return <AuthScreen />;
  }

  // Render Complete Profile Screen if logged in but no profile
  if (!profileComplete) {
      return <CompleteProfileScreen onComplete={handleProfileComplete} />;
  }

  // --- Main App Renderer ---

  const renderScreen = () => {
    switch (currentTab) {
      case 'home':
        return <HomeScreen onNavigate={setCurrentTab} onStartScenario={handleStartScenario} />;
      case 'training':
        return (
          <TrainingScreen 
            initialScenario={pendingScenario} 
            onConsumeScenario={() => setPendingScenario(null)} 
            difficulty={difficulty}
            accentEnabled={accentEnabled}
            cockpitNoise={cockpitNoise}
          />
        );
      case 'assessment':
        return (
            <AssessmentScreen 
                difficulty={difficulty} 
                accentEnabled={accentEnabled}
                cockpitNoise={cockpitNoise}
            />
        );
      case 'profile':
        return (
            <ProfileScreen 
                difficulty={difficulty} 
                setDifficulty={setDifficulty}
                accentEnabled={accentEnabled}
                setAccentEnabled={handleSetAccent}
                cockpitNoise={cockpitNoise}
                setCockpitNoise={handleSetNoise}
            />
        );
      default:
        return <AssessmentScreen difficulty={difficulty} accentEnabled={accentEnabled} cockpitNoise={cockpitNoise} />;
    }
  };

  return (
    <div className="h-screen w-full flex flex-col bg-ios-bg font-sans text-ios-text selection:bg-ios-blue/20">
      
      {/* Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {renderScreen()}
      </div>

      {/* Bottom Tab Bar */}
      <div className="h-16 bg-white/90 backdrop-blur-md border-t border-gray-200 shrink-0 flex items-center justify-around pb-safe">
        
        {/* Home Tab */}
        <button 
          onClick={() => setCurrentTab('home')}
          className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${currentTab === 'home' ? 'text-ios-blue' : 'text-gray-400 hover:text-gray-500'}`}
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span className="text-[10px] font-medium">首页</span>
        </button>

        {/* Training Tab */}
        <button 
          onClick={() => setCurrentTab('training')}
          className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${currentTab === 'training' ? 'text-ios-blue' : 'text-gray-400 hover:text-gray-500'}`}
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <span className="text-[10px] font-medium">训练</span>
        </button>

        {/* Assessment Tab */}
        <button 
          onClick={() => setCurrentTab('assessment')}
          className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${currentTab === 'assessment' ? 'text-ios-blue' : 'text-gray-400 hover:text-gray-500'}`}
        >
           {/* Active Indicator or different icon style could be used here */}
          <div className={`relative ${currentTab === 'assessment' ? 'scale-110 transition-transform' : ''}`}>
             <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
             </svg>
             {currentTab === 'assessment' && <div className="absolute top-0 right-0 w-2 h-2 bg-ios-orange rounded-full"></div>}
          </div>
          <span className="text-[10px] font-medium">评估</span>
        </button>

        {/* Profile Tab */}
        <button 
          onClick={() => setCurrentTab('profile')}
          className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${currentTab === 'profile' ? 'text-ios-blue' : 'text-gray-400 hover:text-gray-500'}`}
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span className="text-[10px] font-medium">我的</span>
        </button>

      </div>

    </div>
  );
};

export default App;
