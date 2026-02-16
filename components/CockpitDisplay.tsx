
import React, { useEffect, useState } from 'react';
import { Scenario, FlightPhase } from '../types';
import { Airport } from '../services/airportService';

interface Props {
  active: boolean;
  scenario: Scenario | null;
  airportCode?: string;
  airportData?: Airport | null; // Added full airport data
}

const CockpitDisplay: React.FC<Props> = ({ active, scenario, airportCode = '----', airportData }) => {
  const [elapsed, setElapsed] = useState(0);

  // Helper to find frequency from Airport Data with fallbacks
  const getCommsData = (phase?: FlightPhase, data?: Airport | null) => {
      const freqs = data?.frequencies || {};
      const city = data?.city?.toUpperCase();
      const code = data?.icao_code || airportCode || '----';
      
      // 1. Determine Target Unit Type based on Phase
      let targetKeys: string[] = [];
      let defaultFreq = '118.100';
      let defaultSuffix = 'TOWER';

      switch (phase) {
          case 'Ground Ops':
              // Ground > Delivery > Tower
              targetKeys = ['GND', 'GROUND', 'DEL', 'DELIVERY', 'RAMP'];
              defaultFreq = '121.900';
              defaultSuffix = 'GROUND';
              break;
          case 'Takeoff & Climb':
              // Tower > Departure
              targetKeys = ['TWR', 'TOWER', 'DEP', 'DEPARTURE'];
              defaultFreq = '118.100';
              defaultSuffix = 'TOWER';
              break;
          case 'Landing & Taxi in':
              // Tower (Landing) > Ground (Taxi) - Stick to Tower as primary for landing phase
              targetKeys = ['TWR', 'TOWER'];
              defaultFreq = '118.100';
              defaultSuffix = 'TOWER';
              break;
          case 'Descent & Approach':
          case 'Go-around & Diversion':
              // Approach > Radar > Arrival
              targetKeys = ['APP', 'APPROACH', 'ARR', 'ARRIVAL', 'RADAR'];
              defaultFreq = '119.700';
              defaultSuffix = 'APPROACH';
              break;
          case 'Cruise & Enroute':
              // Control > Center > Radar
              targetKeys = ['CTR', 'CONTROL', 'CEN', 'CENTER', 'RADAR', 'AREA'];
              defaultFreq = '132.800';
              defaultSuffix = 'CONTROL';
              break;
          default:
              targetKeys = ['TWR', 'TOWER'];
      }

      // 2. Find Actual Frequency from DB
      let foundFreq: string | null = null;
      let foundKey: string = '';

      for (const k of targetKeys) {
          const entry = Object.entries(freqs).find(([dbKey]) => dbKey.toUpperCase().includes(k));
          if (entry) {
              foundFreq = entry[1];
              foundKey = entry[0].toUpperCase();
              break;
          }
      }

      // 3. Determine Final Display Name
      let displaySuffix = defaultSuffix;
      
      if (foundKey) {
          // Map DB key to standard suffix
          if (foundKey.includes('DEL')) displaySuffix = 'DELIVERY';
          else if (foundKey.includes('GND') || foundKey.includes('GROUND')) displaySuffix = 'GROUND';
          else if (foundKey.includes('TWR') || foundKey.includes('TOWER')) displaySuffix = 'TOWER';
          else if (foundKey.includes('DEP')) displaySuffix = 'DEPARTURE';
          else if (foundKey.includes('APP')) displaySuffix = 'APPROACH';
          else if (foundKey.includes('CTR') || foundKey.includes('CONTROL') || foundKey.includes('CEN')) displaySuffix = 'CONTROL';
          else if (foundKey.includes('RAD')) displaySuffix = 'RADAR';
      }

      // Construct Full Name: "BEIJING GROUND" or "ZBAA GROUND"
      const locationName = city || code;
      const fullName = `${locationName} ${displaySuffix}`;

      return {
          freq: foundFreq || defaultFreq,
          name: fullName
      };
  };

  const comms = getCommsData(scenario?.phase, airportData);

  // Helper to pick a likely runway for display
  const getDisplayRunway = () => {
      if (!airportData?.runways || airportData.runways.length === 0) return 'N/A';
      // Simple logic: Pick the first one as "Active"
      // In a real app, wind logic would go here.
      return airportData.runways[0];
  };

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
    <div className="grid grid-cols-12 gap-2 w-full max-w-2xl mx-auto h-28 sm:h-32 transition-all">
      
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
        <div className="flex flex-col items-start pl-2 overflow-hidden w-full">
            <span className="text-[10px] sm:text-xs font-black text-ios-blue uppercase leading-tight truncate w-full" title={comms.name}>
                {comms.name}
            </span>
            <span className="text-[8px] sm:text-[9px] font-bold text-gray-400 uppercase leading-none truncate w-full mt-0.5">
                ACTIVE
            </span>
        </div>
      </div>

      {/* --- Right Card: FLIGHT DATA (Wider: col-span-8) --- */}
      <div className="col-span-8 bg-ios-surface/90 backdrop-blur-xl rounded-2xl p-3 sm:p-4 flex flex-col justify-between border border-ios-border shadow-soft relative overflow-hidden">
         {scenario ? (
             <>
                {/* Row 1: Timer (Big) & Phase (Badge) */}
                <div className="flex justify-between items-start">
                    <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Elapsed Time</span>
                        <span className={`font-mono text-xl sm:text-3xl font-black tracking-tight tabular-nums leading-none ${active ? 'text-ios-blue' : 'text-gray-400'}`}>
                            {formatTime(elapsed)}
                        </span>
                    </div>
                    <div className="text-right flex flex-col items-end">
                        <span className="inline-block px-2 py-1 rounded-md bg-gray-100 text-[10px] font-bold text-gray-600 uppercase tracking-tight truncate max-w-[140px] border border-gray-200">
                            {scenario.phase || 'PRE-FLIGHT'}
                        </span>
                        {/* Runway Info */}
                        {airportData && (
                            <span className="text-[9px] font-mono font-bold text-gray-400 mt-1 uppercase">
                                Active: {getDisplayRunway()}
                            </span>
                        )}
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
                        <span className="text-sm sm:text-xl font-black text-ios-orange tracking-wide leading-none">{scenario.callsign}</span>
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
