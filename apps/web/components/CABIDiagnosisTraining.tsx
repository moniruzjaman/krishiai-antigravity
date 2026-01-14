import React, { useState, useEffect } from 'react';
import { useSpeech } from '../App';

interface MODULE_TYPE {
  id: number;
  title: string;
  icon: string;
  desc: string;
  content: string;
  image?: string;
  checkpoints?: string[];
  tip?: string;
  simulator?: {
    image: string;
    question: string;
    options: { label: string; value: string; isCorrect: boolean; feedback: string; }[];
  };
  logic?: { label: string; target: string; desc: string; }[];
  isQuiz?: boolean;
  question?: string;
  options?: { label: string; correct: boolean; }[];
}

const MODULES: MODULE_TYPE[] = [
  {
    id: 1,
    title: "ধাপ ১: পর্যবেক্ষণ (Observation)",
    icon: "👁️",
    desc: "একটি গাছের স্বাস্থ্য বুঝতে হলে প্রথমে তার স্বাভাবিক অবস্থা জানতে হবে।",
    content: "গবেষণা নির্দেশিকা অনুযায়ী, আক্রান্ত গাছটির সাথে পাশের একটি সুস্থ গাছের তুলনা করুন। নিচের কোন অংশগুলো আক্রান্ত হতে পারে বলে আপনি মনে করেন?",
    image: "https://images.unsplash.com/photo-1592982537447-6f2a6a0c7c18?auto=format&fit=crop&q=80&w=800",
    checkpoints: ["পাতা", "কান্ড", "শিকড়", "ফল/ফুল"],
    tip: "টিপস: একজন দক্ষ বিজ্ঞানীর মতো সব সময় গাছের উপরে থেকে নিচে এবং চারপাশ পর্যবেক্ষণ করুন।"
  },
  {
    id: 2,
    title: "ধাপ ২: লক্ষণের ধরণ (Damage Type)",
    icon: "🔬",
    desc: "ক্ষতির ধরণ দেখে 'অপরাধী' শনাক্ত করা সম্ভব। এটি ভার্চুয়াল ডায়াগনোসিস।",
    content: "যদি পাতায় ফুটো বা খাওয়া অংশ থাকে, তবে এটি পোকা (Pests)। যদি রঙ পরিবর্তন বা পচন থাকে, তবে এটি রোগ (Disease) হতে পারে।",
    simulator: {
      image: "https://images.unsplash.com/photo-1628350560943-029e44799b7c?auto=format&fit=crop&q=80&w=800",
      question: "এই ডিজিটাল স্যাম্পলটি স্ক্যান করুন এবং লক্ষণটি শনাক্ত করুন:",
      options: [
        { label: "চিবানো বা ফুটো করা (Chewing)", value: "pest", isCorrect: true, feedback: "সঠিক ডায়াগনোসিস! এটি সাধারণত মাজরা বা লেদা পোকার কাজ। আপনি এখন দ্বিতীয় স্তরের বিজ্ঞানী।" },
        { label: "রঙ পরিবর্তন বা ছোপ (Spots)", value: "disease", isCorrect: false, feedback: "লক্ষণটি আবার দেখুন। এখানে পাতার টিস্যু সরাসরি খাওয়া হয়েছে, শুধু রঙ পরিবর্তন হয়নি।" },
        { label: "গাছ শুকিয়ে যাওয়া (Wilting)", value: "abiotic", isCorrect: false, feedback: "এটি পানি বা তাপের অভাবে হতে পারে, কিন্তু এখানে যান্ত্রিক ক্ষতির চিহ্ন স্পষ্ট।" }
      ]
    }
  },
  {
    id: 3,
    title: "ধাপ ৩: মাঠের বিন্যাস (Field Patterns)",
    icon: "🗺️",
    desc: "সমস্যাটি কি পুরো মাঠে নাকি নির্দিষ্ট জায়গায়? বৈজ্ঞানিক ম্যাপিং।",
    content: "যদি সমস্যাটি একটি লাইনে থাকে, তবে এটি যান্ত্রিক (যেমন লাঙল বা স্প্রে)। যদি এটি ছড়িয়ে ছিটিয়ে গোল আকারে থাকে, তবে এটি জৈবিক (পোকা বা রোগ)।",
    image: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&q=80&w=800",
    logic: [
      { label: "এলোমেলো ছোপ (Random Patches)", target: "Biotic (Living)", desc: "পোকা বা রোগ।" },
      { label: "সোজা লাইন (Straight Lines)", target: "Abiotic (Non-living)", desc: "সার বা বিষ প্রয়োগের ত্রুটি।" }
    ]
  },
  {
    id: 4,
    title: "ধাপ ৪: চূড়ান্ত চ্যালেঞ্জ (The Plant Doctor Challenge)",
    icon: "👨‍⚕️",
    desc: "আপনি কি এখন একজন সার্টিফাইড প্ল্যান্ট ডক্টর?",
    // Added content property to satisfy MODULE_TYPE requirement
    content: "নিচের কেস স্টাডিটি সমাধান করে আপনার সনদ অর্জন করুন।",
    image: "https://images.unsplash.com/photo-1530507629858-e4977d30e9e0?auto=format&fit=crop&q=80&w=800",
    isQuiz: true,
    question: "এই ধান ক্ষেতে ধান গাছগুলো লালচে হয়ে যাচ্ছে এবং টান দিলে সহজেই উঠে আসছে। গোড়ায় পচন দেখা যাচ্ছে। এটি কী?",
    options: [
      { label: "নাইট্রোজেনের অভাব (পুষ্টিজনিত)", correct: false },
      { label: "শৈবাল আক্রমণ (জৈবিক)", correct: false },
      { label: "ব্যাকটেরিয়াল রট (DAE Code: 402)", correct: true },
      { label: "ইঁদুরের কামড় (যান্ত্রিক)", correct: false }
    ]
  }
];

