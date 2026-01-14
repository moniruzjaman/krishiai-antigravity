
import React, { useState, useEffect, useRef, useMemo } from 'react';
/* Fix: Removed non-existent sanitizeForTTS import */
import { performSoilHealthAudit, generateSpeech, requestSoilPrecisionParameters, performDeepSoilAudit } from '../services/geminiService';
import { queryQwenVL } from '../services/huggingfaceService';
import { detectCurrentAEZDetails, AEZInfo, getStoredLocation } from '../services/locationService';
import { SavedReport, Language } from '../types';
import ShareDialog from './ShareDialog';
import DynamicPrecisionForm from './DynamicPrecisionForm';
import { useSpeech } from '../App';
import GuidedTour, { TourStep } from './GuidedTour';
import { ToolGuideHeader } from './ToolGuideHeader';

interface SoilExpertProps {
  onAction?: (xp: number) => void;
  onBack?: () => void;
  onSaveReport?: (report: Omit<SavedReport, 'id' | 'timestamp'>) => void;
  onShowFeedback?: () => void;
  lang: Language;
}

const SOIL_TOUR: TourStep[] = [
  { title: "মৃত্তিকা বিশেষজ্ঞ ২.০", content: "মাটি বিশ্লেষণ, বুনট নির্ণয় এবং জৈব সার পরিকল্পনার জন্য এই উন্নত টুলটি ব্যবহার করুন।", position: 'center' },
  { targetId: "soil-tab-switcher", title: "টুল নির্বাচন", content: "আপনার প্রয়োজন অনুযায়ী অডিট, বুনট বা জৈব সার ক্যালকুলেটর বেছে নিন।", position: 'bottom' },
  { targetId: "soil-deep-audit-btn", title: "ডিপ অডিট", content: "নিখুঁত কৃষি পরিকল্পনার জন্য এআই-এর বিশেষ প্রশ্নের উত্তর দিয়ে ডিপ অডিট করুন।", position: 'top' }
];

