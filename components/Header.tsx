
import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="bg-slate-950 text-white py-5 px-4 sm:py-8 border-b border-white/5 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full hidden sm:block -translate-y-1/2 translate-x-1/2 blur-[80px]"></div>
      <div className="max-w-5xl mx-auto flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3 sm:gap-5">
          <div className="bg-amber-500 p-2.5 sm:p-3 rounded-2xl shadow-xl shadow-amber-500/20 rotate-3 transition-transform hover:rotate-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-slate-950" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tighter uppercase leading-none mb-1">BSc Math Assistant</h1>
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500">Exam solutions from photos</p>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
