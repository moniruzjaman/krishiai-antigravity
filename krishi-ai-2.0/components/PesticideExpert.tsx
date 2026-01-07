
import React, { useState, useEffect, useRef } from 'react';
import { 
  getPesticideExpertAdvice, 
  analyzePesticideMixing, 
  getPesticideRotationAdvice,
  generateSpeech, 
  getLiveWeather,
  requestPesticidePrecisionParameters,
  performDeepPesticideAudit,
  getAISprayAdvisory
} from '../services/geminiService';
import { View, GroundingChunk, WeatherData, SavedReport, Language } from '../types';
import { getStoredLocation } from '../services/locationService';
import DynamicPrecisionForm from './DynamicPrecisionForm';
import { useSpeech } from '../App';
import GuidedTour, { TourStep } from './GuidedTour';
import { ToolGuideHeader } from './ToolGuideHeader';

const PesticideExpert: React.FC<any> = ({ onBack, onAction, onSaveReport, lang }) => {
  const [activeTab, setActiveTab] = useState<'advisor' | 'search' | 'mixing' | 'rotation'>('advisor');
  const [query, setQuery] = useState('');
  const [sprayCrop, setSprayCrop] = useState('ধান');
  const [sprayPest, setSprayPest] = useState('');
  const [advice, setAdvice] = useState<{ text: string, groundingChunks: GroundingChunk[] } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [precisionFields, setPrecisionFields] = useState<any[] | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [activeListeningId, setActiveListeningId] = useState<string | null>(null);

  // Mixing State
  const [mixingItems, setMixingItems] = useState<{ id: string, text: string, data?: string, mimeType?: string }[]>([
    { id: '1', text: '' },
    { id: '2', text: '' }
  ]);
  const mixingFileRef = useRef<HTMLInputElement>(null);
  const [activeMixingId, setActiveMixingId] = useState<string | null>(null);

  const reportRef = useRef<HTMLDivElement>(null);
  const { playSpeech, stopSpeech, isSpeaking } = useSpeech();
  const recognitionRef = useRef<any>(null);

  const loadingMessages = [ "বালাইনাশক ডাটাবেস অনুসন্ধান করা হচ্ছে...", "আবহাওয়া প্রেক্ষাপট যাচাই হচ্ছে...", "DAE প্রটোকল বিশ্লেষণ চলছে..." ];

  useEffect(() => {
    let interval: any;
    if (isLoading) interval = setInterval(() => setLoadingStep(prev => (prev + 1) % loadingMessages.length), 2000);
    return () => clearInterval(interval);
  }, [isLoading]);

  useEffect(() => {
    const loadWeather = async () => {
      const loc = getStoredLocation();
      if (loc) {
        try {
          const data = await getLiveWeather(loc.lat, loc.lng);
          setWeather(data);
        } catch (e) {}
      }
    };
    loadWeather();

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.lang = lang === 'bn' ? 'bn-BD' : 'en-US';
      recognitionRef.current.onstart = () => setIsListening(true);
      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (activeListeningId === 'query') setQuery(transcript);
        if (activeListeningId === 'sprayPest') setSprayPest(transcript);
        if (activeListeningId === 'mixing') {
           setMixingItems(prev => prev.map(p => p.id === activeMixingId ? { ...p, text: transcript } : p));
        }
      };
      recognitionRef.current.onend = () => { setIsListening(false); setActiveListeningId(null); };
      recognitionRef.current.onerror = () => { setIsListening(false); setActiveListeningId(null); };
    }
  }, [lang, activeListeningId]);

  const toggleListening = (id: string, mId?: string) => {
    if (!recognitionRef.current) return alert("ভয়েস ইনপুট সমর্থিত নয়।");
    if (isListening && activeListeningId === id) recognitionRef.current.stop();
    else { 
      setActiveListeningId(id); 
      if (mId) setActiveMixingId(mId);
      recognitionRef.current.start(); 
    }
  };

  const handleSearchSubmit = async (precision: boolean = false) => {
    if (!query.trim()) return;
    setIsLoading(true); setAdvice(null);
    try {
      if (precision) {
        const fields = await requestPesticidePrecisionParameters(query, lang);
        setPrecisionFields(fields);
        setIsLoading(false);
      } else {
        const result = await getPesticideExpertAdvice(query, lang);
        setAdvice(result);
        if (result.text) playSpeech(result.text);
        if (onAction) onAction();
        setIsLoading(false);
      }
    } catch (err) { alert("Error fetching data."); setIsLoading(false); }
  };

  const handleSprayAdvisory = async () => {
    if (!sprayPest.trim() || !weather) return;
    setIsLoading(true); setAdvice(null);
    try {
      const result = await getAISprayAdvisory(sprayCrop, sprayPest, weather, lang);
      setAdvice(result);
      if (result.text) playSpeech(result.text);
      if (onAction) onAction();
    } catch (err) { alert("Advisory generation failed."); } finally { setIsLoading(false); }
  };

  const handleMixingAnalysis = async () => {
    const validItems = mixingItems.filter(item => item.text.trim() || item.data);
    if (validItems.length < 2) return alert("কমপক্ষে ২ টি বালাইনাশক যুক্ত করুন।");
    
    setIsLoading(true); setAdvice(null);
    try {
      const result = await analyzePesticideMixing(validItems, weather || undefined, lang);
      setAdvice({ text: result.text, groundingChunks: result.groundingChunks });
      if (result.text) playSpeech(result.text);
      if (onAction) onAction();
    } catch (err) { alert("Analysis failed."); } finally { setIsLoading(false); }
  };

  const handleRotationSchedule = async () => {
    if (!query.trim()) return alert("ফসল বা পোকার নাম লিখুন।");
    setIsLoading(true); setAdvice(null);
    try {
      const result = await getPesticideRotationAdvice(query, lang);
      setAdvice(result);
      if (result.text) playSpeech(result.text);
      if (onAction) onAction();
    } catch (err) { alert("Rotation schedule generation failed."); } finally { setIsLoading(false); }
  };

  const handleMixingFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && activeMixingId) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setMixingItems(prev => prev.map(item => 
          item.id === activeMixingId 
            ? { ...item, data: (reader.result as string).split(',')[1], mimeType: file.type, text: 'Scanned Image' } 
            : item
        ));
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePrecisionSubmit = async (dynamicData: Record<string, string>) => {
    setIsLoading(true);
    try {
      const result = await performDeepPesticideAudit(query, dynamicData, lang);
      setAdvice(result);
      setPrecisionFields(null);
      if (result.text) playSpeech(result.text);
      if (onAction) onAction();
    } catch (e) { alert("Deep Pesticide Audit Failed."); } finally { setIsLoading(false); }
  };

  const handleDownload = () => {
    window.print();
  };

  const handleSaveReportToProfile = async () => {
    if (advice && onSaveReport) {
      setIsSaving(true);
      try {
        const audioBase64 = await generateSpeech(advice.text.replace(/[*#_~]/g, ''));
        onSaveReport({ 
          type: 'Pesticide Report', 
          title: `Expert Advice: ${activeTab.toUpperCase()}`, 
          content: advice.text, 
          audioBase64, 
          icon: '🧪' 
        });
        alert(lang === 'bn' ? "অডিওসহ রিপোর্ট সেভ হয়েছে!" : "Report saved with audio!");
      } catch (e) {
        onSaveReport({ type: 'Pesticide Report', title: 'Pesticide Advice', content: advice.text, icon: '🧪' });
        alert(lang === 'bn' ? "সেভ হয়েছে" : "Saved");
      } finally {
        setIsSaving(false);
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 bg-slate-50 min-h-screen pb-24 font-sans text-slate-900">
      <ToolGuideHeader 
        title={lang === 'bn' ? 'বালাইনাশক বিশেষজ্ঞ' : 'Pesticide Expert'}
        subtitle={lang === 'bn' ? 'IRAC/FRAC মিক্সিং স্ট্যান্ডার্ড এবং DAE ২০২৫ প্রটোকল অনুসৃত।' : 'Governed by IRAC/FRAC mixing standards and DAE 2025 spray protocols.'}
        protocol="DAE-IRAC-FRAC-BD"
        source="Official National Spray Protocol"
        lang={lang}
        onBack={onBack || (() => {})}
        icon="🧪"
        themeColor="rose"
        guideSteps={lang === 'bn' ? [
          "স্প্রে করার আগে আপনার এলাকার লাইভ আবহাওয়া চেক করুন।",
          "একাধিক বিষ মেশানোর আগে 'মিক্সিং চেক' ফিচারে নাম বা কিউআর কোড দিন।",
          "প্রতিরোধ ক্ষমতা (Resistance) রোধে MoA গ্রুপ রোটেশন শিডিউল ব্যবহার করুন।",
          "সার্চ ফিচারের মাধ্যমে যেকোনো বালাইনাশকের সরকারি ডোজ জেনে নিন।"
        ] : [
          "Check live weather before planning a spray session.",
          "Use the 'Mixing Check' feature to verify chemical compatibility via name or scan.",
          "Follow the MoA Group Rotation schedule to prevent pest resistance.",
          "Use 'Search' to find official DAE dosages for specific products."
        ]}
      />

      <div className="flex bg-white p-1.5 rounded-[2rem] shadow-sm mb-8 border border-slate-200 overflow-x-auto scrollbar-hide print:hidden">
        <button onClick={() => { setActiveTab('advisor'); stopSpeech(); setAdvice(null); }} className={`flex-1 min-w-[120px] px-4 py-3 text-[10px] font-black uppercase rounded-[1.5rem] transition-all ${activeTab === 'advisor' ? 'bg-rose-600 text-white shadow-xl' : 'text-slate-400'}`}>{lang === 'bn' ? 'স্প্রে গাইড' : 'Spray Advisor'}</button>
        <button onClick={() => { setActiveTab('mixing'); stopSpeech(); setAdvice(null); }} className={`flex-1 min-w-[120px] px-4 py-3 text-[10px] font-black uppercase rounded-[1.5rem] transition-all ${activeTab === 'mixing' ? 'bg-rose-600 text-white shadow-xl' : 'text-slate-400'}`}>{lang === 'bn' ? 'মিক্সিং চেক' : 'Mixing Check'}</button>
        <button onClick={() => { setActiveTab('rotation'); stopSpeech(); setAdvice(null); }} className={`flex-1 min-w-[120px] px-4 py-3 text-[10px] font-black uppercase rounded-[1.5rem] transition-all ${activeTab === 'rotation' ? 'bg-rose-600 text-white shadow-xl' : 'text-slate-400'}`}>{lang === 'bn' ? 'রোটেশন' : 'Rotation'}</button>
        <button onClick={() => { setActiveTab('search'); stopSpeech(); setAdvice(null); }} className={`flex-1 min-w-[120px] px-4 py-3 text-[10px] font-black uppercase rounded-[1.5rem] transition-all ${activeTab === 'search' ? 'bg-rose-600 text-white shadow-xl' : 'text-slate-400'}`}>{lang === 'bn' ? 'সার্চ' : 'Search'}</button>
      </div>

      {activeTab === 'advisor' && !advice && !isLoading && (
        <div className="space-y-8 animate-fade-in print:hidden">
           {weather && (
             <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-slate-100 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                   <div className="text-4xl">{weather.condition?.includes('বৃষ্টি') ? '🌧️' : '☀️'}</div>
                   <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">বর্তমান আবহাওয়া ({weather.upazila})</p>
                      <p className="text-sm font-black text-slate-800">{weather.temp}°C • আর্দ্রতা {weather.humidity}% • বাতাস {weather.windSpeed} km/h</p>
                   </div>
                </div>
                <div className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase border ${weather.rainProbability < 25 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                   {weather.rainProbability < 25 ? 'স্প্রে করার উপযুক্ত' : 'বৃষ্টির সম্ভাবনা আছে'}
                </div>
             </div>
           )}

           <div className="bg-white rounded-[3rem] p-8 md:p-10 shadow-xl border border-slate-100 space-y-6">
              <h3 className="text-xl font-black text-slate-800 mb-2">{lang === 'bn' ? 'এআই স্প্রে অ্যাডভাইজর' : 'AI Spray Advisor'}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-4">ফসল</label>
                    <input type="text" value={sprayCrop} onChange={(e) => setSprayCrop(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-6 font-bold focus:border-rose-600 outline-none transition-all shadow-inner" />
                 </div>
                 <div className="space-y-2">
                    <div className="flex justify-between items-center ml-4 mb-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase">রোগ বা পোকার নাম</label>
                       <button onClick={() => toggleListening('sprayPest')} className={`p-1.5 rounded-lg transition-all ${isListening && activeListeningId === 'sprayPest' ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-50 text-slate-400 hover:text-rose-600'}`}>🎙️</button>
                    </div>
                    <input type="text" value={sprayPest} onChange={(e) => setSprayPest(e.target.value)} placeholder="যেমন: মাজরা পোকা" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-6 font-bold focus:border-rose-600 outline-none transition-all shadow-inner" />
                 </div>
              </div>
              <button onClick={handleSprayAdvisory} disabled={isLoading || !sprayPest} className="w-full bg-rose-600 text-white font-black py-5 rounded-[2.5rem] shadow-xl active:scale-95 disabled:bg-slate-200 disabled:text-slate-400 transition-all flex items-center justify-center space-x-3 text-lg">
                 {isLoading ? <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div> : <span>পরামর্শ জেনারেট করুন</span>}
              </button>
           </div>
        </div>
      )}

      {activeTab === 'mixing' && !advice && !isLoading && (
        <div className="space-y-8 animate-fade-in print:hidden">
           <div className="bg-white rounded-[3rem] p-8 md:p-10 shadow-xl border border-slate-100 space-y-8">
              <h3 className="text-xl font-black text-slate-800">বালাইনাশক মিক্সিং অ্যানালাইজার</h3>
              <p className="text-xs font-medium text-slate-500">DAE এবং IRAC/FRAC প্রটোকল অনুযায়ী বালাইনাশকগুলো একসাথে মেশানো নিরাপদ কি না যাচাই করুন।</p>
              
              <div className="space-y-4">
                 {mixingItems.map((item, idx) => (
                   <div key={item.id} className="p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl relative group">
                      <div className="flex items-center justify-between mb-4">
                         <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest">পণ্য {idx + 1}</span>
                         <div className="flex gap-2">
                           <button onClick={() => toggleListening('mixing', item.id)} className={`p-2 rounded-lg transition-all ${isListening && activeMixingId === item.id && activeListeningId === 'mixing' ? 'bg-red-500 text-white animate-pulse' : 'bg-white text-slate-400 border border-slate-200 shadow-sm'}`}>🎙️</button>
                           {item.data && <span className="text-[8px] font-black text-emerald-600 uppercase flex items-center">Image Scanned</span>}
                         </div>
                      </div>
                      <div className="flex gap-2">
                         <input 
                           type="text" 
                           value={item.text} 
                           onChange={(e) => setMixingItems(prev => prev.map(p => p.id === item.id ? { ...p, text: e.target.value } : p))}
                           placeholder="পণ্য বা উপকরণের নাম লিখুন"
                           className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-rose-500 shadow-inner"
                         />
                         <button 
                           onClick={() => { setActiveMixingId(item.id); mixingFileRef.current?.click(); }}
                           className="p-3 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-rose-600 shadow-sm"
                         >
                           📸
                         </button>
                      </div>
                   </div>
                 ))}
                 <button 
                   onClick={() => setMixingItems([...mixingItems, { id: Date.now().toString(), text: '' }])}
                   className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-black text-xs uppercase tracking-widest hover:border-rose-400 hover:text-rose-600 transition-all"
                 >
                   + আরেকটি পণ্য যোগ করুন
                 </button>
              </div>

              <input type="file" ref={mixingFileRef} accept="image/*" className="hidden" onChange={handleMixingFileChange} />

              <button onClick={handleMixingAnalysis} disabled={isLoading} className="w-full bg-rose-600 text-white font-black py-5 rounded-[2.5rem] shadow-xl active:scale-95 disabled:bg-slate-200 transition-all flex items-center justify-center space-x-3 text-lg">
                 <span>মিক্সিং সেফটি চেক করুন</span>
              </button>
           </div>
        </div>
      )}

      {activeTab === 'rotation' && !advice && !isLoading && (
        <div className="space-y-8 animate-fade-in print:hidden">
           <div className="bg-white rounded-[3rem] p-8 md:p-10 shadow-xl border border-slate-100 space-y-6 text-center">
              <div className="w-20 h-20 bg-rose-50 rounded-[2rem] flex items-center justify-center mx-auto text-4xl shadow-inner">♻️</div>
              <h3 className="text-2xl font-black text-slate-800">MoA গ্রুপ রোটেশন শিডিউলার</h3>
              <p className="text-sm text-slate-500 font-medium leading-relaxed max-w-sm mx-auto">পোকা বা রোগের প্রতিরোধ ক্ষমতা (Resistance) রোধ করতে পর্যায়ক্রমে ভিন্ন ভিন্ন গ্রুপের বিষ ব্যবহারের পরিকল্পনা নিন।</p>
              
              <div className="relative pt-4">
                 <div className="relative">
                   <input 
                     type="text" 
                     value={query} 
                     onChange={(e) => setQuery(e.target.value)} 
                     placeholder="ফসল এবং পোকার নাম (যেমন: বেগুনের ডগা ও ফল ছিদ্রকারী)"
                     className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-5 px-8 pr-16 font-black text-lg text-slate-700 outline-none focus:border-rose-600 transition-all shadow-inner"
                   />
                   <button onClick={() => toggleListening('query')} className={`absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-xl transition-all ${isListening && activeListeningId === 'query' ? 'bg-red-500 text-white animate-pulse' : 'bg-white/50 text-slate-400 hover:text-rose-600'}`}>🎙️</button>
                 </div>
                 <button onClick={handleRotationSchedule} disabled={isLoading || !query} className="w-full mt-4 bg-rose-600 text-white font-black py-5 rounded-[2.5rem] shadow-xl active:scale-95 transition-all text-lg">শিডিউল জেনারেট করুন</button>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'search' && !advice && !isLoading && (
        <div className="space-y-8 animate-fade-in print:hidden">
          <div className="bg-white rounded-[3rem] p-8 md:p-10 shadow-xl border border-slate-100 mb-8">
             <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={lang === 'bn' ? "বালাইনাশকের নাম লিখুন..." : "Enter product name..."} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-6 pr-14 font-bold focus:border-rose-600 outline-none shadow-inner" />
                  <button onClick={() => toggleListening('query')} className={`absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl transition-all ${isListening && activeListeningId === 'query' ? 'bg-red-500 text-white animate-pulse' : 'bg-white text-slate-400 hover:text-rose-600'}`}>🎙️</button>
                </div>
                <button onClick={() => handleSearchSubmit(true)} disabled={isLoading} className="bg-rose-600 text-white font-black px-8 py-4 rounded-2xl shadow-lg active:scale-95 disabled:bg-slate-300">সায়েন্টিফিক অডিট</button>
             </div>
          </div>
        </div>
      )}

      {precisionFields && !isLoading && !advice && (
        <div className="max-w-2xl mx-auto my-8 print:hidden">
           <DynamicPrecisionForm 
              fields={precisionFields} 
              lang={lang} 
              onSubmit={handlePrecisionSubmit} 
              isLoading={isLoading} 
              toolProtocol="DAE-IRAC-FRAC-BD"
           />
        </div>
      )}

      {isLoading && (
        <div className="bg-white p-12 rounded-[3.5rem] text-center shadow-xl border border-slate-50 mt-8 flex flex-col items-center space-y-6 print:hidden">
           <div className="w-20 h-20 border-8 border-rose-50 border-t-rose-600 rounded-full animate-spin"></div>
           <p className="font-black text-slate-800">{loadingMessages[loadingStep]}</p>
        </div>
      )}

      {advice && !isLoading && (
        <div className="space-y-8 animate-fade-in-up">
          <div ref={reportRef} className="bg-white rounded-[3.5rem] p-10 md:p-14 shadow-2xl animate-fade-in-up border-t-[16px] border-rose-600 mt-8 relative overflow-hidden flex flex-col print:rounded-none print:shadow-none print:border-t-8 print:p-8 print:m-0">
             
             {/* Print Watermark */}
             <div className="hidden print:flex absolute inset-0 items-center justify-center opacity-[0.03] pointer-events-none rotate-45 select-none text-[6rem] font-black uppercase whitespace-nowrap">
                DAE Certified Protocol
             </div>

             <div className="flex justify-between items-center mb-8 pb-6 border-b-2 border-slate-50 relative z-10 print:border-slate-200">
                <div>
                  <h3 className="text-3xl font-black tracking-tight print:text-2xl">{lang === 'bn' ? 'বিশেষজ্ঞ অ্যাডভাইজরি' : 'Expert Advisory'}</h3>
                  <div className="flex items-center space-x-2 mt-2">
                     <span className="bg-rose-50 text-rose-600 px-3 py-1 rounded-lg text-[8px] font-black uppercase border border-rose-100 print:text-slate-500">Standard: DAE 2025</span>
                     <span className="text-[7px] font-bold text-slate-300 uppercase print:hidden">Certified Protocol Sync</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2 print:hidden">
                   <button onClick={handleDownload} className="p-4 rounded-full bg-blue-600 text-white shadow-xl hover:bg-blue-700 transition-all active:scale-90" title="PDF ডাউনলোড">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                   </button>
                   <button onClick={handleSaveReportToProfile} disabled={isSaving} className="p-4 rounded-full bg-rose-600 text-white shadow-xl hover:bg-rose-700 transition-all active:scale-90 disabled:opacity-50">
                      {isSaving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 5h14m-14 0v14l7-7 7 7V5m-14 0h14" /></svg>}
                   </button>
                   <button onClick={() => playSpeech(advice.text)} className={`p-4 rounded-full shadow-lg transition-all ${isSpeaking ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-900 text-white'}`}>{isSpeaking ? '🔇' : '🔊'}</button>
                </div>
             </div>
             <div className="prose prose-slate max-w-none text-slate-800 leading-relaxed font-medium text-xl whitespace-pre-wrap first-letter:text-6xl first-letter:font-black first-letter:text-rose-600 first-letter:float-left first-letter:mr-3 print:text-base print:leading-normal print:first-letter:text-4xl">
               {advice.text}
             </div>
             {/* Print only footer */}
             <div className="hidden print:block mt-12 pt-8 border-t border-slate-200 text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">This advisory follows DAE National Spray & IRAC Chemical Management protocols.</p>
                <p className="text-[10px] font-bold text-slate-400 mt-1">Generated by Krishi AI Digital Assistant • {new Date().toLocaleString('bn-BD')}</p>
             </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          .print\\:visible, [ref="reportRef"], [ref="reportRef"] * { visibility: visible; }
          [ref="reportRef"] { 
            position: absolute !important; 
            left: 0 !important; 
            top: 0 !important; 
            width: 100% !important; 
            height: auto !important;
            border: none !important; 
            box-shadow: none !important; 
            background: white !important;
            padding: 40px !important;
          }
          header, nav, footer, button, .print\\:hidden { display: none !important; }
          @page { size: portrait; margin: 15mm; }
        }
      `}} />
    </div>
  );
};

export default PesticideExpert;
