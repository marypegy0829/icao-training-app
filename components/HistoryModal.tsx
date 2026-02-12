
import React, { useEffect, useState } from 'react';
import { userService } from '../services/userService';
import { AssessmentData } from '../types';

interface HistoryModalProps {
  onClose: () => void;
  onSelectReport: (data: AssessmentData) => void;
}

const HistoryModal: React.FC<HistoryModalProps> = ({ onClose, onSelectReport }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const data = await userService.getHistory();
        setLogs(data || []);
      } catch (e) {
        console.error("Failed to load history", e);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  // Helper to determine score color
  const getScoreColor = (score: number) => {
    if (score >= 5) return 'bg-green-100 text-green-700 border-green-200';
    if (score >= 4) return 'bg-blue-100 text-blue-700 border-blue-200';
    return 'bg-orange-100 text-orange-700 border-orange-200';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-lg h-[80vh] sm:h-[600px] rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl flex flex-col overflow-hidden relative">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-white z-10">
          <div>
            <h2 className="text-lg font-bold text-gray-900">历史报告</h2>
            <p className="text-xs text-gray-500">训练与评估记录 (Training & Assessment)</p>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-40 space-y-2">
               <div className="w-6 h-6 border-2 border-ios-blue border-t-transparent rounded-full animate-spin"></div>
               <span className="text-xs text-gray-400">加载记录中...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">
              暂无历史记录，快去开始训练吧！
            </div>
          ) : (
            logs.map((log) => (
              <button
                key={log.id}
                onClick={() => {
                   if (log.details) {
                       onSelectReport(log.details as AssessmentData);
                   } else {
                       // Chinese alert for better UX
                       alert("该记录无详细报告数据 (No detailed report available).");
                   }
                }}
                className="w-full bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all active:scale-[0.98] text-left group"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center space-x-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold border ${getScoreColor(log.score)}`}>
                        {log.score}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-gray-900 line-clamp-1">{log.scenario_title || '未命名会话'}</h3>
                        <div className="flex items-center text-[10px] text-gray-400 space-x-2">
                            <span>{new Date(log.created_at).toLocaleDateString()}</span>
                            <span>•</span>
                            <span>{new Date(log.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                      </div>
                  </div>
                  <div className="text-right flex flex-col items-end">
                      {/* Badge for Session Type */}
                      {log.session_type === 'ASSESSMENT' ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 border border-purple-200 mb-1">
                              评估
                          </span>
                      ) : (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100 mb-1">
                              训练
                          </span>
                      )}
                      
                      <span className="text-[10px] font-mono text-gray-400 block">{log.duration}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-1">
                    <span className="px-2 py-0.5 bg-gray-100 rounded text-[10px] text-gray-500 uppercase font-semibold">{log.phase || 'General'}</span>
                    <span className="text-[10px] font-bold text-ios-blue opacity-0 group-hover:opacity-100 transition-opacity">查看报告 &rarr;</span>
                </div>
              </button>
            ))
          )}
        </div>

      </div>
    </div>
  );
};

export default HistoryModal;
