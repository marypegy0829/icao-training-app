import React from 'react';

interface VisualizerProps {
  isActive: boolean;
  audioLevel: number; // 0.0 to 1.0
}

const Visualizer: React.FC<VisualizerProps> = ({ isActive, audioLevel }) => {
  // Base scale is 1. When audio is loud, it grows.
  const dynamicScale = 1 + (audioLevel * 0.4); 

  return (
    <div className="relative w-full max-w-[280px] aspect-square mx-auto flex items-center justify-center">
      {/* Background Soft Blob */}
      <div 
        className={`absolute inset-0 bg-gradient-to-tr from-ios-blue/30 to-ios-orange/30 rounded-full blur-[60px] transition-all duration-1000 ${isActive ? 'opacity-100 scale-110' : 'opacity-0 scale-50'}`}
      ></div>

      {/* Main Container */}
      <div className="relative flex items-center justify-center">
        
        {/* Outer Ripple Ring 1 */}
        <div 
          className={`absolute w-56 h-56 rounded-full border border-ios-blue/10 bg-white/30 backdrop-blur-md transition-all duration-200 ease-out
          ${isActive ? 'opacity-100' : 'opacity-0 scale-50'}`}
          style={{ transform: isActive ? `scale(${1 + audioLevel * 0.2})` : 'scale(0.5)' }}
        ></div>

        {/* Outer Ripple Ring 2 */}
        <div 
          className={`absolute w-44 h-44 rounded-full border border-ios-blue/20 bg-white/40 backdrop-blur-lg transition-all duration-200
          ${isActive ? 'opacity-100' : 'opacity-0 scale-50'}`}
          style={{ transform: isActive ? `scale(${1 + audioLevel * 0.15})` : 'scale(0.5)' }}
        ></div>

        {/* The Core Orb (Liquid Gradient) */}
        <div 
          className={`relative w-32 h-32 rounded-full shadow-lg flex items-center justify-center transition-all duration-100 ease-linear z-10 overflow-hidden
          ${isActive 
            ? 'shadow-glow' 
            : 'bg-gray-200 scale-90 shadow-inner'}
          `}
          style={{ transform: isActive ? `scale(${dynamicScale})` : 'scale(0.9)' }}
        >
          {isActive ? (
             <div className={`absolute inset-[-50%] bg-[conic-gradient(from_0deg,#007AFF,#5856D6,#FF9500,#007AFF)] opacity-90 blur-xl animate-[spin_4s_linear_infinite]`}></div>
          ) : (
             <div className="text-gray-400">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
             </div>
          )}
          
          {/* Shine effect */}
          <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/80 to-transparent opacity-50 rounded-t-full"></div>
        </div>
      </div>
    </div>
  );
};

export default Visualizer;