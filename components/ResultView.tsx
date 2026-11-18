
import React, { useEffect, useState } from 'react';
import { MathResult } from '../types';

interface ResultViewProps {
  result: MathResult;
  marks: number;
}

const ResultView: React.FC<ResultViewProps> = ({ result, marks }) => {
  const [copyStatus, setCopyStatus] = useState('');
  useEffect(() => setCopyStatus(''), [result]);

  const openInOverleaf = () => {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = 'https://www.overleaf.com/docs';
    form.target = '_blank';

    const snipInput = document.createElement('input');
    snipInput.type = 'hidden';
    snipInput.name = 'snip';
    snipInput.value = result.latexCode;

    const nameInput = document.createElement('input');
    nameInput.type = 'hidden';
    nameInput.name = 'snip_name';
    nameInput.value = `BSc_Thermal_Proof_Q${result.startQNum}.tex`;

    form.appendChild(snipInput);
    form.appendChild(nameInput);
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(result.latexCode);
      setCopyStatus('LaTeX copied.');
    } catch {
      setCopyStatus('Clipboard unavailable. Select and copy the LaTeX below.');
    }
  };

  return (
    <div>
      <div className="bg-slate-950 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl">
        <div className="bg-slate-900/50 px-4 sm:px-6 py-4 flex flex-wrap gap-4 justify-between items-center border-b border-white/5 ">
          <div className="flex flex-col">
            <div className="flex items-center space-x-2 mb-1">
              <div className="flex space-x-1.5 mr-4">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/20"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/40"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/60"></div>
              </div>
              <span className="text-[10px] font-mono text-emerald-500 uppercase tracking-[0.2em] font-bold">Solution LaTeX</span>
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-[9px] text-amber-500 font-black uppercase tracking-tighter">{marks} {marks === 1 ? "mark" : "marks"}</span>
            </div>
          </div>
          
          <div className="flex space-x-3">
            <button 
              onClick={copyToClipboard}
              className="bg-slate-800 hover:bg-slate-700 text-white text-[10px] min-h-11 px-4 py-2.5 rounded-xl font-black transition-all uppercase tracking-widest border border-white/5"
            >
              Copy
            </button>
            <button 
              onClick={openInOverleaf}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] min-h-11 px-5 py-2.5 rounded-xl font-black flex items-center space-x-2 transition-all shadow-lg shadow-emerald-900/20 uppercase tracking-widest"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              <span>Overleaf</span>
            </button>
          </div>
        </div>
        
        <p role="status" className={copyStatus ? "px-4 py-2 text-xs text-emerald-300" : "sr-only"}>{copyStatus}</p>

        {result.question && (
          <div className="bg-slate-900/30 px-4 sm:px-8 py-5 border-b border-white/5">
             <div className="flex items-center space-x-2 mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <h4 className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Identified Question Text</h4>
             </div>
             <div className="pl-5 border-l-2 border-amber-500/30">
                <p className="text-slate-300 text-sm font-serif italic leading-relaxed whitespace-pre-wrap break-words">
                  "{result.question}"
                </p>
             </div>
          </div>
        )}

        <div className="bg-black/40 p-4 sm:p-8 lg:max-h-[500px] lg:overflow-y-auto">
          <pre className="text-emerald-400/90 font-mono text-[13px] leading-relaxed selection:bg-emerald-500/30">
            {result.latexCode}
          </pre>
        </div>
        
        <div className="border-t border-white/5 bg-slate-900 px-4 py-4 sm:px-8">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            57mm Thermal Print Layout
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResultView;
