
import React, { useState, useRef, useEffect } from 'react';
import { detectCurrentAEZDetails } from '../services/locationService';
import { getAIYieldPrediction, generateSpeech, decodeBase64, decodeAudioData } from '../services/geminiService';
import { CROPS_BY_CATEGORY, CROP_CATEGORIES } from '../constants';
import { User, SavedReport, Language } from '../types';
import ShareDialog from './ShareDialog';
import GuidedTour, { TourStep } from './GuidedTour';
import { ToolGuideHeader } from './ToolGuideHeader';

interface AIYieldPredictorProps {
  user?: User;
  onAction?: (xp: number) => void;
  onSaveReport?: (report: Omit<SavedReport, 'id' | 'timestamp'>) => void;
  onShowFeedback?: () => void;
  onBack?: () => void;
  lang: Language;
}

interface DynamicField {
  id: string;
  label: string;
  type: 'select' | 'text' | 'number';
  options?: string[];
  required: boolean;
  placeholder?: string;
}

const YIELD_TOUR: TourStep[] = [
  {
    title: "ফলন পূর্বাভাস",
    content: "আপনার ফসল কতটুকু ফলবে এবং তা বাড়ানোর উপায় জানতে ৩টি সহজ ধাপ পূরণ করুন।",
    position: 'center'
  },
  {
    targetId: "yield-steps-progress",
    title: "ধাপসমূহ",
    content: "প্রথমে ফসল ও অঞ্চল, তারপর চাষ পদ্ধতি এবং সবশেষে অতিরিক্ত তথ্য দিয়ে বিশ্লেষণ শুরু করুন।",
    position: 'bottom'
  },
  {
    targetId: "yield-aez-detector",
    title: "অঞ্চল শনাক্তকরণ",
    content: "সঠিক পূর্বাভাস পেতে 'লোকেশন' বাটন টিপে আপনার এলাকা নিশ্চিত করুন।",
    position: 'top'
  }
];

const yieldLoadingSteps = [
  "আঞ্চলিক মাটির গুণাগুণ বিশ্লেষণ করা হচ্ছে...",
  "ঐতিহাসিক আবহাওয়া প্যাটার্ন যাচাই চলছে...",
  "চাষাবাদ পদ্ধতির কার্যকারিতা মূল্যায়ন হচ্ছে...",
  "BARC/BRRI/BARI ফলন মডেল মেলানো হচ্ছে...",
  "চূড়ান্ত ফলন পূর্বাভাস ও অপ্টিমাইজেশন রিপোর্ট তৈরি হচ্ছে..."
];

