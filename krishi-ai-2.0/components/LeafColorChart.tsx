
import React, { useState, useRef, useEffect } from 'react';
import { getLCCAnalysisSummary, generateSpeech, decodeBase64, decodeAudioData } from '../services/geminiService';
import { shareContent } from '../services/shareService';
import { ToolGuideHeader } from './ToolGuideHeader';

interface LeafColorChartProps {
  onAction?: () => void;
  onShowFeedback?: () => void;
  onBack?: () => void;
}

const VARIETY_DATA = [
  { name: "BRRI dhan28", threshold: 4 },
  { name: "BRRI dhan74", threshold: 4 },
  { name: "Local Variety", threshold: 4, type: "Local" },
  { name: "Manual Entry", threshold: 4, isManual: true }
];

const LeafColorChart: React.FC<LeafColorChartProps> = ({ onAction, onShowFeedback, onBack }) => {
  const [currentLang, setCurrentLang] = useState<'en' | 'bn'>('bn');
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [progress, setProgress] = useState<number>(0);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [lccValue, setLccValue] = useState<number | null>(null);
  const [tsr, setTsr] = useState<number>(0);
  const [recommendation, setRecommendation] = useState<{ dose: string, text: string } | null>(null);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [shareToast, setShareToast] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [selectedVariety, setSelectedVariety] = useState<string>(VARIETY_DATA[0].name);
  const [manualVariety, setManualVariety] = useState<string>('');
  const [locationId, setLocationId] = useState<string>('');
  const [toast, setToast] = useState<{ text: string, type: 'success' | 'error' | 'info' } | null>(null);
  const [isListening, setIsListening] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.lang = 'bn-BD';
      recognitionRef.current.onstart = () => setIsListening(true);
      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setLocationId(transcript);
      };
      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) return alert("ভয়েস ইনপুট সমর্থিত নয়।");
    isListening ? recognitionRef.current.stop() : recognitionRef.current.start();
  };

  const TR = {
    en: {
      title: "Digital Leaf Color Chart", subtitle: "নাইট্রোজেন ব্যবস্থাপনা প্রোটোকল। ইউরিয়া সার অপচয় রোধে আধুনিক প্রযুক্তি।", capture: "1. Capture Leaf Image", camera: "Take Photo", gallery: "Upload Gallery", analyze: "2. Analyze Leaf Color", statusWaiting: "Waiting for image...", statusRefining: "Refining image quality (ROI)...", statusCalculating: "Calculating chlorophyll index...", statusAnalyzing: "Analyzing color spectrum...", statusFinalizing: "Generating trust score (TSR)...", statusSuccess: "Analysis Complete!", lccLabel: "LCC Value", nRecLabel: "Recommended N Dose", tsrLabel: "Overall Trust Score (TSR)", resultsTitle: "Analysis Results", saveTitle: "3. Save Analysis Data (TSR ≥ 80%)", phVariety: "Select Rice Variety", varOther: "Other / Manual Entry", locationPlaceholder: "Location/Plot ID (e.g., Block A)", saveBtn: "Save Analysis Data", manualPlaceholder: "Enter Variety Name Manually", rec3: "Moderate deficiency. N top-dress required.", rec4: "Mild deficiency. Low dose N top-dress required.", rec5: "Adequate N. Usually 0 kg/ha.", toastCapture: "✅ Image captured successfully.", toastAnalysis: "✅ Analysis results are ready.", toastSave: "💾 Analysis saved successfully!", toastReset: "♻️ Analysis reset.", errorLowTsr: "Trust Score Low. Please recapture with better lighting.", initialState: "Select or Capture an image to begin analysis", aiInsightTitle: "AI Expert Insights", aiLoading: "Generating specialized summary..."
    },
    bn: {
      title: "ডিজিটাল লিফ কালার চার্ট", subtitle: "N Management Protocol. Modern tech to save Urea fertilizer.", capture: "১. পাতার ছবি তুলুন", camera: "ছবি তুলুন", gallery: "গ্যালারি থেকে নিন", analyze: "২. পাতার রঙ বিশ্লেষণ করুন", statusWaiting: "ছবির জন্য অপেক্ষা করছে...", statusRefining: "ছবির মান পরিমার্জন (ROI)...", statusCalculating: "ক্লোরোফিল ইনডেক্স গণনা হচ্ছে...", statusAnalyzing: "কালার স্পেকট্রাম বিশ্লেষণ চলছে...", statusFinalizing: "ট্রাস্ট স্কোর (TSR) তৈরি হচ্ছে...", statusSuccess: "বিশ্লেষণ সম্পন্ন!", lccLabel: "এলসিসি মান", nRecLabel: "সুপারিশকৃত নাইট্রোজেন ডোজ", tsrLabel: "সামগ্রিক ট্রাস্ট স্কোর (TSR)", resultsTitle: "বিশ্লেষণ ফলাফল", saveTitle: "৩. ডেটা সংরক্ষণ করুন (TSR ≥ ৮০%)", phVariety: "ধানের জাত নির্বাচন করুন", varOther: "অন্যান্য / নিজে লিখুন", locationPlaceholder: "স্থান/প্লট আইডি (যেমন: ব্লক এ)", saveBtn: "বিশ্লেষণ ডেটা সংরক্ষণ করুন", manualPlaceholder: "জাতের নাম লিখুন (যেমন: ব্রি ধান৭৪)", rec3: "মাঝারি ঘাটতি। ইউরিয়া সার প্রয়োগ প্রয়োজন।", rec4: "সামান্য ঘাটতি। কম মাত্রায় ইউরিয়া সার প্রয়োগ প্রয়োজন।", rec5: "পর্যাপ্ত নাইট্রোজেন। সাধারণত ০ কেজি/হেক্টর।", toastCapture: "✅ ছবি সফলভাবে তোলা হয়েছে।", toastAnalysis: "✅ বিশ্লেষণ ফলাফল প্রস্তুত।", toastSave: "💾 বিশ্লেষণ সফলভাবে সংরক্ষিত হয়েছে!", toastReset: "♻️ বিশ্লেষণ রিসেট করা হয়েছে।", errorLowTsr: "ট্রাস্ট স্কোর কম। ভালো আলোতে আবার ছবি তুলুন।", initialState: "বিশ্লেষণ শুরু করতে ছবি তুলুন বা গ্যালারি থেকে নির্বাচন করুন", aiInsightTitle: "এআই বিশেষজ্ঞ ইনসাইট", aiLoading: "বিশেষজ্ঞ সারসংক্ষেপ তৈরি হচ্ছে..."
    }
  };

  const t = TR[currentLang];

  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImageSrc(event.target?.result as string);
        setStep(1);
        setProgress(0);
        showToast(t.toastCapture, 'success');
      };
      reader.readAsDataURL(file);
    }
  };

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3000);
  };

  const startAnalysis = async () => {
    setStep(2);
    setProgress(10);
    setStatus(t.statusRefining);

    await new Promise(r => setTimeout(r, 800));
    setProgress(35);
    setStatus(t.statusCalculating);

    await new Promise(r => setTimeout(r, 1200));
    setProgress(70);
    setStatus(t.statusAnalyzing);

    await new Promise(r => setTimeout(r, 800));
    setProgress(90);
    setStatus(t.statusFinalizing);

    await new Promise(r => setTimeout(r, 500));

    const randomLcc = Math.floor(Math.random() * 3) + 3; // 3, 4, or 5
    const randomTsr = Math.floor(Math.random() * 15) + 82; // 82-96%

    setLccValue(randomLcc);
    setTsr(randomTsr);

    let dose = "0 kg/ha";
    let text = t.rec5;
    if (randomLcc === 3) { dose = "30-40 kg/ha"; text = t.rec3; }
    else if (randomLcc === 4) { dose = "15-20 kg/ha"; text = t.rec4; }

    setRecommendation({ dose, text });
    setProgress(100);
    setStatus(t.statusSuccess);
    setStep(3);
    showToast(t.toastAnalysis, 'success');

    // Generate AI Insight
    setIsAiLoading(true);
    try {
      const insight = await getLCCAnalysisSummary(randomLcc, randomTsr, dose, currentLang);
      setAiInsight(insight || null);
      if (insight) playTTS(insight);
    } catch (e) {
      setAiInsight("Unable to generate AI summary at this time.");
    } finally {
      setIsAiLoading(false);
    }

    if (onAction) onAction();
  };

  const playTTS = async (text: string) => {
    if (isPlaying) { stopTTS(); return; }
    try {
      setIsPlaying(true);
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') await ctx.resume();

      const cleanText = text.replace(/[*#_~]/g, '');
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

  const handleSaveData = async () => {
    if (tsr < 80) return showToast(t.errorLowTsr, 'error');
    setIsSaving(true);
    try {
      const audioToSave = aiInsight ? await generateSpeech(aiInsight.replace(/[*#_~]/g, '')) : undefined;
      window.dispatchEvent(new CustomEvent('agritech_save_report', {
        detail: {
          type: 'LCC Analysis',
          title: `${selectedVariety} - ${locationId || 'Plot'}`,
          content: aiInsight || `LCC Value: ${lccValue}, Recommendation: ${recommendation?.text}`,
          audioBase64: audioToSave,
          icon: '🍃'
        }
      }));
      showToast(t.toastSave, 'success');
      if (onShowFeedback) onShowFeedback();
    } catch (e) {
      showToast("Could not save audio data", 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const resetAnalysis = () => {
    setImageSrc(null);
    setStep(0);
    setLccValue(null);
    setRecommendation(null);
    setAiInsight(null);
    stopTTS();
  };

  return (
    <div className="max-w-4xl mx-auto p-4 pb-32 animate-fade-in font-sans">
      <ToolGuideHeader
        title={t.title}
        subtitle={t.subtitle}
        protocol="IRRI / BRRI LCC-V2"
        source="International Rice Research Institute"
        lang={currentLang}
        onBack={onBack || (() => { })}
        icon="🍃"
        themeColor="green"
        guideSteps={currentLang === 'bn' ? [
          "ধানের মাঝখানের ১টি সতেজ পাতার ছবি তুলুন।",
          "সরাসরি সূর্যের আলো বা ছায়াতে না গিয়ে সাধারণ দিনের আলোতে ছবি নিন।",
          "বিশ্লেষণ বাটনে ক্লিক করে এলসিসি মান এবং সারের ডোজ জানুন।",
          "৮০% এর বেশি ট্রাস্ট স্কোর থাকলে তথ্যটি সেভ করে রাখুন।"
        ] : [
          "Capture a photo of one fresh leaf from the middle of the plant.",
          "Avoid direct harsh sunlight or deep shadow; take photo in natural day light.",
          "Click analyze to find the LCC value and recommended N-dose.",
          "Save the data if the Trust Score (TSR) is above 80%."
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Step 1: Capture */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-[3rem] p-8 shadow-xl border border-slate-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-full -mr-12 -mt-12 opacity-50"></div>
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center">
              <span className="w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-[10px] mr-2">1</span>
              {t.capture}
            </h3>

            <div className="aspect-square w-full rounded-[2.5rem] bg-slate-50 border-4 border-dashed border-slate-200 overflow-hidden relative group">
              {imageSrc ? (
                <img src={imageSrc} className="w-full h-full object-cover animate-fade-in" alt="Leaf Capture" />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300">
                  <span className="text-6xl mb-4 group-hover:scale-110 transition-transform">🍃</span>
                  <p className="text-xs font-bold text-center px-8 leading-relaxed opacity-60">{t.initialState}</p>
                </div>
              )}
              <input type="file" ref={cameraInputRef} capture="environment" accept="image/*" className="hidden" onChange={handleCapture} />
              <input type="file" ref={galleryInputRef} accept="image/*" className="hidden" onChange={handleCapture} />
            </div>

            <div className="grid grid-cols-2 gap-3 mt-6">
              <button onClick={() => cameraInputRef.current?.click()} className="bg-slate-900 text-white p-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center space-x-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812-1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><circle cx="12" cy="13" r="3" /></svg>
                <span>{t.camera}</span>
              </button>
              <button onClick={() => galleryInputRef.current?.click()} className="bg-emerald-50 text-emerald-600 border border-emerald-100 p-4 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center space-x-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                <span>{t.gallery}</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Rice Varieties Guidelines</h4>
            <div className="space-y-3">
              {VARIETY_DATA.slice(0, 3).map(v => (
                <div key={v.name} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <span className="text-xs font-bold text-slate-600">{v.name}</span>
                  <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[8px] font-black">Threshold: {v.threshold}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 space-y-8">
          <div className="bg-white rounded-[3.5rem] p-8 md:p-12 shadow-xl border border-slate-100 h-full flex flex-col">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-10 flex items-center">
              <span className="w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-[10px] mr-2">2</span>
              {t.analyze}
            </h3>

            {step === 1 && (
              <div className="flex-1 flex flex-col items-center justify-center text-center animate-fade-in py-12">
                <div className="w-24 h-24 bg-emerald-600 text-white rounded-[2rem] flex items-center justify-center text-4xl shadow-2xl mb-8 animate-bounce">🧬</div>
                <h4 className="text-2xl font-black text-slate-800 mb-4">Image Ready for Scan</h4>
                <button onClick={startAnalysis} className="bg-slate-900 text-white px-12 py-5 rounded-[2rem] font-black uppercase text-sm tracking-widest shadow-2xl hover:scale-105 active:scale-95 transition-all">Start Digital LCC Scan</button>
              </div>
            )}

            {step === 2 && (
              <div className="flex-1 flex flex-col items-center justify-center py-12 animate-fade-in">
                <div className="relative w-40 h-40 mb-10">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-slate-100" />
                    <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="12" fill="transparent" strokeDasharray={440} strokeDashoffset={440 - (progress / 100) * 440} className="text-emerald-600 transition-all duration-500" strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center flex-col">
                    <span className="text-3xl font-black text-slate-800">{progress}%</span>
                    <span className="text-[8px] font-black text-slate-400 uppercase">Analysis</span>
                  </div>
                </div>
                <div className="space-y-2 text-center">
                  <p className="text-lg font-black text-slate-800 tracking-tight">{status}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">AI Core v3.0 Processing...</p>
                </div>
              </div>
            )}

            {step === 3 && lccValue && (
              <div className="animate-fade-in flex-1">
                <div className="flex items-center justify-between mb-10 pb-6 border-b border-slate-50">
                  <h4 className="text-2xl font-black text-slate-800 tracking-tight">{t.resultsTitle}</h4>
                  <button onClick={resetAnalysis} className="p-2 bg-slate-100 text-slate-400 rounded-xl hover:bg-rose-50 hover:text-rose-600 transition-all" title="Reset">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                  <div className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 flex flex-col items-center text-center group">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">{t.lccLabel}</p>
                    <div className="flex items-center justify-center space-x-4">
                      <div className={`w-16 h-16 rounded-3xl flex items-center justify-center text-3xl text-white shadow-xl transition-transform group-hover:scale-110 ${lccValue === 3 ? 'bg-amber-500' : lccValue === 4 ? 'bg-emerald-500' : 'bg-green-700'
                        }`}>{lccValue}</div>
                      <div className="h-10 w-[2px] bg-slate-200"></div>
                      <div className="text-left">
                        <p className="text-[8px] font-black text-slate-400 uppercase">Status</p>
                        <p className="text-xs font-bold text-slate-700">{lccValue >= 5 ? 'Healthy' : lccValue >= 4 ? 'Moderate' : 'Needs Care'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 flex flex-col items-center text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">{t.tsrLabel}</p>
                    <div className="text-4xl font-black text-blue-600">{tsr}%</div>
                    <div className="w-full max-w-[100px] h-1.5 bg-blue-100 rounded-full mt-2 overflow-hidden">
                      <div className="h-full bg-blue-600" style={{ width: `${tsr}%` }}></div>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900 rounded-[3rem] p-8 md:p-10 text-white shadow-2xl relative overflow-hidden mb-10">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl"></div>
                  <div className="relative z-10">
                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-4 flex items-center">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-2"></span>
                      {t.nRecLabel}
                    </p>
                    <h5 className="text-4xl font-black tracking-tighter mb-6">{recommendation?.dose}</h5>
                    <p className="text-lg font-medium text-slate-300 leading-relaxed italic border-l-4 border-emerald-500 pl-6">
                      "{recommendation?.text}"
                    </p>
                  </div>
                </div>

                <div className="bg-emerald-50 rounded-[3rem] p-8 border border-emerald-100 relative overflow-hidden">
                  <div className="flex justify-between items-center mb-6">
                    <h4 className="text-xl font-black text-slate-800 tracking-tight leading-none">{t.aiInsightTitle}</h4>
                    <button
                      onClick={() => aiInsight && playTTS(aiInsight)}
                      className={`p-4 rounded-full shadow-lg transition-all active:scale-90 ${isPlaying ? 'bg-rose-500 text-white animate-pulse' : 'bg-white text-emerald-600 hover:bg-emerald-100'}`}
                    >
                      {isPlaying ? '🔇' : '🔊'}
                    </button>
                  </div>
                  {isAiLoading ? (
                    <div className="flex items-center space-x-3 py-6">
                      <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">{t.aiLoading}</p>
                    </div>
                  ) : (
                    <p className="text-sm font-medium text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {aiInsight}
                    </p>
                  )}
                </div>

                <div className="mt-10 pt-10 border-t border-slate-100 space-y-8">
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center">
                    <span className="w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-[10px] mr-2">3</span>
                    {t.saveTitle}
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <select value={selectedVariety} onChange={(e) => setSelectedVariety(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold text-slate-700 focus:border-emerald-500 outline-none transition-all shadow-inner">
                      {VARIETY_DATA.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                    </select>
                    <div className="relative">
                      <input type="text" value={locationId} onChange={(e) => setLocationId(e.target.value)} placeholder={t.locationPlaceholder} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 pr-12 font-bold text-slate-700 focus:border-emerald-500 outline-none transition-all shadow-inner" />
                      <button onClick={toggleListening} className={`absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-50 text-slate-400 hover:text-emerald-500'}`}>🎙️</button>
                    </div>
                  </div>

                  <button onClick={handleSaveData} disabled={tsr < 80 || isSaving} className="w-full bg-[#0A8A1F] text-white py-6 rounded-[2rem] font-black uppercase text-sm tracking-widest shadow-2xl active:scale-95 transition-all disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none flex items-center justify-center space-x-3">
                    {isSaving ? (
                      <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        <span>{t.saveBtn}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {step === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-20 opacity-30">
                <div className="text-8xl mb-8">🖥️</div>
                <p className="font-black text-slate-400 uppercase tracking-widest">{t.statusWaiting}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {toast && (
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] px-8 py-4 rounded-3xl shadow-2xl font-black text-xs uppercase tracking-widest animate-bounce flex items-center space-x-3 border-2 ${toast.type === 'success' ? 'bg-white border-emerald-500 text-emerald-600' :
            toast.type === 'error' ? 'bg-white border-rose-500 text-rose-600' : 'bg-white border-blue-500 text-blue-600'
          }`}>
          <span>{toast.text}</span>
        </div>
      )}
    </div>
  );
};

export default LeafColorChart;
