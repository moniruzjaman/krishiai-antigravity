
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { performSoilHealthAudit, generateSpeech, requestSoilPrecisionParameters, performDeepSoilAudit } from '../services/geminiService';
import { detectCurrentAEZDetails, AEZInfo } from '../services/locationService';
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

   // Organic Matter State
   const [currentOM, setCurrentOM] = useState(1.5);
   const [targetOM, setTargetOM] = useState(3.5);
   const [landArea, setLandArea] = useState(33); // 1 Bigha default

   const reportRef = useRef<HTMLDivElement>(null);
   const { playSpeech, stopSpeech, isSpeaking } = useSpeech();
   const [auditInputs, setAuditInputs] = useState({ ph: 6.5, oc: 0.8, n: 0.1, p: 15, k: 0.15 });
   const recognitionRef = useRef<any>(null);

   const loadingMessages = [
      "আপনার এলাকার মাটির প্রোফাইল বিশ্লেষণ হচ্ছে...",
      "SRDI মানদণ্ড অনুযায়ী পুষ্টির ভারসাম্য যাচাই চলছে...",
      "BARC-2024 নির্দেশিকা থেকে সমাধান খোঁজা হচ্ছে...",
      "বিশেষজ্ঞ অ্যাডভাইজরি রিপোর্ট প্রস্তুত হচ্ছে..."
   ];

   useEffect(() => {
      const tourDone = localStorage.getItem('agritech_tour_soil_v3');
      if (!tourDone) setShowTour(true);
      handleDetectAEZ(false);

      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
         recognitionRef.current = new SpeechRecognition();
         recognitionRef.current.lang = lang === 'bn' ? 'bn-BD' : 'en-US';
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
         recognitionRef.current.onerror = () => { setIsListening(false); setActiveListeningId(null); };
      }
   }, [lang, activeListeningId]);

   useEffect(() => {
      let interval: any;
      if (isLoading) interval = setInterval(() => setLoadingStep(prev => (prev + 1) % loadingMessages.length), 2000);
      return () => clearInterval(interval);
   }, [isLoading]);

   const toggleListening = (id: string) => {
      if (!recognitionRef.current) return alert("ভয়েস ইনপুট সমর্থিত নয়।");
      if (isListening && activeListeningId === id) recognitionRef.current.stop();
      else { setActiveListeningId(id); recognitionRef.current.start(); }
   };

   const handleAuditSubmit = async (precision: boolean = false) => {
      setIsLoading(true); setAdvice(null);
      try {
         if (precision) {
            const fields = await requestSoilPrecisionParameters(auditInputs, aezData?.name || 'Local', lang);
            setPrecisionFields(fields);
            setIsLoading(false);
         } else {
            const res = await performSoilHealthAudit(auditInputs, aezData || undefined, lang);
            setAdvice(res || null);
            if (res) playSpeech(res);
            if (onAction) onAction(45);
            if (onShowFeedback) onShowFeedback();
            setIsLoading(false);
         }
      } catch (e) {
         alert(lang === 'bn' ? "অডিট জেনারেট করতে সমস্যা হয়েছে।" : "Failed to generate audit.");
         setIsLoading(false);
      }
   };

   const handlePrecisionSubmit = async (dynamicData: Record<string, string>) => {
      setIsLoading(true);
      try {
         const res = await performDeepSoilAudit(auditInputs, aezData?.name || 'Local', dynamicData, lang);
         setAdvice(res || null);
         setPrecisionFields(null);
         if (res) playSpeech(res);
         if (onAction) onAction(60);
      } catch (e) { alert("Deep Soil Audit Failed."); } finally { setIsLoading(false); }
   };

   const handleDetectAEZ = async (force: boolean = true) => {
      setIsDetecting(true);
      try {
         const data = await detectCurrentAEZDetails(force);
         setAezData(data);
      } catch (e) { if (force) alert(lang === 'bn' ? "লোকেশন পাওয়া যায়নি।" : "Location detection failed."); } finally { setIsDetecting(false); }
   };

   const handleDownload = () => {
      window.print();
   };

   const handleSave = async () => {
      if (advice && onSaveReport) {
         setIsSaving(true);
         try {
            const audioBase64 = await generateSpeech(advice.replace(/[*#_~]/g, ''));
            onSaveReport({
               type: 'Soil Audit',
               title: `${aezData?.name || 'Local'} Soil Audit`,
               content: advice,
               audioBase64,
               icon: '🏺'
            });
            alert(lang === 'bn' ? "অডিওসহ রিপোর্ট সেভ হয়েছে!" : "Report saved with audio!");
         } catch (e) {
            onSaveReport({ type: 'Soil Audit', title: 'Soil Audit', content: advice, icon: '🏺' });
            alert(lang === 'bn' ? "সেভ হয়েছে" : "Saved");
         } finally {
            setIsSaving(false);
         }
      }
   };

   const textureResult = useMemo(() => {
      const total = sand + silt + clay;
      const sP = (sand / total) * 100;
      const siP = (silt / total) * 100;
      const cP = (clay / total) * 100;

      if (cP >= 40) return { name: lang === 'bn' ? "এঁটেল মাটি (Clay)" : "Clayey", color: "text-rose-600", desc: lang === 'bn' ? "পানি ধারণ ক্ষমতা বেশি, কিন্তু বাতাস চলাচলে সমস্যা হয়। ধান চাষের জন্য উপযোগী।" : "High water retention, low aeration. Suitable for Rice." };
      if (sP >= 85) return { name: lang === 'bn' ? "বেলে মাটি (Sand)" : "Sandy", color: "text-amber-600", desc: lang === 'bn' ? "পানি ধরে রাখতে পারে না। তরমুজ, বাদাম ও কন্দাল ফসলের জন্য ভালো।" : "Low water retention. Good for Watermelon, Groundnut, and Tubers." };
      if (siP >= 80) return { name: lang === 'bn' ? "পলি মাটি (Silt)" : "Silty", color: "text-blue-600", desc: lang === 'bn' ? "অত্যন্ত উর্বর। রবি শস্যের জন্য চমৎকার।" : "Highly fertile. Excellent for winter crops." };
      return { name: lang === 'bn' ? "দোআঁশ মাটি (Loam)" : "Loamy", color: "text-emerald-600", desc: lang === 'bn' ? "সব ধরণের ফসলের জন্য আদর্শ মাটি। পানি ও বাতাসের ভারসাম্য থাকে।" : "Ideal for most crops. Balanced water and aeration." };
   }, [sand, silt, clay, lang]);

   const omCalculation = useMemo(() => {
      const deficit = Math.max(0, targetOM - currentOM);
      const neededPerBigha = (deficit * 7.5).toFixed(1);
      return { deficit, neededPerBigha };
   }, [currentOM, targetOM]);

   return (
      <div className="max-w-4xl mx-auto p-4 bg-slate-50 min-h-screen pb-32 font-sans animate-fade-in">
         {showTour && <GuidedTour steps={SOIL_TOUR} tourKey="soil_v3" onClose={() => setShowTour(false)} />}
         {isShareOpen && <ShareDialog isOpen={isShareOpen} onClose={() => setIsShareOpen(false)} title="মৃত্তিকা বিশেষজ্ঞ রিপোর্ট" content={advice || ""} />}

         <ToolGuideHeader
            title={lang === 'bn' ? 'মৃত্তিকা বিশেষজ্ঞ ও অডিট' : 'Soil Expert & Audit'}
            subtitle={lang === 'bn' ? 'অঞ্চলভিত্তিক (AEZ) পুষ্টি বিশ্লেষণ এবং SRDI/BARC বৈজ্ঞানিক মানদণ্ড।' : 'AEZ-based nutrient analysis and scientific benchmarks from SRDI/BARC.'}
            protocol="SRDI-BARC-FRG24"
            source="Soil Resource Development Institute"
            lang={lang}
            onBack={onBack || (() => { })}
            icon="🏺"
            themeColor="amber"
            guideSteps={lang === 'bn' ? [
               "আপনার বর্তমান লোকেশন শনাক্ত করে মাটির বৈজ্ঞানিক প্রোফাইল দেখুন।",
               "আপনার ল্যাব রিপোর্ট থেকে pH, নাইট্রোজেন এবং অন্যান্য মান ইনপুট দিন।",
               "বুনট ক্যালকুলেটর ব্যবহার করে মাটির ধরণ (বেলে/এঁটেল) শনাক্ত করুন।",
               "জৈব সার ক্যালকুলেটর ব্যবহার করে মাটির উর্বরতা বাড়ানোর সঠিক মিশ্রণ জানুন।"
            ] : [
               "Identify your current location to view the regional soil profile.",
               "Input pH, Nitrogen, and other values from your lab report.",
               "Use the Texture Calculator to identify soil type (Sandy/Clayey).",
               "Use the Organic Matter Mixer to find the correct amendment ratios."
            ]}
         />

         <div id="soil-tab-switcher" className="flex bg-white p-1.5 rounded-[2rem] shadow-sm mb-10 border border-slate-200 overflow-x-auto scrollbar-hide print:hidden">
            <button onClick={() => { setActiveTab('audit'); stopSpeech(); }} className={`flex-1 min-w-[100px] py-3 text-[10px] font-black uppercase rounded-[1.5rem] transition-all ${activeTab === 'audit' ? 'bg-emerald-600 text-white shadow-xl' : 'text-slate-400 hover:bg-slate-50'}`}>
               {lang === 'bn' ? "স্বাস্থ্য অডিট" : "Health Audit"}
            </button>
            <button onClick={() => { setActiveTab('texture'); stopSpeech(); }} className={`flex-1 min-w-[100px] py-3 text-[10px] font-black uppercase rounded-[1.5rem] transition-all ${activeTab === 'texture' ? 'bg-emerald-600 text-white shadow-xl' : 'text-slate-400 hover:bg-slate-50'}`}>
               {lang === 'bn' ? "বুনট নির্ণয়" : "Texture Calc"}
            </button>
            <button onClick={() => { setActiveTab('om_calc'); stopSpeech(); }} className={`flex-1 min-w-[100px] py-3 text-[10px] font-black uppercase rounded-[1.5rem] transition-all ${activeTab === 'om_calc' ? 'bg-emerald-600 text-white shadow-xl' : 'text-slate-400 hover:bg-slate-50'}`}>
               {lang === 'bn' ? "জৈব সার মিক্সার" : "OM Mixer"}
            </button>
         </div>

         {activeTab === 'audit' && (
            <div className="space-y-8 animate-fade-in">
               <div className="bg-white rounded-[3rem] p-8 md:p-10 shadow-xl border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-8 relative overflow-hidden print:hidden">
                  <div className="flex-1 relative z-10">
                     <div className="flex items-center space-x-3 mb-2">
                        <span className="text-2xl">📍</span>
                        <h3 className="text-xl font-black text-slate-800">{lang === 'bn' ? 'বর্তমান অবস্থান ও অঞ্চল' : 'Current Location & AEZ'}</h3>
                     </div>
                     <p className="text-sm font-medium text-slate-500 mb-4">
                        {aezData ? `AEZ ${aezData.id}: ${aezData.name}` : (lang === 'bn' ? 'সঠিক মাটির মানের জন্য আপনার এলাকা শনাক্ত করুন।' : 'Identify your region for precise soil benchmarking.')}
                     </p>
                  </div>
                  <button onClick={() => handleDetectAEZ(true)} disabled={isDetecting} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all flex items-center space-x-3 shrink-0 relative z-10">
                     {isDetecting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <span>লোকেশন আপডেট করুন</span>}
                  </button>
               </div>

               <div className="bg-white rounded-[3rem] p-8 md:p-10 shadow-xl border border-slate-100 print:hidden">
                  <h3 className="text-xl font-black mb-8 border-b border-slate-50 pb-4">{lang === 'bn' ? 'মাটির গুণাগুণ ডাটা (Audit Inputs)' : 'Soil Audit Parameters'}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-6 mb-10">
                     <AuditInput label="pH" value={auditInputs.ph} step={0.1} onChange={(v: number) => setAuditInputs({ ...auditInputs, ph: v })} icon="🧪" />
                     <AuditInput label="OC (%)" value={auditInputs.oc} step={0.1} onChange={(v: number) => setAuditInputs({ ...auditInputs, oc: v })} icon="🍂" />
                     <AuditInput label="N (%)" value={auditInputs.n} step={0.01} onChange={(v: number) => setAuditInputs({ ...auditInputs, n: v })} icon="🔬" />
                     <AuditInput label="P (ppm)" value={auditInputs.p} step={1} onChange={(v: number) => setAuditInputs({ ...auditInputs, p: v })} icon="💎" />
                     <AuditInput label="K (meq)" value={auditInputs.k} step={0.01} onChange={(v: number) => setAuditInputs({ ...auditInputs, k: v })} icon="🍌" />
                  </div>
                  <div className="flex gap-4">
                     <button id="soil-deep-audit-btn" onClick={() => handleAuditSubmit(true)} disabled={isLoading} className="flex-1 bg-emerald-600 text-white py-6 rounded-[2.5rem] font-black text-xl shadow-2xl active:scale-95 transition-all flex items-center justify-center space-x-3">
                        {isLoading ? <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div> : <span>ডিপ অডিট</span>}
                     </button>
                  </div>
               </div>

               {isLoading && (
                  <div className="bg-white p-12 rounded-[3.5rem] text-center shadow-xl border border-slate-50 mt-8 flex flex-col items-center space-y-6 print:hidden">
                     <div className="w-20 h-20 border-8 border-emerald-50 border-t-emerald-600 rounded-full animate-spin"></div>
                     <p className="font-black text-slate-800">{loadingMessages[loadingStep]}</p>
                  </div>
               )}

               {precisionFields && !isLoading && !advice && (
                  <div className="max-w-2xl mx-auto my-8 print:hidden">
                     <DynamicPrecisionForm
                        fields={precisionFields}
                        lang={lang}
                        onSubmit={handlePrecisionSubmit}
                        isLoading={isLoading}
                        toolProtocol="SRDI-BARC-FRG24"
                     />
                  </div>
               )}

               {advice && !isLoading && (
                  <div ref={reportRef} className="bg-slate-900 rounded-[4rem] p-10 md:p-14 text-white shadow-2xl border-t-[16px] border-emerald-600 animate-fade-in-up flex flex-col relative overflow-hidden print:rounded-none print:shadow-none print:bg-white print:text-slate-900 print:p-8 print:border-t-[10px] print:border-emerald-600 print:m-0">
                     <div className="flex justify-between items-center mb-8 border-b border-white/10 pb-6 relative z-10 print:border-slate-200">
                        <div>
                           <h3 className="text-3xl font-black tracking-tight print:text-2xl print:text-black">{lang === 'bn' ? 'অডিট রিপোর্ট' : 'Soil Audit Report'}</h3>
                           <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mt-1 print:text-slate-500">Verified SRDI Benchmarks</p>
                        </div>
                        <div className="flex items-center space-x-2 print:hidden">
                           <button onClick={handleDownload} className="p-4 rounded-full bg-blue-600 text-white shadow-xl hover:bg-blue-700 transition-all active:scale-90" title="PDF রিপোর্ট ডাউনলোড">
                              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                           </button>
                           <button onClick={handleSave} disabled={isSaving} className="p-4 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all active:scale-90 shadow-xl border border-white/10">
                              {isSaving ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 5h14m-14 0v14l7-7 7 7V5m-14 0h14" /></svg>}
                           </button>
                           <button onClick={() => playSpeech(advice!)} className={`p-5 rounded-full shadow-xl transition-all ${isSpeaking ? 'bg-rose-500 animate-pulse' : 'bg-white text-emerald-600'}`}>
                              {isSpeaking ? '🔇' : '🔊'}
                           </button>
                        </div>
                     </div>
                     <div className="prose prose-invert max-w-none text-slate-300 font-medium leading-relaxed text-xl whitespace-pre-wrap relative z-10 print:text-black print:text-sm print:prose-slate">
                        {advice}
                     </div>
                  </div>
               )}
            </div>
         )}

         {activeTab === 'texture' && (
            <div className="space-y-8 animate-fade-in px-2">
               <div className="bg-white rounded-[3rem] p-10 shadow-xl border border-slate-100 flex flex-col md:flex-row gap-12 items-center">
                  <div className="flex-1 space-y-8 w-full">
                     <h3 className="text-2xl font-black text-slate-800">{lang === 'bn' ? 'মাটির উপাদান (%)' : 'Soil Proportions (%)'}</h3>
                     <TextureSlider label={lang === 'bn' ? "বালু (Sand)" : "Sand"} val={sand} setVal={setSand} color="bg-amber-400" />
                     <TextureSlider label={lang === 'bn' ? "পলি (Silt)" : "Silt"} val={silt} setVal={setSilt} color="bg-blue-400" />
                     <TextureSlider label={lang === 'bn' ? "কাদা (Clay)" : "Clay"} val={clay} setVal={setClay} color="bg-rose-400" />
                     <div className="p-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                        <p className="text-[10px] font-black text-slate-400 uppercase text-center">{lang === 'bn' ? 'মোট উপাদানের পরিমাণ:' : 'Total Composition:'} {sand + silt + clay}%</p>
                     </div>
                  </div>

                  <div className="w-full md:w-[350px] bg-slate-900 rounded-[3rem] p-10 text-white text-center shadow-2xl relative overflow-hidden group">
                     <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl group-hover:scale-150 transition-transform"></div>
                     <p className="text-[10px] font-black uppercase text-emerald-400 tracking-widest mb-4">{lang === 'bn' ? 'শনাক্তকৃত বুনট' : 'Identified Texture'}</p>
                     <h4 className={`text-4xl font-black mb-6 ${textureResult.color}`}>{textureResult.name}</h4>
                     <p className="text-sm font-medium text-slate-400 leading-relaxed mb-8">{textureResult.desc}</p>
                     <div className="aspect-square w-24 h-24 mx-auto rounded-3xl bg-white/5 flex items-center justify-center text-5xl shadow-inner border border-white/10 group-hover:rotate-12 transition-transform">
                        {textureResult.name.includes('এঁটেল') ? '🥣' : textureResult.name.includes('বেলে') ? '🏜️' : textureResult.name.includes('পলি') ? '💧' : '🌱'}
                     </div>
                  </div>
               </div>

               <div className="bg-white rounded-[3rem] p-10 shadow-xl border border-slate-100">
                  <h3 className="text-2xl font-black text-slate-800 mb-8 flex items-center">
                     <span className="w-2 h-8 bg-blue-500 rounded-full mr-4"></span>
                     {lang === 'bn' ? 'বুনট অনুযায়ী চাষাবাদ নির্দেশিকা' : 'Soil Texture Management Guide'}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <TextureGuideItem title={lang === 'bn' ? "সেচ ব্যবস্থাপনা" : "Irrigation"} icon="🚿" desc={lang === 'bn' ? "বেলে মাটিতে ঘনঘন সেচ লাগে, এঁটেল মাটিতে একবার সেচ অনেকদিন থাকে।" : "Sandy soil needs frequent irrigation, clayey soil retains water for long durations."} />
                     <TextureGuideItem title={lang === 'bn' ? "সার প্রয়োগ পদ্ধতি" : "Fertilization"} icon="⚖️" desc={lang === 'bn' ? "বেলে মাটিতে সার ধুয়ে যায় (Leaching), তাই ভাগ করে প্রয়োগ করুন।" : "Sand prone to leaching; apply fertilizer in small multiple splits."} />
                     <TextureGuideItem title={lang === 'bn' ? "নিড়ানি ও চাষ" : "Tillage"} icon="🚜" desc={lang === 'bn' ? "এঁটেল মাটিতে চাষ করা কঠিন (Heavy Soil), জো বুঝে চাষ করা জরুরি।" : "Clay is heavy and hard to till; time tillage based on optimal moisture (Jo)."} />
                     <TextureGuideItem title={lang === 'bn' ? "সবচেয়ে উপযুক্ত ফসল" : "Best Crops"} icon="🍎" desc={lang === 'bn' ? "দোআঁশ মাটিতে প্রায় সব ফসলই হয়। এঁটেল মাটি ধানের জন্য শ্রেষ্ঠ।" : "Loam is versatile. Clay is superior for Rice cultivation."} />
                  </div>
               </div>
            </div>
         )}

         {activeTab === 'om_calc' && (
            <div className="space-y-8 animate-fade-in px-2">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-white rounded-[3rem] p-10 shadow-xl border border-slate-100 space-y-8">
                     <h3 className="text-2xl font-black text-slate-800">{lang === 'bn' ? 'মাটির উর্বরতা টার্গেট' : 'Soil Fertility Target'}</h3>

                     <div className="space-y-6">
                        <div>
                           <div className="flex justify-between items-center ml-4 mb-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'বর্তমান জৈব পদার্থ (%)' : 'Current OM (%)'}</label>
                              <button onClick={() => toggleListening('currentOM')} className={`p-1.5 rounded-lg transition-all ${isListening && activeListeningId === 'currentOM' ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-50 text-slate-400 hover:text-emerald-600'}`}>🎙️</button>
                           </div>
                           <input type="number" step="0.1" value={currentOM} onChange={(e) => setCurrentOM(parseFloat(e.target.value))} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-6 font-black text-xl text-emerald-600 outline-none focus:border-emerald-500 shadow-inner" />
                        </div>
                        <div>
                           <div className="flex justify-between items-center ml-4 mb-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'লক্ষ্যমাত্রা (%)' : 'Target OM (%)'}</label>
                              <button onClick={() => toggleListening('targetOM')} className={`p-1.5 rounded-lg transition-all ${isListening && activeListeningId === 'targetOM' ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-50 text-slate-400 hover:text-emerald-600'}`}>🎙️</button>
                           </div>
                           <input type="number" step="0.1" value={targetOM} onChange={(e) => setTargetOM(parseFloat(e.target.value))} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-6 font-black text-xl text-blue-600 outline-none focus:border-emerald-500 shadow-inner" />
                        </div>
                        <div>
                           <div className="flex justify-between items-center ml-4 mb-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'জমির পরিমাণ (বিঘা)' : 'Land Area (Bigha)'}</label>
                              <button onClick={() => toggleListening('landArea')} className={`p-1.5 rounded-lg transition-all ${isListening && activeListeningId === 'landArea' ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-50 text-slate-400 hover:text-emerald-600'}`}>🎙️</button>
                           </div>
                           <input type="number" value={landArea} onChange={(e) => setLandArea(parseInt(e.target.value))} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-6 font-black text-xl text-slate-700 outline-none focus:border-emerald-500 shadow-inner" />
                        </div>
                     </div>
                  </div>

                  <div className="bg-emerald-600 rounded-[3rem] p-10 text-white shadow-2xl flex flex-col justify-center relative overflow-hidden group">
                     <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl group-hover:scale-110 transition-transform"></div>
                     <div className="relative z-10 text-center">
                        <p className="text-[11px] font-black uppercase tracking-[0.3em] opacity-80 mb-6">{lang === 'bn' ? 'প্রয়োজনীয় কম্পোস্ট সার' : 'Required Compost Amount'}</p>
                        <h4 className="text-7xl font-black tracking-tighter mb-4">{omCalculation.neededPerBigha} <span className="text-2xl font-bold opacity-60">টন</span></h4>
                        <p className="text-lg font-medium opacity-90 leading-relaxed px-4">{lang === 'bn' ? 'আগামী ৩ বছরে ধীরে ধীরে প্রয়োগ করে লক্ষ্যমাত্রা অর্জন করুন।' : 'Achieve target by split application over the next 3 years.'}</p>
                        <div className="mt-10 inline-flex items-center space-x-3 bg-white/20 px-6 py-3 rounded-2xl border border-white/20">
                           <span className="text-2xl">🌱</span>
                           <span className="text-xs font-black uppercase tracking-widest">{lang === 'bn' ? 'মাটি পুনর্গঠন পরিকল্পনা' : 'Soil Restoration Plan'}</span>
                        </div>
                     </div>
                  </div>
               </div>

               <div className="bg-white rounded-[4rem] p-10 md:p-14 shadow-2xl border border-slate-100">
                  <div className="flex items-center space-x-4 mb-12">
                     <div className="w-16 h-16 bg-emerald-50 rounded-3xl flex items-center justify-center text-4xl shadow-inner">🧪</div>
                     <div>
                        <h3 className="text-3xl font-black text-slate-800 tracking-tight">{lang === 'bn' ? 'জৈব মিশ্রণ গাইড (Mixer Guide)' : 'Special Attribute Mixer Guide'}</h3>
                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-1">Optimal Ratios for Soil Improvement</p>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                     <MixerCard title={lang === 'bn' ? "আদর্শ মিক্স" : "Standard Mix"} ratio="৩ : ২ : ১" labels={lang === 'bn' ? ["গোবর/কুড়া", "সবুজ ঘাস", "খড়/নাড়া"] : ["Manure", "Green Waste", "Straw"]} desc={lang === 'bn' ? "সাধারণ উর্বরতা রক্ষার জন্য এই মিশ্রণটি সবচেয়ে ভালো।" : "Best for maintaining general baseline fertility."} color="emerald" />
                     <MixerCard title={lang === 'bn' ? "বেলে মাটি সংস্কার" : "Sand Amendment"} ratio="৪ : ১ : ১" labels={lang === 'bn' ? ["কাদাযুক্ত মাটি", "ভার্মি-কম্পোস্ট", "অন্যান্য"] : ["Clay-Soil", "Vermi-compost", "Others"]} desc={lang === 'bn' ? "বেলে মাটির পানি ধারণ ক্ষমতা বাড়াতে কাদা মেশানো জরুরি।" : "Adding clay is critical to increase sandy soil retention."} color="blue" />
                     <MixerCard title={lang === 'bn' ? "লবণাক্ততা দমন" : "Salinity Control"} ratio="২ : ২ : ১" labels={lang === 'bn' ? ["জিপসাম", "জৈব সার", "খামারজাত সার"] : ["Gypsum", "Organic", "Farmyard"]} desc={lang === 'bn' ? "জিপসাম এবং উচ্চ জৈব সার লবণের প্রভাব কমিয়ে দেয়।" : "Gypsum and high organic content buffers salt impact."} color="amber" />
                  </div>

                  <div className="mt-12 p-8 bg-slate-900 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden">
                     <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl"></div>
                     <h4 className="text-[11px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-4">পেশাদার টিপস (Scientific Tip)</h4>
                     <p className="text-sm font-medium leading-relaxed text-slate-300 italic">
                        {lang === 'bn'
                           ? "মিশ্রণটি ব্যবহারের আগে অন্তত ১৫ দিন ছায়াযুক্ত স্থানে পচাতে দিন। এতে মাইক্রোবিয়াল এক্টিভিটি কয়েক গুণ বৃদ্ধি পায়।"
                           : "Allow the mix to decompose in a shaded area for at least 15 days before use to multiply microbial activity."}
                     </p>
                  </div>
               </div>
            </div>
         )}

         <style dangerouslySetInnerHTML={{
            __html: `
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

const AuditInput = ({ label, value, onChange, step = 1, icon }: any) => (
   <div className="space-y-2 group">
      <div className="flex items-center space-x-2">
         <span className="text-base grayscale group-hover:grayscale-0 transition-all">{icon}</span>
         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
      </div>
      <input type="number" value={value} step={step} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-black text-center text-lg text-slate-700 outline-none focus:border-emerald-500 shadow-inner" />
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

const TextureGuideItem = ({ title, icon, desc }: any) => (
   <div className="flex items-start space-x-4 p-5 rounded-3xl bg-slate-50 border border-slate-100 hover:border-blue-100 transition-all">
      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-2xl shadow-sm shrink-0">{icon}</div>
      <div>
         <h4 className="font-black text-slate-800 text-sm mb-1">{title}</h4>
         <p className="text-xs text-slate-500 leading-relaxed font-medium">{desc}</p>
      </div>
   </div>
);

const MixerCard = ({ title, ratio, labels, desc, color }: any) => (
   <div className="flex flex-col h-full">
      <div className={`bg-white rounded-[2.5rem] p-8 border-2 border-slate-100 flex-1 flex flex-col items-center text-center group hover:border-${color}-500 transition-all shadow-sm`}>
         <h4 className="text-lg font-black text-slate-800 mb-6">{title}</h4>
         <div className="flex items-center space-x-2 mb-8">
            {labels.map((l: string, i: number) => (
               <div key={i} className="flex flex-col items-center">
                  <span className="text-[8px] font-black text-slate-400 uppercase mb-1">{l}</span>
                  <div className={`w-10 h-10 rounded-xl bg-${color}-50 text-${color}-600 flex items-center justify-center font-black text-lg border border-${color}-100`}>{ratio.split(' : ')[i]}</div>
               </div>
            ))}
         </div>
         <p className="text-xs text-slate-500 leading-relaxed font-medium">{desc}</p>
      </div>
   </div>
);

export default SoilExpert;
