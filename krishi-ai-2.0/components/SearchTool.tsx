
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { searchAgriculturalInfo, generateSpeech, decodeBase64, decodeAudioData } from '../services/geminiService';
import { GroundingChunk, SavedReport } from '../types';
import { COMMODITIES_DATA } from '../constants';
import { Logo } from './Logo';
import ShareDialog from './ShareDialog';

interface SearchToolProps {
  onAction?: () => void;
  onSaveReport?: (report: Omit<SavedReport, 'id' | 'timestamp'>) => void;
  onShowFeedback?: () => void;
  onBack?: () => void;
}

const DISTRICTS = ['ঢাকা', 'চট্টগ্রাম', 'রাজশাহী', 'খুলনা', 'সিলেট', 'বরিশাল', 'রংপুর', 'ময়মনসিংহ'];
const CATEGORIES = ['সব', 'সবজি', 'শস্য', 'মসলা', 'ডাল', 'তেল', 'পোল্ট্রি', 'মাংস'];

const aiSearchLoadingSteps = [
  "সর্বশেষ বাজার দর অনুসন্ধান করা হচ্ছে...",
  "বিএআরসি (BARC) এবং ড্যাম (DAM) পোর্টাল থেকে তথ্য নেওয়া হচ্ছে...",
  "আঞ্চলিক চাহিদাও সরবরাহের ডাটা বিশ্লেষণ চলছে...",
  "বাজার প্রবণতা (Trends) এবং ভবিষ্যৎ পূর্বাভাস যাচাই হচ্ছে...",
  "সঠিক তথ্য সম্বলিত রিপোর্ট তৈরি করা হচ্ছে..."
];

const toBanglaNumber = (val: any) => {
  if (val === null || val === undefined) return '';
  const banglaNumbers: Record<string, string> = {
    '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪', '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯'
  };
  return val.toString().replace(/[0-9]/g, (w: string) => banglaNumbers[w]);
};

