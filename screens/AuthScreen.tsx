
import React, { useState } from 'react';
import { authService } from '../services/authService';
import { userService } from '../services/userService';

type AuthMode = 'login' | 'register-step-1' | 'register-step-2' | 'forgot-password';

const AuthScreen: React.FC = () => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Profile Form State
  const [profileData, setProfileData] = useState({
    name: '',
    airline: '',
    aircraft_type: '',
    flight_level: 'First Officer',
    current_icao_level: '4'
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await authService.signIn(email, password);
      // App.tsx auth state listener will handle the transition
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate Password
    const validation = authService.validatePassword(password);
    if (!validation.isValid) {
      setError(validation.message || 'Invalid password');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { session } = await authService.signUp(email, password);
      
      // CRITICAL: Check if we have a session. If not, email confirmation is enabled.
      if (session) {
          setMode('register-step-2');
      } else {
          setSuccessMsg("Registration successful! Please check your email to verify your account before logging in.");
          setMode('login');
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
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
      // App.tsx auth state listener will handle transition to Home
      window.location.reload(); 
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to save profile. Ensure you are logged in.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await authService.resetPassword(email);
      setSuccessMsg("Check your email for the password reset link.");
    } catch (err: any) {
      setError(err.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  // --- Components ---

  const renderLogo = () => (
    <div className="flex flex-col items-center mb-8">
      <div className="w-16 h-16 bg-gradient-to-tr from-ios-blue to-ios-indigo rounded-2xl flex items-center justify-center shadow-glow mb-4">
        <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-ios-text tracking-tight">ICAO Examiner</h1>
      <p className="text-sm text-ios-subtext">Level 5+ Proficiency Trainer</p>
    </div>
  );

  const renderLogin = () => (
    <form onSubmit={handleLogin} className="space-y-4 animate-fade-in">
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label>
        <input 
          type="email" 
          required
          className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-ios-blue focus:ring-1 focus:ring-ios-blue transition-all"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="captain@airline.com"
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Password</label>
        <input 
          type="password" 
          required
          className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-ios-blue focus:ring-1 focus:ring-ios-blue transition-all"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="••••••••"
        />
        <div className="flex justify-end mt-1">
          <button type="button" onClick={() => setMode('forgot-password')} className="text-xs text-ios-blue font-semibold">
            Forgot Password?
          </button>
        </div>
      </div>
      <button 
        type="submit" 
        disabled={loading}
        className="w-full py-3 bg-ios-text text-white rounded-xl font-bold shadow-lg hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
      >
        {loading ? 'Signing In...' : 'Sign In'}
      </button>
      <div className="text-center mt-4">
        <span className="text-xs text-gray-500">New pilot? </span>
        <button type="button" onClick={() => setMode('register-step-1')} className="text-xs text-ios-blue font-bold">
          Register Account
        </button>
      </div>
    </form>
  );

  const renderRegisterStep1 = () => (
    <form onSubmit={handleRegisterStep1} className="space-y-4 animate-fade-in">
       <div className="mb-2">
         <h2 className="text-lg font-bold text-ios-text">Create Account</h2>
         <p className="text-xs text-gray-400">Step 1/2: Credentials</p>
       </div>
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label>
        <input 
          type="email" 
          required
          className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Password</label>
        <input 
          type="password" 
          required
          className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        <ul className="mt-2 text-[10px] text-gray-400 space-y-1 ml-1 list-disc list-inside">
          <li className={password.length >= 8 ? 'text-green-600' : ''}>At least 8 characters</li>
          <li className={/[A-Z]/.test(password) ? 'text-green-600' : ''}>One uppercase letter</li>
          <li className={/[a-z]/.test(password) ? 'text-green-600' : ''}>One lowercase letter</li>
          <li className={/[0-9]/.test(password) ? 'text-green-600' : ''}>One number</li>
        </ul>
      </div>
      <button 
        type="submit" 
        disabled={loading}
        className="w-full py-3 bg-ios-blue text-white rounded-xl font-bold shadow-lg shadow-blue-200 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
      >
        {loading ? 'Validating...' : 'Next: Profile'}
      </button>
      <div className="text-center mt-4">
        <button type="button" onClick={() => setMode('login')} className="text-xs text-gray-500">
          Already have an account? <span className="text-ios-blue font-bold">Sign In</span>
        </button>
      </div>
    </form>
  );

  const renderRegisterStep2 = () => (
    <form onSubmit={handleRegisterStep2} className="space-y-4 animate-fade-in">
       <div className="mb-2">
         <h2 className="text-lg font-bold text-ios-text">Pilot Profile</h2>
         <p className="text-xs text-gray-400">Step 2/2: Operational Details</p>
       </div>
       
       <div>
         <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Full Name</label>
         <input 
           type="text" 
           required
           className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl"
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
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl"
              value={profileData.airline}
              onChange={e => setProfileData({...profileData, airline: e.target.value})}
              placeholder="ICAO Code"
            />
         </div>
         <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Aircraft</label>
            <input 
              type="text" 
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl"
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
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm"
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
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm"
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
        className="w-full py-3 bg-ios-blue text-white rounded-xl font-bold shadow-lg shadow-blue-200 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
      >
        {loading ? 'Completing Setup...' : 'Complete Registration'}
      </button>
    </form>
  );

  const renderForgotPassword = () => (
    <form onSubmit={handleForgotPassword} className="space-y-4 animate-fade-in">
      <div className="mb-2">
         <h2 className="text-lg font-bold text-ios-text">Reset Password</h2>
         <p className="text-xs text-gray-400">Enter your email to receive a recovery link.</p>
      </div>
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label>
        <input 
          type="email" 
          required
          className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
      </div>
      <button 
        type="submit" 
        disabled={loading}
        className="w-full py-3 bg-ios-text text-white rounded-xl font-bold shadow-lg disabled:opacity-50"
      >
        {loading ? 'Sending...' : 'Send Recovery Link'}
      </button>
      <div className="text-center mt-4">
        <button type="button" onClick={() => setMode('login')} className="text-xs text-gray-500 font-bold">
          Back to Login
        </button>
      </div>
    </form>
  );

  return (
    <div className="h-screen w-full bg-ios-bg flex items-center justify-center p-6 relative overflow-hidden">
        {/* Background Blobs */}
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-ios-blue/10 rounded-full blur-[80px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-ios-orange/10 rounded-full blur-[80px]"></div>

        <div className="w-full max-w-md bg-white/80 backdrop-blur-xl border border-white p-8 rounded-[2rem] shadow-2xl relative z-10">
            {renderLogo()}
            
            {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 font-medium text-center">
                    {error}
                </div>
            )}
            
            {successMsg && (
                <div className="mb-4 p-3 bg-green-50 border border-green-100 rounded-xl text-xs text-green-600 font-medium text-center">
                    {successMsg}
                </div>
            )}

            {mode === 'login' && renderLogin()}
            {mode === 'register-step-1' && renderRegisterStep1()}
            {mode === 'register-step-2' && renderRegisterStep2()}
            {mode === 'forgot-password' && renderForgotPassword()}
        </div>
    </div>
  );
};

export default AuthScreen;
