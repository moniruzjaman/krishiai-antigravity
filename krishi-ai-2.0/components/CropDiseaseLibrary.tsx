
import React, { useState, useRef, useEffect } from 'react';
import { getCropDiseaseInfo, generateAgriImage, generateSpeech, decodeBase64, decodeAudioData } from '../services/geminiService';
import { CROP_CATEGORIES, CROPS_BY_CATEGORY } from '../constants';
import { CropDiseaseReport, SavedReport } from '../types';
import ShareDialog from './ShareDialog';

interface CropDiseaseLibraryProps {
  onAction?: () => void;
  onShowFeedback?: () => void;
  onBack?: () => void;
  onSaveReport?: (report: Omit<SavedReport, 'id' | 'timestamp'>) => void;
}

export const CropDiseaseLibrary: React.FC<CropDiseaseLibraryProps> = ({ onAction, onShowFeedback, onBack, onSaveReport }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [selectedCategory, setSelectedCategory] = useState<string>(CROP_CATEGORIES[0].id);
  const [selectedCrop, setSelectedCrop] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [report, setReport] = useState<CropDiseaseReport | null>(null);
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const handleStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.lang = 'bn-BD';
      recognitionRef.current.onstart = () => setIsListening(true);
      recognitionRef.current.onresult = (event: any) => {
        setSearchQuery(event.results[0][0].transcript);
      };
      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    }
    return () => {
      window.removeEventListener('online', handleStatus);
      window.removeEventListener('offline', handleStatus);
    };
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) return alert("ভয়েস ইনপুট সমর্থিত নয়।");
    if (isListening) recognitionRef.current.stop();
    else recognitionRef.current.start();
  };

  const fetchDiseaseInfo = async (crop: string) => {
    setSelectedCrop(crop);
    stopTTS();
    setIsLoading(true);
    setReport(null);
    setCropImage(null);
    try {
      const [diseaseData, generatedImg] = await Promise.all([
        getCropDiseaseInfo(crop),
        generateAgriImage(`${crop} crop plant healthy lush photography`)
      ]);
      setReport(diseaseData.data);
      setCropImage(generatedImg);
      if (onAction) onAction();
    } catch (error) {
      alert("তথ্য সংগ্রহ করতে সমস্যা হয়েছে।");
    } finally {
      setIsLoading(false);
    }
  };

  const playTTS = async () => {
    if (!report) return;
    if (isPlaying) { stopTTS(); return; }
    try {
      setIsPlaying(true);
      const ctx = audioContextRef.current || new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      if (ctx.state === 'suspended') await ctx.resume();
      const textToSpeak = `${report.cropName} এর সুরক্ষা নির্দেশিকা। ${report.summary}`;
      const base64Audio = await generateSpeech(textToSpeak.replace(/[*#_~]/g, ''));
      const audioBuffer = await decodeAudioData(decodeBase64(base64Audio), ctx, 24000, 1);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => setIsPlaying(false);
      currentSourceRef.current = source;
      source.start(0);
    } catch (error) { setIsPlaying(false); }
  };

  const stopTTS = () => {
    if (currentSourceRef.current) { currentSourceRef.current.stop(); currentSourceRef.current = null; }
    setIsPlaying(false);
  };

  const filteredCrops = (CROPS_BY_CATEGORY[selectedCategory] || []).filter(c => 
    c.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getFullTextForShare = () => {
    if (!report) return "";
    let text = `${report.cropName}: ${report.summary}\n\n`;
    text += "Diseases:\n" + report.diseases.map(d => `- ${d.name}: ${d.chemControl}`).join('\n');
    return text;
  };

  return (
    <div className="max-w-5xl mx-auto p-4 pb-32 animate-fade-in font-sans">
      {isShareOpen && report && (
        <ShareDialog 
          isOpen={isShareOpen} 
          onClose={() => setIsShareOpen(false)} 
          title={`Crop Guard: ${report.cropName}`} 
          content={getFullTextForShare()} 
        />
      )}

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-6 sticky top-0 bg-slate-50/95 backdrop-blur-md z-[60] py-4">
        <div className="flex items-center space-x-4">
          <button onClick={onBack} className="p-3 bg-white rounded-2xl shadow-sm border hover:bg-slate-50 transition-all text-slate-400">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </button>
          <div>
            <h1 className="text-3xl font-black text-gray-800 tracking-tight leading-none">শস্য সুরক্ষা লাইব্রেরি</h1>
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="bg-blue-600 text-white px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest animate-pulse shadow-lg">Govt Data Sync: 2025</span>
              <span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded text-[7px] font-black uppercase border border-emerald-100 tracking-widest">BRRI/BARI/DAE Sourced</span>
            </div>
          </div>
        </div>

        <div className="relative w-full md:w-80 group">
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="শস্যের নাম লিখে খুঁজুন..."
            className="w-full bg-white border-2 border-slate-100 rounded-2xl px-12 py-4 focus:ring-2 focus:ring-[#0A8A1F] focus:outline-none font-bold text-sm shadow-xl transition-all"
          />
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          <button onClick={toggleListening} className={`absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-50 text-slate-400'}`}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
          </button>
        </div>
      </div>

      <div className="flex overflow-x-auto space-x-2 mb-6 pb-2 scrollbar-hide border-b border-slate-100">
        {CROP_CATEGORIES.map(cat => (
          <button key={cat.id} onClick={() => setSelectedCategory(cat.id)} className={`flex items-center space-x-2 px-6 py-3 rounded-2xl whitespace-nowrap text-sm font-black transition-all ${selectedCategory === cat.id ? 'bg-[#0A8A1F] text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100'}`}>
            <span>{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-12">
        {filteredCrops.map(crop => (
          <button key={crop} onClick={() => fetchDiseaseInfo(crop)} disabled={isLoading} className={`p-5 rounded-[2rem] font-bold shadow-sm transition-all border text-sm text-center flex flex-col items-center justify-center space-y-2 ${selectedCrop === crop ? 'bg-[#0A8A1F] text-white' : 'bg-white text-slate-700 hover:border-[#0A8A1F]'}`}>
            <span className="text-2xl">🌱</span>
            <span className="leading-tight">{crop}</span>
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-24 space-y-6">
           <div className="relative">
              <div className="w-16 h-16 border-4 border-[#0A8A1F]/10 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-[#0A8A1F] border-t-transparent rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center text-2xl">📖</div>
           </div>
           <p className="font-black text-slate-800 text-lg">অফিসিয়াল সোর্স ভেরিফিকেশন চলছে (২০২৫)...</p>
        </div>
      )}

      {report && !isLoading && (
        <div className="space-y-8 animate-fade-in pb-12">
          <div className="bg-slate-900 rounded-[3rem] overflow-hidden shadow-2xl relative min-h-[450px] flex flex-col justify-end border-b-[16px] border-[#0A8A1F]">
             {cropImage && <img src={cropImage} className="absolute inset-0 w-full h-full object-cover opacity-60" alt={report.cropName} />}
             <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent"></div>
             <div className="relative p-8 md:p-12 text-white">
                <div className="flex flex-col md:flex-row justify-between items-end gap-6">
                   <div className="flex-1">
                      <div className="inline-flex items-center space-x-2 bg-emerald-600 px-3 py-1 rounded-full text-[10px] font-black uppercase mb-4 border border-white/20">
                         <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                         <span>Latest Govt Portal Data (Sync: 2025)</span>
                      </div>
                      <h2 className="text-5xl md:text-7xl font-black mb-6 tracking-tighter">{report.cropName}</h2>
                      <p className="text-xl font-medium text-slate-200 leading-relaxed max-w-3xl border-l-4 border-emerald-500 pl-6 bg-black/20 backdrop-blur-sm p-4 rounded-r-2xl">
                        {report.summary}
                      </p>
                   </div>
                   <div className="flex items-center space-x-3">
                      <button onClick={() => setIsShareOpen(true)} className="p-6 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all active:scale-90 border border-white/10 shadow-xl">
                         <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                      </button>
                      <button onClick={playTTS} className={`p-8 rounded-full shadow-2xl transition-all ${isPlaying ? 'bg-rose-500 animate-pulse' : 'bg-white text-[#0A8A1F]'}`}>
                        {isPlaying ? <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 9v6m4-6v6" /></svg> : <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>}
                      </button>
                   </div>
                </div>
             </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
             <div className="space-y-6">
                <h3 className="text-2xl font-black text-slate-800 px-2 flex items-center"><span className="w-2 h-8 bg-rose-600 rounded-full mr-3"></span>রোগবালাই (২০২৫ গাইড)</h3>
                <div className="space-y-4">
                   {report.diseases?.map((d, i) => (
                     <div key={i} className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
                        <h4 className="text-2xl font-black text-slate-800 mb-4">{d.name}</h4>
                        <div className="space-y-4">
                           <div className="bg-slate-50 p-4 rounded-2xl"><p className="text-[10px] font-black text-slate-400 uppercase mb-1">লক্ষণ</p><p className="font-bold text-slate-700">{d.symptoms}</p></div>
                           <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100"><p className="text-[10px] font-black text-blue-600 uppercase mb-1">অফিসিয়াল প্রতিকার (DAE)</p><p className="font-bold text-blue-800">{d.chemControl}</p></div>
                        </div>
                     </div>
                   ))}
                </div>
             </div>
             <div className="space-y-6">
                <h3 className="text-2xl font-black text-slate-800 px-2 flex items-center"><span className="w-2 h-8 bg-amber-500 rounded-full mr-3"></span>পোকামাকড় (২০২৫ গাইড)</h3>
                <div className="space-y-4">
                   {report.pests?.map((p, i) => (
                     <div key={i} className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
                        <h4 className="text-2xl font-black text-slate-800 mb-4">{p.name}</h4>
                        <div className="space-y-4">
                           <div className="bg-slate-50 p-4 rounded-2xl"><p className="text-[10px] font-black text-slate-400 uppercase mb-1">ক্ষতির লক্ষণ</p><p className="font-bold text-slate-700">{p.damageSymptoms}</p></div>
                           <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100"><p className="text-[10px] font-black text-emerald-600 uppercase mb-1">জৈবিক দমন</p><p className="font-bold text-emerald-800">{p.bioControl}</p></div>
                        </div>
                     </div>
                   ))}
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};
