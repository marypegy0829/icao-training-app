
import React from 'react';
import { AssessmentData, DeepAnalysisItem } from '../types';

interface Props {
  data: AssessmentData;
  onClose: () => void;
}

const AssessmentReport: React.FC<Props> = ({ data, onClose }) => {
  const passed = data.overallScore >= 4;

  const exportPDF = () => {
    window.print();
  };

  const exportWord = () => {
    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Assessment Report</title></head><body>";
    const footer = "</body></html>";
    const content = document.getElementById('report-content')?.innerHTML;
    
    if (content) {
      const sourceHTML = header + content + footer;
      const blob = new Blob(['\ufeff', sourceHTML], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ICAO_Assessment_Report_${new Date().toISOString().slice(0,10)}.doc`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto print:p-0 print:bg-white print:static">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-full { width: 100% !important; height: auto !important; max-width: none !important; max-height: none !important; overflow: visible !important; }
          body { background: white; color: black; }
        }
      `}</style>
      
      <div className="bg-white w-full max-w-4xl rounded-[2rem] shadow-2xl flex flex-col max-h-[90vh] print:max-h-none print:shadow-none print:rounded-none print-full relative">
        
        {/* Actions Header (No Print) */}
        <div className="flex justify-between items-center p-4 border-b border-gray-100 no-print">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
            Close
          </button>
          <div className="flex space-x-2">
            <button onClick={exportWord} className="px-4 py-2 text-sm font-semibold text-ios-blue bg-blue-50 hover:bg-blue-100 rounded-full transition-colors">
              Export Word
            </button>
            <button onClick={exportPDF} className="px-4 py-2 text-sm font-semibold text-white bg-ios-blue hover:bg-blue-600 rounded-full transition-colors">
              Export PDF
            </button>
          </div>
        </div>

        {/* Scrollable Report Content */}
        <div id="report-content" className="flex-1 overflow-y-auto p-8 print:p-0 font-serif">
          
          {/* 1. Header & Title */}
          <div className="text-center mb-10 border-b-2 border-gray-800 pb-6">
            <h1 className="text-3xl font-bold uppercase tracking-widest mb-2">ICAO Language Proficiency Report</h1>
            <p className="text-sm text-gray-500 font-mono">CONFIDENTIAL DIAGNOSTIC RECORD • {new Date().toLocaleDateString()}</p>
          </div>

          {/* 2. Executive Summary */}
          <section className="mb-10">
            <h2 className="text-xl font-bold bg-gray-100 p-2 border-l-4 border-black mb-4">1. Executive Summary (核心总评)</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="p-4 border rounded-lg bg-gray-50">
                <div className="text-xs text-gray-500 uppercase font-bold mb-1">Overall Assessment</div>
                <div className="text-md leading-relaxed font-semibold text-gray-800">{data.executiveSummary?.assessment}</div>
              </div>
              <div className="flex flex-col gap-4">
                 <div className="p-4 border rounded-lg bg-red-50 border-red-100">
                    <div className="text-xs text-red-500 uppercase font-bold mb-1">Safety Margin Impact</div>
                    <div className="text-sm text-red-900">{data.executiveSummary?.safetyMargin}</div>
                 </div>
                 <div className="p-4 border rounded-lg bg-orange-50 border-orange-100">
                    <div className="text-xs text-orange-500 uppercase font-bold mb-1">Key Friction Points</div>
                    <div className="text-sm text-orange-900">{data.executiveSummary?.frictionPoints}</div>
                 </div>
              </div>
            </div>

            <div className="flex items-center justify-center space-x-8 p-6 bg-gray-900 text-white rounded-xl print:bg-gray-200 print:text-black">
              <div className="text-center">
                <div className="text-xs uppercase opacity-70">ICAO Level</div>
                <div className="text-5xl font-bold">{data.overallScore}</div>
              </div>
              <div className="h-12 w-px bg-white/20 print:bg-black/20"></div>
              <div className="text-center">
                <div className="text-xs uppercase opacity-70">Status</div>
                <div className={`text-2xl font-bold ${passed ? 'text-green-400 print:text-green-700' : 'text-red-400 print:text-red-700'}`}>
                  {passed ? 'OPERATIONAL' : 'BELOW STANDARD'}
                </div>
              </div>
            </div>
          </section>

          {/* 3. Dimensional Breakdown */}
          <section className="mb-10 break-inside-avoid">
             <h2 className="text-xl font-bold bg-gray-100 p-2 border-l-4 border-black mb-4">2. Dimensional Breakdown (维度缺陷诊断)</h2>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
               {Object.entries(data.dimensionalDetails || {}).map(([key, detail]) => (
                 <div key={key} className="mb-2">
                   <div className="flex justify-between items-baseline mb-1">
                     <span className="font-bold capitalize text-gray-700">{key}</span>
                     <span className="font-mono text-sm font-bold bg-gray-200 px-2 rounded">
                        Level {(data as any)[key]}
                     </span>
                   </div>
                   <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded border border-gray-100 italic">
                     "{detail}"
                   </p>
                 </div>
               ))}
             </div>
          </section>

          {/* 4. Deep Analysis Table */}
          <section className="mb-10">
            <h2 className="text-xl font-bold bg-gray-100 p-2 border-l-4 border-black mb-4">3. Master-Level Deep Analysis (深度根源分析)</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border p-2 text-left w-1/6">Context</th>
                    <th className="border p-2 text-left w-1/5">Observed Issue</th>
                    <th className="border p-2 text-left w-1/6">Theoretical Basis</th>
                    <th className="border p-2 text-left w-1/5">Root Cause</th>
                    <th className="border p-2 text-left w-1/5">Correction</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.deepAnalysis || []).map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="border p-2 font-mono text-xs text-gray-500">{item.context}</td>
                      <td className="border p-2 font-medium text-red-700">{item.issue}</td>
                      <td className="border p-2 italic text-gray-600">{item.theory}</td>
                      <td className="border p-2">{item.rootCause}</td>
                      <td className="border p-2 text-green-700 font-medium">{item.correction}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 5. Remedial Plan */}
          <section className="mb-10 break-inside-avoid">
            <h2 className="text-xl font-bold bg-gray-100 p-2 border-l-4 border-black mb-4">4. Strategic Remedial Plan (提升建议)</h2>
            <div className="space-y-4">
              {(data.remedialPlan || []).map((plan, idx) => (
                <div key={idx} className="flex items-start">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-ios-blue text-white flex items-center justify-center font-bold mr-4 print:text-black print:border print:border-black print:bg-white">
                    {idx + 1}
                  </div>
                  <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 w-full print:bg-white print:border-gray-300">
                    <p className="text-gray-800 font-medium">{plan}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

        </div>
      </div>
    </div>
  );
};

export default AssessmentReport;
