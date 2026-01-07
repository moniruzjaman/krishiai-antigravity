
import React, { useState, useEffect } from 'react';
import { View, Language } from '../types';
import { generateAgriImage } from '../services/geminiService';
import { useSpeech } from '../App';

interface HeroProps {
  onNavigate: (view: View) => void;
  lang: Language;
}

const GrowingPlant = ({ className = "", style = {} }: { className?: string, style?: React.CSSProperties }) => (
  <svg 
    viewBox="0 0 100 100" 
    className={`w-16 h-16 md:w-24 md:h-24 text-white pointer-events-none absolute ${className}`}
    fill="currentColor"
    style={style}
  >
    <path d="M50,100 Q45,60 50,20" stroke="currentColor" strokeWidth="3" fill="none" />
    <path d="M50,75 Q30,60 20,70 Q30,85 50,75" fillOpacity="0.8" />
    <path d="M50,55 Q70,40 80,50 Q70,65 50,55" fillOpacity="0.8" />
    <path d="M50,20 Q40,10 50,0 Q60,10 50,20" fillOpacity="0.9" />
  </svg>
);

export const Hero: React.FC<HeroProps> = ({ onNavigate, lang }) => {
  const [bgImage, setBgImage] = useState<string>("");
  const { speechEnabled } = useSpeech();

  useEffect(() => {
    const fetchBg = async () => {
      const themes = [
        "Cinematic aerial shot of lush green rice terraces in Bangladesh",
        "Modern smart farming dashboard floating over a golden wheat field",
        "Beautiful sunset over a traditional Bangladeshi agricultural landscape high resolution"
      ];
      const randomTheme = themes[Math.floor(Math.random() * themes.length)];
      try {
        const url = await generateAgriImage(randomTheme);
        setBgImage(url);
      } catch (e) {
        // Log locally but don't disrupt user; fallback to gradient is handled in render
        console.warn("Hero Background API Quota reached, using fallback gradient.");
      }
    };
    fetchBg();
  }, []);

  const content = {
    bn: {
      tag: "প্রজেক্ট কৃষি ২.০",
      titleTop: "চাষাবাদ হবে",
      titleBottom: "স্মার্ট ও লাভজনক",
      desc: "সর্বাধুনিক এআই এবং স্যাটেলাইট প্রযুক্তি। নিখুঁত রোগ নির্ণয় থেকে লাভজনক উৎপাদন—সবই এখন আপনার হাতের মুঠোয়।",
      btnScan: "এআই স্ক্যানার",
      btnChat: "সহায়তা নিন",
      voiceTag: "পড়ুন বা শুনে নিন",
      stat1: "সাশ্রয়ী",
      stat2: "লাইভ",
      stat3: "নিখুঁত",
      stat4: "আধুনিক"
    },
    en: {
      tag: "PROJECT KRISHI 2.0",
      titleTop: "Farming is now",
      titleBottom: "Smart & Profitable",
      desc: "Cutting-edge AI and satellite technology. Precise disease diagnosis to profitable production—all in your hands.",
      btnScan: "AI Scanner",
      btnChat: "AI Chatbot",
      voiceTag: "Read or Listen",
      stat1: "Savings",
      stat2: "Live",
      stat3: "Precise",
      stat4: "Modern"
    }
  }[lang];

  return (
    <div id="hero-section" className="relative bg-slate-900 text-white overflow-hidden rounded-b-[4rem] md:rounded-b-[6rem] shadow-2xl min-h-[600px] flex flex-col justify-center border-b-[20px] border-[#0A8A1F]/30 transition-all duration-700">
      {/* Background Image Container with Gradient Fallback */}
      <div className="absolute inset-0 z-0">
        {bgImage ? (
          <div 
            className="absolute inset-0 bg-cover bg-center transition-opacity duration-2000 animate-fade-in opacity-50 grayscale-[0.3]"
            style={{ backgroundImage: `url(${bgImage})` }}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#0A8A1F] via-slate-900 to-black opacity-80" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/40 to-transparent" />
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      </div>

      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-10">
        <div className="absolute top-20 right-20 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute -bottom-24 -left-24 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[150px]"></div>
        <GrowingPlant style={{ bottom: '10%', left: '5%', animationDelay: '0s' }} className="animate-grow-plant opacity-0" />
      </div>
      
      <div className="relative z-20 max-w-7xl mx-auto px-6 py-20 flex flex-col items-center text-center">
        <div className="mb-10 transform hover:scale-105 transition-transform duration-700 animate-fade-in flex flex-col items-center">
           <div className="mt-4 flex flex-wrap justify-center gap-2">
              <div className="bg-emerald-600/30 backdrop-blur-xl px-6 py-1.5 rounded-full border border-emerald-500/30 flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400">{content.tag}</span>
              </div>
              <div className={`bg-blue-600/30 backdrop-blur-xl px-4 py-1.5 rounded-full border border-blue-400/30 flex items-center space-x-2 transition-all ${speechEnabled ? 'opacity-100 translate-y-0' : 'opacity-50 grayscale'}`}>
                <span className="text-[14px]">🔊</span>
                <span className="text-[9px] font-black uppercase tracking-widest text-blue-300">{content.voiceTag}</span>
              </div>
           </div>
        </div>

        <h1 className="text-4xl md:text-8xl font-black mb-6 tracking-tighter leading-[0.85] drop-shadow-[0_20px_30px_rgba(0,0,0,0.6)] animate-fade-in-up">
          {content.titleTop}<br/>
          <span className="bg-gradient-to-r from-emerald-400 via-green-300 to-blue-400 bg-clip-text text-transparent">{content.titleBottom}</span>
        </h1>
        
        <p className="max-w-2xl text-lg md:text-xl font-medium text-slate-300 mb-12 leading-relaxed animate-fade-in [animation-delay:0.2s] drop-shadow-xl">
          {content.desc}
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-lg justify-center animate-fade-in [animation-delay:0.4s] mb-12">
          <button 
            onClick={() => onNavigate(View.ANALYZER)}
            className="flex-1 bg-white text-slate-900 px-8 py-5 rounded-3xl font-black text-lg shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center space-x-3 group"
          >
             <span className="text-2xl">📸</span>
             <span>{content.btnScan}</span>
          </button>
          
          <button 
            onClick={() => onNavigate(View.CHAT)}
            className="flex-1 bg-emerald-600 text-white px-8 py-5 rounded-3xl font-black text-lg shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center space-x-3 group border border-emerald-400/30"
          >
             <span className="text-2xl">🤖</span>
             <span>{content.btnChat}</span>
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-3xl animate-fade-in [animation-delay:0.6s]">
           <HeroMetric icon="🌾" label={content.stat1} val="৩০%" />
           <HeroMetric icon="🛰️" label={content.stat2} val="১০+" />
           <HeroMetric icon="🧬" label={content.stat3} val="১০০%" />
           <HeroMetric icon="🎓" label={content.stat4} val="২০+" />
        </div>
      </div>
    </div>
  );
};

const HeroMetric = ({ icon, label, val }: any) => (
  <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-4 rounded-[2rem] flex flex-col items-center justify-center group hover:bg-white/10 transition-all border-b-4 border-emerald-500/20">
     <span className="text-xl mb-1 group-hover:scale-110 transition-transform">{icon}</span>
     <span className="text-[8px] font-black uppercase text-slate-500 tracking-widest leading-none mb-1">{label}</span>
     <span className="text-lg font-black text-white">{val}</span>
  </div>
);
