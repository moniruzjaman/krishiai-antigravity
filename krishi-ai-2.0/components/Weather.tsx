
import React, { useState, useEffect, useRef } from 'react';
/* Removed missing generateGroundedWeatherReport from import to fix error on line 3 */
import { getLiveWeather, generateSpeech, decodeBase64, decodeAudioData } from '../services/geminiService';
import { WeatherData, ForecastDay, GroundingChunk } from '../types';
import { saveStoredLocation } from '../services/locationService';
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import GuidedTour, { TourStep } from './GuidedTour';

const toBanglaNumber = (val: any) => {
  if (val === null || val === undefined) return '';
  const banglaNumbers: Record<string, string> = {
    '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪', '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯', '.': '.'
  };
  return val.toString().replace(/[0-9.]/g, (w: string) => banglaNumbers[w]);
};

interface WeatherProps {
  onBack?: () => void;
  lang: 'bn' | 'en';
}

const WEATHER_TOUR: TourStep[] = [
  {
    title: "স্মার্ট কৃষি আবহাওয়া",
    content: "Google Weather ও BAMIS তথ্যের সমন্বয়ে আপনার এলাকার সঠিক আবহাওয়া এবং কৃষি ঝুঁকি জানুন।",
    position: 'center'
  },
  {
    targetId: "weather-refresh-btn",
    title: "লাইভ আপডেট",
    content: "যেকোনো সময় সর্বশেষ আবহাওয়া জানতে এই রিফ্রেশ বাটনটি ব্যবহার করুন।",
    position: 'bottom'
  }
];

const WEATHER_CACHE_KEY = 'agritech_weather_cache';
const WEATHER_TIMESTAMP_KEY = 'agritech_weather_last_update';
const ONE_HOUR_MS = 3600000;

