
import React, { useEffect, useState } from 'react';
import { userService } from '../services/userService';
import { AssessmentData } from '../types';

interface HistoryModalProps {
  onClose: () => void;
  onSelectReport: (data: AssessmentData) => void;
  initialFilter?: 'ALL' | 'TRAINING' | 'ASSESSMENT';
}

const HistoryModal: React.FC<HistoryModalProps> = ({ onClose, onSelectReport, initialFilter = 'ALL' }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchingDetailsId, setFetchingDetailsId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'TRAINING' | 'ASSESSMENT'>(initialFilter);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await userService.getHistory();
      setLogs(data || []);
    } catch (e) {
      console.error("Failed to load history", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // Handle report selection with Lazy Loading
  const handleSelectLog = async (logId: string) => {
      if (fetchingDetailsId) return; // Prevent double clicks
      
      setFetchingDetailsId(logId);
      try {
          const details = await userService.getSessionDetails(logId);
          if (details) {
              onSelectReport(details);
          } else {
              alert("无法加载该报告的详细数据 (Data corrupted or missing).");
          }
      } catch (e) {
          console.error("Error fetching report details:", e);
          alert("加载失败，请检查网络连接。");
      } finally {
          setFetchingDetailsId(null);
      }
  };

  // Filter logs based on active tab
  const filteredLogs = logs.filter(log => {
      if (activeFilter === 'ALL') return true;
      // Default to 'TRAINING' if session_type is missing/null (legacy support)
      const type = log.session_type || 'TRAINING';
      return type === activeFilter;
  });

  // Helper to determine score color
  const getScoreColor = (score: number) => {
    if (score >= 5) return 'bg-green-100 text-green-700 border-green-200';
    if (score >= 4) return 'bg-blue-100 text-blue-700 border-blue-200';
    return 'bg-orange-100 text-orange-700 border-orange-200';
  };

  // Aviation Standard UTC Formatting
  const formatZuluDate = (isoString: string) => {
      const date = new Date(isoString);
      
      const pad = (n: number) => n.toString().padStart(2, '0');
      const year = date.getUTCFullYear();
      const month = pad(date.getUTCMonth() + 1);
      const day = pad(date.getUTCDate());
      const hours = pad(date.getUTCHours());
      const mins = pad(date.getUTCMinutes());

      return `${year}-${month}-${day} ${hours}:${mins} Z`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-lg h-[85vh] sm:h-[650px] rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl flex flex-col overflow-hidden relative">
        
        {/* Header */}
        <div className="pt-5 pb-2 px-6 bg-white z-10">
          <div className="flex justify-between items-center mb-4">
            <div>
                <h2 className="text-xl font-bold text-gray-900">飞行日志</h2>
                <p className="text-xs text-gray-500">Pilot Logbook & Records</p>
            </div>
            <div className="flex space-x-2">
                <button 
                    onClick={fetchLogs}
                    className="w-8 h-8 rounded-full bg-blue-50 text-ios-blue flex items-center justify-center hover:bg-blue-100 transition-colors"
                    title="Refresh"
                >
                    <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                </button>
                <button 
                    onClick={onClose}
                    className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex p-1 bg-gray-100 rounded-xl">
            {(['ALL', 'TRAINING', 'ASSESSMENT'] as const).map(tab => (
                <button
                    key={tab}
                    onClick={() => setActiveFilter(tab)}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                        activeFilter === tab 
                        ? 'bg-white shadow-sm text-ios-blue' 
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                >
                    {tab === 'ALL' ? '全部记录' : tab === 'TRAINING' ? '专项训练' : '模拟评估'}
                </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50 border-t border-gray-100">
          {loading && logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 space-y-2">
               <div className="w-6 h-6 border-2 border-ios-blue border-t-transparent rounded-full animate-spin"></div>
               <span className="text-xs text-gray-400">正在同步云端数据...</span>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center opacity-60">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3 text-gray-300 text-2xl">
                  {activeFilter === 'TRAINING' ? '🎓' : activeFilter === 'ASSESSMENT' ? '📝' : '📂'}
              </div>
              <p className="text-sm font-bold text-gray-500">暂无{activeFilter === 'TRAINING' ? '训练' : activeFilter === 'ASSESSMENT' ? '评估' : ''}记录</p>
              <p className="text-xs text-gray-400 mt-1">完成一次训练并生成报告后在此显示</p>
            </div>
          ) : (
            filteredLogs.map((log) => (
              <button
                key={log.id}
                onClick={() => handleSelectLog(log.id)}
                disabled={fetchingDetailsId !== null}
                className="w-full bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-ios-blue/30 transition-all active:scale-[0.99] text-left group relative overflow-hidden disabled:opacity-70"
              >
                {/* Visual Indicator Strip */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${log.session_type === 'ASSESSMENT' ? 'bg-purple-500' : 'bg-ios-blue'}`}></div>

                <div className="flex justify-between items-start mb-2 pl-2">
                  <div className="flex items-center space-x-3">
                      {/* Score Badge */}
                      <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center border ${getScoreColor(log.score)}`}>
                        <span className="text-[10px] uppercase font-bold opacity-60 leading-none mb-0.5">Lvl</span>
                        <span className="text-sm font-black leading-none">{log.score}</span>
                      </div>
                      
                      <div className="min-w-0">
                        <div className="flex items-center space-x-2 mb-0.5">
                            {log.session_type === 'ASSESSMENT' && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 border border-purple-200 uppercase tracking-wider">
                                    Exam
                                </span>
                            )}
                            <h3 className="text-sm font-bold text-gray-900 truncate">{log.scenario_title || '未命名会话'}</h3>
                        </div>
                        <div className="flex items-center text-[10px] text-gray-400 font-medium font-mono">
                            <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            {formatZuluDate(log.created_at)}
                        </div>
                      </div>
                  </div>
                  
                  <div className="text-right pl-2 shrink-0">
                      <div className="text-xs font-mono font-bold text-gray-500 flex items-center justify-end">
                          <svg className="w-3 h-3 mr-1 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          {log.duration}
                      </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between mt-3 pl-2 pt-2 border-t border-gray-50">
                    <span className="px-2 py-0.5 bg-gray-100 rounded text-[10px] text-gray-500 uppercase font-bold tracking-wide">
                        {log.phase || 'General'}
                    </span>
                    <span className="flex items-center text-[10px] font-bold text-ios-blue opacity-0 group-hover:opacity-100 transition-opacity">
                        {fetchingDetailsId === log.id ? (
                            <span className="flex items-center text-gray-400">
                                <svg className="w-3 h-3 mr-1 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                Syncing...
                            </span>
                        ) : (
                            <>
                                查看详细报告 
                                <svg className="w-3 h-3 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                            </>
                        )}
                    </span>
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
