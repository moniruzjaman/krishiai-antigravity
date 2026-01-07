
import React, { useState, useEffect } from 'react';
import { View, Language } from '../types';
import { getAgriNews } from '../services/geminiService';

// Add Language type to NewsTicker props to fix assignability error in App.tsx
export const NewsTicker: React.FC<{ lang?: Language }> = ({ lang = 'bn' }) => {
  const [news, setNews] = useState<string[]>([
    "সর্বশেষ কৃষি তথ্য লোড হচ্ছে...",
    "বিএআরআই উদ্ভাবিত প্রযুক্তি ব্যবহার করুন",
    "সুষম সার প্রয়োগ নিশ্চিত করুন"
  ]);

  useEffect(() => {
    const fetchLatestNews = async () => {
      try {
        // Pass lang to getAgriNews to ensure correct localized content
        // Fix: Explicitly cast lang as Language to satisfy TypeScript
        const data = await getAgriNews(lang as Language);
        if (data && data.length > 0) {
          setNews(data);
        }
      } catch (e) {
        console.error("News fetch error", e);
      }
    };
    fetchLatestNews();
  }, [lang]);

  const today = new Date().toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="bg-slate-900 text-white overflow-hidden whitespace-nowrap border-y border-white/10 z-[60] sticky top-16 h-14 flex items-center shadow-2xl">
      {/* Date & Breaking Label */}
      <div className="bg-rose-600 px-6 h-full flex flex-col justify-center items-center z-20 shadow-[10px_0_20px_rgba(0,0,0,0.3)] relative">
        <span className="text-[10px] font-black uppercase tracking-widest text-rose-100">ব্রেকিং নিউজ</span>
        <span className="text-[11px] font-black mt-0.5">{today}</span>
        {/* Triangle end piece for style */}
        <div className="absolute top-0 -right-4 h-full w-4 bg-rose-600" style={{ clipPath: 'polygon(0 0, 0% 100%, 100% 50%)' }}></div>
      </div>
      
      {/* Moving Text */}
      <div className="flex-1 overflow-hidden h-full flex items-center relative">
        <div className="flex animate-[scroll_45s_linear_infinite] space-x-24 px-8 items-center">
          {news.concat(news).map((item, i) => (
            <div key={i} className="flex items-center space-x-4">
              <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_12px_rgba(52,211,153,0.8)]"></span>
              <span className="text-sm md:text-base font-black tracking-tight drop-shadow-sm">{item}</span>
            </div>
          ))}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}} />
    </div>
  );
};

export const StatsSection: React.FC = () => (
  <section className="max-w-7xl mx-auto px-4 py-12">
    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
       <StatItem label="কৃষি জিডিপি অবদান" val="১১.৫%" icon="💹" trend="+০.২%" trendUp={true} />
       <StatItem label="মোট আবাদী জমি" val="৮.৮ মি. হেক্টর" icon="🚜" trend="স্থির" trendUp={null} />
       <StatItem label="খাদ্য উৎপাদন বৃদ্ধি" val="১৪% বার্ষিক" icon="🌾" trend="+২.১%" trendUp={true} />
       <StatItem label="ডিজিটাল কৃষক" val="৭২ লক্ষ+" icon="📱" trend="+১৫%" trendUp={true} />
    </div>
  </section>
);

const StatItem = ({ label, val, icon, trend, trendUp }: any) => (
  <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 hover:shadow-xl transition-all group relative overflow-hidden">
     <div className="absolute top-0 right-0 w-16 h-16 bg-slate-50 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-150"></div>
     <div className="text-3xl mb-4 relative z-10">{icon}</div>
     <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 relative z-10">{label}</h4>
     <p className="text-xl font-black text-slate-800 relative z-10">{val}</p>
     <div className="mt-3 flex items-center space-x-2 relative z-10">
        <span className={`text-[8px] font-black px-2 py-0.5 rounded-full ${trendUp === true ? 'bg-emerald-50 text-emerald-600' : trendUp === false ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-400'}`}>
          {trend}
        </span>
     </div>
  </div>
);