const Weather: React.FC<WeatherProps> = ({ onBack, lang }) => {
  /* Fix: Removed 'report' from active tab union type as it is unused and its service is missing */
  const [activeTab, setActiveTab] = useState<'forecast' | 'risks' | 'spraying'>('forecast');
  const [weather, setWeather] = useState<WeatherData | null>(null);
  /* Removed unused 'report' and 'isReportLoading' states that depended on the missing generateGroundedWeatherReport */
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showTour, setShowTour] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const tourDone = localStorage.getItem('agritech_tour_weather_v2');
    if (!tourDone) setShowTour(true);
    loadInitialWeather();
    const weatherUpdateTimer = setInterval(() => { fetchWeather(true); }, ONE_HOUR_MS);
    return () => clearInterval(weatherUpdateTimer);
  }, []);

  const loadInitialWeather = async () => {
    const cachedData = localStorage.getItem(WEATHER_CACHE_KEY);
    const lastUpdate = localStorage.getItem(WEATHER_TIMESTAMP_KEY);
    const now = Date.now();
    if (cachedData && lastUpdate && (now - parseInt(lastUpdate) < ONE_HOUR_MS)) {
      setWeather(JSON.parse(cachedData));
    } else {
      fetchWeather(false);
    }
  };

  const fetchWeather = async (force: boolean = false) => {
    setIsLoading(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude } = position.coords;
        saveStoredLocation(latitude, longitude);
        try {
          const data = await getLiveWeather(latitude, longitude, force, lang);
          setWeather(data);
          localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(data));
          localStorage.setItem(WEATHER_TIMESTAMP_KEY, Date.now().toString());
        } catch (err) {
          console.error("Weather error:", err);
        } finally { setIsLoading(false); }
      }, () => setIsLoading(false), { enableHighAccuracy: true, timeout: 10000 });
    } else {
      setIsLoading(false);
    }
  };

  const playTTS = async (text: string) => {
    if (isPlaying) { stopTTS(); return; }
    try {
      setIsPlaying(true);
      if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') await ctx.resume();
      const base64 = await generateSpeech(text.replace(/[*#_~]/g, ''));
      const buffer = await decodeAudioData(decodeBase64(base64), ctx, 24000, 1);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.onended = () => setIsPlaying(false);
      currentSourceRef.current = source;
      source.start(0);
    } catch (e) { setIsPlaying(false); }
  };

  const stopTTS = () => {
    if (currentSourceRef.current) { currentSourceRef.current.stop(); currentSourceRef.current = null; }
    setIsPlaying(false);
  };

  const getSpraySafety = () => {
    if (!weather) return { status: 'অজানা', color: 'slate', desc: '' };
    const { windSpeed, rainProbability, humidity, temp } = weather;
    let dangerLevel = 0;
    if (windSpeed > 12) dangerLevel += 2;
    if (rainProbability > 25) dangerLevel += 2;
    if (humidity > 80) dangerLevel += 1;
    if (temp > 32) dangerLevel += 1;
    if (dangerLevel >= 3) return { status: lang === 'bn' ? 'ঝুঁকিপূর্ণ' : 'High Risk', color: 'rose', desc: lang === 'bn' ? 'এখন স্প্রে করা থেকে বিরত থাকুন।' : 'Avoid spraying chemicals now.' };
    if (dangerLevel >= 1.5) return { status: lang === 'bn' ? 'সতর্কাবস্থা' : 'Caution', color: 'amber', desc: lang === 'bn' ? 'আবহাওয়া নিবিড়ভাবে পর্যবেক্ষণ করুন।' : 'Monitor weather closely before spray.' };
    return { status: lang === 'bn' ? 'আদর্শ সময়' : 'Ideal Time', color: 'emerald', desc: lang === 'bn' ? 'বালাইনাশক প্রয়োগের জন্য উপযুক্ত আবহাওয়া।' : 'Perfect conditions for chemical application.' };
  };

  const spray = getSpraySafety();
  const hasUrgentRisk = weather?.rainProbability && weather.rainProbability > 60;

  return (
    <div className="max-w-4xl mx-auto bg-slate-50 min-h-screen pb-32 font-sans overflow-x-hidden">
      {showTour && <GuidedTour steps={WEATHER_TOUR} tourKey="weather_v2" onClose={() => setShowTour(false)} />}
      
      <div className="bg-white/80 backdrop-blur-md px-6 py-6 border-b border-slate-100 flex justify-between items-center sticky top-0 z-[100] shadow-sm">
        <div className="flex items-center space-x-4">
           <button onClick={onBack} className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100 hover:bg-[#0A8A1F] hover:text-white transition-all active:scale-90 text-slate-400">
             <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
           </button>
           <div>
             <h1 className="text-xl font-black text-slate-800 leading-none flex items-center">
               {lang === 'bn' ? 'স্মার্ট কৃষি আবহাওয়া' : 'Smart Agri Weather'}
               <span className="ml-2 bg-blue-100 text-blue-600 text-[8px] px-2 py-0.5 rounded-full font-black uppercase">LIVE</span>
             </h1>
             <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mt-1.5">
               📍 {weather?.upazila || '...'}, {weather?.district || ''}
             </p>
           </div>
        </div>
        <button id="weather-refresh-btn" onClick={() => fetchWeather(true)} className={`p-3 bg-blue-50 text-blue-600 rounded-2xl active:scale-90 transition-all ${isLoading ? 'animate-spin' : ''}`}>
           <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
        </button>
      </div>

      {isLoading && !weather ? (
        <div className="flex flex-col items-center justify-center py-40 animate-fade-in">
           <div className="w-24 h-24 border-[10px] border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
           <h2 className="text-2xl font-black text-slate-800 mt-8">ডাটা সংগ্রহ হচ্ছে...</h2>
           <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-2">BAMIS এবং Google Data Sync</p>
        </div>
      ) : weather && (
        <div className="p-4 md:p-8 space-y-8 animate-fade-in">
           
           {hasUrgentRisk && (
             <div className="bg-rose-600 text-white p-6 rounded-[2.5rem] shadow-xl flex items-center space-x-5 animate-bounce-slow">
                <div className="text-4xl">⛈️</div>
                <div className="flex-1">
                   <h3 className="text-xl font-black tracking-tight">{lang === 'bn' ? 'সতর্কতা: ভারী বৃষ্টির সম্ভাবনা' : 'Warning: Heavy Rain Expected'}</h3>
                   <p className="text-xs font-medium opacity-80 mt-1">{lang === 'bn' ? 'আগামী ৪৮ ঘণ্টার মধ্যে আপনার এলাকায় অতি ভারী বৃষ্টির সংকেত পাওয়া গেছে।' : 'Severe rain forecast in your area within 48 hours.'}</p>
                </div>
                <button onClick={() => setActiveTab('risks')} className="bg-white text-rose-600 px-6 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg">বিস্তারিত</button>
             </div>
           )}

           {/* Immersive Main Card */}
           <section className="bg-gradient-to-br from-blue-600 via-indigo-700 to-slate-900 rounded-[3.5rem] p-10 text-white shadow-[0_30px_60px_-15px_rgba(37,99,235,0.4)] relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32 transition-transform duration-1000 group-hover:scale-110"></div>
              <div className="relative z-10 flex flex-col items-center text-center">
                <div className="text-[120px] mb-4 drop-shadow-2xl animate-pulse">
                  {weather.condition?.includes('রোদ্র') ? "☀️" : weather.condition?.includes('বৃষ্টি') ? "🌧️" : "⛅"}
                </div>
                <div className="flex items-baseline space-x-1">
                  <span className="text-9xl font-black tracking-tighter leading-none">{lang === 'bn' ? toBanglaNumber(weather.temp) : weather.temp}</span>
                  <span className="text-4xl font-bold opacity-40">°C</span>
                </div>
                <div className="mt-8 bg-white/20 backdrop-blur-xl px-12 py-3 rounded-full border border-white/30 inline-flex items-center space-x-3">
                   <span className="text-2xl">{weather.condition?.includes('রোদ্র') ? "✨" : "☁️"}</span>
                   <span className="text-xl font-black uppercase tracking-[0.2em]">{weather.condition}</span>
                </div>
                <p className="text-sm font-medium text-blue-100/70 mt-8 max-w-sm leading-relaxed">{weather.description}</p>
              </div>
           </section>

           {/* Tabs Switching */}
           <div className="flex bg-white p-2 rounded-[2.5rem] shadow-xl border border-slate-100 overflow-x-auto scrollbar-hide">
              <button onClick={() => setActiveTab('forecast')} className={`flex-1 min-w-[120px] py-4 text-[10px] font-black uppercase rounded-[2rem] transition-all flex items-center justify-center space-x-2 ${activeTab === 'forecast' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>
                 <span>📅</span><span>{lang === 'bn' ? '৭ দিনের পূর্বাভাস' : '7 Day Forecast'}</span>
              </button>
              <button onClick={() => setActiveTab('risks')} className={`flex-1 min-w-[120px] py-4 text-[10px] font-black uppercase rounded-[2rem] transition-all flex items-center justify-center space-x-2 ${activeTab === 'risks' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>
                 <span>⚠️</span><span>{lang === 'bn' ? 'বালাই ঝুঁকি' : 'Pest Risks'}</span>
              </button>
              <button onClick={() => setActiveTab('spraying')} className={`flex-1 min-w-[120px] py-4 text-[10px] font-black uppercase rounded-[2rem] transition-all flex items-center justify-center space-x-2 ${activeTab === 'spraying' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>
                 <span>🧪</span><span>{lang === 'bn' ? 'স্প্রে গাইড' : 'Spray Guide'}</span>
              </button>
           </div>

           {/* Tab Content: Forecast Grid */}
           {activeTab === 'forecast' && (
             <div className="space-y-8 animate-fade-in">
                {/* Agri Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <AgriMetricItem label={lang === 'bn' ? "সেচ চাহিদা (ET0)" : "ET0 (Irrigation)"} val={lang === 'bn' ? toBanglaNumber(weather.evapotranspiration || "১.২") : weather.evapotranspiration || "1.2"} unit="mm" icon="🚿" />
                  <AgriMetricItem label={lang === 'bn' ? "মাটির তাপমাত্রা" : "Soil Temp"} val={lang === 'bn' ? toBanglaNumber(weather.soilTemperature || "২৩") : weather.soilTemperature || "23"} unit="°C" icon="🏺" />
                  <AgriMetricItem label={lang === 'bn' ? "সৌর বিকিরণ" : "Solar Rad."} val={lang === 'bn' ? toBanglaNumber(weather.solarRadiation || "৩৫০") : weather.solarRadiation || "350"} unit="W/m²" icon="☀️" />
                  <AgriMetricItem label={lang === 'bn' ? "ফসল প্রগতি (GDD)" : "GDD Progress"} val={lang === 'bn' ? toBanglaNumber(weather.gdd || "১২") : weather.gdd || "12"} unit="Units" icon="🌱" />
                </div>

                {/* 7-Day Grid */}
                <div className="bg-white rounded-[3rem] p-8 shadow-xl border border-slate-100">
                  <h3 className="text-xl font-black text-slate-800 mb-8 px-2 flex items-center">
                    <span className="w-1.5 h-8 bg-blue-600 rounded-full mr-3"></span>
                    {lang === 'bn' ? 'আগামী ৭ দিনের আবহাওয়া' : '7-Day Extended Forecast'}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-4">
                    {(weather.forecast && weather.forecast.length > 0 ? weather.forecast : Array(7).fill(null)).map((day, i) => (
                      <div key={i} className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex flex-col items-center text-center shadow-sm hover:shadow-md transition-shadow group">
                        <span className="text-[10px] font-black text-slate-400 uppercase mb-4">{day ? day.date.split(',')[0] : `Day ${i+1}`}</span>
                        <span className="text-4xl mb-4 transform group-hover:scale-125 transition-transform duration-500">
                          {day?.condition?.includes('বৃষ্টি') ? '🌧️' : day?.condition?.includes('মেঘ') ? '☁️' : '☀️'}
                        </span>
                        <div className="flex items-baseline space-x-1">
                          <span className="font-black text-2xl text-slate-800">{day ? (lang === 'bn' ? toBanglaNumber(day.maxTemp) : day.maxTemp) : '--'}°</span>
                          <span className="text-xs font-bold text-slate-300">{day ? (lang === 'bn' ? toBanglaNumber(day.minTemp) : day.minTemp) : '--'}°</span>
                        </div>
                        <div className="text-[8px] font-black text-blue-500 uppercase mt-2 px-2 py-0.5 bg-blue-50 rounded-full truncate w-full">
                           {day?.condition || 'Clear'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
             </div>
           )}

           {/* Tab Content: Pest Risk Association */}
           {activeTab === 'risks' && (
             <div className="space-y-6 animate-fade-in">
                <div className="bg-white rounded-[3rem] p-10 shadow-xl border border-slate-100">
                   <div className="flex justify-between items-center mb-8 border-b border-slate-50 pb-6">
                      <h3 className="text-2xl font-black text-slate-800 tracking-tight flex items-center">
                        <span className="mr-3 p-3 bg-rose-50 rounded-2xl text-2xl shadow-inner">🦠</span> 
                        {lang === 'bn' ? 'বালাই ও রোগ শঙ্কা (Association)' : 'Pest & Disease Association'}
                      </h3>
                      <span className="text-[10px] font-black text-slate-400 bg-slate-50 px-3 py-1 rounded-full uppercase border border-slate-100">BAMIS Integration</span>
                   </div>
                   
                   <div className="mb-10 bg-rose-50 border-2 border-rose-100 p-8 rounded-[2.5rem] relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-rose-100/50 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-700"></div>
                      <div className="relative z-10">
                        <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-2 flex items-center">
                          <span className="w-1.5 h-1.5 bg-rose-600 rounded-full mr-2 animate-ping"></span>
                          {lang === 'bn' ? 'সায়েন্টিফিক এলার্ট' : 'Scientific Alert'}
                        </p>
                        <h4 className="text-3xl font-black text-rose-900 leading-tight mb-4">
                          {weather.diseaseRisk || (lang === 'bn' ? "তথ্য প্রক্রিয়াধীন..." : "Calculating risk levels...")}
                        </h4>
                        <p className="text-sm font-bold text-rose-700 leading-relaxed">
                          {lang === 'bn' 
                            ? 'বর্তমান তাপমাত্রা ও আর্দ্রতা এই বিশেষ রোগটির প্রসারের জন্য অত্যন্ত সহায়ক। আগাম ব্যবস্থা নেওয়া জরুরি।' 
                            : 'Current temperature and humidity profile is highly conducive for the rapid spread of this pest/disease.'}
                        </p>
                      </div>
                   </div>

                   <ul className="space-y-4">
                      <RiskFactorItem 
                        title={lang === 'bn' ? "ব্লাস্ট রোগ (Blast)" : "Rice Blast"} 
                        desc={lang === 'bn' ? "২২-২৮°C তাপমাত্রা ও ৯০% এর বেশি আর্দ্রতা ব্লাস্টের জন্য অনুকূল।" : "Temp 22-28°C + Humidity >90% favors blast spore development."} 
                        icon="🌾" 
                        risk={weather.humidity > 85 ? 'High' : 'Low'} 
                      />
                      <RiskFactorItem 
                        title={lang === 'bn' ? "লেট ব্লাইট (Let Blight)" : "Potato Late Blight"} 
                        desc={lang === 'bn' ? "ঘন কুয়াশা এবং মেঘলা আকাশ পচন রোগের ঝুঁকি বাড়িয়ে দেয়।" : "Continuous fog and cloudy weather increases late blight risk."} 
                        icon="🥔" 
                        risk={weather.condition?.includes('মেঘ') || weather.condition?.includes('কুয়াশা') ? 'High' : 'Low'}
                      />
                      <RiskFactorItem 
                        title={lang === 'bn' ? "চোষক পোকা (Sucking Pests)" : "Sucking Pests"} 
                        desc={lang === 'bn' ? "শুষ্ক ও গরম আবহাওয়া এফিড এবং জাব পোকার জন্য সহায়ক।" : "Dry and hot weather promotes aphids and thrips population growth."} 
                        icon="🦟" 
                        risk={weather.temp > 30 && weather.humidity < 60 ? 'High' : 'Low'}
                      />
                   </ul>
                </div>
             </div>
           )}

           {/* Tab Content: Spraying Guide (Enhanced) */}
           {activeTab === 'spraying' && (
             <div className="space-y-8 animate-fade-in">
                <div className={`bg-white rounded-[4rem] p-12 md:p-16 shadow-2xl border-t-[24px] border-${spray.color === 'emerald' ? 'green' : spray.color === 'amber' ? 'amber' : 'red'}-600 text-center space-y-10 relative overflow-hidden group`}>
                   <div className={`absolute top-0 right-0 w-48 h-48 bg-${spray.color === 'emerald' ? 'green' : spray.color === 'amber' ? 'amber' : 'red'}-50 rounded-full -mr-24 -mt-24 opacity-60 group-hover:scale-110 transition-transform duration-1000`}></div>
                   <div className={`w-40 h-40 rounded-[3rem] bg-${spray.color === 'emerald' ? 'green' : spray.color === 'amber' ? 'amber' : 'red'}-50 flex items-center justify-center text-8xl shadow-inner mx-auto group-hover:scale-110 transition-transform`}>
                      {spray.color === 'emerald' ? '✅' : spray.color === 'amber' ? '⚠️' : '❌'}
                   </div>
                   <div className="relative z-10">
                      <p className="text-[11px] font-black uppercase text-slate-400 tracking-[0.2em] mb-4">{lang === 'bn' ? 'রিয়েল-টাইম স্প্রে সিদ্ধান্ত' : 'Real-Time Spray Decision'}</p>
                      <h3 className={`text-5xl font-black leading-none mb-6 text-${spray.color === 'emerald' ? 'green' : spray.color === 'amber' ? 'amber' : 'red'}-700`}>{spray.status}</h3>
                      <p className="text-xl font-bold text-slate-500 max-w-md mx-auto leading-relaxed">{spray.desc}</p>
                   </div>
                </div>
             </div>
           )}
        </div>
      )}
    </div>
  );
};

const AgriMetricItem = ({ label, val, unit, icon }: any) => (
  <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col items-center text-center group hover:shadow-xl hover:border-blue-200 transition-all">
     <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-2xl mb-4 shadow-inner group-hover:scale-110 transition-transform">{icon}</div>
     <p className="text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest leading-none">{label}</p>
     <p className="text-2xl font-black text-slate-800 leading-none">{val}<span className="text-[10px] ml-1 opacity-30 font-bold">{unit}</span></p>
  </div>
);

const RiskFactorItem = ({ title, desc, icon, risk }: any) => (
  <li className={`p-6 rounded-[2rem] border transition-all flex items-start space-x-5 ${risk === 'High' ? 'bg-rose-50 border-rose-100' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
     <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-3xl shadow-sm shrink-0">{icon}</div>
     <div className="flex-1">
        <div className="flex justify-between items-center mb-1">
           <h4 className="font-black text-slate-800 text-lg">{title}</h4>
           <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${risk === 'High' ? 'bg-rose-600 text-white animate-pulse' : 'bg-slate-200 text-slate-400'}`}>
             {risk} Risk
           </span>
        </div>
        <p className="text-sm font-medium text-slate-500 leading-relaxed">{desc}</p>
     </div>
  </li>
);

export default Weather;
