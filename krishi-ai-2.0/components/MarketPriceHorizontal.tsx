
import React, { useState, useEffect } from 'react';
import { View, Language } from '../types';
import { getTrendingMarketPrices } from '../services/geminiService';

interface MarketPriceHorizontalProps {
  onNavigate: (view: View) => void;
  // Add lang to fix assignability error in App.tsx
  lang?: Language;
}

export const MarketPriceHorizontal: React.FC<MarketPriceHorizontalProps> = ({ onNavigate, lang = 'bn' }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [prices, setPrices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);
  
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchPrices();
  }, [lang]);

  const fetchPrices = async () => {
    setIsLoading(true);
    setError(false);
    try {
      // Pass lang to getTrendingMarketPrices to ensure localized results
      // Fix: Explicitly cast lang as Language to satisfy TypeScript
      const data = await getTrendingMarketPrices(lang as Language);
      if (data && data.length > 0) {
        setPrices(data);
      } else {
        // Fallback for empty or malformed data
        setPrices([]);
      }
    } catch (e) {
      console.error("Market fetch error", e);
      setError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const toBanglaNumber = (val: any) => {
    if (val === null || val === undefined) return '';
    const banglaNumbers: Record<string, string> = {
      '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪', '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯'
    };
    return val.toString().replace(/[0-9]/g, (w: string) => banglaNumbers[w]);
  };

  const formattedDate = currentTime.toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' });
  const formattedTime = currentTime.toLocaleTimeString('bn-BD');

  return (
    <div className="max-w-7xl mx-auto px-4 mt-6 animate-fade-in">
      <div className="bg-white rounded-[2.5rem] p-6 shadow-xl border border-slate-100 relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-6">
          <div className="flex items-center space-x-4">
             <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-2xl shadow-inner relative">
                📊
                <div className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </div>
             </div>
             <div>
                <h3 className="text-xl font-black text-slate-800 tracking-tight leading-none flex items-center">
                  লাইভ বাজার দর
                  <span className="ml-2 bg-rose-500 text-white text-[7px] px-1.5 py-0.5 rounded uppercase tracking-widest font-black animate-pulse">Live</span>
                </h3>
                <div className="flex flex-col mt-1">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">দাম ডট গভ ডট বিডি (dam.gov.bd) ভিত্তিক</p>
                   <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">
                     আপডেট: {formattedDate} • {formattedTime}
                   </p>
                </div>
             </div>
          </div>
          <button 
            onClick={() => onNavigate(View.SEARCH)}
            className="px-6 py-2.5 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center space-x-2"
          >
            <span>বিস্তারিত তথ্য</span>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>

        {isLoading && prices.length === 0 ? (
          <div className="flex items-center space-x-4 py-8 animate-pulse">
            <div className="h-24 w-40 bg-slate-100 rounded-[2rem]"></div>
            <div className="h-24 w-40 bg-slate-100 rounded-[2rem]"></div>
            <div className="h-24 w-40 bg-slate-100 rounded-[2rem]"></div>
          </div>
        ) : error ? (
           <div className="py-10 text-center flex flex-col items-center">
              <p className="text-sm font-bold text-slate-400 uppercase mb-4">তথ্য সংগ্রহে সমস্যা হচ্ছে</p>
              <button onClick={fetchPrices} className="text-[10px] font-black text-blue-600 border-b-2 border-blue-600 pb-0.5">পুনরায় চেষ্টা করুন</button>
           </div>
        ) : (
          <div className="flex space-x-4 overflow-x-auto pb-2 scrollbar-hide -mx-2 px-2">
            {prices.map((item, idx) => (
              <div 
                key={idx} 
                onClick={() => onNavigate(View.SEARCH)}
                className="min-w-[190px] bg-slate-50 border border-slate-100 p-5 rounded-[2rem] hover:bg-white hover:shadow-lg transition-all cursor-pointer group relative overflow-hidden"
              >
                <div className="flex justify-between items-start mb-3">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">{item.category}</span>
                  <div className={`flex items-center space-x-1 px-2 py-0.5 rounded-full text-[9px] font-black ${item.trend === 'up' ? 'bg-rose-50 text-rose-600' : item.trend === 'down' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                    <span>{item.change}</span>
                    <span className="text-[12px]">{item.trend === 'up' ? '↑' : item.trend === 'down' ? '↓' : '→'}</span>
                  </div>
                </div>
                <h4 className="font-black text-slate-800 text-lg leading-tight mb-2 group-hover:text-[#0A8A1F] transition-colors">{item.name}</h4>
                <div className="flex items-baseline space-x-1">
                  <span className="text-3xl font-black text-slate-900">৳{toBanglaNumber(item.price)}</span>
                  <span className="text-[10px] font-bold text-slate-400">/{item.unit}</span>
                </div>
                <div className="absolute bottom-0 left-0 w-full h-1 bg-[#0A8A1F] scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-500"></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
