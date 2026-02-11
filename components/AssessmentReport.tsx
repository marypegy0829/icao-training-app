
import React from 'react';
import { AssessmentData } from '../types';
import RadarChart from './RadarChart';

interface Props {
  data: AssessmentData;
  onClose: () => void;
}

const AssessmentReport: React.FC<Props> = ({ data, onClose }) => {
  const passed = data.overallScore >= 4;

  const exportPDF = () => {
    window.print();
  };

  // Convert AssessmentData flat fields to RadarChart format
  const radarData = {
      Pronunciation: data.pronunciation || 1,
      Structure: data.structure || 1,
      Vocabulary: data.vocabulary || 1,
      Fluency: data.fluency || 1,
      Comprehension: data.comprehension || 1,
      Interactions: data.interactions || 1
  };

  // Helper for Dimension Cards with Progress Bar
  const DimensionCard = ({ title, cnTitle, score, detail }: { title: string, cnTitle: string, score: number, detail: string }) => (
    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col h-full hover:shadow-md transition-shadow">
        <div className="flex justify-between items-end mb-3">
            <div>
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{title}</h4>
                <div className="text-sm font-bold text-gray-900">{cnTitle}</div>
            </div>
            <div className={`text-2xl font-black ${score >= 4 ? 'text-ios-blue' : 'text-orange-500'}`}>
                {score}<span className="text-xs text-gray-300 font-normal ml-0.5">/6</span>
            </div>
        </div>
        {/* Progress Bar */}
        <div className="w-full bg-gray-100 h-1.5 rounded-full mb-4 overflow-hidden">
            <div 
                className={`h-full rounded-full transition-all duration-1000 ${score >= 4 ? 'bg-ios-blue' : 'bg-orange-500'}`} 
                style={{width: `${(score/6)*100}%`}}
            ></div>
        </div>
        <p className="text-xs text-gray-600 leading-relaxed text-justify">{detail || "暂无详细反馈。"}</p>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-0 sm:p-4 overflow-y-auto animate-fade-in print:p-0 print:bg-white print:static">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-full { width: 100% !important; height: auto !important; max-width: none !important; max-height: none !important; overflow: visible !important; boxShadow: none !important; }
          body { background: white; color: black; }
          /* Ensure backgrounds print */
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .page-break { page-break-before: always; }
        }
      `}</style>
      
      <div className="bg-ios-bg w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-5xl sm:rounded-[2rem] shadow-2xl flex flex-col overflow-hidden relative print-full">
        
        {/* Actions Header (No Print) */}
        <div className="flex justify-between items-center p-4 bg-white/80 backdrop-blur-md border-b border-gray-200 no-print sticky top-0 z-50">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-full transition-colors flex items-center">
            <svg className="w-5 h-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            Close
          </button>
          <div className="flex space-x-3">
             <div className="hidden sm:flex items-center space-x-2 text-xs text-gray-400 mr-2">
                <span className={`w-2 h-2 rounded-full ${passed ? 'bg-green-500' : 'bg-red-500'}`}></span>
                <span>{passed ? 'PASSED (Level 4+)' : 'RETRY (Below Level 4)'}</span>
             </div>
            <button onClick={exportPDF} className="px-5 py-2 text-sm font-bold text-white bg-ios-text hover:bg-gray-800 rounded-full transition-colors shadow-lg flex items-center">
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Export Report / Print
            </button>
          </div>
        </div>

        {/* Scrollable Report Content */}
        <div id="report-content" className="flex-1 overflow-y-auto p-6 sm:p-10 space-y-10 bg-white print:p-0">
          
          {/* 1. Official Header */}
          <div className="flex justify-between items-end border-b-2 border-gray-900 pb-6">
            <div>
                 <div className="flex items-center space-x-2 mb-3">
                    <div className="bg-gray-900 text-white text-[10px] font-bold px-2 py-0.5 uppercase tracking-widest rounded-sm">AI Examiner System</div>
                    <span className="text-xs font-bold text-gray-400 uppercase">Automated Proficiency Check</span>
                 </div>
                 <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tight text-gray-900 leading-none">
                     ICAO English <br/>
                     <span className="text-transparent bg-clip-text bg-gradient-to-r from-ios-blue to-ios-indigo">Assessment Report</span>
                 </h1>
                 <p className="mt-2 text-sm text-gray-500 font-medium">国际民航组织英语等级能力评估报告</p>
            </div>
            <div className="text-right hidden sm:block">
                <div className="w-24 h-24 mb-2 ml-auto bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-center p-2">
                     {/* QR Code Placeholder */}
                     <div className="w-full h-full bg-gray-200 flex items-center justify-center text-[8px] text-gray-400 text-center">
                         SECURE<br/>VALIDATION<br/>HASH
                     </div>
                </div>
                <p className="text-sm font-bold text-gray-900">{new Date().toLocaleDateString()}</p>
                <p className="text-xs text-gray-400 font-mono mt-1">ID: {Math.random().toString(36).substr(2, 9).toUpperCase()}</p>
            </div>
          </div>

          {/* 2. Score Overview & Radar */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
              
              {/* Left: Big Score Card */}
              <div className="md:col-span-4 flex flex-col">
                   <div className={`flex-1 rounded-[2rem] p-8 text-white text-center shadow-xl relative overflow-hidden flex flex-col justify-center items-center min-h-[280px] ${passed ? 'bg-gradient-to-br from-gray-900 to-gray-800' : 'bg-gradient-to-br from-red-600 to-red-500'}`}>
                       <div className="relative z-10">
                           <div className="text-xs uppercase opacity-60 font-bold tracking-[0.2em] mb-2">Overall Level</div>
                           <div className="text-8xl font-black tracking-tighter mb-4">{data.overallScore}</div>
                           <div className={`inline-block px-6 py-2 rounded-full text-xs font-bold backdrop-blur-md border ${passed ? 'bg-white/10 border-white/20' : 'bg-black/20 border-black/10'}`}>
                               {passed ? 'OPERATIONAL (合格)' : 'BELOW STANDARD (不合格)'}
                           </div>
                       </div>
                       {/* Background FX */}
                       <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl transform translate-x-10 -translate-y-10"></div>
                       <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full blur-2xl transform -translate-x-5 translate-y-5"></div>
                   </div>
              </div>

              {/* Right: Radar & Executive Summary */}
              <div className="md:col-span-8 bg-gray-50 rounded-[2rem] p-8 border border-gray-100 flex flex-col lg:flex-row gap-8 items-center">
                  <div className="shrink-0 flex items-center justify-center bg-white p-4 rounded-full shadow-sm border border-gray-100">
                       <RadarChart data={radarData} size={200} color={passed ? '#5856D6' : '#FF3B30'} />
                  </div>
                  <div className="flex-1 space-y-5 w-full">
                      <div>
                          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center">
                             <span className="w-1.5 h-1.5 rounded-full bg-ios-blue mr-2"></span>
                             Executive Summary (综合评估)
                          </h3>
                          <p className="text-sm text-gray-800 font-medium leading-relaxed text-justify">
                              {data.executiveSummary?.assessment || "Assessment pending..."}
                          </p>
                      </div>
                      
                      {/* Safety & Friction Bars */}
                      <div className="space-y-4">
                           {/* Safety Margin */}
                           <div>
                               <div className="flex justify-between text-xs font-bold mb-1">
                                   <span className="text-gray-500">Safety Margin (安全裕度)</span>
                                   <span className={`${data.overallScore >= 4 ? 'text-green-600' : 'text-red-600'}`}>
                                       {data.overallScore >= 5 ? 'HIGH' : data.overallScore >= 4 ? 'ACCEPTABLE' : 'CRITICAL'}
                                   </span>
                               </div>
                               <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                                   <div 
                                      className={`h-full rounded-full ${data.overallScore >= 5 ? 'bg-green-500' : data.overallScore >= 4 ? 'bg-yellow-400' : 'bg-red-500'}`} 
                                      style={{width: data.overallScore >= 5 ? '90%' : data.overallScore >= 4 ? '60%' : '30%'}}
                                   ></div>
                               </div>
                               <p className="text-[10px] text-gray-400 mt-1">{data.executiveSummary?.safetyMargin}</p>
                           </div>

                           {/* Friction Points */}
                           <div>
                               <div className="flex justify-between text-xs font-bold mb-1">
                                   <span className="text-gray-500">Comm Friction (沟通摩擦)</span>
                                   <span className="text-orange-500">ANALYSIS</span>
                               </div>
                               <div className="bg-orange-50 border border-orange-100 rounded-lg p-2 text-[10px] font-medium text-orange-800 leading-tight">
                                   {data.executiveSummary?.frictionPoints}
                               </div>
                           </div>
                      </div>
                  </div>
              </div>
          </div>

          {/* 3. 6-Dimension Grid */}
          <section>
             <div className="flex items-center space-x-3 mb-6 border-b border-gray-100 pb-3">
                <div className="w-8 h-8 rounded-lg bg-ios-blue text-white flex items-center justify-center font-bold font-serif">6</div>
                <h2 className="text-lg font-bold text-gray-900 uppercase tracking-tight">Dimensional Analysis <span className="text-gray-400 font-normal ml-2">六大维度详解</span></h2>
             </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                <DimensionCard title="Pronunciation" cnTitle="发音" score={data.pronunciation} detail={data.dimensionalDetails?.pronunciation} />
                <DimensionCard title="Structure" cnTitle="结构" score={data.structure} detail={data.dimensionalDetails?.structure} />
                <DimensionCard title="Vocabulary" cnTitle="词汇" score={data.vocabulary} detail={data.dimensionalDetails?.vocabulary} />
                <DimensionCard title="Fluency" cnTitle="流利度" score={data.fluency} detail={data.dimensionalDetails?.fluency} />
                <DimensionCard title="Comprehension" cnTitle="理解" score={data.comprehension} detail={data.dimensionalDetails?.comprehension} />
                <DimensionCard title="Interactions" cnTitle="互动" score={data.interactions} detail={data.dimensionalDetails?.interactions} />
             </div>
          </section>

          {/* 4. Deep Analysis (Page Break for Print) */}
          <section className="break-inside-avoid page-break">
             <div className="flex items-center space-x-3 mb-6 border-b border-gray-100 pb-3">
                <div className="w-8 h-8 rounded-lg bg-gray-900 text-white flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                </div>
                <h2 className="text-lg font-bold text-gray-900 uppercase tracking-tight">Root Cause Analysis <span className="text-gray-400 font-normal ml-2">错误溯源</span></h2>
             </div>
             
             {(!data.deepAnalysis || data.deepAnalysis.length === 0) ? (
                 <div className="bg-green-50 text-green-800 p-8 rounded-2xl border border-green-100 text-center">
                     <div className="text-2xl mb-2">✨</div>
                     <div className="font-bold">Excellent Performance</div>
                     <div className="text-sm opacity-80">No critical linguistic errors detected in this session.</div>
                 </div>
             ) : (
                 <div className="grid grid-cols-1 gap-4">
                    {data.deepAnalysis.map((item, idx) => (
                        <div key={idx} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:border-ios-blue transition-colors group">
                            <div className="flex flex-col md:flex-row gap-6">
                                {/* Left: Context */}
                                <div className="md:w-1/3">
                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Transcript Context (原文)</div>
                                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-sm font-mono text-gray-700 leading-relaxed group-hover:bg-blue-50/30 transition-colors">
                                        "{item.context}"
                                    </div>
                                </div>

                                {/* Right: Analysis */}
                                <div className="md:w-2/3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {/* Issue */}
                                    <div>
                                        <div className="text-[10px] font-bold text-red-500 uppercase tracking-wider mb-1">Issue Identified (错误)</div>
                                        <div className="text-sm font-bold text-gray-900 mb-2">{item.issue}</div>
                                        <div className="bg-red-50 p-2 rounded-lg border border-red-100 text-xs text-red-800 italic">
                                            <span className="font-bold not-italic mr-1">Theory:</span>
                                            {item.theory}
                                        </div>
                                    </div>
                                    
                                    {/* Correction & Root Cause */}
                                    <div className="flex flex-col justify-between">
                                        <div>
                                            <div className="text-[10px] font-bold text-green-600 uppercase tracking-wider mb-1">Correction (建议修正)</div>
                                            <div className="text-sm font-mono text-green-700 font-medium bg-green-50 px-2 py-1 rounded border border-green-100 inline-block mb-3">
                                                {item.correction}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Root Cause (根源)</div>
                                            <div className="text-xs text-gray-600 font-medium">{item.rootCause}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                 </div>
             )}
          </section>

          {/* 5. Remedial Plan */}
          <section className="break-inside-avoid pb-8">
             <div className="flex items-center space-x-3 mb-6 border-b border-gray-100 pb-3">
                <div className="w-8 h-8 rounded-lg bg-ios-orange text-white flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <h2 className="text-lg font-bold text-gray-900 uppercase tracking-tight">Training Syllabus <span className="text-gray-400 font-normal ml-2">后续训练建议</span></h2>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {(data.remedialPlan || []).map((plan, idx) => (
                    <div key={idx} className="bg-gradient-to-br from-gray-50 to-white p-6 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden group hover:border-ios-blue transition-colors">
                        <div className="absolute top-0 right-0 p-4 opacity-10 font-black text-6xl text-gray-300 group-hover:text-ios-blue transition-colors select-none">
                            {idx+1}
                        </div>
                        <h4 className="text-xs font-bold text-ios-blue uppercase mb-3 relative z-10 flex items-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-ios-blue mr-2"></span>
                            Action Item {idx+1}
                        </h4>
                        <p className="text-sm text-gray-700 font-medium relative z-10 leading-relaxed">
                            {plan}
                        </p>
                    </div>
                ))}
             </div>
          </section>
          
          {/* Footer Logo (Print Only) */}
          <div className="hidden print:flex justify-center items-center mt-10 opacity-50">
             <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Generated by ICAO Level 5 Examiner AI</div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default AssessmentReport;
