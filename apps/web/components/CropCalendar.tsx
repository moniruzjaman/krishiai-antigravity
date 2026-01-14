
import React, { useState, useEffect, useRef } from 'react';
import { User, UserCrop, SavedReport, AgriTask } from '../types';
import { AGRI_SEASONS } from '../constants';
import { getPersonalizedAgriAdvice, generateSpeech, decodeBase64, decodeAudioData } from '../services/geminiService';

interface CropCalendarProps {
  onBack?: () => void;
  user: User;
  onAction?: () => void;
  onSaveReport?: (report: Omit<SavedReport, 'id' | 'timestamp'>) => void;
  onShowFeedback?: () => void;
}

const calendarLoadingSteps = [
  "আপনার খামারের শস্যের প্রোফাইল চেক করা হচ্ছে...",
  "বর্তমান ঋতু এবং আবহাওয়ার উপাত্ত সংগ্রহ হচ্ছে...",
  "গবেষণা প্রতিষ্ঠানগুলোর (BRRI/BARI) চাষাবাদ পঞ্জিকা যাচাই হচ্ছে...",
  "আপনার জন্য বিশেষায়িত চাষ নির্দেশিকা প্রস্তুত হচ্ছে...",
  "ঋতুভিত্তিক পরামর্শ সমন্বয় করা হচ্ছে..."
];

