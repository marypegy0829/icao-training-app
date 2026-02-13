
import React from 'react';

export const GlobalHeader: React.FC = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-[100] h-[48px] bg-white/80 backdrop-blur-md border-b border-black/5 flex items-center justify-center px-4 transition-all duration-300 shadow-sm select-none">
        
        {/* Left: Icon Brand */}
        <div className="absolute left-4 flex items-center justify-center w-8 h-8 bg-gradient-to-tr from-ios-blue to-ios-indigo rounded-lg shadow-sm">
            <svg className="w-5 h-5 text-white transform -rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
        </div>

        {/* Center: Title */}
        <div className="text-center">
            <h1 className="text-[17px] font-bold tracking-tight text-ios-text font-sans">
                ICAO <span className="text-ios-blue">Examiner</span>
            </h1>
        </div>

        {/* Right: Placeholder for future status icons (e.g. WiFi) */}
        <div className="absolute right-4 w-8 h-8 flex items-center justify-center">
            {/* Optional: Add a subtle status dot if needed later */}
        </div>
    </header>
  );
};