const SoilExpert: React.FC<SoilExpertProps> = ({ onAction, onBack, onSaveReport, onShowFeedback, lang }) => {
  const [activeTab, setActiveTab] = useState<'audit' | 'texture' | 'om_calc'>('audit');
  const [aezData, setAezData] = useState<AEZInfo | null>(null);
  const [currentCoords, setCurrentCoords] = useState<{lat: number, lng: number} | null>(null);
  const [advice, setAdvice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [precisionFields, setPrecisionFields] = useState<any[] | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [activeListeningId, setActiveListeningId] = useState<string | null>(null);

  // Texture State
  const [sand, setSand] = useState(40);
  const [silt, setSilt] = useState(40);
  const [clay, setClay] = useState(20);

  // Organic Matter Mixer State
  const [currentOM, setCurrentOM] = useState(1.5);
  const [targetOM, setTargetOM] = useState(3.5);
  const [landUnit, setLandUnit] = useState<'bigha' | 'decimal'>('bigha');
  const [landArea, setLandArea] = useState(33);
  const [omResult, setOmResult] = useState<any>(null);

  const reportRef = useRef<HTMLDivElement>(null);
  const { playSpeech, stopSpeech, isSpeaking } = useSpeech();
  const [auditInputs, setAuditInputs] = useState({ ph: 6.5, oc: 0.8, n: 0.1, p: 15, k: 0.15 });
  const recognitionRef = useRef<any>(null);

  const loadingMessages = lang === 'bn' ? [
    "আপনার এলাকার মাটির প্রোফাইল বিশ্লেষণ হচ্ছে...",
    "SRDI মানদণ্ড অনুযায়ী পুষ্টির ভারসাম্য যাচাই চলছে...",
    "BARC-2024 নির্দেশিকা থেকে সমাধান খোঁজা হচ্ছে...",
    "মৃত্তিকা ভিত্তিক এনPK সমন্বয় করা হচ্ছে...",
    "বিশেষজ্ঞ অ্যাডভাইজরি রিপোর্ট প্রস্তুত হচ্ছে..."
  ] : [
    "Mapping regional soil AEZ profile...",
    "Validating nutrient balance per SRDI standards...",
    "Consulting BARC-2024 scientific guidelines...",
    "Synthesizing NPK dosage adjustments...",
    "Finalizing scientific soil audit report..."
  ];

  useEffect(() => {
    const tourDone = localStorage.getItem('agritech_tour_soil_v4');
    if (!tourDone) setShowTour(true);
    handleDetectAEZ(false);

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.lang = 'bn-BD';
      recognitionRef.current.onstart = () => setIsListening(true);
      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        const num = parseFloat(transcript.replace(/[^0-9.]/g, ''));
        if (!isNaN(num) && activeListeningId) {
          if (activeListeningId === 'currentOM') setCurrentOM(num);
          if (activeListeningId === 'targetOM') setTargetOM(num);
          if (activeListeningId === 'landArea') setLandArea(num);
        }
      };
      recognitionRef.current.onend = () => { setIsListening(false); setActiveListeningId(null); };
    }
  }, [activeListeningId]);

  useEffect(() => {
    let interval: any;
    if (isLoading) interval = setInterval(() => setLoadingStep(prev => (prev + 1) % loadingMessages.length), 2000);
    return () => clearInterval(interval);
  }, [isLoading, loadingMessages.length]);

  const handleAuditSubmit = async (precision: boolean = false) => {
    setIsLoading(true); setAdvice(null);
    try {
      if (precision) {
        const fields = await requestSoilPrecisionParameters(auditInputs, aezData?.name || 'Local', lang);
        setPrecisionFields(fields);
        setIsLoading(false);
      } else {
        const prompt = `Perform a Soil Health Audit for AEZ: ${aezData?.name}. Grounding: BARC FRG 2024. NO INTRO.`;
        
        const qwenRes = await queryQwenVL(prompt, undefined, lang);
        if (qwenRes) {
          setAdvice(qwenRes);
          playSpeech(qwenRes);
        } else {
          const res = await performSoilHealthAudit(auditInputs, aezData || undefined, lang);
          setAdvice(res);
          if (res) playSpeech(res);
        }
        if (onAction) onAction(45);
        setIsLoading(false);
      }
    } catch (e) {
      alert("Audit Failed.");
      setIsLoading(false);
    }
  };

  const handlePrecisionSubmit = async (dynamicData: Record<string, string>) => {
    setIsLoading(true);
    try {
      const prompt = `Perform a Deep Soil Audit for ${aezData?.name}. NO INTRO.`;
      const qwenRes = await queryQwenVL(prompt, undefined, lang);
      if (qwenRes) {
        setAdvice(qwenRes);
        playSpeech(qwenRes);
      } else {
        const res = await performDeepSoilAudit(auditInputs, aezData?.name || 'Local', dynamicData, lang);
        setAdvice(res);
        if (res) playSpeech(res);
      }
      setPrecisionFields(null);
      if (onAction) onAction(60);
    } catch (e) { alert("Deep Soil Audit Failed."); } finally { setIsLoading(false); }
  };

  const handleDetectAEZ = async (force: boolean = true) => {
    setIsDetecting(true);
    try {
      const data = await detectCurrentAEZDetails(force);
      setAezData(data);
      const loc = getStoredLocation();
      if (loc) setCurrentCoords({lat: loc.lat, lng: loc.lng});
    } catch (e) { if (force) alert("Location detection failed."); } finally { setIsDetecting(false); }
  };

  const calculateOrganicFertilizer = () => {
    const deficit = Math.max(0, targetOM - currentOM);
    const areaInDecimal = landUnit === 'bigha' ? landArea * 33 : landArea; 
    const neededTotalKg = areaInDecimal * 15 * deficit; 
    
    setOmResult({
      totalKg: neededTotalKg.toFixed(1),
      cowDung: (neededTotalKg * 0.6).toFixed(1),
      vermiCompost: (neededTotalKg * 0.4).toFixed(1),
      deficit: deficit.toFixed(2),
      soilType: textureResult.name
    });
    if (onAction) onAction(15);
  };

  const textureResult = useMemo(() => {
    const total = sand + silt + clay;
    const cP = (clay / total) * 100;
    const sP = (sand / total) * 100;
    if (cP >= 40) return { id: 'clay', name: "এঁটেল মাটি (Clay)", color: "text-rose-600" };
    if (sP >= 85) return { id: 'sand', name: "বেলে মাটি (Sand)", color: "text-amber-600" };
    return { id: 'loam', name: "দোআঁশ মাটি (Loam)", color: "text-emerald-600" };
  }, [sand, silt, clay]);

  const handleSave = async () => {
    if (advice && onSaveReport) {
      setIsSaving(true);
      try {
        const audioBase64 = await generateSpeech(advice);
        onSaveReport({ 
          type: 'Soil Audit', 
          title: `${aezData?.name || 'Local'} Soil Audit`, 
          content: advice, 
          audioBase64, 
          icon: '🏺' 
        });
        alert("সংরক্ষিত হয়েছে!");
      } catch (e) {
        onSaveReport({ type: 'Soil Audit', title: 'Soil Audit', content: advice, icon: '🏺' });
        alert("Saved");
      } finally { setIsSaving(false); }
    }
  };

  const formatResultContent = (text: string) => {
    const parts = text.split(/(\[.*?\]:?)/g);
    return parts.map((part, i) => {
      if (part.startsWith('[') && part.includes(']')) {
        return <span key={i} className="block mt-8 mb-3 bg-amber-50 text-amber-700 px-4 py-2 rounded-xl font-black text-sm uppercase tracking-widest border border-amber-100">{part.replace(/[\[\]:]/g, '')}</span>;
      }
      return <span key={i} className="leading-relaxed opacity-90">{part}</span>;
    });
  };

  const toggleListening = (id: string) => {
    if (!recognitionRef.current) return alert("ভয়েস ইনপুট সমর্থিত নয়।");
    if (isListening && activeListeningId === id) recognitionRef.current.stop();
    else { setActiveListeningId(id); recognitionRef.current.start(); }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 bg-slate-50 min-h-screen pb-32 font-sans animate-fade-in">
      {showTour && <GuidedTour steps={SOIL_TOUR} tourKey="soil_v4" onClose={() => setShowTour(false)} />}
      
      {/* Floating Status Toast - Re-engineered for consistent UX */}
      {isLoading && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[200] animate-bounce-in w-full max-w-xs md:max-w-sm px-4">
           <div className="bg-slate-900/95 text-white p-5 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.4)] flex flex-col space-y-4 border border-amber-500/30 backdrop-blur-md">
              <div className="flex items-center space-x-4">
                <div className="relative shrink-0">
                  <div className="w-10 h-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center text-lg">🏺</div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black text-amber-400 uppercase tracking-[0.2em] mb-1">Scientific Soil Analytics</p>
                  <h4 className="text-sm font-bold truncate transition-all duration-500">{loadingMessages[loadingStep]}</h4>
                </div>
              </div>
              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden flex gap-1 px-1 py-0.5">
                 {[0,1,2,3,4].map(i => (
                   <div key={i} className={`h-full flex-1 rounded-full transition-all duration-500 ${i <= loadingStep ? 'bg-amber-500 shadow-[0_0_8px_#f59e0b]' : 'bg-white/5'}`}></div>
                 ))}
              </div>
           </div>
        </div>
      )}

      <ToolGuideHeader 
        title={lang === 'bn' ? 'মৃত্তিকা বিশেষজ্ঞ ২.০' : 'Soil Expert 2.0'}
        subtitle={lang === 'bn' ? 'অঞ্চলভিত্তিক (AEZ) পুষ্টি বিশ্লেষণ এবং SRDI/BARC বৈজ্ঞানিক মানদণ্ড।' : 'AEZ-based nutrient analysis and scientific benchmarks from SRDI/BARC.'}
        protocol="SRDI-BARC-FRG24"
        source="Soil Resource Development Institute"
        lang={lang}
        onBack={onBack || (() => {})}
        icon="🏺"
        themeColor="amber"
        guideSteps={lang === 'bn' ? ["আপনার এলাকার মাটির প্রোফাইল দেখুন।", "অডিট তথ্য দিন।", "সায়েন্টিফিক সমাধান জানুন।"] : ["Detect area profile.", "Provide audit data.", "Get scientific advisory."]}
      />

      <div id="soil-tab-switcher" className="flex bg-white p-1.5 rounded-[2rem] shadow-sm mb-10 border border-slate-200 overflow-x-auto scrollbar-hide print:hidden">
        <button onClick={() => { setActiveTab('audit'); stopSpeech(); setAdvice(null); }} className={`flex-1 min-w-[100px] py-3 text-[10px] font-black uppercase rounded-[1.5rem] transition-all ${activeTab === 'audit' ? 'bg-amber-600 text-white shadow-xl' : 'text-slate-400 hover:bg-slate-50'}`}>স্বাস্থ্য অডিট</button>
        <button onClick={() => { setActiveTab('texture'); stopSpeech(); setAdvice(null); }} className={`flex-1 min-w-[100px] py-3 text-[10px] font-black uppercase rounded-[1.5rem] transition-all ${activeTab === 'texture' ? 'bg-amber-600 text-white shadow-xl' : 'text-slate-400 hover:bg-slate-50'}`}>বুনট নির্ণয়</button>
        <button onClick={() => { setActiveTab('om_calc'); stopSpeech(); setAdvice(null); }} className={`flex-1 min-w-[100px] py-3 text-[10px] font-black uppercase rounded-[1.5rem] transition-all ${activeTab === 'om_calc' ? 'bg-amber-600 text-white shadow-xl' : 'text-slate-400 hover:bg-slate-50'}`}>জৈব সার মিক্সার</button>
      </div>

      {activeTab === 'audit' && (
        <div className="space-y-8 animate-fade-in">
           <div className="bg-white rounded-[3rem] p-8 md:p-10 shadow-xl border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-8 relative overflow-hidden print:hidden">
              <div className="flex-1 relative z-10">
                 <div className="flex items-center space-x-3 mb-3">
                    <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-xl shadow-inner">📍</div>
                    <h3 className="text-xl font-black text-slate-800">অঞ্চল শনাক্তকরণ</h3>
                 </div>
                 <div className="pl-2">
                    <p className="text-sm font-black text-amber-700">
                      {aezData ? `AEZ ${aezData.id}: ${aezData.name}` : 'শনাক্ত করা হয়নি'}
                    </p>
                 </div>
              </div>
              <button onClick={() => handleDetectAEZ(true)} disabled={isDetecting} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all">
                {isDetecting ? '...' : 'আপডেট করুন'}
              </button>
           </div>
           
           <div className="bg-white rounded-[3rem] p-8 md:p-10 shadow-xl border border-slate-100 print:hidden">
              <h3 className="text-xl font-black mb-8 border-b border-slate-50 pb-4">মাটির গুণাগুণ ইনপুট</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-6 mb-10">
                 <AuditInput label="pH" value={auditInputs.ph} step={0.1} onChange={(v: number) => setAuditInputs({...auditInputs, ph: v})} icon="🧪" />
                 <AuditInput label="OC (%)" value={auditInputs.oc} step={0.1} onChange={(v: number) => setAuditInputs({...auditInputs, oc: v})} icon="🍂" />
                 <AuditInput label="N (%)" value={auditInputs.n} step={0.01} onChange={(v: number) => setAuditInputs({...auditInputs, n: v})} icon="🔬" />
                 <AuditInput label="P (ppm)" value={auditInputs.p} step={1} onChange={(v: number) => setAuditInputs({...auditInputs, p: v})} icon="💎" />
                 <AuditInput label="K (meq)" value={auditInputs.k} step={0.01} onChange={(v: number) => setAuditInputs({...auditInputs, k: v})} icon="🍌" />
              </div>
              <button id="soil-deep-audit-btn" onClick={() => handleAuditSubmit(true)} disabled={isLoading} className="w-full bg-amber-600 text-white py-6 rounded-[2.5rem] font-black text-xl shadow-2xl active:scale-95 transition-all text-center">ডিপ অডিট শুরু করুন</button>
           </div>
        </div>
      )}

      {activeTab === 'texture' && (
        <div className="bg-white rounded-[3rem] p-10 shadow-xl border border-slate-100 animate-fade-in">
           <h3 className="text-xl font-black text-slate-800 mb-10 text-center">মাটির বুনট (Texture) স্লাইডার</h3>
           <div className="space-y-12 max-w-lg mx-auto">
              <TextureSlider label="বেলে (Sand)" val={sand} setVal={setSand} color="bg-amber-500" />
              <TextureSlider label="পলি (Silt)" val={silt} setVal={setSilt} color="bg-blue-500" />
              <TextureSlider label="এঁটেল (Clay)" val={clay} setVal={setClay} color="bg-rose-500" />
              
              <div className="mt-12 p-8 bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200 text-center">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">শনাক্তকৃত বুনট</p>
                 <h4 className={`text-3xl font-black ${textureResult.color}`}>{textureResult.name}</h4>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'om_calc' && (
        <div className="bg-white rounded-[3rem] p-10 shadow-xl border border-slate-100 animate-fade-in">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-6">
                 <div>
                    <div className="flex justify-between mb-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">বর্তমান জৈব পদার্থ (%)</label><button onClick={() => toggleListening('currentOM')} className="text-slate-300">🎙️</button></div>
                    <input type="number" value={currentOM} onChange={(e) => setCurrentOM(parseFloat(e.target.value))} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-black text-lg text-slate-700 outline-none focus:border-amber-500" />
                 </div>
                 <div>
                    <div className="flex justify-between mb-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">লক্ষ্যমাত্রা (%)</label><button onClick={() => toggleListening('targetOM')} className="text-slate-300">🎙️</button></div>
                    <input type="number" value={targetOM} onChange={(e) => setTargetOM(parseFloat(e.target.value))} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-black text-lg text-slate-700 outline-none focus:border-amber-500" />
                 </div>
                 <div className="flex gap-2">
                    <input type="number" value={landArea} onChange={(e) => setLandArea(parseFloat(e.target.value))} className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-black" />
                    <select value={landUnit} onChange={(e) => setLandUnit(e.target.value as any)} className="bg-slate-900 text-white px-6 rounded-2xl font-black text-xs uppercase tracking-widest">
                       <option value="bigha">বিঘা</option>
                       <option value="decimal">শতাংশ</option>
                    </select>
                 </div>
                 <button onClick={calculateOrganicFertilizer} className="w-full bg-amber-600 text-white font-black py-5 rounded-2xl shadow-xl">হিসাব করুন</button>
              </div>

              <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white flex flex-col justify-center text-center">
                 {omResult ? (
                   <div className="space-y-6 animate-fade-in">
                      <div>
                         <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">প্রয়োজনীয় মোট সার</p>
                         <h4 className="text-5xl font-black tracking-tighter">{omResult.totalKg} <span className="text-lg opacity-40 font-bold">কেজি</span></h4>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                         <div className="bg-white/5 p-4 rounded-2xl">
                            <p className="text-[8px] font-black text-slate-400 uppercase mb-1">গোবর সার</p>
                            <p className="text-lg font-black">{omResult.cowDung} কেজি</p>
                         </div>
                         <div className="bg-white/5 p-4 rounded-2xl">
                            <p className="text-[8px] font-black text-slate-400 uppercase mb-1">ভার্মিকম্পোস্ট</p>
                            <p className="text-lg font-black">{omResult.vermiCompost} কেজি</p>
                         </div>
                      </div>
                      <p className="text-[10px] font-medium text-slate-400 italic">"{omResult.soilType} এর জন্য অপ্টিমাইজড মিশ্রণ"</p>
                   </div>
                 ) : (
                   <div className="opacity-30">
                      <div className="text-5xl mb-4">⚖️</div>
                      <p className="font-black uppercase text-xs">ডাটা দিন</p>
                   </div>
                 )}
              </div>
           </div>
        </div>
      )}

      {precisionFields && !isLoading && !advice && (
        <div className="max-w-2xl mx-auto my-8 print:hidden">
           <DynamicPrecisionForm fields={precisionFields} lang={lang} onSubmit={handlePrecisionSubmit} isLoading={isLoading} toolProtocol="SRDI-BARC-FRG24" />
        </div>
      )}

      {advice && !isLoading && (
        <div ref={reportRef} className="bg-white rounded-[4rem] p-10 md:p-14 border-[12px] border-slate-900 shadow-2xl relative overflow-hidden flex flex-col animate-fade-in-up mt-10">
           <div className="flex justify-between items-center mb-10 border-b border-slate-100 pb-8">
              <div>
                 <h3 className="text-3xl font-black text-slate-900 tracking-tight">অডিট অ্যাডভাইজরি</h3>
                 <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mt-2">AEZ Analysis Core v2.1</p>
              </div>
              <div className="flex items-center space-x-2">
                 <button onClick={handleSave} disabled={isSaving} className="p-4 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all shadow-sm">
                    {isSaving ? '...' : 'Save'}
                 </button>
                 <button onClick={() => playSpeech(advice!)} className={`p-5 rounded-full shadow-xl transition-all ${isSpeaking ? 'bg-rose-500 animate-pulse' : 'bg-amber-600 text-white'}`}>
                    🔊
                 </button>
              </div>
           </div>
           <div className="prose prose-slate max-w-none text-slate-800 font-medium leading-[1.8] text-xl whitespace-pre-wrap">
              {formatResultContent(advice)}
           </div>

           <div className="mt-16 pt-8 border-t border-slate-50 flex flex-col md:flex-row justify-between items-center gap-4 opacity-60">
              <div className="flex items-center space-x-4">
                <div className="flex flex-col">
                   <span className="text-[8px] font-black uppercase text-slate-400">Primary Engine</span>
                   <span className="text-[10px] font-bold text-slate-700">Qwen/Qwen3-VL</span>
                </div>
                <div className="w-px h-6 bg-slate-200"></div>
                <div className="flex flex-col">
                   <span className="text-[8px] font-black uppercase text-slate-400">Standard</span>
                   <span className="text-[10px] font-bold text-slate-700">SRDI-BARC-FRG-24</span>
                </div>
                <div className="w-px h-6 bg-slate-200"></div>
                <div className="flex flex-col">
                   <span className="text-[8px] font-black uppercase text-slate-400">Version</span>
                   <span className="text-[10px] font-bold text-slate-700">v3.5.0-BD</span>
                </div>
              </div>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Scientific Soil Mapping Integrity v2.5</p>
           </div>
        </div>
      )}
    </div>
  );
};

const AuditInput = ({ label, value, onChange, step = 1, icon }: any) => (
  <div className="space-y-2 group">
    <div className="flex items-center space-x-2">
       <span className="text-base grayscale group-hover:grayscale-0 transition-all">{icon}</span>
       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
    </div>
    <input type="number" value={value} step={step} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-black text-center text-lg text-slate-700 outline-none focus:border-amber-500 shadow-inner" />
  </div>
);

const TextureSlider = ({ label, val, setVal, color }: any) => (
  <div className="space-y-3">
     <div className="flex justify-between items-center px-1">
        <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">{label}</label>
        <span className={`px-3 py-1 rounded-lg text-white text-[10px] font-black ${color}`}>{val}%</span>
     </div>
     <input type="range" min="0" max="100" value={val} onChange={(e) => setVal(parseInt(e.target.value))} className="w-full h-2 bg-slate-100 rounded-full appearance-none cursor-pointer accent-slate-800" />
  </div>
);

export default SoilExpert;