// Defined CABIDiagnosisTrainingProps to fix 'Cannot find name' error
interface CABIDiagnosisTrainingProps {
  onBack: () => void;
  onAction: () => void;
}

const CABIDiagnosisTraining: React.FC<CABIDiagnosisTrainingProps> = ({ onBack, onAction }) => {
  const [currentModule, setCurrentModule] = useState(0);
  const [progress, setProgress] = useState(0);
  const [simFeedback, setSimFeedback] = useState<{ text: string, isCorrect: boolean } | null>(null);
  const [completed, setCompleted] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const { playSpeech, stopSpeech } = useSpeech();

  const handleNext = () => {
    if (currentModule < MODULES.length - 1) {
      const nextIdx = currentModule + 1;
      setCurrentModule(nextIdx);
      setSimFeedback(null);
      setProgress((nextIdx / MODULES.length) * 100);
      stopSpeech();
    } else {
      setCompleted(true);
      setProgress(100);
      onAction();
    }
  };

  const activeModule = MODULES[currentModule];

  const triggerScan = (feedback: string, isCorrect: boolean) => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      setSimFeedback({ text: feedback, isCorrect });
      playSpeech(feedback);
    }, 1500);
  };

  return (
    <div className="max-w-4xl mx-auto p-4 pb-32 animate-fade-in font-sans">
      {/* Header */}
      <div className="flex items-center space-x-4 mb-8 sticky top-0 bg-slate-50/90 backdrop-blur-md z-50 py-4">
        <button onClick={() => { stopSpeech(); onBack(); }} className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100 hover:bg-emerald-600 hover:text-white transition-all">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-black text-slate-800 leading-none">CABI ডায়াগনোসিস একাডেমি</h1>
          <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-1">International Field Guide Standards</p>
        </div>
        <div className="flex items-center space-x-4">
           <div className="text-right hidden sm:block">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">ডায়াগনোসিস প্রগতি</p>
              <p className="text-sm font-black text-emerald-600">{Math.round(progress)}% বিজ্ঞানী স্তর</p>
           </div>
           <div className="w-12 h-12 bg-white rounded-xl border-2 border-emerald-100 flex items-center justify-center text-xl shadow-inner">👨‍🔬</div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-2 bg-slate-100 rounded-full mb-10 overflow-hidden shadow-inner">
         <div className="h-full bg-emerald-500 transition-all duration-1000 ease-out" style={{ width: `${progress}%` }}></div>
      </div>

      {!completed ? (
        <div className="space-y-8 animate-fade-in">
           {/* Module Intro Card */}
           <div className="bg-white rounded-[3.5rem] p-8 md:p-12 shadow-xl border border-slate-100 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-50 rounded-full -mr-24 -mt-24 opacity-50"></div>
              
              <div className="flex items-center space-x-6 mb-8 relative z-10">
                 <div className="w-20 h-20 bg-emerald-600 text-white rounded-[2rem] flex items-center justify-center text-4xl shadow-2xl animate-pulse">
                    {activeModule?.icon}
                 </div>
                 <div>
                    <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">{activeModule?.title}</h2>
                    <p className="text-lg font-medium text-slate-500">{activeModule?.desc}</p>
                 </div>
              </div>

              <div className="space-y-8 relative z-10">
                 {/* Hero Image for context */}
                 {activeModule?.image && !activeModule.simulator && !activeModule.isQuiz && (
                    <div className="rounded-[2.5rem] overflow-hidden shadow-lg aspect-video mb-6 border-4 border-slate-50">
                       <img src={activeModule.image} className="w-full h-full object-cover" alt={activeModule.title} />
                    </div>
                 )}

                 <p className="text-xl text-slate-700 leading-relaxed font-medium border-l-8 border-emerald-500 pl-6 bg-emerald-50/30 py-4 rounded-r-2xl">
                    {activeModule?.content}
                 </p>

                 {/* Step Specific Components */}
                 {activeModule.checkpoints && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                       {activeModule.checkpoints.map((cp: string) => (
                         <div key={cp} className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 text-center group hover:bg-emerald-600 hover:shadow-xl transition-all cursor-pointer">
                            <div className="text-2xl mb-2 opacity-0 group-hover:opacity-100 transition-opacity">✅</div>
                            <p className="font-black text-slate-800 group-hover:text-white transition-colors">{cp}</p>
                         </div>
                       ))}
                    </div>
                 )}

                 {activeModule.simulator && (
                    <div className="bg-slate-950 rounded-[3rem] overflow-hidden shadow-2xl border-2 border-emerald-500/20">
                       <div className="relative h-64 group">
                          <img src={activeModule.simulator.image} className="w-full h-full object-cover opacity-60" alt="Simulator Sample" />
                          {isScanning && (
                             <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/40 to-transparent animate-[scan_1.5s_infinite] h-10 w-full z-20"></div>
                          )}
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                             <div className="w-48 h-48 border-2 border-emerald-500/30 rounded-full animate-ping"></div>
                          </div>
                          <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-[8px] font-black text-emerald-400 uppercase tracking-widest border border-emerald-500/30">
                             Digital Microscopy Active
                          </div>
                       </div>
                       <div className="p-8 space-y-6">
                          <div>
                            <h4 className="text-emerald-400 font-black uppercase text-[10px] tracking-widest mb-1">ভার্চুয়াল স্যাম্পল ডায়াগনোসিস</h4>
                            <h3 className="text-white text-2xl font-black tracking-tight">{activeModule.simulator.question}</h3>
                          </div>
                          
                          <div className="grid grid-cols-1 gap-3">
                             {activeModule.simulator.options?.map((opt: any) => (
                               <button 
                                 key={opt.value} 
                                 onClick={() => triggerScan(opt.feedback, opt.isCorrect)}
                                 className="w-full text-left p-5 bg-white/5 border border-white/10 rounded-3xl text-slate-300 hover:bg-white/10 transition-all font-bold flex items-center justify-between group/opt"
                               >
                                 <span>{opt.label}</span>
                                 <svg className="w-5 h-5 opacity-0 group-hover/opt:opacity-100 transition-opacity text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7m0 0l-7 7m7-7H3" /></svg>
                               </button>
                             ))}
                          </div>
                          
                          {simFeedback && (
                            <div className={`p-6 rounded-[2rem] animate-fade-in border-l-8 ${simFeedback.isCorrect ? 'bg-emerald-500/10 border-emerald-500' : 'bg-rose-500/10 border-rose-500'}`}>
                               <div className="flex items-center space-x-3 mb-2">
                                  <span className="text-2xl">{simFeedback.isCorrect ? '🔬' : '⚠️'}</span>
                                  <p className={`font-black uppercase text-[10px] tracking-widest ${simFeedback.isCorrect ? 'text-emerald-400' : 'text-rose-400'}`}>
                                     {simFeedback.isCorrect ? 'Scientific Conclusion' : 'Diagnostic Error'}
                                  </p>
                               </div>
                               <p className="text-white text-lg font-medium leading-relaxed">{simFeedback.text}</p>
                               {simFeedback.isCorrect && (
                                  <button 
                                    onClick={handleNext}
                                    className="mt-6 bg-emerald-600 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl active:scale-95 transition-all"
                                  >
                                    পরবর্তী সেশনে যান
                                  </button>
                               )}
                            </div>
                          )}
                       </div>
                    </div>
                 )}

                 {activeModule.logic && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       {activeModule.logic.map((l: any) => (
                         <div key={l.label} className="p-8 bg-blue-50 rounded-[2.5rem] border-2 border-blue-100 relative overflow-hidden group hover:bg-blue-600 transition-all cursor-default shadow-sm">
                            <div className="relative z-10">
                               <h4 className="font-black text-blue-600 group-hover:text-blue-100 uppercase text-[10px] tracking-widest mb-1">{l.label}</h4>
                               <p className="text-2xl font-black text-slate-800 group-hover:text-white mb-3">{l.target}</p>
                               <p className="text-base font-medium text-blue-800/70 group-hover:text-white/80 leading-relaxed">{l.desc}</p>
                            </div>
                            <div className="absolute -bottom-4 -right-4 text-6xl opacity-5 group-hover:opacity-20 transition-opacity">📊</div>
                         </div>
                       ))}
                    </div>
                 )}

                 {activeModule.isQuiz && (
                    <div className="space-y-8">
                       <div className="bg-slate-50 p-8 rounded-[3rem] border-2 border-dashed border-slate-200">
                          {activeModule.image && (
                            <img src={activeModule.image} className="w-full h-48 object-cover rounded-2xl mb-4 shadow-md" alt="Quiz Clue" />
                          )}
                          <h3 className="text-2xl font-black text-slate-800 leading-tight">"ভার্চুয়াল কেস স্টাডি: {activeModule.question}"</h3>
                       </div>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {activeModule.options?.map((opt: any, i: number) => (
                            <button 
                              key={i}
                              onClick={() => { if(opt.correct) handleNext(); else alert("ডায়াগনোসিস ভুল হয়েছে! আবার পর্যবেক্ষণ করুন।"); }}
                              className="p-6 bg-white border-2 border-slate-100 rounded-[2rem] text-left font-black text-slate-700 hover:border-emerald-500 hover:bg-emerald-50 transition-all shadow-sm hover:shadow-xl group"
                            >
                               <span className="inline-block w-8 h-8 rounded-full bg-slate-100 group-hover:bg-emerald-100 text-center leading-8 text-xs mr-3 transition-colors">{String.fromCharCode(65+i)}</span>
                               {opt.label}
                            </button>
                          ))}
                       </div>
                    </div>
                 )}

                 {activeModule.tip && (
                    <div className="bg-amber-50 p-8 rounded-[2.5rem] border-2 border-amber-100 flex items-start space-x-6 shadow-inner">
                       <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center text-4xl shadow-sm shrink-0">💡</div>
                       <p className="text-lg font-bold text-amber-900 leading-relaxed italic">{activeModule.tip}</p>
                    </div>
                 )}
              </div>

              {!activeModule.isQuiz && !activeModule.simulator && (
                <div className="mt-12 flex justify-end">
                   <button 
                     onClick={handleNext}
                     className="bg-slate-900 text-white px-12 py-5 rounded-[2.2rem] font-black text-sm uppercase tracking-widest shadow-2xl active:scale-95 transition-all flex items-center space-x-3 group"
                   >
                      <span>পরবর্তী বৈজ্ঞানিক স্তর</span>
                      <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                   </button>
                </div>
              )}
           </div>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto py-12 text-center space-y-10 animate-fade-in">
           <div className="relative">
              <div className="w-48 h-48 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-9xl animate-bounce shadow-2xl border-4 border-white">🎓</div>
              <div className="absolute inset-0 w-full h-full pointer-events-none">
                 {[1,2,3,4,5].map(i => (
                   <div key={i} className="absolute text-2xl animate-pulse" style={{ top: `${Math.random()*100}%`, left: `${Math.random()*100}%` }}>✨</div>
                 ))}
              </div>
           </div>
           
           <div className="space-y-4">
              <h2 className="text-5xl font-black text-slate-900 tracking-tight">অভিনন্দন, আপনি এখন একজন সার্টিফাইড 'প্ল্যান্ট ডক্টর'!</h2>
              <p className="text-xl text-slate-500 font-medium">আপনি সফলভাবে সকল বৈজ্ঞানিক সেশন এবং ডায়াগনোসিস ট্রেনিং সম্পন্ন করেছেন।</p>
           </div>

           <div className="bg-white p-10 rounded-[4rem] shadow-2xl border-2 border-emerald-500/20 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-3 bg-emerald-500"></div>
              <p className="text-[12px] font-black text-emerald-600 uppercase tracking-[0.4em] mb-6">Scientific Achievement Rewards</p>
              <div className="flex justify-center space-x-6">
                 <div className="p-6 bg-emerald-50 rounded-[2.5rem] border border-emerald-100 shadow-inner group hover:scale-105 transition-transform">
                    <p className="text-4xl mb-2 group-hover:rotate-12 transition-transform">🏅</p>
                    <p className="text-[10px] font-black uppercase">Elite Scout Badge</p>
                 </div>
                 <div className="p-6 bg-emerald-50 rounded-[2.5rem] border border-emerald-100 shadow-inner group hover:scale-105 transition-transform">
                    <p className="text-4xl mb-2 group-hover:rotate-12 transition-transform">⭐</p>
                    <p className="text-[10px] font-black uppercase">Knowledge +১০০ XP</p>
                 </div>
              </div>
           </div>

           <div className="pt-6">
              <button 
                onClick={onBack}
                className="w-full bg-[#0A8A1F] text-white py-7 rounded-[2.5rem] font-black text-2xl shadow-[0_20px_50px_rgba(10,138,31,0.3)] active:scale-95 transition-all hover:scale-[1.02]"
              >
                এআই স্ক্যানার দিয়ে প্র্যাকটিস শুরু করুন
              </button>
           </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes scan {
          0% { top: 0%; }
          100% { top: 100%; }
        }
      `}} />
    </div>
  );
};

export default CABIDiagnosisTraining;