export const FeaturedCourses: React.FC<{ onNavigate: (v: View) => void }> = ({ onNavigate }) => {
  const courses = [
    { title: "লাভজনক ধান চাষ ও প্রযুক্তি", level: "বেসিক", icon: "🌾", color: "bg-emerald-500" },
    { title: "জৈবিক বালাইনাশক ও সার", level: "ইন্টারমিডিয়েট", icon: "🐞", color: "bg-blue-500" },
    { title: "মৃত্তিকা বিজ্ঞান ও অডিট", level: "অ্যাডভান্সড", icon: "🏺", color: "bg-amber-500" },
    { title: "স্মার্ট সেচ ও কৃষি মনিটরিং", level: "বেসিক", icon: "💧", color: "bg-indigo-500" },
  ];

  return (
    <section className="py-16 px-6 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-16">
        <div className="lg:col-span-8">
          <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
            <div>
              <div className="inline-flex items-center space-x-2 bg-amber-50 px-3 py-1 rounded-full border border-amber-100 mb-3">
                 <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                 <span className="text-[9px] font-black text-amber-800 uppercase tracking-widest">Digital Academy</span>
              </div>
              <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter leading-none">প্রশিক্ষণ একাডেমি</h2>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-[0.2em] mt-3">Professional Agri-Skill Development (Coming Soon)</p>
            </div>
            <button onClick={() => onNavigate(View.LEARNING_CENTER)} className="text-slate-400 font-black text-xs uppercase tracking-widest border-b-4 border-slate-200 pb-1 hover:text-emerald-600 hover:border-emerald-600 transition-all">শিখন কেন্দ্র দেখুন</button>
          </div>
          <div className="flex space-x-6 overflow-x-auto pb-8 scrollbar-hide -mx-2 px-2">
            {courses.map((course, i) => (
              <div key={i} className="min-w-[280px] bg-white rounded-[3rem] p-8 shadow-xl border border-slate-50 group hover:-translate-y-3 transition-all relative overflow-hidden">
                <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] z-10"></div>
                <div className="absolute top-6 right-6 z-20 bg-slate-900 text-white px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest shadow-xl">Cooking Soon</div>
                
                <div className="relative z-0 opacity-50 grayscale">
                  <div className={`w-16 h-16 ${course.color} rounded-3xl flex items-center justify-center text-3xl text-white mb-8 shadow-2xl transition-all duration-500`}>{course.icon}</div>
                  <p className="text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest flex items-center">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-2"></span>
                    {course.level}
                  </p>
                  <h3 className="text-2xl font-black text-slate-800 leading-tight mb-8">{course.title}</h3>
                  <button disabled className="w-full py-4 bg-slate-200 text-slate-400 rounded-2xl font-black text-xs uppercase tracking-widest cursor-not-allowed">শীঘ্রই আসছে</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Nearby Map Shortcut Section - Updated to Navigate to Profile */}
        <div className="lg:col-span-4">
           <div className="bg-slate-900 rounded-[3.5rem] p-10 h-full text-white shadow-2xl relative overflow-hidden group border-b-[16px] border-emerald-600">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-1000"></div>
              <div className="relative z-10">
                 <div className="w-14 h-14 bg-emerald-600 rounded-2xl flex items-center justify-center text-3xl mb-8 shadow-xl transform transition-transform group-hover:rotate-12">📍</div>
                 <h3 className="text-3xl font-black tracking-tight leading-none mb-4">নিকটস্থ কৃষি হাব</h3>
                 <p className="text-slate-400 text-sm font-medium leading-relaxed mb-10">আপনার ক্ষেতের চারপাশ থেকে সেরা বীজ ভাণ্ডার, বালাইনাশক ডিলার এবং ডিএই অফিসগুলো খুঁজে বের করুন।</p>
                 <button 
                   onClick={() => onNavigate(View.PROFILE)}
                   className="w-full bg-white text-slate-900 py-5 rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-xl hover:bg-emerald-50 transition-all active:scale-95 flex items-center justify-center space-x-3"
                 >
                    <span>প্রোফাইল ম্যাপ দেখুন</span>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 20l-5.447-2.724A2 2 0 013 15.485V6.515a2 2 0 011.553-1.943L9 2l5.447 2.724A2 2 0 0115 6.515v8.97a2 2 0 01-1.553 1.943L9 20z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 2v18M15 11h.01" /></svg>
                 </button>
              </div>
           </div>
        </div>
      </div>
    </section>
  );
};

export const MissionSection: React.FC = () => (
  <section className="py-24 px-6 bg-emerald-50/30">
    <div className="max-w-5xl mx-auto text-center space-y-10">
      <div className="inline-flex items-center space-x-3 bg-white px-6 py-2.5 rounded-full shadow-xl border border-emerald-100">
         <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
         <span className="text-[11px] font-black text-emerald-800 uppercase tracking-[0.3em]">Our Vision 2050</span>
      </div>
      <h2 className="text-5xl md:text-7xl font-black text-slate-900 tracking-tighter leading-[0.9]">টেকসই প্রযুক্তিতে<br/><span className="bg-gradient-to-r from-emerald-600 to-green-800 bg-clip-text text-transparent">স্মার্ট কৃষি বিপ্লব ২০২৫</span></h2>
      <p className="text-xl text-slate-500 font-medium leading-relaxed max-w-3xl mx-auto">
        Krishi AI-এর লক্ষ্য হলো ২০৫০ সালের মধ্যে লাভজনক এআই ও ডেটা সায়েন্স ব্যবহার করে উৎপাদনশীলতা বৃদ্ধি, 
        উপকরণের সর্বোচ্চ সঠিক ব্যবহার এবং চাষের খরচ কমিয়ে বাংলাদেশের প্রতিটি কৃষকের মুখে হাসি ফোটানো।
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-6">
         <MissionCard 
           icon="📈" 
           title="উচ্চ উৎপাদনশীলতা" 
           desc="লাভজনক জাত ও বিজ্ঞানভিত্তিক চাষ পদ্ধতি প্রয়োগের মাধ্যমে হেক্টর প্রতি ফলন বৃদ্ধি।" 
         />
         <MissionCard 
           icon="⚖️" 
           title="সম্পদ সাশ্রয়" 
           desc="সার, বীজ ও পানির অপচয় রোধে নিখুঁত সেন্সর ও এআই চালিত পরামর্শ।" 
         />
         <MissionCard 
           icon="📉" 
           title="খরচ হ্রাস" 
           desc="অপ্রয়োজনীয় উপকরণের ব্যবহার কমিয়ে উৎপাদন খরচ ৩০% পর্যন্ত কমানোর লক্ষ্য।" 
         />
      </div>
    </div>
  </section>
);

const MissionCard = ({ icon, title, desc, trend }: any) => (
  <div className="bg-white p-10 rounded-[3.5rem] shadow-sm border border-white hover:shadow-2xl hover:scale-105 transition-all group text-center">
     <div className="text-5xl mb-8 group-hover:scale-110 group-hover:-rotate-6 transition-transform">{icon}</div>
     <div className="flex items-center justify-center space-x-2 mb-3">
        <h4 className="font-black text-slate-900 text-lg uppercase tracking-tighter">{title}</h4>
        {trend && <span className="bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-md animate-pulse">{trend}</span>}
     </div>
     <p className="text-sm text-slate-400 leading-relaxed font-medium">{desc}</p>
  </div>
);

export const ContactFooter: React.FC = () => (
  <section className="py-24 px-6 bg-slate-900 text-white rounded-t-[4rem] md:rounded-t-[6rem]">
    <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16">
      <div className="space-y-10">
         <div className="space-y-4">
            <h3 className="text-5xl md:text-6xl font-black tracking-tighter leading-none">আপনার খামার,<br/><span className="text-emerald-500">আমাদের প্রযুক্তি।</span></h3>
            <p className="text-xl text-slate-400 font-medium max-w-md">যেকোনো জিজ্ঞাসা বা টেকనిక্যাল সহায়তার জন্য আমাদের এগ্রো-এক্সপার্টরা ২৪/৭ প্রস্তুত।</p>
         </div>
         <div className="flex flex-col space-y-6">
            <a href="https://wa.me/8801712653740" target="_blank" className="flex items-center space-x-6 bg-white/5 p-6 rounded-[2.5rem] border border-white/10 hover:bg-emerald-600 transition-all group shadow-xl">
               <div className="w-16 h-16 bg-emerald-50 rounded-3xl flex items-center justify-center text-3xl shadow-inner group-hover:rotate-12 transition-transform">💬</div>
               <div>
                  <p className="text-[11px] font-black uppercase text-emerald-400 group-hover:text-white">WhatsApp Helpline</p>
                  <p className="text-2xl font-black">+৮৮০ ১৭১২-৬৫৩৭৪০</p>
               </div>
               <div className="flex-1 text-right pr-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg className="w-6 h-6 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
               </div>
            </a>
            <a href="mailto:support@krishiai.live" className="flex items-center space-x-6 bg-white/5 p-6 rounded-[2.5rem] border border-white/10 hover:bg-blue-600 transition-all group shadow-xl">
               <div className="w-16 h-16 bg-blue-50 rounded-3xl flex items-center justify-center text-3xl shadow-inner group-hover:rotate-12 transition-transform">📧</div>
               <div>
                  <p className="text-[11px] font-black uppercase text-blue-400 group-hover:text-white">Agro Expert Inquiry</p>
                  <p className="text-2xl font-black">support@krishiai.live</p>
               </div>
               <div className="flex-1 text-right pr-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg className="w-6 h-6 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
               </div>
            </a>
         </div>
      </div>
      <div className="flex flex-col">
         <div className="bg-white/5 p-10 md:p-14 rounded-[3.5rem] border border-white/10 flex-1 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000"></div>
            <h4 className="text-2xl font-black mb-10 flex items-center">
               <span className="w-3 h-3 bg-blue-500 rounded-full mr-4 animate-pulse"></span>
               আন্তর্জাতিক এগ্রো-কমিউনিটি
            </h4>
            <div className="aspect-video bg-slate-800/50 rounded-[2.5rem] flex items-center justify-center border-2 border-dashed border-white/10 text-slate-400 text-center p-8 group-hover:border-blue-500/50 transition-colors">
               <div className="space-y-6">
                 <div className="text-6xl opacity-40">🌍</div>
                 <p className="font-bold text-lg leading-relaxed">বিশ্বের বিভিন্ন প্রান্তের লাভজনক কৃষি খবর ও প্রযুক্তি শেয়ার করুন আমাদের গ্লোবাল ফোরামে।</p>
                 <button className="px-10 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl active:scale-95 transition-all">ফোরামে যোগ দিন</button>
               </div>
            </div>
         </div>
      </div>
    </div>
    <div className="mt-24 pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
       <div className="flex items-center space-x-6">
          <a href="#" className="text-slate-500 hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest">Privacy Policy</a>
          <a href="#" className="text-slate-500 hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest">Terms of Use</a>
          <a href="#" className="text-slate-500 hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest">Govt Info</a>
       </div>
       <p className="text-[10px] font-black uppercase text-slate-600 tracking-[0.4em]">Krishi AI Ecosystem © 2025 • Govt Digital Project</p>
    </div>
  </section>
);
