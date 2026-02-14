
import React, { useState } from 'react';
import { Achievement } from '../services/achievementService';
import { MistakeEntry } from '../services/mistakeService';

// --- Achievements Modal ---
interface AchievementsModalProps {
  achievements: Achievement[];
  onClose: () => void;
}

export const AchievementsModal: React.FC<AchievementsModalProps> = ({ achievements, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in p-4">
      <div className="bg-white w-full max-w-lg max-h-[80vh] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden relative">
        {/* Header */}
        <div className="bg-gradient-to-r from-yellow-400 to-orange-500 p-6 text-white shrink-0">
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-2xl font-bold">荣誉殿堂</h2>
                    <p className="text-white/80 text-xs font-medium uppercase tracking-wider mt-1">Pilot Achievements</p>
                </div>
                <button onClick={onClose} className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                {achievements.map((ach) => (
                    <div key={ach.id} className={`flex flex-col items-center text-center p-3 rounded-xl transition-all ${ach.unlocked_at ? 'bg-white shadow-sm border border-yellow-100' : 'opacity-50 grayscale'}`}>
                        <div className="text-4xl mb-2 filter drop-shadow-sm">{ach.icon_url || '🏆'}</div>
                        <h3 className="text-xs font-bold text-gray-800 leading-tight mb-1">{ach.name}</h3>
                        <p className="text-[9px] text-gray-500 leading-none">{ach.description}</p>
                        {ach.unlocked_at && (
                            <span className="mt-2 text-[8px] font-mono text-yellow-600 bg-yellow-50 px-1.5 py-0.5 rounded border border-yellow-100">
                                {new Date(ach.unlocked_at).toLocaleDateString(undefined, {month:'short', day:'numeric'})}
                            </span>
                        )}
                    </div>
                ))}
            </div>
            {achievements.length === 0 && (
                <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                    <p>暂无勋章数据</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

// --- Mistake Book Modal ---
interface MistakeBookModalProps {
  mistakes: MistakeEntry[];
  onToggleMastered: (id: string, currentStatus: boolean) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export const MistakeBookModal: React.FC<MistakeBookModalProps> = ({ mistakes, onToggleMastered, onDelete, onClose }) => {
  const [activeTab, setActiveTab] = useState<'pending' | 'mastered'>('pending');
  
  const pendingMistakes = mistakes.filter(m => !m.is_mastered);
  const masteredMistakes = mistakes.filter(m => m.is_mastered);
  
  const displayList = activeTab === 'pending' ? pendingMistakes : masteredMistakes;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in p-4">
      <div className="bg-white w-full max-w-lg h-[80vh] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden relative">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-500 to-pink-600 px-6 pt-6 pb-2 text-white shrink-0">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <div className="flex items-center space-x-2">
                        <h2 className="text-2xl font-bold">错题本</h2>
                        <span className="bg-white/20 px-2 py-0.5 rounded text-xs font-bold">{pendingMistakes.length} 待复习</span>
                    </div>
                    <p className="text-white/80 text-xs font-medium uppercase tracking-wider mt-1">Review & Improve</p>
                </div>
                <button onClick={onClose} className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>

            {/* Tabs */}
            <div className="flex space-x-1">
                <button 
                    onClick={() => setActiveTab('pending')}
                    className={`flex-1 py-2 text-xs font-bold rounded-t-lg transition-colors ${activeTab === 'pending' ? 'bg-white text-pink-600' : 'bg-white/20 text-white hover:bg-white/30'}`}
                >
                    Review Queue ({pendingMistakes.length})
                </button>
                <button 
                    onClick={() => setActiveTab('mastered')}
                    className={`flex-1 py-2 text-xs font-bold rounded-t-lg transition-colors ${activeTab === 'mastered' ? 'bg-white text-pink-600' : 'bg-white/20 text-white hover:bg-white/30'}`}
                >
                    Archive ({masteredMistakes.length})
                </button>
            </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-3">
            {displayList.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-3 text-gray-400">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-2xl">
                        {activeTab === 'pending' ? '🎉' : '📂'}
                    </div>
                    <p className="text-sm">
                        {activeTab === 'pending' 
                            ? '太棒了！已完成所有复习任务。\nGreat Job!' 
                            : '暂无已掌握的错题记录。\nNo archived items.'}
                    </p>
                </div>
            ) : (
                displayList.map((m) => (
                    <div key={m.id} className={`bg-white p-4 rounded-xl border transition-all ${m.is_mastered ? 'border-gray-100 opacity-80' : 'border-red-100 shadow-sm'}`}>
                        
                        {/* Card Header */}
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex flex-col">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase w-fit mb-1 ${m.is_mastered ? 'bg-gray-100 text-gray-500' : 'bg-red-50 text-red-600'}`}>
                                    {m.issue_type || 'General'}
                                </span>
                                {/* P0: Show Source Scenario */}
                                {m.source_scenario_title && (
                                    <span className="text-[9px] font-medium text-gray-400 flex items-center">
                                        <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                                        {m.source_scenario_title}
                                    </span>
                                )}
                            </div>
                            
                            <div className="flex items-center space-x-1">
                                <button 
                                    onClick={() => onToggleMastered(m.id, m.is_mastered)}
                                    className={`text-xs font-bold px-3 py-1.5 rounded-full transition-colors flex items-center space-x-1 ${m.is_mastered ? 'bg-gray-100 text-gray-500 hover:bg-gray-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                                >
                                    <span>{m.is_mastered ? '撤销' : '掌握'}</span>
                                    {m.is_mastered && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>}
                                </button>
                                {/* P0: Delete Button */}
                                <button 
                                    onClick={() => {
                                        if(window.confirm('Confirm delete?')) onDelete(m.id);
                                    }}
                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                                    title="Delete"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                            </div>
                        </div>
                        
                        <div className="space-y-2 mb-3">
                            <div className="flex items-start space-x-2">
                                <span className="text-xs text-red-400 font-mono mt-0.5 shrink-0">ERR:</span>
                                <div className="text-sm text-red-900 line-through decoration-red-300 decoration-2">{m.original_text}</div>
                            </div>
                            <div className="flex items-start space-x-2">
                                <span className="text-xs text-green-500 font-mono mt-0.5 shrink-0">COR:</span>
                                <div className="text-sm font-bold text-green-800">{m.correction}</div>
                            </div>
                        </div>
                        
                        <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100 flex justify-between items-end">
                            <p className="text-xs text-gray-600 leading-relaxed flex-1">
                                <span className="font-bold text-gray-400 mr-1">ANALYSIS:</span>
                                {m.explanation}
                            </p>
                            {/* P1: Review Count */}
                            <div className="ml-2 shrink-0 text-[9px] font-bold text-gray-300 flex flex-col items-center">
                                <svg className="w-3 h-3 mb-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                {m.review_count}
                            </div>
                        </div>
                    </div>
                ))
            )}
        </div>
      </div>
    </div>
  );
};