const CropCalendar: React.FC<CropCalendarProps> = ({ user, onAction, onSaveReport, onShowFeedback, onBack }) => {
  const [activeSeason, setActiveSeason] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [cropAdvices, setCropAdvices] = useState<Record<string, string>>({});
  const [isPlaying, setIsPlaying] = useState(false);
  const [reminders, setReminders] = useState<AgriTask[]>([]);
  const [showReminderModal, setShowReminderModal] = useState<{ title: string; category: string } | null>(null);
  const [reminderDate, setReminderDate] = useState(new Date().toISOString().split('T')[0]);
  const [reminderTime, setReminderTime] = useState('09:00');

  const audioContextRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const currentMonth = new Date().getMonth();
  const currentSeason = AGRI_SEASONS.find(s => s.months.includes(currentMonth)) || AGRI_SEASONS[0];

  useEffect(() => {
    setActiveSeason(currentSeason.id);
    loadReminders();
    requestNotificationPermission();
  }, []);

  const loadReminders = () => {
    const saved = localStorage.getItem('agritech_tasks');
    if (saved) {
      try {
        setReminders(JSON.parse(saved));
      } catch (e) {
        setReminders([]);
      }
    }
  };

  const requestNotificationPermission = () => {
    if ("Notification" in window) {
      Notification.requestPermission();
    }
  };

  useEffect(() => {
    let interval: any;
    if (isLoading) {
      interval = setInterval(() => {
        setLoadingStep(prev => (prev + 1) % calendarLoadingSteps.length);
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  const fetchDynamicSuggestions = async () => {
    if (user.myCrops.length === 0) return;
    setIsLoading(true);
    setLoadingStep(0);

    if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
    }

    try {
      const res = await getPersonalizedAgriAdvice(user.myCrops, user.progress.rank);
      setCropAdvices({ all: res });
      
      if (res) {
        playTTS(res);
      }

      if (onAction) onAction();
      if (onShowFeedback) onShowFeedback();
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const playTTS = async (textOverride?: string) => {
    const textToSpeak = textOverride || cropAdvices.all;
    if (!textToSpeak) return;

    if (isPlaying && !textOverride) { 
      stopTTS(); 
      return; 
    }

    try {
      stopTTS();
      setIsPlaying(true);
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') await ctx.resume();
      
      const cleanText = textToSpeak.replace(/[*#_~]/g, '');
      const base64Audio = await generateSpeech(cleanText);
      const audioData = decodeBase64(base64Audio);
      const audioBuffer = await decodeAudioData(audioData, ctx, 24000, 1);
      
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => setIsPlaying(false);
      currentSourceRef.current = source;
      source.start(0);
    } catch (error) {
      setIsPlaying(false);
    }
  };

  const stopTTS = () => {
    if (currentSourceRef.current) {
      currentSourceRef.current.stop();
      currentSourceRef.current = null;
    }
    setIsPlaying(false);
  };

  const getCropAge = (sowingDate: string) => {
    const start = new Date(sowingDate).getTime();
    const now = Date.now();
    return Math.floor((now - start) / (1000 * 60 * 60 * 24));
  };

  const handleSave = async () => {
    if (cropAdvices.all && onSaveReport) {
      setIsSaving(true);
      try {
        const audioBase64 = await generateSpeech(cropAdvices.all.replace(/[*#_~]/g, ''));
        onSaveReport({
          type: 'Seasonal Calendar',
          title: `${currentSeason.name} - চাষাবাদ পরিকল্পনা`,
          content: cropAdvices.all,
          audioBase64,
          icon: '🗓️'
        });
        alert("অডিওসহ রিপোর্টটি প্রোফাইলে সেভ হয়েছে!");
      } catch (e) {
        onSaveReport({
          type: 'Seasonal Calendar',
          title: `${currentSeason.name} - চাষাবাদ পরিকল্পনা`,
          content: cropAdvices.all,
          icon: '🗓️'
        });
        alert("রিপোর্ট সেভ হয়েছে (অডিও ফাইল ছাড়াই)");
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleSetReminder = () => {
    if (!showReminderModal) return;
    const newTask: AgriTask = {
      id: Math.random().toString(36).substr(2, 9),
      title: showReminderModal.title,
      dueDate: reminderDate,
      dueTime: reminderTime,
      completed: false,
      category: showReminderModal.category as any || 'other',
      notes: 'Calendar Reminder'
    };
    
    const updatedTasks = [newTask, ...reminders];
    setReminders(updatedTasks);
    localStorage.setItem('agritech_tasks', JSON.stringify(updatedTasks));
    setShowReminderModal(null);
    alert("রিমাইন্ডার সেট করা হয়েছে!");
  };

  return (
    <div className="max-w-4xl mx-auto p-4 pb-32 font-sans animate-fade-in min-h-screen bg-slate-50">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
        <div className="flex items-center space-x-4">
          <button onClick={() => { onBack ? onBack() : window.history.back(); stopTTS(); }} className="p-3 bg-white rounded-2xl shadow-sm border">
            <svg className="h-6 w-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </button>
          <div>
            <h1 className="text-3xl font-black text-gray-800 tracking-tighter">শস্য ক্যালেন্ডার</h1>
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-1">Dynamic Seasonal Planner</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
            <button 
              onClick={fetchDynamicSuggestions}
              disabled={isLoading || user.myCrops.length === 0}
              className="bg-emerald-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <span>✨ আপডেট পরামর্শ নিন</span>
            </button>
            {cropAdvices.all && (
              <button onClick={handleSave} disabled={isSaving} className="p-3 bg-white rounded-2xl shadow-sm border border-emerald-100 text-emerald-600 hover:bg-emerald-50 transition-all">
                {isSaving ? <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div> : <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>}
              </button>
            )}
        </div>
      </div>

      <div className="bg-white rounded-[3rem] p-8 md:p-12 shadow-xl border border-slate-100 relative overflow-hidden mb-8">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full -mr-32 -mt-32 opacity-40 blur-3xl"></div>
        <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
          <div className="w-32 h-32 bg-emerald-600 rounded-[2.5rem] flex flex-col items-center justify-center text-white shadow-2xl shrink-0">
             <span className="text-4xl mb-1">{activeSeason === 'rabi' ? '🌫️' : activeSeason === 'kharif1' ? '☀️' : '🌧️'}</span>
             <span className="text-[10px] font-black uppercase tracking-widest">{currentSeason.name.split(' ')[0]}</span>
          </div>
          <div className="text-center md:text-left flex-1">
             <h2 className="text-3xl font-black text-slate-800 mb-2">{currentSeason.name}</h2>
             <p className="text-lg font-medium text-slate-500 leading-relaxed max-w-md">{currentSeason.desc}</p>
             <div className="mt-6 flex flex-wrap justify-center md:justify-start gap-2">
                {currentSeason.suggestions.map((s, i) => (
                  <button 
                    key={i} 
                    onClick={() => setShowReminderModal({ title: s.title, category: s.category })}
                    className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full text-[10px] font-black border border-emerald-100 uppercase flex items-center space-x-2 hover:bg-emerald-600 hover:text-white transition-all group"
                  >
                    <span>{s.title}</span>
                    <span className="opacity-40 group-hover:opacity-100">🔔</span>
                  </button>
                ))}
             </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-8">
          {/* Active Crops Column */}
          <div className="space-y-6">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-2 flex justify-between">
              <span>আমার শস্যের প্রগতি</span>
              <span>Age (Days)</span>
            </h3>
            {user.myCrops.length > 0 ? (
              <div className="space-y-4">
                {user.myCrops.map(crop => {
                  const age = getCropAge(crop.sowingDate);
                  const percent = Math.min(100, (age / 120) * 100); 
                  return (
                    <div key={crop.id} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 group hover:shadow-lg transition-all">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                            <h4 className="font-black text-lg text-slate-800 leading-none mb-1">{crop.name}</h4>
                            <p className="text-[10px] font-black text-emerald-600 uppercase">{crop.variety}</p>
                        </div>
                        <span className="bg-slate-50 px-2 py-1 rounded-lg text-[10px] font-black text-slate-400">{toBanglaNumber(age)} দিন</span>
                      </div>
                      <div className="space-y-2">
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${percent}%` }}></div>
                        </div>
                        <div className="flex justify-between text-[8px] font-black text-slate-400 uppercase">
                            <span>বপন</span>
                            <span>বাড়ন্ত</span>
                            <span>পরিপক্ব</span>
                            <span>কর্তন</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white p-10 rounded-[2.5rem] border-4 border-dashed border-slate-100 text-center opacity-60">
                <p className="text-xs font-black text-slate-400 uppercase leading-relaxed">প্রোফাইল থেকে আপনার চাষকৃত শস্য যোগ করুন</p>
              </div>
            )}
          </div>

          {/* Active Reminders Column */}
          <div className="space-y-6">
             <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-2">সক্রিয় রিমাইন্ডার</h3>
             <div className="space-y-3">
                {reminders.filter(r => !r.completed).slice(0, 3).map(r => (
                  <div key={r.id} className="bg-white p-4 rounded-3xl border-l-4 border-blue-500 shadow-sm flex items-center justify-between">
                     <div className="flex items-center space-x-3">
                        <span className="text-xl">🔔</span>
                        <div>
                           <p className="text-xs font-black text-slate-800 truncate max-w-[120px]">{r.title}</p>
                           <p className="text-[9px] font-bold text-slate-400 uppercase">{r.dueDate}</p>
                        </div>
                     </div>
                     <span className="text-[8px] font-black bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full uppercase">Set</span>
                  </div>
                ))}
                {reminders.filter(r => !r.completed).length === 0 && (
                  <p className="text-[10px] text-slate-400 italic text-center py-4">কোনো আসন্ন রিমাইন্ডার নেই</p>
                )}
             </div>
          </div>
        </div>

        <div className="lg:col-span-8 space-y-6">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-2">এআই ক্যালেন্ডার ইনসাইট</h3>
          <div className="bg-slate-900 rounded-[3rem] p-8 md:p-12 text-white shadow-2xl relative overflow-hidden min-h-[500px] flex flex-col">
             <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl"></div>
             
             {isLoading ? (
                <div className="flex flex-col items-center justify-center flex-1 text-center space-y-10 animate-fade-in relative z-10">
                   <div className="relative w-28 h-28">
                      <div className="absolute inset-0 border-8 border-white/10 rounded-full"></div>
                      <div className="absolute inset-0 border-8 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                      <div className="absolute inset-0 flex items-center justify-center text-4xl">🗓️</div>
                   </div>
                   <div className="max-w-xs mx-auto">
                      <h4 className="text-2xl font-black mb-3">{calendarLoadingSteps[loadingStep]}</h4>
                      <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-[0.3em]">Harvesting Data from Scientific Repositories</p>
                   </div>
                </div>
             ) : !cropAdvices.all ? (
               <div className="flex flex-col items-center justify-center h-full py-20 text-center space-y-8 flex-1">
                  <div className="w-20 h-20 bg-white/10 rounded-[2rem] flex items-center justify-center text-4xl">🗓️</div>
                  <div className="max-w-xs">
                    <h4 className="text-xl font-black mb-2">আপনার সিজনাল প্ল্যান তৈরি করুন</h4>
                    <p className="text-sm text-slate-400 leading-relaxed font-medium">উপরে 'আপডেট পরামর্শ নিন' বাটন টিপে আপনার বর্তমান সিজন ও ফসলের ওপর ভিত্তি করে এআই গাইড জেনারেট করুন।</p>
                  </div>
               </div>
             ) : (
               <div className="animate-fade-in relative z-10">
                  <div className="flex items-center justify-between mb-8 pb-6 border-b border-white/10">
                     <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center text-2xl shadow-xl">✨</div>
                        <div>
                           <h4 className="text-xl font-black tracking-tight">আপনার ব্যক্তিগত ক্যালেন্ডার পরামর্শ</h4>
                           <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">{currentSeason.name} স্পেশাল</p>
                        </div>
                     </div>
                     <button onClick={() => playTTS()} className={`p-4 rounded-full shadow-2xl transition-all ${isPlaying ? 'bg-rose-500 animate-pulse' : 'bg-white text-emerald-600'}`}>
                        {isPlaying ? <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg> : <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>}
                     </button>
                  </div>
                  <div className="prose prose-invert max-w-none text-slate-300 font-medium leading-[1.8] whitespace-pre-wrap text-lg md:text-xl first-letter:text-5xl first-letter:font-black first-letter:text-emerald-500 first-letter:float-left first-letter:mr-3">
                    {cropAdvices.all}
                  </div>
               </div>
             )}
          </div>
        </div>
      </div>

      {/* Custom Reminder Modal */}
      {showReminderModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl space-y-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-blue-500"></div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-black text-slate-800 tracking-tight leading-none">রিমাইন্ডার সেট করুন</h3>
              <button onClick={() => setShowReminderModal(null)} className="p-2 bg-slate-50 rounded-xl text-slate-400">✕</button>
            </div>
            
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-center space-x-3">
                 <span className="text-2xl">🔔</span>
                 <p className="text-sm font-black text-blue-900 leading-tight">{showReminderModal.title}</p>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">তারিখ</label>
                <input 
                  type="date" 
                  value={reminderDate} 
                  onChange={(e) => setReminderDate(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold text-slate-700 outline-none focus:border-blue-500 shadow-inner"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">সময়</label>
                <input 
                  type="time" 
                  value={reminderTime} 
                  onChange={(e) => setReminderTime(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold text-slate-700 outline-none focus:border-blue-500 shadow-inner"
                />
              </div>

              <button 
                onClick={handleSetReminder}
                className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl shadow-xl active:scale-95 transition-all text-lg flex items-center justify-center space-x-3"
              >
                <span>সংরক্ষণ করুন</span>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const toBanglaNumber = (val: any) => {
  if (val === null || val === undefined) return '';
  const banglaNumbers: Record<string, string> = {
    '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪', '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯'
  };
  return val.toString().replace(/[0-9]/g, (w: string) => banglaNumbers[w]);
};

export default CropCalendar;