const SearchTool: React.FC<SearchToolProps> = ({ onAction, onSaveReport, onShowFeedback, onBack }) => {
  const [activeMode, setActiveMode] = useState<'market' | 'ai'>('market');
  const [query, setQuery] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('ঢাকা');
  const [selectedCategory, setSelectedCategory] = useState('সব');
  const [results, setResults] = useState<{ text: string, groundingChunks: GroundingChunk[] } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const today = currentTime.toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = currentTime.toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' });

  useEffect(() => {
    let interval: any;
    if (isLoading && activeMode === 'ai') {
      interval = setInterval(() => {
        setLoadingStep(prev => (prev + 1) % aiSearchLoadingSteps.length);
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [isLoading, activeMode]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.lang = 'bn-BD';
      recognitionRef.current.onstart = () => setIsListening(true);
      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setQuery(transcript);
        setIsListening(false);
      };
      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) return alert("Browser does not support voice.");
    isListening ? recognitionRef.current.stop() : recognitionRef.current.start();
  };

  const filteredItems = useMemo(() => {
    return COMMODITIES_DATA.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(query.toLowerCase());
      const matchesCategory = selectedCategory === 'সব' || item.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [query, selectedCategory]);

  const handleAIQuery = async () => {
    if (!query.trim()) return;
    setIsLoading(true);
    setActiveMode('ai');
    setResults(null);
    setLoadingStep(0);

    if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
    }

    try {
      const data = await searchAgriculturalInfo(query);
      setResults(data);
      
      if (data.text) {
        playTTS(data.text);
      }

      if (onAction) onAction();
      if (onShowFeedback) onShowFeedback();
    } catch (error) {
      alert("AI তথ্য অনুসন্ধানে সমস্যা হয়েছে।");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (results && onSaveReport) {
      setIsSaving(true);
      try {
        const audioBase64 = await generateSpeech(results.text.replace(/[*#_~]/g, ''));
        onSaveReport({
          type: 'Search',
          title: query ? `সার্চ: ${query}` : 'কৃষি তথ্য রিপোর্ট',
          content: results.text,
          audioBase64,
          icon: '🔍'
        });
        alert("অডিওসহ রিপোর্টটি প্রোফাইলে সেভ হয়েছে!");
      } catch (e) {
        onSaveReport({
          type: 'Search',
          title: query ? `সার্চ: ${query}` : 'কৃষি তথ্য রিপোর্ট',
          content: results.text,
          icon: '🔍'
        });
        alert("রিপোর্ট সেভ হয়েছে (অডিও ফাইল ছাড়াই)");
      } finally {
        setIsSaving(false);
      }
    }
  };

  const playTTS = async (textOverride?: string) => {
    const textToSpeak = textOverride || results?.text;
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

  const navigateToFAQ = () => {
    window.dispatchEvent(new CustomEvent('agritech_navigate', { detail: 'FAQ' }));
  };

  return (
    <div className="max-w-4xl mx-auto p-4 pb-32 font-sans animate-fade-in bg-slate-50 min-h-screen">
      {isShareOpen && results && (
        <ShareDialog 
          isOpen={isShareOpen} 
          onClose={() => setIsShareOpen(false)} 
          title={`Market Insight: ${query}`} 
          content={results.text} 
        />
      )}

      <div className="bg-[#0A8A1F] -mx-4 -mt-4 p-8 text-white rounded-b-[3.5rem] shadow-xl mb-8 border-b-8 border-green-700/20">
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center space-x-3">
             <button onClick={() => { onBack?.(); stopTTS(); }} className="p-2 bg-white/10 rounded-xl hover:bg-white/20 transition-all">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7m0 0l7-7m-7 7h18" /></svg>
             </button>
             <div>
                <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center leading-none">
                  <span className="bg-white text-[#0A8A1F] px-2 py-0.5 rounded-lg mr-2 text-sm md:text-base">DAM</span>
                  দৈনিক বাজার দর
                </h1>
                <p className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] opacity-70 mt-1">উৎস: dam.gov.bd • {selectedDistrict} • {today} • {timeStr}</p>
             </div>
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={navigateToFAQ} className="bg-white/10 hover:bg-white/20 rounded-2xl transition-all border border-white/20 p-1" title="সাহায্য নিন">
              <Logo size="sm" variant="info" />
            </button>
            <button 
              onClick={() => {setIsLoading(true); setTimeout(()=>setIsLoading(false), 800);}}
              className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-all active:scale-90"
            >
              <svg className={`w-6 h-6 ${isLoading && activeMode === 'market' ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="relative group">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="পণ্য বা তথ্য খুঁজুন (যেমন: ধান, সার, ইউরিয়া...)"
              className="w-full bg-white border-none rounded-2xl px-12 py-4 focus:ring-4 focus:ring-green-400 outline-none font-bold text-gray-800 text-lg shadow-2xl transition-all"
              onKeyDown={(e) => e.key === 'Enter' && (activeMode === 'ai' ? handleAIQuery() : null)}
            />
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#0A8A1F]">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            <button 
              onClick={toggleListening}
              className={`absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-xl transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-100 text-slate-400 hover:text-[#0A8A1F]'}`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
            </button>
          </div>
          
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-xl shrink-0 border border-white/10">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
              <select 
                className="bg-transparent border-none outline-none text-xs font-black cursor-pointer appearance-none"
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
              >
                {DISTRICTS.map(d => <option key={d} value={d} className="text-gray-900">{d}</option>)}
              </select>
            </div>
            <button 
              onClick={() => { setActiveMode('market'); setResults(null); stopTTS(); }}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl shrink-0 font-black text-xs shadow-lg transition-all ${activeMode === 'market' ? 'bg-white text-[#0A8A1F]' : 'bg-white/10 text-white border border-white/10'}`}
            >
               বাজার তালিকা
            </button>
            <button 
              onClick={handleAIQuery}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl shrink-0 font-black text-xs shadow-lg transition-all ${activeMode === 'ai' ? 'bg-yellow-400 text-[#0A8A1F]' : 'bg-white/10 text-white border border-white/10'}`}
            >
               <span className="w-4 h-4 bg-white/40 rounded flex items-center justify-center text-[10px]">AI</span>
               তথ্য বিশেষজ্ঞ
            </button>
          </div>
        </div>
      </div>

      {activeMode === 'market' && (
        <div className="space-y-6 animate-fade-in px-2">
          <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide">
            {CATEGORIES.map(cat => (
              <button 
                key={cat} 
                onClick={() => setSelectedCategory(cat)}
                className={`px-6 py-2 rounded-xl whitespace-nowrap text-xs font-black transition-all ${selectedCategory === cat ? 'bg-[#0A8A1F] text-white shadow-md' : 'bg-white text-slate-400 border border-slate-100 hover:bg-slate-50'}`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {filteredItems.length > 0 ? filteredItems.map((item) => (
               <div key={item.id} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex items-center justify-between hover:shadow-xl transition-all group">
                  <div className="flex items-center space-x-5">
                     <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                        {item.category === 'সবজি' ? '🥦' : item.category === 'শস্য' ? '🌾' : item.category === 'মসলা' ? '🌶️' : item.category === 'ডাল' ? '🍲' : item.category === 'মাংস' ? '🥩' : '🛍️'}
                     </div>
                     <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{item.category}</p>
                        <h3 className="text-xl font-black text-slate-800 leading-none">{item.name}</h3>
                        <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase">পরিবর্তন: <span className={item.trend === 'up' ? 'text-rose-500' : 'text-emerald-500'}>{item.change}</span></p>
                     </div>
                  </div>
                  <div className="text-right">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">খুচরা মূল্য</p>
                     <p className="text-2xl font-black text-slate-900 leading-none">৳{toBanglaNumber(item.retail[0])}</p>
                     <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase">প্রতি {item.unit}</p>
                  </div>
               </div>
             )) : (
               <div className="col-span-full py-20 text-center bg-white rounded-[3rem] border-4 border-dashed border-slate-100 opacity-60">
                  <div className="text-6xl mb-6">🏜️</div>
                  <p className="font-black text-slate-400 uppercase tracking-widest">এই ক্যাটাগরিতে কোনো পণ্য পাওয়া যায়নি</p>
               </div>
             )}
          </div>
        </div>
      )}

      {activeMode === 'ai' && (
        <div className="space-y-6 animate-fade-in px-2">
           {isLoading ? (
             <div className="bg-white rounded-[3rem] p-12 text-center shadow-xl border border-slate-100 flex flex-col items-center space-y-6">
                <div className="relative w-20 h-20">
                   <div className="absolute inset-0 border-4 border-green-100 rounded-full"></div>
                   <div className="absolute inset-0 border-4 border-[#0A8A1F] border-t-transparent rounded-full animate-spin"></div>
                   <div className="absolute inset-0 flex items-center justify-center text-2xl">🤖</div>
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800">{aiSearchLoadingSteps[loadingStep]}</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">Connecting to Digital Agri-Market Intelligence</p>
                </div>
             </div>
           ) : results ? (
             <div className="bg-white rounded-[3.5rem] p-8 md:p-12 shadow-2xl border-t-[16px] border-[#0A8A1F] relative overflow-hidden flex flex-col">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 pb-8 border-b-2 border-slate-50 gap-8 relative z-10">
                   <div className="flex items-center space-x-6">
                      <div className="w-16 h-16 bg-[#0A8A1F] text-white rounded-[1.8rem] flex items-center justify-center text-3xl shadow-xl">✨</div>
                      <div>
                        <h3 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter leading-none mb-1">এআই বাজার বিশেষজ্ঞ</h3>
                        <p className="text-[10px] font-black uppercase text-emerald-600">Verified Advisory • Grounds Found</p>
                      </div>
                   </div>
                   <div className="flex items-center space-x-2">
                      <button onClick={() => setIsShareOpen(true)} className="p-5 rounded-full bg-white text-emerald-600 border border-emerald-100 shadow-xl hover:bg-emerald-50 transition-all active:scale-90">
                         <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                      </button>
                      <button onClick={handleSave} disabled={isSaving} className="p-5 rounded-full bg-slate-900 text-white shadow-xl hover:bg-slate-800 transition-all active:scale-90 disabled:opacity-50">
                         {isSaving ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 5h14m-14 0v14l7-7 7 7V5m-14 0h14" /></svg>}
                      </button>
                      <button onClick={() => playTTS()} className={`p-5 rounded-full shadow-2xl transition-all active:scale-90 ${isPlaying ? 'bg-rose-500 text-white animate-pulse' : 'bg-[#0A8A1F] text-white'}`}>
                        {isPlaying ? <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 9v6m4-6v6" /></svg> : <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>}
                      </button>
                   </div>
                </div>
                
                <div className="flex-1 prose prose-slate max-w-none text-slate-800 whitespace-pre-wrap leading-[1.8] font-medium text-lg md:text-xl first-letter:text-7xl first-letter:font-black first-letter:text-[#0A8A1F] first-letter:float-left first-letter:mr-4 first-letter:leading-none">
                  {results.text}
                </div>

                {results.groundingChunks && results.groundingChunks.length > 0 && (
                  <div className="mt-12 pt-8 border-t-2 border-dashed border-slate-100">
                     <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6">যাচাইকৃত তথ্যসূত্র (Grounds):</h4>
                     <div className="flex flex-wrap gap-2">
                       {results.groundingChunks.map((chunk, idx) => chunk.web ? (
                         <a key={idx} href={chunk.web.uri} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-4 py-2 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black border border-blue-100 hover:bg-blue-100 transition shadow-sm">
                           <svg className="w-3 h-3 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                           {chunk.web.title}
                         </a>
                       ) : null)}
                     </div>
                  </div>
                )}
             </div>
           ) : (
             <div className="bg-white rounded-[3.5rem] p-16 text-center space-y-8 border border-slate-100 shadow-xl opacity-60">
                <div className="text-7xl">🔍</div>
                <div className="max-w-xs mx-auto">
                   <h3 className="text-xl font-black text-slate-800 mb-2">এআই বিশেষজ্ঞ অনুসন্ধান</h3>
                   <p className="text-sm font-medium text-slate-400">উপরে আপনার প্রশ্ন লিখে সার্চ করুন। যেমন: "ধানে এই সপ্তাহের বাজার প্রবণতা কী?"</p>
                </div>
             </div>
           )}
        </div>
      )}
    </div>
  );
};

export default SearchTool;
