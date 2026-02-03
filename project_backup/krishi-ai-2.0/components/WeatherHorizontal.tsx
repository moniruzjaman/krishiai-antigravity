
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
export const WeatherHorizontal: React.FC<{ lang?: Language, onNavigate?: (view: any) => void }> = ({ lang = 'bn', onNavigate }) => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    (window as any).weatherMounted = true;
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadInitialWeather();
    const weatherUpdateTimer = setInterval(() => { fetchWeather(true); }, ONE_HOUR_MS);
    return () => clearInterval(weatherUpdateTimer);
  }, []);

  const loadInitialWeather = async () => {
    try {
      const cachedData = localStorage.getItem(WEATHER_CACHE_KEY);
      const lastUpdate = localStorage.getItem(WEATHER_TIMESTAMP_KEY);
      const now = Date.now();
      if (cachedData && lastUpdate && (now - parseInt(lastUpdate) < ONE_HOUR_MS)) {
        setWeather(JSON.parse(cachedData));
      } else {
        fetchWeather(false);
      }
    } catch (e) {
      console.warn("Weather storage error:", e);
      fetchWeather(false);
    }
  };

  const fetchWeather = async (force: boolean = false) => {
    setIsLoading(true);
    setHasError(false);

    // Strategy: Fetch default weather immediately so the user isn't stuck waiting for geolocation
    await fetchDefaultWeather(force);
    setIsLoading(false); // Stop pulse as soon as we have default data

    const hasPermission = localStorage.getItem('agritech_permissions_granted') === 'true';

    if (navigator.geolocation && hasPermission) {
      navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude } = position.coords;
        saveStoredLocation(latitude, longitude);
        // "Upgrade" the weather to localized data - optionally show a small spinner instead of full pulse
        await performWeatherFetch(latitude, longitude, force);
      }, (error) => {
        console.warn("Geolocation upgrade skipped:", error.message);
      }, { timeout: 5000 });
    }
  };

  const performWeatherFetch = async (lat: number, lng: number, force: boolean) => {
    try {
      const data = await getLiveWeather(lat, lng, force, lang as Language);
      setWeather(data);
      setHasError(false);
      localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(data));
      localStorage.setItem(WEATHER_TIMESTAMP_KEY, Date.now().toString());
    } catch (err) {
      console.error("Home weather fetch error:", err);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDefaultWeather = async (force: boolean = false) => {
    // Default to Dhaka coordinates or similar if geolocation is unavailable
    try {
      const data = await getLiveWeather(23.8103, 90.4125, force, lang as Language);
      setWeather(data);
      setHasError(false);
    } catch (e) {
      console.error("Default weather error:", e);
      setHasError(true);
    }
  };

  if (!weather) {
    if (isLoading) {
      return (
        <div id="weather-horizontal-widget" className="relative z-[100] animate-pulse">
          <div className="bg-blue-50/50 rounded-[3rem] p-12 shadow-2xl border-4 border-blue-200/50 flex flex-col items-center justify-center space-y-4">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-blue-100 rounded-full animate-bounce"></div>
              <div className="space-y-3">
                <div className="w-32 h-6 bg-blue-100 rounded-lg"></div>
                <div className="w-48 h-4 bg-blue-50/80 rounded"></div>
              </div>
            </div>
            <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">{lang === 'bn' ? 'আবহাওয়া অনুসন্ধান করা হচ্ছে...' : 'Sychronizing Scientific Weather...'}</p>
          </div>
        </div>
      );
    }
    return (
      <div id="weather-horizontal-widget" className="relative z-10 animate-fade-in">
        <div className="bg-white rounded-[3rem] p-6 shadow-xl border border-rose-100 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <span className="text-3xl">📡</span>
            <div>
              <p className="text-xs font-black text-slate-800">{lang === 'bn' ? 'আবহাওয়া লোড করা যাচ্ছে না' : 'Weather Sync Failed'}</p>
              <button onClick={() => fetchWeather(true)} className="text-[10px] font-black text-blue-600 uppercase">পুনরায় চেষ্টা করুন (Retry)</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isSprayingSafe = weather.windSpeed <= 12 && weather.rainProbability < 25;
  const hasHighRisk = weather.diseaseRisk?.includes('উচ্চ') || weather.diseaseRisk?.toLowerCase().includes('high');

  const getMicroAdvisory = () => {
    if (weather.humidity > 90) return lang === 'bn' ? "অতিরিক্ত আর্দ্রতা: ছত্রাকজনিত রোগের ঝুঁকি বেশি।" : "High Humidity: Elevated fungal risk detected.";
    if (weather.temp > 35) return lang === 'bn' ? "তীব্র তাপ: সেচের প্রয়োজন হতে পারে।" : "High Heat: Immediate irrigation may be required.";
    if (weather.rainProbability > 60) return lang === 'bn' ? "বৃষ্টির সম্ভাবনা: ফসল কাটা থেকে বিরত থাকুন।" : "Rain Expected: Postpone harvesting activities.";
    return lang === 'bn' ? "আবহাওয়া বর্তমানে স্থিতিশীল আছে।" : "Weather conditions are currently stable.";
  };

  const getFallbackIcon = () => {
    const cond = weather.condition?.toLowerCase() || '';
    if (cond.includes('sun') || cond.includes('রোদ্র')) return "☀️";
    if (cond.includes('rain') || cond.includes('বৃষ্টি')) return "🌧️";
    if (cond.includes('cloud') || cond.includes('মেঘ')) return "⛅";
    return "🌤️";
  };

  return (
    <div id="weather-horizontal-widget" className="relative z-10 animate-fade-in group">
      <div className="bg-white rounded-[3rem] p-6 md:p-8 shadow-[0_30px_60px_-12px_rgba(0,0,0,0.15)] border border-white flex flex-col xl:flex-row items-center justify-between gap-8 relative overflow-hidden">
        {/* Invisible anchor to ensure space is reserved */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/10 to-transparent"></div>

        {/* Main Temperature Section */}
        <div className="flex items-center space-x-6 flex-shrink-0 relative z-10 w-full xl:w-auto">
          <div className="relative">
            <div className="text-6xl drop-shadow-md transform transition-transform group-hover:scale-110 duration-700 animate-pulse">
              {getFallbackIcon()}
            </div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white shadow-sm"></div>
          </div>
          <div className="flex-1">
            <div className="flex items-baseline space-x-2">
              <span className="text-6xl font-black text-slate-800 tracking-tighter leading-none">{lang === 'bn' ? toBanglaNumber(weather.temp || 25) : (weather.temp || 25)}°</span>
              <div className="flex flex-col">
                <span className="text-base font-black text-emerald-600 uppercase leading-none tracking-tight">{weather.condition || (lang === 'bn' ? 'পরিষ্কার' : 'Clear')}</span>
                <span className="text-[8px] font-black text-white bg-blue-600 px-3 py-1 rounded-full mt-1.5 uppercase tracking-widest inline-flex items-center shadow-lg shadow-blue-200">
                  <span className="w-1.5 h-1.5 bg-white rounded-full mr-1.5 animate-ping"></span>
                  Official Scientific Sync
                </span>
              </div>
            </div>
            <div className="flex flex-col mt-3">
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center group/loc">
                <span className="mr-1">📍</span> {weather.upazila || (lang === 'bn' ? 'ঢাকা' : 'Dhaka')}, {weather.district || (lang === 'bn' ? 'বাংলাদেশ' : 'Bangladesh')}
                <button
                  onClick={() => fetchWeather(true)}
                  className={`ml-3 text-blue-500 hover:text-blue-700 transition-all ${isLoading ? 'animate-spin' : 'hover:scale-110'}`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </button>
              </p>
            </div>
          </div>
          {onNavigate && (
            <button
              onClick={() => onNavigate('WEATHER')}
              className="mt-4 xl:mt-0 xl:ml-auto p-4 bg-blue-50 text-blue-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all active:scale-95 shadow-sm whitespace-nowrap"
            >
              {lang === 'bn' ? 'বিস্তারিত আবহাওয়া' : 'Full Forecast'} →
            </button>
          )}
        </div>

        {/* Actionable Agricultural Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 px-8 py-5 bg-slate-50/80 backdrop-blur-sm rounded-[2.2rem] border border-slate-100 flex-1 w-full relative z-10">
          <MetricItem label={lang === 'bn' ? "আর্দ্রতা" : "Humidity"} val={lang === 'bn' ? toBanglaNumber(weather.humidity) : weather.humidity} unit="%" icon="💧" />
          <MetricItem label={lang === 'bn' ? "বৃষ্টি" : "Rain"} val={lang === 'bn' ? toBanglaNumber(weather.rainProbability) : weather.rainProbability} unit="%" icon="☔" />

          {/* AI Scientific Advisory */}
          <div className="col-span-1 hidden md:flex flex-col items-center md:items-start p-3 bg-white/40 rounded-2xl border border-white/60 shadow-sm">
            <p className="text-[8px] font-black text-blue-500 uppercase tracking-widest mb-1 flex items-center">
              <span className="mr-1">🧠</span> {lang === 'bn' ? 'এআই টিপস' : 'AI Advice'}
            </p>
            <p className="text-[10px] font-bold text-slate-600 leading-tight line-clamp-2">
              {getMicroAdvisory()}
            </p>
          </div>

          {/* Enhanced Disease Risk Alert Area */}
          <div className={`col-span-2 flex flex-col items-center md:items-start group/risk p-3 rounded-2xl border transition-all duration-500 ${hasHighRisk ? 'bg-rose-50 border-rose-200 shadow-[0_0_25px_rgba(225,29,72,0.15)] animate-pulse' : 'bg-white/40 border-white/60 shadow-sm'}`}>
            <div className="flex items-center space-x-2 mb-1.5">
              <span className={`text-base ${hasHighRisk ? 'animate-bounce' : 'animate-pulse'}`}>🦠</span>
              <p className={`text-[9px] font-black uppercase tracking-widest ${hasHighRisk ? 'text-rose-600' : 'text-slate-400'}`}>
                {lang === 'bn' ? 'সায়েন্টিফিক ঝুঁকি (BAMIS)' : 'Scientific Risk Alert'}
              </p>
            </div>
            <p className={`text-sm font-black leading-tight ${hasHighRisk ? 'text-rose-700' : 'text-slate-800'}`}>
              {weather.diseaseRisk || (lang === 'bn' ? "কোনো প্যাথলজিকাল ঝুঁকি নেই" : "No pathological risk identified")}
            </p>
            {hasHighRisk && (
              <span className="text-[7px] font-black text-rose-500 mt-1 uppercase tracking-[0.2em] animate-ping">{lang === 'bn' ? 'প্রতিরোধমূলক ব্যবস্থা নিন' : 'Take Preventive Action'}</span>
            )}
          </div>
        </div>

        {/* Spray Guide CTA */}
        <div className={`flex items-center space-x-5 px-10 py-5 rounded-[2.5rem] border-2 transition-all duration-700 w-full xl:w-auto relative z-10 shadow-sm ${isSprayingSafe ? 'bg-emerald-50 border-emerald-100 shadow-emerald-200/20' : 'bg-rose-50 border-rose-100 shadow-rose-200/20'}`}>
          <div className={`w-14 h-14 rounded-[1.5rem] flex items-center justify-center text-4xl shadow-inner bg-white ${isSprayingSafe ? 'text-emerald-600' : 'text-rose-600'}`}>
            {isSprayingSafe ? "✅" : "⚠️"}
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] leading-none mb-2 text-slate-400">{lang === 'bn' ? 'স্প্রে সিদ্ধান্ত' : 'Spray Decision'}</p>
            <p className={`text-sm font-black uppercase ${isSprayingSafe ? 'text-emerald-700' : 'text-rose-700'}`}>
              {isSprayingSafe ? (lang === 'bn' ? "নিরাপদ সময়" : "Safe Now") : (lang === 'bn' ? "অনিরাপদ সময়" : "High Risk")}
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
