
import React, { useState } from 'react';
import { userService } from '../services/userService';

interface Props {
    onComplete: () => void;
}

const CompleteProfileScreen: React.FC<Props> = ({ onComplete }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [profileData, setProfileData] = useState({
    name: '',
    airline: '',
    aircraft_type: '',
    flight_level: 'First Officer',
    current_icao_level: '4'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileData.name.trim()) {
        setError("Please enter your name.");
        return;
    }

    setLoading(true);
    setError(null);
    try {
      await userService.createProfile({
        name: profileData.name,
        airline: profileData.airline,
        aircraft_type: profileData.aircraft_type,
        flight_level: profileData.flight_level,
        current_icao_level: parseInt(profileData.current_icao_level)
      });
      
      // FIX: Call parent callback instead of reloading window.
      // This ensures immediate UI transition without relying on async DB fetch latency.
      onComplete();
      
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-full bg-ios-bg flex items-center justify-center p-6 relative overflow-hidden">
        {/* Background Blobs */}
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-ios-blue/10 rounded-full blur-[80px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-ios-orange/10 rounded-full blur-[80px]"></div>

        <div className="w-full max-w-md bg-white/80 backdrop-blur-xl border border-white p-8 rounded-[2rem] shadow-2xl relative z-10">
            <div className="flex flex-col items-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-tr from-ios-blue to-ios-indigo rounded-2xl flex items-center justify-center shadow-glow mb-4">
                    <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                </div>
                <h1 className="text-2xl font-bold text-ios-text tracking-tight">Pilot Profile</h1>
                <p className="text-sm text-ios-subtext">Complete your details to start training</p>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 font-medium text-center">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in">
                <div className="mb-2 text-center">
                    <p className="text-xs text-gray-400">Step 2/2: Operational Details</p>
                </div>
       
               <div>
                 <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Full Name (Required)</label>
                 <input 
                   type="text" 
                   required
                   className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-ios-blue focus:outline-none"
                   value={profileData.name}
                   onChange={e => setProfileData({...profileData, name: e.target.value})}
                   placeholder="e.g. Captain Tom"
                 />
               </div>

               <div className="grid grid-cols-2 gap-3">
                 <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Airline</label>
                    <input 
                      type="text" 
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-ios-blue focus:outline-none"
                      value={profileData.airline}
                      onChange={e => setProfileData({...profileData, airline: e.target.value})}
                      placeholder="ICAO Code"
                    />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Aircraft</label>
                    <input 
                      type="text" 
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-ios-blue focus:outline-none"
                      value={profileData.aircraft_type}
                      onChange={e => setProfileData({...profileData, aircraft_type: e.target.value})}
                      placeholder="e.g. B737"
                    />
                 </div>
               </div>

               <div className="grid grid-cols-2 gap-3">
                 <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Rank</label>
                    <select 
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-ios-blue focus:outline-none"
                      value={profileData.flight_level}
                      onChange={e => setProfileData({...profileData, flight_level: e.target.value})}
                    >
                      <option>Cadet</option>
                      <option>Second Officer</option>
                      <option>First Officer</option>
                      <option>Senior FO</option>
                      <option>Captain</option>
                    </select>
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Current Level</label>
                    <select 
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-ios-blue focus:outline-none"
                      value={profileData.current_icao_level}
                      onChange={e => setProfileData({...profileData, current_icao_level: e.target.value})}
                    >
                      <option value="3">Level 3</option>
                      <option value="4">Level 4</option>
                      <option value="5">Level 5</option>
                      <option value="6">Level 6</option>
                    </select>
                 </div>
               </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full py-3 bg-ios-blue text-white rounded-xl font-bold shadow-lg shadow-blue-200 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 mt-4"
              >
                {loading ? 'Completing Setup...' : 'Complete & Start'}
              </button>
            </form>
        </div>
    </div>
  );
};

export default CompleteProfileScreen;
