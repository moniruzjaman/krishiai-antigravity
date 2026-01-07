
import React, { useState, useEffect } from 'react';
import { getLiveWeather } from '../services/geminiService';
// Fix: Import Language type and WeatherData to ensure correct typing for API calls and state
import { WeatherData, Language } from '../types';
import { getStoredLocation, saveStoredLocation } from '../services/locationService';

const toBanglaNumber = (val: any) => {
  if (val === null || val === undefined) return '';
  const banglaNumbers: Record<string, string> = {
    '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪', '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯', '.': '.'
  };
  return val.toString().replace(/[0-9.]/g, (w: string) => banglaNumbers[w]);
};

const WEATHER_CACHE_KEY = 'agritech_weather_cache';
const WEATHER_TIMESTAMP_KEY = 'agritech_weather_last_update';
const ONE_HOUR_MS = 3600000;

// Fix: Use imported Language type for props to resolve assignability error when passing to getLiveWeather
export const WeatherHorizontal: React.FC<{ lang?: Language }> = ({ lang = 'bn' }) => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
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
          // Fix: Ensure lang is treated as the correct Language type when passed to getLiveWeather (Error on line 56 fixed)
          const data = await getLiveWeather(latitude, longitude, force, lang as Language);
          setWeather(data);
          localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(data));
          localStorage.setItem(WEATHER_TIMESTAMP_KEY, Date.now().toString());
        } catch (err) {
          console.error("Home weather error:", err);
        } finally { setIsLoading(false); }
      }, () => setIsLoading(false), { timeout: 10000 });
    } else {
      setIsLoading(false);
    }
  };

  if (isLoading && !weather) {
    return (
      <div className="max-w-7xl mx-auto px-4 -mt-12 relative z-[70]">
        <div className="bg-white/95 backdrop-blur-xl rounded-[2.5rem] p-6 shadow-2xl border border-white flex items-center justify-center space-x-4 h-24">
          <div className="w-6 h-6 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-black text-slate-500 uppercase tracking-widest">{lang === 'bn' ? 'আবহাওয়া সিঙ্ক হচ্ছে...' : 'Syncing Weather...'}</span>
        </div>
      </div>
    );
  }

  if (!weather) return null;

  const isSprayingSafe = weather.windSpeed <= 12 && weather.rainProbability < 25;
  const hasHighRisk = weather.diseaseRisk?.includes('উচ্চ') || weather.diseaseRisk?.toLowerCase().includes('high');

  return (
    <div id="weather-horizontal-widget" className="max-w-7xl mx-auto px-4 -mt-12 relative z-[70] animate-fade-in">
      <div className="bg-white rounded-[3rem] p-6 md:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-white flex flex-col xl:flex-row items-center justify-between gap-8 relative overflow-hidden group">
        
        {/* Main Temperature Section */}
        <div className="flex items-center space-x-6 flex-shrink-0 relative z-10 w-full xl:w-auto">
          <div className="relative">
             <div className="text-6xl drop-shadow-md transform transition-transform group-hover:scale-110 duration-700 animate-pulse">
               {weather.condition?.includes('রোদ্র') ? "☀️" : weather.condition?.includes('বৃষ্টি') ? "🌧️" : "⛅"}
             </div>
             <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white shadow-sm"></div>
          </div>
          <div className="flex-1">
            <div className="flex items-baseline space-x-2">
              <span className="text-6xl font-black text-slate-800 tracking-tighter leading-none">{lang === 'bn' ? toBanglaNumber(weather.temp) : weather.temp}°</span>
              <div className="flex flex-col">
                 <span className="text-base font-black text-emerald-600 uppercase leading-none tracking-tight">{weather.condition}</span>
                 <span className="text-[8px] font-black text-white bg-blue-600 px-2 py-0.5 rounded-full mt-1.5 uppercase tracking-widest inline-flex items-center">
                    <span className="w-1.5 h-1.5 bg-white rounded-full mr-1 animate-pulse"></span>
                    BAMIS Integrated
                 </span>
              </div>
            </div>
            <div className="flex flex-col mt-3">
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center group/loc">
                <span className="mr-1">📍</span> {weather.upazila}, {weather.district}
                <button 
                  onClick={() => fetchWeather(true)} 
                  className={`ml-3 text-blue-500 hover:text-blue-700 transition-all ${isLoading ? 'animate-spin' : 'hover:scale-110'}`}
                >
                   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </button>
              </p>
            </div>
          </div>
        </div>

        {/* Actionable Agricultural Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 px-8 py-5 bg-slate-50/80 backdrop-blur-sm rounded-[2.2rem] border border-slate-100 flex-1 w-full relative z-10">
          <MetricItem label={lang === 'bn' ? "আর্দ্রতা" : "Humidity"} val={lang === 'bn' ? toBanglaNumber(weather.humidity) : weather.humidity} unit="%" icon="💧" />
          <MetricItem label={lang === 'bn' ? "বৃষ্টি" : "Rain"} val={lang === 'bn' ? toBanglaNumber(weather.rainProbability) : weather.rainProbability} unit="%" icon="☔" />
          <MetricItem label={lang === 'bn' ? "মাটির তাপ" : "Soil Temp"} val={lang === 'bn' ? toBanglaNumber(weather.soilTemperature || "২৩") : "23"} unit="°C" icon="🏺" />
          
          {/* Enhanced Disease Risk Alert Area */}
          <div className={`col-span-2 flex flex-col items-center md:items-start group/risk p-3 rounded-2xl border transition-all duration-500 ${hasHighRisk ? 'bg-rose-50 border-rose-100 shadow-[0_0_20px_rgba(225,29,72,0.1)]' : 'bg-white/40 border-white/60 shadow-sm'}`}>
             <div className="flex items-center space-x-2 mb-1.5">
                <span className={`text-base ${hasHighRisk ? 'animate-bounce' : 'animate-pulse'}`}>🦠</span>
                <p className={`text-[9px] font-black uppercase tracking-widest ${hasHighRisk ? 'text-rose-600' : 'text-slate-400'}`}>
                   {lang === 'bn' ? 'রোগের ঝুঁকি (BAMIS)' : 'Disease Risk Alert'}
                </p>
             </div>
             <p className={`text-sm font-black leading-tight ${hasHighRisk ? 'text-rose-700' : 'text-slate-800'}`}>
                {weather.diseaseRisk || (lang === 'bn' ? "ঝুঁকি নেই" : "No active risk")}
             </p>
             {hasHighRisk && (
                <span className="text-[7px] font-bold text-rose-500 mt-1 uppercase tracking-tighter animate-pulse">প্রতিরোধমূলক ব্যবস্থা নিন</span>
             )}
          </div>
        </div>

        {/* Spray Guide CTA */}
        <div className={`flex items-center space-x-5 px-10 py-5 rounded-[2.5rem] border-2 transition-all duration-700 w-full xl:w-auto relative z-10 shadow-sm ${isSprayingSafe ? 'bg-emerald-50 border-emerald-100 shadow-emerald-200/20' : 'bg-rose-50 border-rose-100 shadow-rose-200/20'}`}>
           <div className={`w-14 h-14 rounded-[1.5rem] flex items-center justify-center text-4xl shadow-inner bg-white ${isSprayingSafe ? 'text-emerald-600' : 'text-rose-600'}`}>
              {isSprayingSafe ? "✅" : "⚠️"}
           </div>
           <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] leading-none mb-2 text-slate-400">{lang === 'bn' ? 'স্প্রে সতর্কতা' : 'Spray Alert'}</p>
              <p className={`text-sm font-black uppercase ${isSprayingSafe ? 'text-emerald-700' : 'text-rose-700'}`}>
                 {isSprayingSafe ? (lang === 'bn' ? "আদর্শ সময়" : "Safe Now") : (lang === 'bn' ? "এখন ঝুঁকি আছে" : "High Risk")}
              </p>
           </div>
        </div>
      </div>
    </div>
  );
};

const MetricItem = ({ label, val, unit, icon }: any) => (
  <div className="flex flex-col items-center md:items-start group/m">
    <div className="flex items-center space-x-2 mb-1.5">
       <span className="text-base group-hover/m:scale-125 transition-transform">{icon}</span>
       <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
    </div>
    <p className="text-xl font-black text-slate-800 leading-none">
       {val}<span className="text-[10px] ml-0.5 opacity-30 font-bold uppercase">{unit}</span>
    </p>
  </div>
);
