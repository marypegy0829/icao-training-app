
import React, { useEffect, useState } from 'react';
import { Scenario, FlightPhase } from '../types';

interface Props {
  active: boolean;
  scenario: Scenario | null;
}

const CockpitDisplay: React.FC<Props> = ({ active, scenario }) => {
  const [elapsed, setElapsed] = useState(0);

  // Helper to determine Frequency and Station Name based on Phase
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
              return { freq: '118.500', name: 'TOWER' };
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
    } else if (!active && elapsed !== 0) {
      // Do not reset immediately on pause
    }

    if (!scenario) setElapsed(0);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [active, scenario]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="grid grid-cols-3 gap-3 w-full max-w-2xl mx-auto">
      
      {/* Widget 1: COMMS */}
      <div className="bg-ios-surface/80 backdrop-blur-md rounded-2xl p-3 flex flex-col justify-between h-24 border border-ios-border shadow-soft transition-all duration-500">
        <div className="flex justify-between items-center">
             <span className="text-[10px] font-bold text-ios-subtext uppercase tracking-wider">COM 1</span>
             <div className={`w-2 h-2 rounded-full ${active ? 'bg-ios-blue shadow-glow' : 'bg-gray-300'}`}></div>
        </div>
        <div>
          <div className="text-xl font-bold font-mono text-ios-text tracking-tight tabular-nums">{comms.freq}</div>
          <span className="text-[10px] text-ios-subtext font-medium">{comms.name}</span>
        </div>
      </div>

      {/* Widget 2: SCENARIO */}
      <div className="col-span-2 bg-ios-surface/80 backdrop-blur-md rounded-2xl p-3 flex flex-col justify-between h-24 border border-ios-border shadow-soft relative overflow-hidden">
         {scenario ? (
             <>
                <div className="flex justify-between items-start z-10">
                    <span className="text-[10px] font-bold text-ios-subtext uppercase tracking-wider truncate max-w-[120px]">
                        {scenario.phase || 'Scenario'}
                    </span>
                    <span className="font-mono text-base font-bold text-ios-text">{formatTime(elapsed)}</span>
                </div>
                <div className="flex items-end justify-between mt-1 z-10 h-full">
                    <div className="flex flex-col overflow-hidden mr-2">
                        <span className="text-[10px] font-bold text-ios-subtext">Weather</span>
                        <span className="text-xs font-medium text-ios-text truncate block w-full" title={scenario.weather}>
                            {scenario.weather}
                        </span>
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                        <span className="text-[10px] font-bold text-ios-subtext">Callsign</span>
                        <span className="text-sm font-bold text-ios-orange">{scenario.callsign}</span>
                    </div>
                </div>
             </>
         ) : (
             <div className="flex items-center justify-center h-full text-xs text-ios-subtext font-medium">
                 System Standby
             </div>
         )}
      </div>

    </div>
  );
};

export default CockpitDisplay;
