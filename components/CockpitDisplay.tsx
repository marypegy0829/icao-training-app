
import React, { useEffect, useState } from 'react';
import { Scenario, FlightPhase } from '../types';

interface Props {
  active: boolean;
  scenario: Scenario | null;
  airportCode?: string;
}

const CockpitDisplay: React.FC<Props> = ({ active, scenario, airportCode = '----' }) => {
  const [elapsed, setElapsed] = useState(0);

  const getCommsData = (phase?: FlightPhase) => {
      switch (phase) {
          case 'Ground Ops':
              return { freq: '121.900', name: 'GROUND' };
          case 'Takeoff & Climb':
          case 'Landing & Taxi in':
              return { freq: '118.500', name: 'TOWER' };
          case 'Descent & Approach':
          case 'Go-around & Diversion':
              return { freq: '119.700', name: 'APPROACH' };
          case 'Cruise & Enroute':
              return { freq: '132.800', name: 'CONTROL' };
          default:
              return { freq: '118.100', name: 'TOWER' };
      }
  };

  const comms = getCommsData(scenario?.phase);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    if (active) {
      const startTime = Date.now() - elapsed;
      timer = setInterval(() => {
        setElapsed(Date.now() - startTime);
      }, 1000);
    }
    if (!scenario) setElapsed(0);
    return () => { if (timer) clearInterval(timer); };
  }, [active, scenario]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="grid grid-cols-12 gap-2 w-full max-w-2xl mx-auto h-24 sm:h-28">
      
      {/* --- Left Card: COMMS (Narrower: col-span-4) --- */}
      <div className="col-span-4 bg-ios-surface/90 backdrop-blur-xl rounded-2xl p-2 sm:p-3 flex flex-col justify-between border border-ios-border shadow-soft relative overflow-hidden">
        {/* Active Indicator Bar */}
        <div className={`absolute top-0 left-0 w-1 h-full transition-colors duration-500 ${active ? 'bg-green-500' : 'bg-gray-300'}`}></div>
        
        {/* Top: Header */}
        <div className="flex justify-between items-center pl-2">
             <span className="text-[9px] font-bold text-ios-subtext uppercase tracking-widest truncate">COM 1</span>
             <div className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse' : 'bg-gray-300'}`}></div>
        </div>

        {/* Middle: Frequency */}
        <div className="text-center pl-1">
          <div className="text-2xl sm:text-3xl font-black font-mono text-ios-text tracking-tighter tabular-nums leading-none">
            {comms.freq}
          </div>
        </div>

        {/* Bottom: Station Info */}
        <div className="flex flex-col items-start pl-2">
            <div className="flex flex-col w-full">
                <span className="text-xs sm:text-sm font-bold text-ios-text leading-none truncate">{airportCode}</span>
                <span className="text-[8px] sm:text-[10px] font-bold text-ios-blue uppercase leading-none truncate mt-0.5">{comms.name}</span>
            </div>
        </div>
      </div>

      {/* --- Right Card: FLIGHT DATA (Wider: col-span-8, No Situation) --- */}
      <div className="col-span-8 bg-ios-surface/90 backdrop-blur-xl rounded-2xl p-3 sm:p-4 flex flex-col justify-between border border-ios-border shadow-soft relative overflow-hidden">
         {scenario ? (
             <>
                {/* Row 1: Timer (Big) & Phase (Badge) */}
                <div className="flex justify-between items-start">
                    <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Elapsed Time</span>
                        <span className={`font-mono text-xl sm:text-2xl font-black tracking-tight tabular-nums leading-none ${active ? 'text-ios-blue' : 'text-gray-400'}`}>
                            {formatTime(elapsed)}
                        </span>
                    </div>
                    <div className="text-right">
                        <span className="inline-block px-2 py-1 rounded-md bg-gray-100 text-[10px] font-bold text-gray-600 uppercase tracking-tight truncate max-w-[140px] border border-gray-200">
                            {scenario.phase || 'PRE-FLIGHT'}
                        </span>
                    </div>
                </div>

                {/* Row 2: Weather & Callsign (Compact Row) */}
                <div className="flex justify-between items-end mt-1">
                    
                    {/* Weather */}
                    <div className="flex-1 mr-4 overflow-hidden">
                        <div className="flex items-center space-x-1.5 text-ios-subtext mb-0.5">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>
                            <span className="text-[9px] font-bold uppercase tracking-wider">Weather</span>
                        </div>
                        <span className="text-xs sm:text-sm font-semibold text-gray-700 truncate block leading-tight">
                            {scenario.weather}
                        </span>
                    </div>

                    {/* Callsign */}
                    <div className="flex flex-col items-end shrink-0">
                        <span className="text-[9px] font-bold text-ios-subtext uppercase tracking-wider mb-0.5">Callsign</span>
                        <span className="text-sm sm:text-lg font-black text-ios-orange tracking-wide leading-none">{scenario.callsign}</span>
                    </div>
                </div>
             </>
         ) : (
             <div className="flex flex-col items-center justify-center h-full text-ios-subtext space-y-2 opacity-60">
                 <span className="text-xs font-bold uppercase tracking-widest">Data Link Standby</span>
             </div>
         )}
      </div>

    </div>
  );
};

export default CockpitDisplay;
