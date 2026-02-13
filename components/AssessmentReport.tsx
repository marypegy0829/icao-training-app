
import React, { useState } from 'react';
import { AssessmentData } from '../types';
import RadarChart from './RadarChart';
import { userService } from '../services/userService';
import { mistakeService } from '../services/mistakeService';

interface Props {
  data: AssessmentData;
  onClose: () => void;
}

const AssessmentReport: React.FC<Props> = ({ data, onClose }) => {
  const passed = data.overallScore >= 4;
  
  // Track which mistakes have been saved in this session
  const [savedMistakeIndices, setSavedMistakeIndices] = useState<number[]>([]);

  const exportPDF = () => {
    window.print();
  };

  const handleSaveMistake = async (item: any, idx: number) => {
      try {
          const uid = await userService.getCurrentUserId();
          if (!uid) {
              alert("请先登录 (Please login first)");
              return;
          }
          await mistakeService.addMistake(
              uid, 
              "Assessment Session", // Or pass scenario title via props if available
              item.context, 
              item.correction, 
              item.issue, 
              item.theory
          );
          setSavedMistakeIndices(prev => [...prev, idx]);
      } catch (e) {
          console.error("Failed to save mistake", e);
          alert("保存失败 (Failed to save)");
      }
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
    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col h-full print:border print:border-gray-300 print:shadow-none print:break-inside-avoid">
        <div className="flex justify-between items-end mb-3">
            <div>
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider print:text-xs print:text-gray-600">{title}</h4>
                <div className="text-sm font-bold text-gray-900 print:text-base">{cnTitle}</div>
            </div>
            <div className={`text-2xl font-black ${score >= 4 ? 'text-ios-blue' : 'text-orange-500'}`}>
                {score}<span className="text-xs text-gray-300 font-normal ml-0.5 print:text-gray-500">/6</span>
            </div>
        </div>
        {/* Progress Bar */}
        <div className="w-full bg-gray-100 h-1.5 rounded-full mb-4 overflow-hidden print:bg-gray-200">
            <div 
                className={`h-full rounded-full ${score >= 4 ? 'bg-ios-blue' : 'bg-orange-500'}`} 
                style={{width: `${(score/6)*100}%`}}
            ></div>
        </div>
        <p className="text-xs text-gray-600 leading-relaxed text-justify print:text-sm print:leading-normal print:text-gray-800">{detail || "暂无详细反馈。"}</p>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-0 sm:p-4 overflow-y-auto animate-fade-in">
      <style>{`
        @media print {
          @page {
            margin: 15mm;
            size: A4 portrait;
          }

          /* 1. RESET: Hide everything by default using visibility */
          body {
            visibility: hidden;
            background-color: white !important;
          }

          /* 2. TARGET: Only show our print container */
          #print-container {
            visibility: visible;
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
            background-color: white;
            overflow: visible !important;
            height: auto !important;
            display: block !important;
          }
          
          /* Ensure all children of print container are visible */
          #print-container * {
            visibility: visible;
          }

          /* 3. LAYOUT OVERRIDES */
          /* Reset scroll/flex/fixed constraints */
          .fixed, .absolute, .flex-1, .overflow-y-auto, .overflow-hidden {
            position: static !important;
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
            transform: none !important;
          }

          /* Hide non-print UI elements */
          .no-print {
            display: none !important;
          }

          /* 4. TYPOGRAPHY & COLORS */
          /* Force background graphics (vital for the dark score card) */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Improve Readability */
          h1 { font-size: 24pt !important; line-height: 1.2 !important; color: black !important; }
          h2 { 
            font-size: 16pt !important; 
            margin-top: 24pt !important; 
            margin-bottom: 12pt !important; 
            border-bottom: 2px solid #eee !important; 
            padding-bottom: 4pt !important;
            color: black !important;
          }
          h3 { font-size: 14pt !important; color: #333 !important; }
          p { font-size: 11pt !important; line-height: 1.5 !important; color: #222 !important; }
          .text-xs { font-size: 9pt !important; }
          .text-sm { font-size: 10pt !important; }
          
          /* 5. PAGE BREAKS */
          .page-break-before { break-before: page; page-break-before: always; }
          .avoid-break { break-inside: avoid; page-break-inside: avoid; }
          
          /* Grid fixes for print */
          .print:grid-cols-2 {
             grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }
      `}</style>
      
      <div className="bg-ios-bg w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-5xl sm:rounded-[2rem] shadow-2xl flex flex-col overflow-hidden relative">
        
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
              Export Report
            </button>
          </div>
        </div>

        {/* Scrollable Report Content - This is what we print */}
        <div id="print-container" className="flex-1 overflow-y-auto p-6 sm:p-10 space-y-10 bg-white">
          
          {/* 1. Official Header */}
          <div className="flex justify-between items-end border-b-2 border-gray-900 pb-6 print:pb-4 print:border-black">
            <div>
                 <div className="flex items-center space-x-2 mb-3">
                    <div className="bg-gray-900 text-white text-[10px] font-bold px-2 py-0.5 uppercase tracking-widest rounded-sm print:bg-black print:text-white">AI Examiner System</div>
                    <span className="text-xs font-bold text-gray-400 uppercase print:text-gray-600">Automated Proficiency Check</span>
                 </div>
                 <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tight text-gray-900 leading-none">
                     ICAO English <br/>
                     <span className="text-transparent bg-clip-text bg-gradient-to-r from-ios-blue to-ios-indigo print:text-black">Assessment Report</span>
                 </h1>
                 <p className="mt-2 text-sm text-gray-500 font-medium print:text-gray-700">国际民航组织英语等级能力评估报告</p>
            </div>
            <div className="text-right hidden sm:block print:block">
                <div className="w-24 h-24 mb-2 ml-auto bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-center p-2 print:border-gray-300">
                     <div className="w-full h-full bg-gray-200 flex items-center justify-center text-[8px] text-gray-400 text-center print:bg-gray-100 print:text-gray-600">
                         SECURE<br/>VALIDATION<br/>HASH
                     </div>
                </div>
                <p className="text-sm font-bold text-gray-900">{new Date().toLocaleDateString()}</p>
                <p className="text-xs text-gray-400 font-mono mt-1">ID: {Math.random().toString(36).substr(2, 9).toUpperCase()}</p>
            </div>
          </div>

          {/* 2. Score Overview & Radar */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 print:block">
              
              {/* Left: Big Score Card - Enhanced for Print Contrast */}
              <div className="md:col-span-4 flex flex-col print:mb-6 print:border print:border-gray-200 print:rounded-2xl">
                   <div className={`flex-1 rounded-[2rem] p-8 text-white text-center shadow-xl relative overflow-hidden flex flex-col justify-center items-center min-h-[280px] ${passed ? 'bg-gradient-to-br from-gray-900 to-gray-800 print:bg-gray-900' : 'bg-gradient-to-br from-red-600 to-red-500 print:bg-red-600'}`}>
                       <div className="relative z-10">
                           <div className="text-xs uppercase opacity-60 font-bold tracking-[0.2em] mb-2 text-white print:text-gray-200">Overall Level</div>
                           <div className="text-8xl font-black tracking-tighter mb-4 text-white">{data.overallScore}</div>
                           <div className={`inline-block px-6 py-2 rounded-full text-xs font-bold backdrop-blur-md border ${passed ? 'bg-white/10 border-white/20' : 'bg-black/20 border-black/10'} print:bg-white print:text-black print:border-none`}>
                               {passed ? 'OPERATIONAL (合格)' : 'BELOW STANDARD (不合格)'}
                           </div>
                       </div>
                   </div>
              </div>

              {/* Right: Radar & Executive Summary */}
              <div className="md:col-span-8 bg-gray-50 rounded-[2rem] p-8 border border-gray-100 flex flex-col lg:flex-row gap-8 items-center print:bg-white print:border-none print:p-0 print:block">
                  <div className="shrink-0 flex items-center justify-center bg-white p-4 rounded-full shadow-sm border border-gray-100 print:float-right print:ml-6 print:mb-6 print:border-none print:shadow-none">
                       <RadarChart data={radarData} size={200} color={passed ? '#5856D6' : '#FF3B30'} />
                  </div>
                  <div className="flex-1 space-y-5 w-full print:space-y-4">
                      <div className="avoid-break">
                          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center print:text-gray-600 print:text-sm">
                             <span className="w-1.5 h-1.5 rounded-full bg-ios-blue mr-2 print:bg-black"></span>
                             Executive Summary (综合评估)
                          </h3>
                          <p className="text-sm text-gray-800 font-medium leading-relaxed text-justify print:text-base print:text-black">
                              {data.executiveSummary?.assessment || "Assessment pending..."}
                          </p>
                      </div>
                      
                      {/* Safety & Friction Bars */}
                      <div className="space-y-4 print:clear-both">
                           {/* Safety Margin */}
                           <div className="avoid-break">
                               <div className="flex justify-between text-xs font-bold mb-1 print:text-sm">
                                   <span className="text-gray-500 print:text-black">Safety Margin (安全裕度)</span>
                                   <span className={`${data.overallScore >= 4 ? 'text-green-600' : 'text-red-600'}`}>
                                       {data.overallScore >= 5 ? 'HIGH' : data.overallScore >= 4 ? 'ACCEPTABLE' : 'CRITICAL'}
                                   </span>
                               </div>
                               <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden print:border print:border-gray-300">
                                   <div 
                                      className={`h-full rounded-full ${data.overallScore >= 5 ? 'bg-green-500' : data.overallScore >= 4 ? 'bg-yellow-400' : 'bg-red-500'}`} 
                                      style={{width: data.overallScore >= 5 ? '90%' : data.overallScore >= 4 ? '60%' : '30%'}}
                                   ></div>
                               </div>
                               <p className="text-[10px] text-gray-400 mt-1 print:text-xs print:text-gray-600">{data.executiveSummary?.safetyMargin}</p>
                           </div>

                           {/* Friction Points */}
                           <div className="avoid-break">
                               <div className="flex justify-between text-xs font-bold mb-1 print:text-sm">
                                   <span className="text-gray-500 print:text-black">Comm Friction (沟通摩擦)</span>
                                   <span className="text-orange-500">ANALYSIS</span>
                               </div>
                               <div className="bg-orange-50 border border-orange-100 rounded-lg p-2 text-[10px] font-medium text-orange-800 leading-tight print:text-sm print:bg-white print:border-gray-300 print:text-black">
                                   {data.executiveSummary?.frictionPoints}
                               </div>
                           </div>
                      </div>
                  </div>
              </div>
          </div>

          {/* 3. 6-Dimension Grid */}
          <section className="avoid-break">
             <div className="flex items-center space-x-3 mb-6 border-b border-gray-100 pb-3 print:border-gray-300 print:mt-4">
                <div className="w-8 h-8 rounded-lg bg-ios-blue text-white flex items-center justify-center font-bold font-serif print:bg-black print:text-white">6</div>
                <h2 className="text-lg font-bold text-gray-900 uppercase tracking-tight">Dimensional Analysis <span className="text-gray-400 font-normal ml-2 print:text-gray-600">六大维度详解</span></h2>
             </div>
             {/* Force grid layout for print to avoid single column stacking */}
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 print:grid-cols-2">
                <DimensionCard title="Pronunciation" cnTitle="发音" score={data.pronunciation} detail={data.dimensionalDetails?.pronunciation} />
                <DimensionCard title="Structure" cnTitle="结构" score={data.structure} detail={data.dimensionalDetails?.structure} />
                <DimensionCard title="Vocabulary" cnTitle="词汇" score={data.vocabulary} detail={data.dimensionalDetails?.vocabulary} />
                <DimensionCard title="Fluency" cnTitle="流利度" score={data.fluency} detail={data.dimensionalDetails?.fluency} />
                <DimensionCard title="Comprehension" cnTitle="理解" score={data.comprehension} detail={data.dimensionalDetails?.comprehension} />
                <DimensionCard title="Interactions" cnTitle="互动" score={data.interactions} detail={data.dimensionalDetails?.interactions} />
             </div>
          </section>

          {/* 4. Deep Analysis (Improved Diff View) */}
          <section className="page-break-before">
             <div className="flex items-center space-x-3 mb-6 border-b border-gray-100 pb-3 print:border-gray-300">
                <div className="w-8 h-8 rounded-lg bg-gray-900 text-white flex items-center justify-center print:bg-black">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                </div>
                <h2 className="text-lg font-bold text-gray-900 uppercase tracking-tight">Root Cause Analysis <span className="text-gray-400 font-normal ml-2 print:text-gray-600">错误溯源</span></h2>
             </div>
             
             {(!data.deepAnalysis || data.deepAnalysis.length === 0) ? (
                 <div className="bg-green-50 text-green-800 p-8 rounded-2xl border border-green-100 text-center print:bg-white print:border-gray-300 print:text-black">
                     <div className="text-2xl mb-2">✨</div>
                     <div className="font-bold">Excellent Performance</div>
                     <div className="text-sm opacity-80">No critical linguistic errors detected in this session.</div>
                 </div>
             ) : (
                 <div className="space-y-4">
                    {data.deepAnalysis.map((item, idx) => (
                        <div key={idx} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:border-ios-blue transition-colors group avoid-break print:border-gray-300 print:shadow-none">
                            
                            {/* Header: Issue Type & Description */}
                            <div className="bg-gray-50/50 px-5 py-3 border-b border-gray-100 flex justify-between items-center print:bg-gray-100 print:border-gray-200">
                                <div className="flex items-center space-x-2">
                                    <span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded uppercase print:bg-white print:text-black print:border print:border-black">Issue {idx + 1}</span>
                                    <span className="text-sm font-bold text-gray-800 print:text-base">{item.issue}</span>
                                </div>
                                <button 
                                  onClick={() => handleSaveMistake(item, idx)}
                                  disabled={savedMistakeIndices.includes(idx)}
                                  className={`text-xs font-bold px-3 py-1.5 rounded-full transition-colors flex items-center space-x-1 no-print ${savedMistakeIndices.includes(idx) ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-600 hover:bg-ios-blue hover:text-white'}`}
                                >
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                                    <span>{savedMistakeIndices.includes(idx) ? '已收藏' : '收藏错题'}</span>
                                </button>
                            </div>

                            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-2">
                                
                                {/* Left: Comparison (The "Diff") */}
                                <div className="space-y-3">
                                    {/* User's Original Input */}
                                    <div className="relative">
                                        <div className="absolute left-0 top-3 bottom-3 w-1 bg-red-400 rounded-full print:bg-black"></div>
                                        <div className="pl-4">
                                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 print:text-gray-600">You Said</div>
                                            <div className="bg-red-50 text-red-900 p-3 rounded-lg text-sm font-mono leading-relaxed border border-red-100 print:bg-white print:text-black print:border-gray-300 print:italic">
                                                "{item.context}"
                                            </div>
                                        </div>
                                    </div>

                                    {/* Correction */}
                                    <div className="relative">
                                        <div className="absolute left-0 top-3 bottom-3 w-1 bg-green-500 rounded-full print:bg-black"></div>
                                        <div className="pl-4">
                                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 print:text-gray-600">Better / Standard</div>
                                            <div className="bg-green-50 text-green-800 p-3 rounded-lg text-sm font-mono leading-relaxed border border-green-100 font-semibold print:bg-white print:text-black print:border-gray-300 print:font-bold">
                                                {item.correction}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right: Explanation */}
                                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex flex-col justify-center print:bg-white print:border-none print:p-0">
                                     <div className="mb-3">
                                         <div className="text-[10px] font-bold text-ios-blue uppercase tracking-wider mb-1 print:text-black">ICAO Principle</div>
                                         <p className="text-xs text-gray-600 leading-relaxed italic print:text-sm print:text-gray-800 print:not-italic">
                                             {item.theory}
                                         </p>
                                     </div>
                                     <div>
                                         <div className="text-[10px] font-bold text-orange-500 uppercase tracking-wider mb-1 print:text-black">Root Cause</div>
                                         <p className="text-xs text-gray-800 font-medium print:text-sm">
                                             {item.rootCause}
                                         </p>
                                     </div>
                                </div>

                            </div>
                        </div>
                    ))}
                 </div>
             )}
          </section>

          {/* 5. Remedial Plan */}
          <section className="avoid-break pb-8 print:mt-6">
             <div className="flex items-center space-x-3 mb-6 border-b border-gray-100 pb-3 print:border-gray-300">
                <div className="w-8 h-8 rounded-lg bg-ios-orange text-white flex items-center justify-center print:bg-black">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <h2 className="text-lg font-bold text-gray-900 uppercase tracking-tight">Training Syllabus <span className="text-gray-400 font-normal ml-2 print:text-gray-600">后续训练建议</span></h2>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-5 print:grid-cols-3">
                {(data.remedialPlan || []).map((plan, idx) => (
                    <div key={idx} className="bg-gradient-to-br from-gray-50 to-white p-6 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden group hover:border-ios-blue transition-colors print:bg-white print:border-gray-300 print:shadow-none">
                        <div className="absolute top-0 right-0 p-4 opacity-10 font-black text-6xl text-gray-300 group-hover:text-ios-blue transition-colors select-none print:opacity-20 print:text-gray-400">
                            {idx+1}
                        </div>
                        <h4 className="text-xs font-bold text-ios-blue uppercase mb-3 relative z-10 flex items-center print:text-black">
                            <span className="w-1.5 h-1.5 rounded-full bg-ios-blue mr-2 print:bg-black"></span>
                            Action Item {idx+1}
                        </h4>
                        <p className="text-sm text-gray-700 font-medium relative z-10 leading-relaxed print:text-black">
                            {plan}
                        </p>
                    </div>
                ))}
             </div>
          </section>
          
          {/* Footer Logo (Print Only) */}
          <div className="hidden print:flex justify-center items-center mt-10 opacity-50 border-t border-gray-200 pt-4">
             <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Generated by ICAO Level 5 Examiner AI</div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default AssessmentReport;
