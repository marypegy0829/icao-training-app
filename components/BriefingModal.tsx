
import React, { useState, useEffect } from 'react';
import { Scenario } from '../types';
import { airportService, Airport } from '../services/airportService';

interface Props {
  scenario: Scenario;
  onAccept: (airportCode: string) => void;
  onCancel: () => void;
  onRefresh?: () => Promise<void> | void; 
}

const BriefingModal: React.FC<Props> = ({ scenario, onAccept, onCancel, onRefresh }) => {
  const [airportCode, setAirportCode] = useState('ZBAA');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [airportData, setAirportData] = useState<Airport | null>(null);

  // Auto-fetch airport details when user stops typing
  useEffect(() => {
      const timer = setTimeout(async () => {
          if (airportCode.length >= 3) {
              const data = await airportService.getAirportByCode(airportCode);
              setAirportData(data);
          } else {
              setAirportData(null);
          }
      }, 500);
      return () => clearTimeout(timer);
  }, [airportCode]);

  const handleStart = () => {
      const code = airportCode.trim().length >= 3 ? airportCode.trim().toUpperCase() : 'ZBAA';
      onAccept(code);
  };

  const handleRefreshClick = async () => {
      if (onRefresh) {
          setIsRefreshing(true);
          try {
            await onRefresh();
          } finally {
            setTimeout(() => setIsRefreshing(false), 300);
          }
      }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-ios-bg/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-md max-h-[90vh] rounded-[2rem] shadow-2xl border border-white/40 flex flex-col overflow-hidden">
        
        <div className="bg-ios-text text-white p-6 relative overflow-hidden shrink-0">
            <div className="absolute top-0 right-0 p-8 opacity-10">
                <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>
            </div>
            <div className="relative z-10">
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Pre-flight Briefing</h2>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight line-clamp-2">{scenario.title}</h1>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* Input & Callsign */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <span className="block text-[10px] font-bold text-gray-400 uppercase">Callsign</span>
                    <span className="block text-base font-mono font-bold text-ios-blue truncate">{scenario.callsign}</span>
                </div>
                
                <div className="bg-white p-3 rounded-xl border-2 border-ios-blue/20 focus-within:border-ios-blue transition-colors shadow-sm relative">
                    <span className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Location</span>
                    <input 
                        type="text"
                        value={airportCode}
                        onChange={(e) => setAirportCode(e.target.value.toUpperCase())}
                        maxLength={4}
                        className="block w-full text-lg font-mono font-bold text-ios-text placeholder-gray-300 focus:outline-none bg-transparent uppercase"
                        placeholder="ICAO"
                    />
                    <div className="absolute top-3 right-3">
                        {airportData ? (
                            <span className="text-xs font-bold text-green-600 bg-green-100 px-1.5 py-0.5 rounded">FOUND</span>
                        ) : (
                            <svg className="w-4 h-4 text-ios-blue opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                        )}
                    </div>
                </div>
            </div>

            {/* Airport Details Card */}
            {airportData && (
                <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-200 p-4 shadow-sm">
                    <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center">
                        <span className="mr-2">{airportData.name}</span>
                        <span className="text-[10px] font-normal text-gray-500 bg-white border px-1.5 rounded">{airportData.elevation_ft}ft</span>
                    </h3>
                    
                    <div className="space-y-3">
                        {/* Runways */}
                        <div>
                            <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Active Runways</span>
                            <div className="flex flex-wrap gap-1">
                                {airportData.runways.map(r => (
                                    <span key={r} className="text-[10px] font-mono font-bold bg-gray-800 text-white px-2 py-0.5 rounded">{r}</span>
                                ))}
                            </div>
                        </div>

                        {/* SIDs/STARs Preview */}
                        {airportData.procedures && (
                            <div className="grid grid-cols-2 gap-2">
                                {airportData.procedures.sids && airportData.procedures.sids.length > 0 && (
                                    <div>
                                        <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Exp SIDs</span>
                                        <div className="text-[10px] text-gray-600 font-mono truncate">
                                            {airportData.procedures.sids.slice(0, 3).join(', ')}...
                                        </div>
                                    </div>
                                )}
                                {airportData.procedures.stars && airportData.procedures.stars.length > 0 && (
                                    <div>
                                        <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Exp STARs</span>
                                        <div className="text-[10px] text-gray-600 font-mono truncate">
                                            {airportData.procedures.stars.slice(0, 3).join(', ')}...
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Scenario Weather & Situation */}
            <div>
                <span className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Weather / ATIS</span>
                <div className="bg-orange-50/50 p-3 rounded-xl border border-orange-100 text-sm text-gray-800 font-mono leading-relaxed">
                    {scenario.weather}
                </div>
            </div>

            <div>
                <div className="flex justify-between items-center mb-1">
                    <span className="block text-[10px] font-bold text-gray-400 uppercase">Situation Brief</span>
                    {onRefresh && (
                        <button 
                            onClick={handleRefreshClick}
                            className="flex items-center space-x-1 text-[10px] font-bold text-ios-blue bg-blue-50 px-2 py-1 rounded-full hover:bg-blue-100 active:scale-95 transition-all"
                        >
                            <svg 
                                className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} 
                                fill="none" viewBox="0 0 24 24" stroke="currentColor"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span>Reroll</span>
                        </button>
                    )}
                </div>
                <p className="text-sm text-gray-600 leading-relaxed min-h-[60px]">
                    {scenario.details}
                </p>
            </div>

        </div>

        <div className="p-6 pt-0 flex space-x-3 shrink-0 bg-white">
            <button 
                onClick={onCancel}
                className="flex-1 py-3.5 rounded-xl font-semibold text-gray-500 hover:bg-gray-100 transition-colors"
            >
                Cancel
            </button>
            <button 
                onClick={handleStart}
                className="flex-1 py-3.5 rounded-xl bg-ios-blue text-white font-semibold shadow-lg shadow-blue-200 hover:scale-[1.02] active:scale-95 transition-all"
            >
                Contact Tower
            </button>
        </div>

      </div>
    </div>
  );
};

export default BriefingModal;
