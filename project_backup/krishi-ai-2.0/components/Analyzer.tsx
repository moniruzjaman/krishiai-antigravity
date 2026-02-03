
import React, { useState, useRef, useEffect } from 'react';
import { analyzeCropImage, generateSpeech, requestPrecisionParameters, performDeepAudit, getLiveWeather, visionGroundedAgriSearch, getPesticideExpertAdvice, getBiocontrolExpertAdvice, getAISprayAdvisory } from '../services/geminiService';
import { classifyPlantDiseaseHF } from '../services/huggingfaceService';
import { getStoredLocation } from '../services/locationService';
import { AnalysisResult, SavedReport, UserCrop, View, Language, WeatherData, UserSettings } from '../types';
import { CROPS_BY_CATEGORY } from '../constants';
import ShareDialog from './ShareDialog';
import DynamicPrecisionForm from './DynamicPrecisionForm';
import { useSpeech } from '../App';
import GuidedTour, { TourStep } from './GuidedTour';
import { ToolGuideHeader } from './ToolGuideHeader';
import { shareContent } from '../services/shareService';
import CABIDiagnosisTraining from './CABIDiagnosisTraining';

interface AnalyzerProps {
  onAction?: () => void;
  onSaveReport?: (report: Omit<SavedReport, 'id' | 'timestamp'>) => void;
  onShowFeedback?: () => void;
  onBack?: () => void;
  onNavigate?: (view: View) => void;
  userRank?: string;
  userCrops?: UserCrop[];
  lang: Language;
  userSettings?: UserSettings;
}

const ANALYZER_TOUR: TourStep[] = [
  { title: "সমন্বিত এআই অডিট", content: "এই এআই স্ক্যানার একই সাথে পোকা (Pest), রোগ (Disease) এবং পুষ্টির অভাব (Nutrient Deficiency) শনাক্ত করতে পারে।", position: 'center' },
  { targetId: "analyzer-media-selector", title: "মিডিয়া নির্বাচন", content: "আপনি এখন ছবি অথবা ভিডিওর মাধ্যমে নিখুঁত ডায়াগনোসিস করতে পারেন।", position: 'bottom' },
  { targetId: "live-cam-btn", title: "লাইভ এআই ক্যামেরা", content: "সরাসরি মাঠ থেকে লাইভ ভিডিও এবং অডিওর মাধ্যমে ডায়াগনোসিস করতে এটি ব্যবহার করুন।", position: 'top' }
];