const AIYieldPredictor: React.FC<AIYieldPredictorProps> = ({ user, onAction, onSaveReport, onShowFeedback, onBack, lang }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('cereals');
  const [crop, setCrop] = useState('ধান');
  const [aez, setAez] = useState('অঞ্চল নির্বাচন করুন');
  const [soilStatus, setSoilStatus] = useState('মাঝারি উর্বরতা');
  const [practice, setPractice] = useState('সমন্বিত বালাই ব্যবস্থাপনা (IPM)');
  const [water, setWater] = useState('পরিমিত সেচ ব্যবস্থা');
  const [notes, setNotes] = useState('');
  
  const [dynamicInputs, setDynamicInputs] = useState<Record<string, string>>({});
  const [formErrors, setFormErrors] = useState<Record<string, boolean>>({});

  const [prediction, setPrediction] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [activeListeningId, setActiveListeningId] = useState<string | null>(null);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showTour, setShowTour] = useState(false);

  // Guide Step State
  const [inputStep, setInputStep] = useState<1 | 2 | 3>(1);

  const audioContextRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const tourDone = localStorage.getItem('agritech_tour_yield');
    if (!tourDone) setShowTour(true);

    let interval: any;
    if (isLoading) {
      interval = setInterval(() => {
        setLoadingStep(prev => (prev + 1) % yieldLoadingSteps.length);
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.lang = 'bn-BD';
      recognitionRef.current.onstart = () => setIsListening(true);
      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (activeListeningId === 'notes') {
          setNotes(prev => prev + ' ' + transcript);
        } else if (activeListeningId) {
          setDynamicInputs(prev => ({ ...prev, [activeListeningId]: transcript }));
          setFormErrors(prev => ({ ...prev, [activeListeningId]: false }));
        }
      };
      recognitionRef.current.onerror = () => {
        setIsListening(false);
        setActiveListeningId(null);
      };
      recognitionRef.current.onend = () => {
        setIsListening(false);
        setActiveListeningId(null);
      };
    }
  }, [activeListeningId]);

  const toggleListening = (id: string) => {
    if (!recognitionRef.current) return alert("ভয়েস ইনপুট আপনার ব্রাউজারে সমর্থিত নয়।");
    if (isListening && activeListeningId === id) {
      recognitionRef.current.stop();
    } else {
      setActiveListeningId(id);
      recognitionRef.current.start();
    }
  };

  const getDynamicFields = (cat: string, cropName: string): DynamicField[] => {
    const fields: DynamicField[] = [
      { id: 'landType', label: 'জমির ধরণ (Land Type)', type: 'select', options: ['উঁচু জমি (Highland)', 'মাঝারি উঁচু', 'মাঝারি নিচু', 'নিচু জমি (Lowland)'], required: true },
      { id: 'growthStage', label: 'বর্তমান ধাপ (Growth Stage)', type: 'select', options: ['রোপণ/অঙ্কুরোদগম', 'বাড়ন্ত (Vegetative)', 'প্রজনন (Reproductive)', 'দানা গঠন (Ripening)'], required: true },
    ];

    if (cat === 'cereals' || cropName === 'ধান') {
      fields.push({ id: 'variety', label: 'ধানের জাত (Variety)', type: 'select', options: ['ব্রি ধান২৮', 'ব্রি ধান২৯', 'ব্রি ধান৮৯', 'বিআর-১১ (মুক্তা)', 'চিনিগুঁড়া', 'হাইব্রিড হীরা'], required: true });
    } else if (cat === 'tubers' || cropName === 'আলুর') {
      fields.push({ id: 'variety', label: 'আলুর জাত', type: 'select', options: ['ডায়মন্ড', 'কার্ডিনাল', 'লাল শীলবিলাতি', 'গ্রানোলা'], required: true });
    } else {
      fields.push({ id: 'variety', label: 'জাত/প্রজাতি', type: 'text', required: false, placeholder: 'যেমন: হাইব্রিড' });
    }

    return fields;
  };

  const dynamicFields = getDynamicFields(selectedCategory, crop);

  const handleDetectAEZ = async () => {
    setIsDetecting(true);
    try {
      const detected = await detectCurrentAEZDetails(true);
      setAez(`AEZ ${detected.id}: ${detected.name}`);
    } catch (error) {
      alert('লোকেশন পাওয়া যায়নি।');
    } finally {
      setIsDetecting(false);
    }
  };

  const handlePredict = async () => {
    const errors: Record<string, boolean> = {};
    let hasError = false;
    dynamicFields.forEach(field => {
      if (field.required && !dynamicInputs[field.id]) {
        errors[field.id] = true;
        hasError = true;
      }
    });

    if (hasError) {
      setFormErrors(errors);
      setInputStep(2); 
      alert("অনুগ্রহ করে সব প্রয়োজনীয় তথ্য পূরণ করুন।");
      return;
    }

    setIsLoading(true);
    setPrediction(null);
    setLoadingStep(0);

    if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
    }

    try {
      const res = await getAIYieldPrediction(
        crop, aez, soilStatus, practice, water, notes, user?.progress.rank, dynamicInputs, lang
      );
      setPrediction(res.text);
      
      if (res.text) {
        playTTS(res.text);
      }

      if (onAction) onAction(40);
      if (onShowFeedback) onShowFeedback();
    } catch (error) {
      alert("পূর্বাভাস তৈরি করতে সমস্যা হয়েছে।");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (prediction && onSaveReport) {
      setIsSaving(true);
      try {
        const audioBase64 = await generateSpeech(prediction.replace(/[*#_~]/g, ''));
        onSaveReport({
          type: 'Yield Prediction',
          title: `${crop} - ফলন পূর্বাভাস রিপোর্ট`,
          content: prediction,
          audioBase64,
          icon: '📈'
        });
        alert("অডিওসহ রিপোর্টটি প্রোফাইলে সেভ হয়েছে!");
      } catch (e) {
        onSaveReport({
          type: 'Yield Prediction',
          title: `${crop} - ফলন পূর্বাভাস রিপোর্ট`,
          content: prediction,
          icon: '📈'
        });
        alert("রিপোর্ট সেভ হয়েছে (অডিও ফাইল ছাড়াই)");
      } finally {
        setIsSaving(false);
      }
    }
  };

  const playTTS = async (textOverride?: string) => {
    const textToSpeak = textOverride || prediction;
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

  const handleCategoryChange = (catId: string) => {
    setSelectedCategory(catId);
    const crops = CROPS_BY_CATEGORY[catId] || [];
    if (crops.length > 0) setCrop(crops[0]);
    setDynamicInputs({});
    setFormErrors({});
  };

  const ProgressSteps = () => (
    <div id="yield-steps-progress" className="flex items-center space-x-2 mb-10 overflow-x-auto scrollbar-hide pb-2">
       {[
         { id: 1, label: 'ফসল ও অঞ্চল', icon: '📍' },
         { id: 2, label: 'চাষ পদ্ধতি', icon: '🚜' },
         { id: 3, label: 'বিশ্লেষণ', icon: '🔮' }
       ].map((s) => (
         <div key={s.id} className="flex items-center space-x-2 shrink-0">
            <button 
              onClick={() => { if (!prediction) setInputStep(s.id as any); }}
              disabled={isLoading || !!prediction}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black transition-all ${inputStep >= s.id ? 'bg-[#0A8A1F] text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-200'}`}
            >
              {s.id}
            </button>
            <span className={`text-[9px] font-black uppercase tracking-widest ${inputStep >= s.id ? 'text-[#0A8A1F]' : 'text-slate-400'}`}>{s.label}</span>
            {s.id < 3 && <div className={`w-4 h-[2px] ${inputStep > s.id ? 'bg-[#0A8A1F]' : 'bg-slate-200'}`}></div>}
         </div>
       ))}
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto p-4 bg-gray-50 min-h-screen font-sans pb-32 animate-fade-in">
      {showTour && <GuidedTour steps={YIELD_TOUR} tourKey="yield" onClose={() => setShowTour(false)} />}
      {isShareOpen && prediction && (
        <ShareDialog 
          isOpen={isShareOpen} 
          onClose={() => setIsShareOpen(false)} 
          title={`Yield Prediction: ${crop}`} 
          content={prediction} 
        />
      )}
      
      <ToolGuideHeader 
        title={lang === 'bn' ? 'এআই ফলন পূর্বাভাস' : 'AI Yield Prediction'}
        subtitle={lang === 'bn' ? 'আবহাওয়া, অঞ্চল এবং চাষ পদ্ধতির সমন্বয়ে আগাম ফলন ধারণা।' : 'Strategic harvest forecasting based on weather, AEZ, and management practices.'}
        protocol="Strategic Agronomic Model 3.1"
        source="AI Strategic Farming Intelligence"
        lang={lang}
        onBack={onBack || (() => {})}
        icon="🔮"
        themeColor="indigo"
        guideSteps={lang === 'bn' ? [
          "প্রথমে আপনার শস্যের বিভাগ এবং নাম নির্বাচন করুন।",
          "জমির ধরণ, শস্যের জাত এবং বর্তমান বৃদ্ধির ধাপ (Stage) নিশ্চিত করুন।",
          "চাষ পদ্ধতি (জৈব/সনাতন) এবং সেচ ব্যবস্থার তথ্য দিন।",
          "এআই মডেল আপনার জন্য সম্ভাব্য ফলন এবং তা বাড়ানোর উপায় জানাবে।"
        ] : [
          "Select your crop category and specific crop name.",
          "Specify land type, crop variety, and current growth stage.",
          "Provide management details like farming practice and irrigation type.",
          "The AI model will predict yield potential and improvement strategies."
        ]}
      />

      <ProgressSteps />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-[3rem] p-8 shadow-xl border border-gray-100 space-y-6 relative overflow-hidden min-h-[400px] flex flex-col">
            <div className="flex-1">
              {inputStep === 1 && (
                <div className="space-y-6 animate-fade-in">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center text-lg">🌾</div>
                    <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">ধাপ ১: ফসল ও এলাকার তথ্য</h4>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    {CROP_CATEGORIES.map(cat => (
                      <button 
                        key={cat.id} 
                        onClick={() => handleCategoryChange(cat.id)}
                        className={`flex items-center space-x-3 p-3 rounded-2xl border-2 transition-all ${selectedCategory === cat.id ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm' : 'bg-slate-50 border-slate-50 text-slate-400 hover:bg-white'}`}
                      >
                        <span className="text-xl">{cat.icon}</span>
                        <span className="text-[9px] font-black uppercase tracking-tighter">{cat.label}</span>
                      </button>
                    ))}
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-2 block">ফসলের নাম</label>
                    <select value={crop} onChange={(e) => { setCrop(e.target.value); setDynamicInputs({}); }} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-6 font-bold text-slate-700 outline-none focus:border-emerald-500 transition-all shadow-inner">
                      {(CROPS_BY_CATEGORY[selectedCategory] || []).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-2 block">আপনার অঞ্চল (AEZ)</label>
                    <div id="yield-aez-detector" className="flex gap-2">
                      <input type="text" readOnly value={aez} className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-xs font-bold text-slate-500 shadow-inner" />
                      <button onClick={handleDetectAEZ} disabled={isDetecting} className="bg-emerald-50 text-emerald-600 px-5 rounded-2xl border-2 border-emerald-100 active:scale-95 transition flex items-center justify-center shadow-sm">
                        {isDetecting ? '...' : '📍'}
                      </button>
                    </div>
                  </div>
                  <button onClick={() => setInputStep(2)} className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl shadow-xl active:scale-95 transition-all text-xs uppercase tracking-widest mt-4">পরবর্তী ধাপে যান</button>
                </div>
              )}

              {inputStep === 2 && (
                <div className="space-y-6 animate-fade-in">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-lg">🚜</div>
                    <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">ধাপ ২: বিস্তারিত প্যারামিটার</h4>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {dynamicFields.map(field => (
                      <div key={field.id} className="space-y-1">
                        <div className="flex justify-between items-center ml-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            {field.label} {field.required && <span className="text-rose-500">*</span>}
                          </label>
                          <button 
                            onClick={() => toggleListening(field.id)}
                            className={`p-1 rounded-md transition-all ${activeListeningId === field.id ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-50 text-slate-300 hover:text-emerald-600'}`}
                            title="ভয়েস ইনপুট"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                          </button>
                        </div>
                        {field.type === 'select' ? (
                          <select 
                            value={dynamicInputs[field.id] || ''} 
                            onChange={(e) => {
                              setDynamicInputs({...dynamicInputs, [field.id]: e.target.value});
                              setFormErrors({...formErrors, [field.id]: false});
                            }}
                            className={`w-full bg-slate-50 border-2 rounded-2xl p-3 text-xs font-bold text-slate-700 outline-none transition-all ${formErrors[field.id] ? 'border-rose-400' : 'border-slate-100 focus:border-emerald-500 shadow-inner'}`}
                          >
                            <option value="">নির্বাচন করুন</option>
                            {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        ) : (
                          <input 
                            type={field.type} 
                            value={dynamicInputs[field.id] || ''}
                            onChange={(e) => {
                              setDynamicInputs({...dynamicInputs, [field.id]: e.target.value});
                              setFormErrors({...formErrors, [field.id]: false});
                            }}
                            placeholder={field.placeholder || 'লিখুন...'}
                            className={`w-full bg-slate-50 border-2 rounded-2xl p-3 text-xs font-bold text-slate-700 outline-none transition-all ${formErrors[field.id] ? 'border-rose-400' : 'border-slate-100 focus:border-emerald-500 shadow-inner'}`}
                          />
                        )}
                      </div>
                    ))}
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-2 block">মাটির উর্বরতা</label>
                    <select value={soilStatus} onChange={(e) => setSoilStatus(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-6 font-bold text-slate-700 outline-none focus:border-emerald-500 transition-all shadow-inner">
                      <option>খুব বেশি উর্বর</option>
                      <option>মাঝারি উর্বরতা</option>
                      <option>কম উর্বর (ঘাটতি আছে)</option>
                      <option>লবণাক্ত মাটি</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-2 block">সেচ ব্যবস্থা</label>
                    <select value={water} onChange={(e) => setWater(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-6 font-bold text-slate-700 outline-none focus:border-emerald-500 transition-all shadow-inner">
                      <option>পরিমিত সেচ ব্যবস্থা</option>
                      <option>বৃষ্টির ওপর নির্ভরশীল</option>
                      <option>উন্নত ড্রিপ সেচ</option>
                    </select>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => setInputStep(1)} className="flex-1 bg-slate-100 text-slate-500 font-black py-5 rounded-2xl text-xs uppercase tracking-widest active:scale-95 transition-all">পিছনে</button>
                    <button onClick={() => setInputStep(3)} className="flex-[2] bg-slate-900 text-white font-black py-5 rounded-2xl shadow-xl active:scale-95 transition-all text-xs uppercase tracking-widest">চুড়ান্ত ধাপ</button>
                  </div>
                </div>
              )}

              {inputStep === 3 && (
                <div className="space-y-6 animate-fade-in">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center text-lg">📝</div>
                    <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">ধাপ ৩: অতিরিক্ত তথ্য ও সাবমিশন</h4>
                  </div>
                  
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-2 block">চাষাবাদ পদ্ধতি</label>
                    <select value={practice} onChange={(e) => setPractice(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-6 font-bold text-slate-700 outline-none focus:border-emerald-500 transition-all shadow-inner">
                      <option>সমন্বিত বালাই ব্যবস্থাপনা (IPM)</option>
                      <option>জৈব চাষাবাদ (Organic)</option>
                      <option>সনাতন পদ্ধতি (Conventional)</option>
                      <option>উন্নত হাই-টেক ফার্মিং</option>
                    </select>
                  </div>

                  <div className="relative">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-2 block">অতিরিক্ত তথ্য (ঐচ্ছিক)</label>
                    <textarea 
                      value={notes} 
                      onChange={(e) => setNotes(e.target.value)} 
                      placeholder="যেমন: সারের ডোজ, পূর্ববর্তী ফলন, বিশেষ কোনো পর্যবেক্ষণ..."
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-5 pr-12 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500 transition-all shadow-inner h-24 resize-none"
                    />
                    <button 
                      onClick={() => toggleListening('notes')}
                      className={`absolute right-3 top-10 p-2 rounded-xl transition-all ${activeListeningId === 'notes' ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-100 text-slate-400 hover:text-green-600 hover:bg-green-50'}`}
                      title="ভয়েস ইনপুট"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                    </button>
                  </div>

                  <button onClick={handlePredict} disabled={isLoading} className="w-full bg-[#0A8A1F] text-white font-black py-6 rounded-[2.5rem] shadow-2xl transition-all active:scale-95 flex justify-center items-center text-xl group overflow-hidden relative">
                    <span className="relative z-10">{isLoading ? 'বিশ্লেষণ চলছে...' : 'পূর্বাভাস জেনারেট করুন'}</span>
                  </button>
                  <button onClick={() => setInputStep(2)} disabled={isLoading} className="w-full text-xs font-black text-slate-400 uppercase tracking-widest hover:text-rose-500 transition-colors">তথ্য পরিবর্তন করুন</button>
                </div>
              )}
            </div>
          </div>
          
          <div className="bg-emerald-50 p-6 rounded-[2.5rem] border border-emerald-100">
             <div className="flex gap-4">
                <div className="text-3xl">💡</div>
                <p className="text-xs text-emerald-800 font-bold leading-relaxed italic">
                  টিপস: সঠিক জাত ও বৃদ্ধির ধাপ নির্বাচন করলে এআই গবেষণা প্রতিষ্ঠান (যেমন ব্রি ধান২৮ এর জন্য BRRI মডেল) এর ডাটা ব্যবহার করে নিখুঁত ফলন ধারণা দিতে পারে।
                </p>
             </div>
          </div>
        </div>

        <div className="lg:col-span-7 flex flex-col space-y-6">
          {isLoading ? (
            <div className="bg-white rounded-[4rem] p-16 md:p-24 shadow-2xl border border-slate-100 flex flex-col items-center justify-center text-center space-y-12 animate-fade-in flex-1 min-h-[500px]">
                <div className="relative w-36 h-36">
                   <div className="absolute inset-0 border-[12px] border-emerald-50 rounded-full"></div>
                   <div className="absolute inset-0 border-[12px] border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                   <div className="absolute inset-0 flex items-center justify-center text-6xl">📈</div>
                </div>
                <div className="max-w-md mx-auto">
                  <h3 className="text-3xl font-black text-slate-800 mb-4">{yieldLoadingSteps[loadingStep]}</h3>
                  <p className="text-sm text-slate-400 font-bold uppercase tracking-[0.3em]">Processing Dynamic Agronomic Data</p>
                </div>
                <div className="w-full max-w-xs h-2 bg-slate-100 rounded-full overflow-hidden">
                   <div className="h-full bg-emerald-600 transition-all duration-1000" style={{ width: `${((loadingStep + 1) / yieldLoadingSteps.length) * 100}%` }}></div>
                </div>
            </div>
          ) : prediction ? (
            <div className="bg-slate-900 rounded-[4rem] p-10 md:p-14 text-white shadow-2xl animate-fade-in relative overflow-hidden flex-1 border-b-[20px] border-emerald-500/30">
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
              
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 pb-8 border-b border-white/10 gap-8 relative z-10">
                <div className="flex items-center space-x-6">
                   <div className="w-20 h-20 bg-emerald-600 text-white rounded-[2.2rem] flex items-center justify-center text-4xl shadow-2xl">🏆</div>
                   <div>
                     <h3 className="text-3xl font-black tracking-tighter leading-none mb-1">পূর্বাভাস রিপোর্ট</h3>
                     <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em]">AI Strategic Yield Analysis</p>
                   </div>
                </div>
                <div className="flex items-center space-x-2">
                   <button onClick={() => setIsShareOpen(true)} className="p-4 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all active:scale-90 shadow-xl border border-white/10" title="শেয়ার করুন">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                   </button>
                   <button onClick={handleSave} disabled={isSaving} className="p-4 rounded-full bg-emerald-600 text-white shadow-xl hover:bg-emerald-700 transition-all active:scale-90 disabled:opacity-50">
                      {isSaving ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 5h14m-14 0v14l7-7 7 7V5m-14 0h14" /></svg>}
                   </button>
                   <button onClick={() => playTTS()} className={`p-5 rounded-full shadow-2xl transition-all active:scale-90 ${isPlaying ? 'bg-rose-500 text-white animate-pulse' : 'bg-white text-emerald-600'}`}>
                      {isPlaying ? <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg> : <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>}
                   </button>
                </div>
              </div>
              
              <div className="prose prose-invert max-w-none font-medium leading-[1.8] whitespace-pre-wrap text-slate-200 text-lg md:text-xl first-letter:text-6xl first-letter:font-black first-letter:text-emerald-500 first-letter:float-left first-letter:leading-none">
                {prediction}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-[4rem] p-16 border-4 border-dashed border-slate-100 flex flex-col items-center justify-center text-center space-y-8 flex-1 opacity-60">
                 <div className="text-8xl grayscale">🔮</div>
                 <div className="max-w-xs mx-auto">
                    <h3 className="text-xl font-black text-slate-800 mb-2">ফলন পূর্বাভাস এআই</h3>
                    <p className="text-sm font-medium text-slate-400">বামে থাকা তথ্যগুলো পূরণ করে আপনার ফসলের সম্ভাব্য ফলন এবং উন্নতির উপায় জানুন।</p>
                 </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIYieldPredictor;
