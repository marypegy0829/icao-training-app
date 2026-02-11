import React, { useEffect, useState } from 'react';
import { Scenario } from '../types';

interface Props {
  active: boolean;
  scenario: Scenario | null;
}

const CockpitDisplay: React.FC<Props> = ({ active, scenario }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    if (active) {
      const startTime = Date.now() - elapsed;
      timer = setInterval(() => {
        setElapsed(Date.now() - startTime);
      }, 1000);
    } else if (!active && elapsed !== 0) {
      // Do not reset immediately on pause, but for this app disconnected means stop
      // We might want to keep the final time visible, but for now let's reset on full disconnect or handle in parent
      // Actually, let's just reset when scenario is null
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
      <div className="bg-ios-surface/80 backdrop-blur-md rounded-2xl p-3 flex flex-col justify-between h-24 border border-ios-border shadow-soft">
        <div className="flex justify-between items-center">
             <span className="text-[10px] font-bold text-ios-subtext uppercase tracking-wider">COM 1</span>
             <div className={`w-2 h-2 rounded-full ${active ? 'bg-ios-blue shadow-glow' : 'bg-gray-300'}`}></div>
        </div>
        <div>
          <div className="text-xl font-bold font-mono text-ios-text tracking-tight">118.500</div>
          <span className="text-[10px] text-ios-subtext font-medium">TOWER</span>
        </div>
      </div>

      {/* Widget 2: SCENARIO */}
      <div className="col-span-2 bg-ios-surface/80 backdrop-blur-md rounded-2xl p-3 flex flex-col justify-between h-24 border border-ios-border shadow-soft relative overflow-hidden">
         {scenario ? (
             <>
                <div className="flex justify-between items-start z-10">
                    <span className="text-[10px] font-bold text-ios-subtext uppercase tracking-wider">Scenario: {scenario.title}</span>
                    <span className="font-mono text-base font-bold text-ios-text">{formatTime(elapsed)}</span>
                </div>
                <div className="flex items-end justify-between mt-1 z-10 h-full">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-ios-subtext">Weather</span>
                        <span className="text-xs font-medium text-ios-text truncate max-w-[200px]">{scenario.weather}</span>
                    </div>
                    <div className="flex flex-col items-end">
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