const Analyzer: React.FC<AnalyzerProps> = ({ onAction, onSaveReport, onShowFeedback, onBack, onNavigate, userRank, userCrops = [], lang, userSettings }) => {
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('');
  const [userQuery, setUserQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [precisionFields, setPrecisionFields] = useState<any[] | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const [expertAdvice, setExpertAdvice] = useState<string | null>(null);
  const [isExpertLoading, setIsExpertLoading] = useState(false);
  const [sprayAdvisory, setSprayAdvisory] = useState<{ text: string } | null>(null);
  const [isSprayLoading, setIsSprayLoading] = useState(false);

  // New State for 2-step flow
  // New State for 2-step flow + Training
  const [viewStep, setViewStep] = useState<'upload' | 'analyzing' | 'diagnosis' | 'advice' | 'training'>('upload');

  const { playSpeech, stopSpeech, isSpeaking, speechEnabled } = useSpeech();
  const [cropFamily, setCropFamily] = useState<string>('ধান');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const recognitionRef = useRef<any>(null);

  const loadingMessages = lang === 'bn' ? [
    "ডিজিটাল ইমেজ সেন্সর ক্যালিব্রেট করা হচ্ছে...",
    "পাতার (Leaves) প্যাথলজিকাল প্যাটার্ন পরীক্ষা করা হচ্ছে...",
    "কাণ্ড ও শরীরের (Stems/Body) সুস্থতা যাচাই করা হচ্ছে...",
    "CABI ডায়াগনোসিস লজিকের সাথে তথ্য মেলানো হচ্ছে...",
    "মাল্টি-মডেল এআই ভেরিফিকেশন চলছে (Gemini 3 Flash)...",
    "নিখুঁত বৈজ্ঞানিক ব্যবস্থাপত্র (Report) চূড়ান্ত করা হচ্ছে..."
  ] : [
    "Calibrating digital image sensors...",
    "Scanning pathological patterns on leaves...",
    "Verifying health of stems and plant body parts...",
    "Mapping symptoms to CABI diagnosis protocols...",
    "Multi-modal AI verification in progress (Gemini 3 Flash)...",
    "Finalizing official scientific advisory report..."
  ];

  useEffect(() => {
    const tourDone = localStorage.getItem('agritech_tour_analyzer_v5');
    if (!tourDone) setShowTour(true);

    const loadWeather = async () => {
      const loc = getStoredLocation();
      if (loc) {
        try {
          const data = await getLiveWeather(loc.lat, loc.lng, false, lang);
          setWeather(data);
        } catch (e) { }
      }
    };
    loadWeather();

    const hasPermission = localStorage.getItem('agritech_permissions_granted') === 'true';
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition && hasPermission) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.lang = lang === 'bn' ? 'bn-BD' : 'en-US';
      recognitionRef.current.onstart = () => setIsListening(true);
      recognitionRef.current.onresult = (event: any) => setUserQuery(prev => prev + ' ' + event.results[0][0].transcript);
      recognitionRef.current.onend = () => setIsListening(false);
      recognitionRef.current.onerror = () => setIsListening(false);
    }
  }, [lang]);

  useEffect(() => {
    let interval: any;
    if (isLoading) interval = setInterval(() => setLoadingStep(prev => (prev + 1) % loadingMessages.length), 2000);
    return () => clearInterval(interval);
  }, [isLoading]);

  const startLiveMode = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsLiveMode(true);
        setSelectedMedia(null);
        setResult(null);
      }
    } catch (err) {
      alert(lang === 'bn' ? "ক্যামেরা অ্যাক্সেস করা সম্ভব হয়নি।" : "Camera access denied.");
    }
  };

  const stopLiveMode = () => {
    const stream = videoRef.current?.srcObject as MediaStream;
    stream?.getTracks().forEach(track => track.stop());
    setIsLiveMode(false);
  };

  const captureFrame = (isDeepAudit: boolean = false) => {
    if (videoRef.current && canvasRef.current) {
      setShowFlash(true);
      setTimeout(() => setShowFlash(false), 400);

      const context = canvasRef.current.getContext('2d');
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      context?.drawImage(videoRef.current, 0, 0);
      const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.95);
      setSelectedMedia(dataUrl);
      setMimeType('image/jpeg');
      stopLiveMode();
      handleAnalyze(isDeepAudit, dataUrl);
    }
  };

  const handleAnalyze = async (precision: boolean = false, dataUrlOverride?: string) => {
    let mediaToAnalyze = dataUrlOverride || selectedMedia;
    let typeToAnalyze = dataUrlOverride ? 'image/jpeg' : mimeType;

    if (!mediaToAnalyze && isLiveMode && videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      context?.drawImage(videoRef.current, 0, 0);
      mediaToAnalyze = canvasRef.current.toDataURL('image/jpeg', 0.95);
      typeToAnalyze = 'image/jpeg';
      setSelectedMedia(mediaToAnalyze);
      setMimeType('image/jpeg');
      stopLiveMode();
    }

    if (!mediaToAnalyze) return;

    setIsLoading(true);
    setViewStep('analyzing');
    setResult(null);
    setPrecisionFields(null);
    setExpertAdvice(null);
    setSprayAdvisory(null);
    setLoadingStep(0);

    const loadingTimer = setInterval(() => {
      setLoadingStep(prev => (prev < loadingMessages.length - 1 ? prev + 1 : prev));
    }, 2500);

    try {
      const base64 = (mediaToAnalyze || '').split(',')[1];

      if (precision) {
        const fields = await requestPrecisionParameters(base64, typeToAnalyze, cropFamily, lang);
        if (!fields || fields.length === 0) {
          const isImage = typeToAnalyze.startsWith('image/');
          const [analysis, hfResults] = await Promise.all([
            analyzeCropImage(base64, typeToAnalyze, { cropFamily, userRank, query: userQuery, lang, weather: weather || undefined }),
            isImage ? classifyPlantDiseaseHF(base64) : Promise.resolve(null)
          ]);
          setResult({ ...analysis, hfResults: hfResults || undefined });
          setViewStep('diagnosis');
          if (speechEnabled) playSpeech(`${analysis.diagnosis}. ${analysis.technicalSummary || ''}`);
        } else {
          setPrecisionFields(fields);
        }
      } else {
        const isImage = typeToAnalyze.startsWith('image/');
        const [analysis, hfResults] = await Promise.all([
          analyzeCropImage(base64, typeToAnalyze, { cropFamily, userRank, query: userQuery, lang, weather: weather || undefined }),
          isImage ? classifyPlantDiseaseHF(base64) : Promise.resolve(null)
        ]);
        setResult({ ...analysis, hfResults: hfResults || undefined });
        setViewStep('diagnosis');
        if (speechEnabled) playSpeech(`${analysis.diagnosis}. ${analysis.technicalSummary || ''}`);
        if (onAction) onAction();
      }
    } catch (error: any) {
      console.warn("Primary Analysis failed, initiating Deep Cross-Verification (Seamless Recovery)...");
      try {
        setLoadingStep(loadingMessages.length - 1);
        const base64 = (mediaToAnalyze || '').split(',')[1];

        const fallbackResult = await visionGroundedAgriSearch(
          base64,
          typeToAnalyze,
          cropFamily,
          userQuery || "general health Check",
          lang
        );

        setResult({ ...fallbackResult, officialSource: `(DEEP VERIFICATION) ${fallbackResult.officialSource}` });
        setViewStep('diagnosis');
        if (speechEnabled) playSpeech(`${fallbackResult.diagnosis}. ${fallbackResult.technicalSummary || ''}`);
        if (onAction) onAction();
      } catch (fallbackErr) {
        console.error("Critical Analysis Failure:", fallbackErr);
        alert(lang === 'bn' ? "দুঃখিত, বৈজ্ঞানিক তথ্যসূত্র পাওয়া যায়নি। - Gemini 3 Flash" : "Error: Official scientific protocol not found. - Gemini 3 Flash");
        setViewStep('upload');
      }
    } finally {
      clearInterval(loadingTimer);
      setIsLoading(false);
    }
  };

  const handlePrecisionSubmit = async (dynamicData: Record<string, string>) => {
    if (!selectedMedia) return;
    setIsLoading(true);
    setViewStep('analyzing');
    setResult(null);
    setExpertAdvice(null);
    setSprayAdvisory(null);
    setLoadingStep(0);
    try {
      const base64 = selectedMedia.split(',')[1];
      const isImage = mimeType.startsWith('image/');
      const [analysis, hfResults] = await Promise.all([
        performDeepAudit(base64, mimeType, cropFamily, dynamicData, lang, weather || undefined),
        isImage ? classifyPlantDiseaseHF(base64) : Promise.resolve(null)
      ]);
      setResult({ ...analysis, hfResults: hfResults || undefined });
      setViewStep('diagnosis');
      setPrecisionFields(null);
      if (speechEnabled) playSpeech(`${analysis.diagnosis}. ${analysis.technicalSummary || ''}`);
      if (onAction) onAction();
    } catch (e) {
      alert(lang === 'bn' ? "ডিপ অডিট ব্যর্থ হয়েছে।" : "Deep Audit Failed.");
      setViewStep('upload');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveToHistory = async () => {
    if (result && onSaveReport && selectedMedia) {
      setIsSaving(true);
      try {
        const audioBase64 = await generateSpeech(result.fullText.replace(/[*#_~]/g, ''));
        onSaveReport({
          type: 'Official Scientific Audit (Gemini 3)',
          title: result.diagnosis,
          content: result.fullText,
          audioBase64,
          icon: result.category === 'Pest' ? '🦗' : result.category === 'Disease' ? '🦠' : result.category === 'Deficiency' ? '⚖️' : '🍂',
          imageUrl: selectedMedia,
        });
        alert(lang === 'bn' ? "অফিসিয়াল রিপোর্ট সংরক্ষিত হয়েছে!" : "Official Report Saved!");
      } catch (e) {
        onSaveReport({
          type: 'Official Scientific Audit (Gemini 3)',
          title: result.diagnosis,
          content: result.fullText,
          icon: result.category === 'Pest' ? '🦗' : result.category === 'Disease' ? '🦠' : result.category === 'Deficiency' ? '⚖️' : '🍂',
          imageUrl: selectedMedia,
        });
        alert(lang === 'bn' ? "সংরক্ষিত হয়েছে (অডিও ছাড়া)" : "Saved (without audio)");
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleQuickShare = async () => {
    if (!result) return;
    const { success } = await shareContent(`Krishi AI Diagnostic: ${result.diagnosis}`, result.fullText);
    if (!success) setIsShareOpen(true);
  };

  const handleGetExpertAdvice = async () => {
    if (!result) return;
    setIsExpertLoading(true);
    try {
      let advice;
      if (result.category === 'Pest' || result.category === 'Disease') {
        advice = await getPesticideExpertAdvice(result.diagnosis, lang);
      } else {
        advice = await getBiocontrolExpertAdvice(result.diagnosis);
      }
      setExpertAdvice(typeof advice === 'string' ? advice : advice.text);
    } catch (e) {
      console.error(e);
    } finally {
      setIsExpertLoading(false);
    }
  };

  const handleGetSprayAdvisory = async () => {
    if (!result || !weather) return;
    setIsSprayLoading(true);
    try {
      const advice = await getAISprayAdvisory(cropFamily, result.diagnosis, weather, lang);
      setSprayAdvisory(advice);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSprayLoading(false);
    }
  };

  // Helper to determine recommendation source text based on crop/category
  const getRecommendationSource = () => {
    if (result?.category === 'Pest' || result?.category === 'Disease') {
      return "DAE (Pesticide/IPM)";
    }
    if (cropFamily.includes('ধান') || cropFamily.toLowerCase().includes('rice')) {
      return "BRRI Protocol";
    }
    return "BARI Protocol";
  };

  if (viewStep === 'upload' || viewStep === 'analyzing') {
    return (
      <div className="max-w-4xl mx-auto p-4 pb-32 animate-fade-in font-sans">
        {showTour && <GuidedTour steps={ANALYZER_TOUR} tourKey="analyzer_v5" onClose={() => setShowTour(false)} />}
        <ToolGuideHeader
          title={lang === 'bn' ? 'অফিসিয়াল সায়েন্টিফিক অডিট (Gemini 3)' : 'Official Scientific Audit (Gemini 3)'}
          subtitle={lang === 'bn' ? 'পোকা, রোগ ও পুষ্টির অভাব শনাক্তকরণ এবং বিএআরআই/বিআরআরআই প্রটোকল ভিত্তিক প্রতিকার।' : 'Identify pests, diseases, and deficiencies with official BARI/BRRI protocols.'}
          protocol="BARC/BARI/BRRI Grounded"
          source="Authentic BD Government Repositories"
          lang={lang}
          onBack={onBack || (() => { })}
          icon="🔬"
          themeColor="emerald"
          guideSteps={lang === 'bn' ? [
            "শস্য নির্বাচন করুন বা আক্রান্ত অংশের ছবি তুলুন।",
            "লাইভ ক্যামেরা ব্যবহার করে সরাসরি মাঠ থেকে ডায়াগনোসিস করুন।",
            "তথ্যসূত্র যাচাই করতে রিপোর্টের নিচের লিংকে ক্লিক করুন।",
            "সকল পরামর্শ বিএআরআই (BARI) বা বিআরআরআই (BRRI) এর প্রটোকল অনুযায়ী তৈরি।"
          ] : [
            "Select crop or take photo of affected part.",
            "Use Live Camera for real-time field diagnosis.",
            "Click verification links at the bottom of report for authentic sources.",
            "All advisories follow BARI/BRRI plant protection protocols."
          ]}
        />
        <div className="bg-white rounded-[3rem] p-6 md:p-10 shadow-xl border border-slate-100 mb-8">
          <div className="space-y-6 mb-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>{lang === 'bn' ? 'শস্য ও ডায়াগনোসিস মোড' : 'Crop & Diagnosis Mode'}</span>
              </div>
              <div className="bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100 flex items-center space-x-2">
                <span className="text-[8px] font-black text-indigo-600 uppercase tracking-widest">Grounded Source Verification</span>
              </div>
            </div>
            <select value={cropFamily} onChange={(e) => setCropFamily(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-6 font-black text-lg text-slate-700 focus:border-emerald-500 outline-none shadow-inner appearance-none transition-all">
              {Object.values(CROPS_BY_CATEGORY).flat().map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              <div id="analyzer-media-selector" className="md:col-span-5 aspect-square relative">
                {isLiveMode ? (
                  <div className="w-full h-full rounded-[2.5rem] overflow-hidden border-4 border-emerald-50 shadow-2xl relative bg-black">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute left-0 w-full h-0.5 bg-emerald-500 shadow-[0_0_15px_#10b981] animate-scanning-line z-10"></div>
                      <div className="absolute top-8 left-8 w-10 h-10 border-t-2 border-l-2 border-emerald-500/60 rounded-tl-xl"></div>
                      <div className="absolute top-8 right-8 w-10 h-10 border-t-2 border-r-2 border-emerald-500/60 rounded-tr-xl"></div>
                      <div className="absolute bottom-8 left-8 w-10 h-10 border-b-2 border-l-2 border-emerald-500/60 rounded-bl-xl"></div>
                      <div className="absolute bottom-8 right-8 w-10 h-10 border-b-2 border-r-2 border-emerald-500/60 rounded-br-xl"></div>
                    </div>
                    {showFlash && <div className="absolute inset-0 bg-white z-[100] animate-camera-flash"></div>}
                    <div className="absolute bottom-6 left-0 right-0 flex justify-center space-x-4 px-6 z-30">
                      <button onClick={() => captureFrame(true)} className="flex-[2] bg-emerald-600 text-white py-4 rounded-2xl font-black text-xs uppercase shadow-xl active:scale-95 transition-all border-b-4 border-emerald-800">সায়েন্টিফিক স্ক্যান</button>
                      <button onClick={() => captureFrame(false)} className="flex-1 bg-white text-slate-900 py-4 rounded-2xl font-black text-xs uppercase shadow-xl active:scale-95 transition-all">দ্রুত ফটো</button>
                      <button onClick={stopLiveMode} className="p-4 bg-red-600 text-white rounded-2xl shadow-xl active:scale-95">✕</button>
                    </div>
                  </div>
                ) : selectedMedia ? (
                  <div className="w-full h-full rounded-[2.5rem] overflow-hidden border-4 border-emerald-50 shadow-2xl relative bg-black group">
                    {mimeType.startsWith('video/') ? <video src={selectedMedia} className="w-full h-full object-cover" controls /> : <img src={selectedMedia} className="w-full h-full object-cover" alt="Scan" />}
                    <button onClick={() => { setSelectedMedia(null); setPrecisionFields(null); setResult(null); }} className="absolute top-4 right-4 p-2 bg-black/40 backdrop-blur-md rounded-full text-white z-20 opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 h-full">
                    <button id="live-cam-btn" onClick={startLiveMode} className="col-span-2 bg-slate-900 rounded-[2.5rem] border-4 border-slate-800 flex flex-col items-center justify-center space-y-3 hover:bg-black transition-all group overflow-hidden relative">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform"></div>
                      <div className="text-4xl">🔴</div>
                      <p className="text-[10px] font-black text-white uppercase tracking-widest">{lang === 'bn' ? 'লাইভ এআই ক্যামেরা' : 'Live AI Camera'}</p>
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} className="col-span-1 bg-slate-50 rounded-[2rem] border-4 border-dashed border-slate-200 flex flex-col items-center justify-center space-y-2 hover:border-emerald-400 transition-all">
                      <div className="text-2xl">🖼️</div>
                      <p className="text-[8px] font-black text-slate-400 uppercase">{lang === 'bn' ? 'ছবি আপলোড' : 'Upload'}</p>
                    </button>
                    <button onClick={() => videoInputRef.current?.click()} className="col-span-1 bg-rose-50 rounded-[2rem] border-4 border-dashed border-rose-200 flex flex-col items-center justify-center space-y-2 hover:border-rose-400 transition-all">
                      <div className="text-2xl">📹</div>
                      <p className="text-[8px] font-black text-rose-600 uppercase">{lang === 'bn' ? 'ভিডিও' : 'Video'}</p>
                    </button>
                  </div>
                )}
                <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onloadend = () => { setSelectedMedia(reader.result as string); setMimeType(file.type); setPrecisionFields(null); setResult(null); };
                    reader.readAsDataURL(file);
                  }
                }} />
                <input type="file" ref={videoInputRef} accept="video/*" className="hidden" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onloadend = () => { setSelectedMedia(reader.result as string); setMimeType(file.type); setPrecisionFields(null); setResult(null); };
                    reader.readAsDataURL(file);
                  }
                }} />
                <canvas ref={canvasRef} className="hidden" />
              </div>
              <div className="md:col-span-7 flex flex-col space-y-4">
                <div className="flex-1 bg-slate-900 rounded-[2.5rem] p-6 flex flex-col focus-within:ring-4 ring-emerald-500/30 transition-all shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 pointer-events-none"></div>
                  <textarea value={userQuery} onChange={(e) => setUserQuery(e.target.value)} placeholder={lang === 'bn' ? "লক্ষণগুলো বা অতিরিক্ত তথ্য লিখুন..." : "Describe symptoms..."} className="w-full flex-1 bg-transparent resize-none font-bold text-white placeholder:text-slate-700 outline-none text-lg min-h-[140px] relative z-10" />
                  <div className="flex items-center justify-between mt-4 gap-2 relative z-10">
                    <button onClick={() => isListening ? recognitionRef.current?.stop() : recognitionRef.current?.start()} className={`p-4 rounded-2xl transition-all shadow-lg ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-white/10 text-emerald-400 hover:bg-white/20'}`} title="ভয়েস প্রম্পট">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                    </button>
                    <button id="deep-audit-btn" onClick={() => handleAnalyze(true)} disabled={isLoading || (!selectedMedia && !isLiveMode)} className="flex-1 bg-emerald-600 text-white py-5 rounded-[1.8rem] font-black text-[10px] uppercase shadow-xl hover:bg-emerald-500 transition-all active:scale-95 disabled:opacity-50">সায়েন্টিফিক অডিট</button>
                    <button onClick={() => handleAnalyze(false)} disabled={isLoading || (!selectedMedia && !isLiveMode)} className="flex-1 bg-slate-800 text-white py-5 rounded-[1.8rem] font-black text-[10px] uppercase shadow-xl hover:bg-slate-700 transition-all active:scale-95 disabled:opacity-50">দ্রুত স্ক্যান</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {precisionFields && !isLoading && !result && (
          <DynamicPrecisionForm fields={precisionFields} lang={lang} onSubmit={handlePrecisionSubmit} isLoading={isLoading} toolProtocol="DAE-SCAN-V5" />
        )}
        {isLoading && (
          <div className="bg-white p-12 rounded-[3.5rem] text-center shadow-2xl flex flex-col items-center space-y-8 animate-fade-in my-8">
            <div className="relative">
              <div className="w-24 h-24 border-[10px] border-emerald-50 border-t-emerald-600 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center text-4xl animate-bounce">🔬</div>
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-slate-800 transition-all duration-500">{loadingMessages[loadingStep]}</h3>
              <div className="w-full max-w-xs mx-auto h-1.5 bg-slate-100 rounded-full overflow-hidden mt-4">
                <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${((loadingStep + 1) / loadingMessages.length) * 100}%` }}></div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // STEP 1: Diagnostic Result View
  if (viewStep === 'diagnosis' && result) {
    return (
      <div className="max-w-4xl mx-auto p-4 pb-32 animate-fade-in font-sans">
        <div className="bg-white rounded-[2rem] p-8 shadow-2xl border border-slate-100 mb-8 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full -mr-20 -mt-20 pointer-events-none"></div>

          {/* Header Status */}
          <div className="flex items-center justify-between mb-8 relative z-10">
            <div className="flex items-center space-x-3">
              <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
              <span className="text-xs font-black text-slate-500 uppercase tracking-widest">
                {lang === 'bn' ? 'সমস্যা শনাক্ত করা হয়েছে' : 'Issue Detected'}
              </span>
            </div>
            <button onClick={() => { setViewStep('upload'); setSelectedMedia(null); setResult(null); }} className="px-4 py-2 bg-slate-100 rounded-full text-xs font-bold text-slate-500 hover:bg-slate-200 transition-all">
              {lang === 'bn' ? 'নতুন স্ক্যান' : 'New Scan'}
            </button>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start relative z-10">
            {/* Left: Image & Quick Stats */}
            <div className="space-y-6">
              {selectedMedia && (
                <div className="w-full aspect-video rounded-3xl overflow-hidden border-4 border-slate-100 shadow-lg relative group">
                  <img src={selectedMedia} className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700" alt="Analyzed Crop" />
                  <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-white text-[10px] font-bold">
                    Gemini 3 Flash Verified
                  </div>
                </div>
              )}
              <div className="bg-emerald-50 p-5 rounded-3xl border border-emerald-100 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-wider mb-1">{lang === 'bn' ? 'কনফিডেন্স' : 'Confidence'}</p>
                  <p className="text-2xl font-black text-emerald-800">{result.confidence}%</p>
                </div>
                <div className="h-10 w-10 bg-white rounded-full flex items-center justify-center text-xl shadow-sm">🎯</div>
              </div>
            </div>

            {/* Right: Diagnosis Details */}
            <div className="space-y-6">
              <div>
                <span className={`inline-block px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest mb-3 ${result.category === 'Disease' ? 'bg-rose-100 text-rose-600' :
                  result.category === 'Pest' ? 'bg-amber-100 text-amber-600' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                  {result.category}
                </span>
                <h2 className="text-4xl font-black text-slate-800 leading-tight mb-2">
                  {result.diagnosis}
                </h2>
              </div>

              {result.structuredResult && (
                <div className="space-y-4">
                  {/* Symptoms */}
                  <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-3">
                      {lang === 'bn' ? 'প্রধান লক্ষণসমূহ (Symptoms)' : 'Key Symptoms'}
                    </h4>
                    <ul className="space-y-2">
                      {result.structuredResult.symptoms.slice(0, 3).map((s, i) => (
                        <li key={i} className="flex items-start text-sm text-slate-700 font-medium">
                          <span className="mr-2 text-emerald-500">●</span> {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <button
                onClick={() => setViewStep('advice')}
                className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-3xl font-black uppercase tracking-widest shadow-xl shadow-emerald-200 transform transition-all active:scale-95 flex items-center justify-center space-x-3 group"
              >
                <span>{lang === 'bn' ? 'সমাধান দেখুন' : 'Get Solution'}</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // STEP 2: Advisory / Remedy View
  if (viewStep === 'advice' && result && result.structuredResult) {
    return (
      <div className="max-w-4xl mx-auto p-4 pb-32 animate-fade-in font-sans">
        <div className="bg-white rounded-[3rem] shadow-2xl border border-slate-100 overflow-hidden relative print:shadow-none print:border-4">
          {/* Header */}
          <div className="bg-slate-900 p-8 md:p-12 text-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
            <div className="relative z-10">
              <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-md px-4 py-1.5 rounded-full mb-6 border border-white/20">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                <span className="text-[10px] font-black text-emerald-100 uppercase tracking-[0.2em]">Verified Protocol</span>
              </div>
              <h2 className="text-3xl md:text-5xl font-black text-white mb-4">{result.diagnosis}</h2>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">
                Source: <span className="text-emerald-400">{getRecommendationSource()}</span>
              </p>
            </div>
          </div>

          {/* Action Grid */}
          <div className="p-8 md:p-12 space-y-10">
            {/* Primary Recommendations */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-emerald-50 p-8 rounded-[2rem] border border-emerald-100">
                <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-2xl mb-4">🛡️</div>
                <h3 className="text-emerald-900 font-black text-lg mb-2">{lang === 'bn' ? 'নিরাপদ ব্যবস্থা' : 'Safe Action'}</h3>
                <p className="text-slate-700 text-sm font-medium leading-relaxed">
                  {result.structuredResult.recommendations.safe}
                </p>
              </div>
              <div className="bg-blue-50 p-8 rounded-[2rem] border border-blue-100">
                <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-2xl mb-4">⚡</div>
                <h3 className="text-blue-900 font-black text-lg mb-2">{lang === 'bn' ? 'কার্যকর সমাধান' : 'Effective Solution'}</h3>
                <p className="text-slate-700 text-sm font-medium leading-relaxed">
                  {result.structuredResult.recommendations.effective}
                </p>
              </div>
            </div>

            {/* Secondary Details */}
            <div className="bg-slate-50 rounded-[2.5rem] p-8 border border-slate-200">
              <h3 className="text-center text-xs font-black text-slate-400 uppercase tracking-[0.3em] mb-8">Detailed Management Protocol</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div>
                  <h4 className="font-black text-slate-800 text-sm mb-2 uppercase">{lang === 'bn' ? 'ব্যবহারিক' : 'Practical'}</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">{result.structuredResult.recommendations.practical}</p>
                </div>
                <div>
                  <h4 className="font-black text-slate-800 text-sm mb-2 uppercase">{lang === 'bn' ? 'লক্ষণীয়' : 'Availability'}</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">{result.structuredResult.recommendations.locallyAvailable}</p>
                </div>
                <div>
                  <h4 className="font-black text-slate-800 text-sm mb-2 uppercase">{lang === 'bn' ? 'IPM কৌশল' : 'IPM Strategy'}</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">{result.structuredResult.recommendations.ipmStrategy}</p>
                </div>
              </div>
            </div>

            {/* Expert Tools */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
              <button
                onClick={handleGetExpertAdvice}
                disabled={isExpertLoading}
                className="bg-indigo-600 hover:bg-indigo-500 text-white p-5 rounded-2xl flex items-center justify-center space-x-3 transition-all active:scale-95 disabled:opacity-50 shadow-xl shadow-indigo-200"
              >
                <span className="text-xl">{isExpertLoading ? '⌛' : '👨‍🔬'}</span>
                <span className="font-black text-[10px] uppercase">{lang === 'bn' ? 'বিশেষজ্ঞ পরামর্শ' : 'Expert Advice'}</span>
              </button>

              {(result.category === 'Pest' || result.category === 'Disease') && weather && (
                <button
                  onClick={handleGetSprayAdvisory}
                  disabled={isSprayLoading}
                  className="bg-blue-600 hover:bg-blue-500 text-white p-5 rounded-2xl flex items-center justify-center space-x-3 transition-all active:scale-95 disabled:opacity-50 shadow-xl shadow-blue-200"
                >
                  <span className="text-xl">{isSprayLoading ? '⌛' : '🚿'}</span>
                  <span className="font-black text-[10px] uppercase">{lang === 'bn' ? 'স্প্রে করার উপযুক্ত সময়' : 'Spray Advisory'}</span>
                </button>
              )}
            </div>

            {/* Dynamic Content Areas */}
            {expertAdvice && (
              <div className="p-6 bg-indigo-50 rounded-2xl border border-indigo-100 animate-fade-in">
                <h5 className="text-indigo-600 font-black text-[10px] uppercase mb-2 tracking-widest flex items-center">
                  <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mr-2"></span>
                  Expert Deep-Dive Result
                </h5>
                <p className="text-sm text-slate-700 leading-relaxed italic">{expertAdvice}</p>
              </div>
            )}

            {sprayAdvisory && (
              <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100 animate-fade-in">
                <h5 className="text-blue-600 font-black text-[10px] uppercase mb-2 tracking-widest flex items-center">
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2"></span>
                  Go/No-Go Spray Advisory
                </h5>
                <p className="text-sm text-slate-700 leading-relaxed font-bold">{sprayAdvisory.text}</p>
              </div>
            )}


            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-8 border-t border-slate-100">
              <button onClick={() => setViewStep('diagnosis')} className="text-xs font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-colors flex items-center">
                <span className="mr-2">←</span> {lang === 'bn' ? 'ফিরে যান' : 'Back'}
              </button>
              <div className="flex space-x-2">
                {/* NEW: Train on this Case Button */}
                <button
                  onClick={() => setViewStep('training')}
                  className="p-4 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-600 hover:text-purple-800 transition-colors flex items-center space-x-2"
                  title={lang === 'bn' ? 'এই কেস নিয়ে শিখুন' : 'Train on this Case'}
                >
                  <span>🎓</span>
                  <span className="text-[10px] font-black uppercase hidden sm:inline">{lang === 'bn' ? 'ট্রেনিং' : 'Train'}</span>
                </button>

                <button onClick={handleQuickShare} className="p-4 rounded-xl bg-slate-100 hover:bg-emerald-100 text-slate-400 hover:text-emerald-600 transition-colors">🔗</button>
                <button onClick={handleSaveToHistory} disabled={isSaving} className="p-4 rounded-xl bg-slate-900 text-white hover:bg-black transition-colors shadow-lg">💾 {lang === 'bn' ? 'সংরক্ষণ' : 'Save'}</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // STEP 3: Training View
  if (viewStep === 'training' && result) {
    // Pass the analysis result + the image URL (selectedMedia) to the training component
    const trainingContext = { ...result, imageUrl: selectedMedia };
    return (
      <CABIDiagnosisTraining
        onBack={() => setViewStep('advice')}
        onAction={() => {
          alert(lang === 'bn' ? "ট্রেনিং সম্পন্ন হয়েছে!" : "Training Completed!");
          setViewStep('advice');
        }}
        lang={lang}
        user={{ ...userSettings, myCrops: userCrops } as any}
        analysisResult={trainingContext}
      />
    );
  }

  return null;
};

export default Analyzer;
