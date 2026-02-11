import React from 'react';
import { Scenario } from '../types';

interface Props {
  scenario: Scenario;
  onAccept: () => void;
  onCancel: () => void;
}

const BriefingModal: React.FC<Props> = ({ scenario, onAccept, onCancel }) => {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-ios-bg/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl border border-white/40 flex flex-col overflow-hidden">
        
        <div className="bg-ios-text text-white p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10">
                <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>
            </div>
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Pre-flight Briefing</h2>
            <h1 className="text-2xl font-bold tracking-tight">{scenario.title}</h1>
        </div>

        <div className="p-6 space-y-6">
            
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <span className="block text-[10px] font-bold text-gray-400 uppercase">Callsign</span>
                    <span className="block text-lg font-mono font-bold text-ios-blue">{scenario.callsign}</span>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <span className="block text-[10px] font-bold text-gray-400 uppercase">Location</span>
                    <span className="block text-lg font-mono font-bold text-ios-text">EGLL</span>
                </div>
            </div>

            <div>
                <span className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Weather / ATIS</span>
                <div className="bg-orange-50/50 p-3 rounded-xl border border-orange-100 text-sm text-gray-800 font-mono leading-relaxed">
                    {scenario.weather}
                </div>
            </div>

            <div>
                <span className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Situation</span>
                <p className="text-sm text-gray-600 leading-relaxed">
                    {scenario.details}
                </p>
            </div>

        </div>

        <div className="p-6 pt-0 flex space-x-3">
            <button 
                onClick={onCancel}
                className="flex-1 py-4 rounded-xl font-semibold text-gray-500 hover:bg-gray-100 transition-colors"
            >
                Cancel
            </button>
            <button 
                onClick={onAccept}
                className="flex-1 py-4 rounded-xl bg-ios-blue text-white font-semibold shadow-lg shadow-blue-200 hover:scale-[1.02] active:scale-95 transition-all"
            >
                Contact Tower
            </button>
        </div>

      </div>
    </div>
  );
};

export default BriefingModal;