
import React from 'react';
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
  onClose: () => void;
}

export const MistakeBookModal: React.FC<MistakeBookModalProps> = ({ mistakes, onToggleMastered, onClose }) => {
  const pendingCount = mistakes.filter(m => !m.is_mastered).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in p-4">
      <div className="bg-white w-full max-w-lg h-[80vh] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden relative">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-500 to-pink-600 p-6 text-white shrink-0">
            <div className="flex justify-between items-start">
                <div>
                    <div className="flex items-center space-x-2">
                        <h2 className="text-2xl font-bold">错题本</h2>
                        <span className="bg-white/20 px-2 py-0.5 rounded text-xs font-bold">{pendingCount} 待复习</span>
                    </div>
                    <p className="text-white/80 text-xs font-medium uppercase tracking-wider mt-1">Review & Improve</p>
                </div>
                <button onClick={onClose} className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-3">
            {mistakes.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-3 text-gray-400">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-2xl">✨</div>
                    <p className="text-sm">暂无错题记录<br/>Keep up the good work!</p>
                </div>
            ) : (
                mistakes.map((m) => (
                    <div key={m.id} className={`bg-white p-4 rounded-xl border transition-all ${m.is_mastered ? 'border-gray-100 opacity-60' : 'border-red-100 shadow-sm'}`}>
                        <div className="flex justify-between items-start mb-2">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${m.is_mastered ? 'bg-gray-100 text-gray-500' : 'bg-red-50 text-red-600'}`}>
                                {m.issue_type || 'General'}
                            </span>
                            <button 
                                onClick={() => onToggleMastered(m.id, m.is_mastered)}
                                className={`text-xs font-bold px-3 py-1.5 rounded-full transition-colors flex items-center space-x-1 ${m.is_mastered ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                            >
                                <span>{m.is_mastered ? '已掌握' : '标记掌握'}</span>
                                {m.is_mastered && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                            </button>
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
                        
                        <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                            <p className="text-xs text-gray-600 leading-relaxed">
                                <span className="font-bold text-gray-400 mr-1">ANALYSIS:</span>
                                {m.explanation}
                            </p>
                        </div>
                    </div>
                ))
            )}
        </div>
      </div>
    </div>
  );
};
