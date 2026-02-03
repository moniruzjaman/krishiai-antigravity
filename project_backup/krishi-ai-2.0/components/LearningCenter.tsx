
import React, { useState, useRef, useEffect } from 'react';
import {
  identifyPlantSpecimen,
  generateAgriQuiz,
  searchEncyclopedia,
  generateSpeech,
  decodeBase64,
  decodeAudioData
} from '../services/geminiService';
import { AgriQuizQuestion, Language, GroundingChunk } from '../types';
import { useSpeech } from '../App';

interface LearningCenterProps {
  onBack: () => void;
  onAction: (xp: number) => void;
  lang: Language;
}

const LearningCenter: React.FC<LearningCenterProps> = ({ onBack, onAction, lang }) => {
  const [activeMode, setActiveMode] = useState<'menu' | 'scan' | 'quiz' | 'dictionary'>('menu');
  const [isLoading, setIsLoading] = useState(false);
  const { playSpeech, stopSpeech, isSpeaking } = useSpeech();

  const DashboardCard = ({ icon, title, desc, onClick, color }: any) => (
    <button
      onClick={onClick}
      className={`${color} p-8 rounded-[3rem] text-white text-left shadow-xl hover:scale-[1.02] transition-all active:scale-95 group relative overflow-hidden h-full flex flex-col`}
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700"></div>
      <div className="text-5xl mb-6 transform group-hover:rotate-12 transition-transform">{icon}</div>
      <h3 className="text-2xl font-black mb-3 tracking-tight">{title}</h3>
      <p className="text-sm font-medium opacity-80 leading-relaxed flex-1">{desc}</p>
      <div className="mt-8 flex justify-end">
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center group-hover:bg-white group-hover:text-emerald-600 transition-all">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
        </div>
      </div>
    </button>
  );

  return (
    <div className="max-w-6xl mx-auto p-4 animate-fade-in font-sans pb-32">
      <div className="flex items-center space-x-4 mb-12">
        <button onClick={activeMode === 'menu' ? onBack : () => { setActiveMode('menu'); stopSpeech(); }} className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100 hover:bg-slate-50 transition-all active:scale-90 text-slate-400">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </button>
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight leading-none">কৃষি শিখন কেন্দ্র</h1>
          <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-1">International Scientific Standards</p>
        </div>
      </div>

      {activeMode === 'menu' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in px-2">
          <DashboardCard
            icon="🔬"
            title="CABI ডায়াগনোসিস মাস্টারক্লাস"
            desc="আন্তর্জাতিক মানের রোগ শনাক্তকরণ পদ্ধতি শিখুন ও সার্টিফিকেট পান।"
            onClick={() => window.dispatchEvent(new CustomEvent('agritech_navigate', { detail: 'CABI_TRAINING' }))}
            color="bg-rose-600"
          />
          <DashboardCard icon="🌿" title="উদ্ভিদ শনাক্তকরণ" desc="যেকোনো গাছের ছবি তুলে তার বৈজ্ঞানিক নাম ও গুণাগুণ জানুন।" onClick={() => setActiveMode('scan')} color="bg-emerald-600" />
          <DashboardCard icon="🧠" title="এআই কৃষি কুইজ" desc="আপনার কৃষি জ্ঞান যাচাই করুন এবং নতুন XP অর্জন করুন।" onClick={() => setActiveMode('quiz')} color="bg-blue-600" />
          <DashboardCard icon="📖" title="এআই এনসাইক্লোপিডিয়া" desc="জটিল কৃষি টার্ম বা পদ্ধতির সহজ ব্যাখ্যা খুঁজুন।" onClick={() => setActiveMode('dictionary')} color="bg-indigo-600" />
        </div>
      )}

      {activeMode === 'scan' && <PlantScanner onComplete={(xp: number) => { onAction(xp); setActiveMode('menu'); }} onCancel={() => setActiveMode('menu')} lang={lang} />}
      {activeMode === 'quiz' && <QuizModule onComplete={(xp: number) => { onAction(xp); setActiveMode('menu'); }} lang={lang} />}
      {activeMode === 'dictionary' && <Encyclopedia lang={lang} />}
    </div>
  );
};

/* Sub-Module: Plant Scanner */
const PlantScanner = ({ onComplete, onCancel, lang }: any) => {
  const [image, setImage] = useState<string | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { playSpeech, isSpeaking, stopSpeech } = useSpeech();

  const handleScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = (ev.target?.result as string).split(',')[1];
        setImage(ev.target?.result as string);
        setIsLoading(true);
        try {
          const res = await identifyPlantSpecimen(base64, file.type, lang);
          setReport(res.text);
          if (res.text) playSpeech(res.text);
          onComplete(30);
        } catch (err) {
          alert("Error identifying plant.");
        } finally { setIsLoading(false); }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="bg-white rounded-[4rem] p-10 shadow-2xl border border-slate-100 animate-fade-in-up">
      <div className="text-center mb-10">
        <div className="w-20 h-20 bg-emerald-50 rounded-[2rem] flex items-center justify-center mx-auto text-4xl mb-6 shadow-inner">🌿</div>
        <h2 className="text-3xl font-black text-slate-800">উদ্ভিদ শনাক্তকরণ</h2>
        <p className="text-slate-500 font-medium max-w-sm mx-auto mt-2">যেকোনো কৃষি গাছের ছবি নিন, এআই তার বিস্তারিত পরিচয় জানাবে।</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <div className="space-y-6">
          <div className="aspect-square bg-slate-50 rounded-[3rem] border-4 border-dashed border-slate-200 flex flex-col items-center justify-center overflow-hidden relative group">
            {image ? (
              <img src={image} className="w-full h-full object-cover" alt="Sample" />
            ) : (
              <div className="text-center px-10">
                <div className="text-5xl mb-4 grayscale opacity-40 group-hover:grayscale-0 group-hover:opacity-100 transition-all">📸</div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">Take or Upload a photography</p>
              </div>
            )}
            <input type="file" ref={fileInputRef} className="hidden" onChange={handleScan} accept="image/*" />
          </div>
          {!report && !isLoading && (
            <button onClick={() => fileInputRef.current?.click()} className="w-full bg-emerald-600 text-white py-6 rounded-[2.2rem] font-black text-lg shadow-xl active:scale-95 transition-all">ছবি নির্বাচন করুন</button>
          )}
        </div>

        <div className="flex flex-col">
          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-6 bg-slate-50 rounded-[3rem]">
              <div className="w-12 h-12 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin"></div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Analysing Specimen...</p>
            </div>
          ) : report ? (
            <div className="flex-1 bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden">
              <div className="flex justify-between items-center mb-8 pb-4 border-b border-white/10">
                <span className="text-[10px] font-black uppercase text-emerald-400 tracking-[0.2em]">Scientific Identification</span>
                <button onClick={() => playSpeech(report)} className={`p-3 rounded-full ${isSpeaking ? 'bg-rose-500 animate-pulse' : 'bg-white text-emerald-600'}`}>
                  {isSpeaking ? '🔇' : '🔊'}
                </button>
              </div>
              <div className="prose prose-invert max-w-none text-slate-300 font-medium leading-relaxed whitespace-pre-wrap text-lg">
                {report}
              </div>
              <button onClick={() => { setReport(null); setImage(null); stopSpeech(); }} className="mt-10 w-full py-4 border border-white/20 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/5">আরেকটি স্ক্যান করুন</button>
            </div>
          ) : (
            <div className="flex-1 border-4 border-dashed border-slate-100 rounded-[3rem] flex flex-col items-center justify-center opacity-30">
              <span className="text-7xl mb-4">🔎</span>
              <p className="text-sm font-black uppercase">Result Preview</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* Sub-Module: Agri Quiz */
const QuizModule = ({ onComplete, lang }: any) => {
  const [topic, setTopic] = useState('');
  const [questions, setQuestions] = useState<AgriQuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);

  const startQuiz = async (selectedTopic: string) => {
    setTopic(selectedTopic);
    setIsLoading(true);
    setQuestions([]);
    setCurrentIndex(0);
    setScore(0);
    setIsFinished(false);
    setSelectedAnswer(null);
    setShowExplanation(false);
    try {
      const data = await generateAgriQuiz(selectedTopic, lang);
      setQuestions(data);
    } catch (e) { alert("Quiz generation failed."); }
    finally { setIsLoading(false); }
  };

  const handleAnswer = (idx: number) => {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(idx);
    if (idx === questions[currentIndex].correctAnswer) {
      setScore(s => s + 1);
    }
    setShowExplanation(true);
  };

  const nextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
    } else {
      setIsFinished(true);
      onComplete(score * 20); // XP based on score
    }
  };

  if (isLoading) return (
    <div className="bg-white p-24 rounded-[4rem] shadow-xl text-center flex flex-col items-center space-y-8">
      <div className="w-16 h-16 border-4 border-blue-50 border-t-blue-600 rounded-full animate-spin"></div>
      <h3 className="text-2xl font-black text-slate-800">আপনার জন্য কুইজ তৈরি হচ্ছে...</h3>
    </div>
  );

  if (!questions.length && !isFinished) return (
    <div className="bg-white p-12 rounded-[4rem] shadow-2xl text-center animate-fade-in border border-slate-100">
      <div className="w-20 h-20 bg-blue-50 rounded-[2rem] flex items-center justify-center mx-auto text-4xl mb-8">🧠</div>
      <h2 className="text-3xl font-black text-slate-800 mb-4">আপনার বিষয় নির্বাচন করুন</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
        {['ধান চাষ', 'মৃত্তিকা পুষ্টি', 'জৈবিক দমন', 'স্মার্ট প্রযুক্তি', 'বাজার ব্যবস্থাপনা', 'সার প্রয়োগ'].map(t => (
          <button key={t} onClick={() => startQuiz(t)} className="p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl font-black text-slate-700 hover:border-blue-500 hover:bg-blue-50 transition-all active:scale-95 text-sm">{t}</button>
        ))}
      </div>
    </div>
  );

  if (isFinished) return (
    <div className="bg-slate-900 rounded-[4rem] p-16 text-center text-white shadow-2xl animate-fade-in relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl"></div>
      <div className="text-8xl mb-8">🏆</div>
      <h2 className="text-4xl font-black mb-4">কুইজ সম্পন্ন!</h2>
      <p className="text-xl font-medium text-slate-400 mb-10">আপনার স্কোর: <span className="text-blue-400 font-black">{score} / {questions.length}</span></p>
      <div className="bg-white/5 border border-white/10 px-8 py-4 rounded-full inline-block font-black uppercase tracking-widest text-emerald-400">+{score * 20} XP অর্জিত</div>
      <button onClick={() => { setQuestions([]); setIsFinished(false); }} className="mt-12 block w-full bg-blue-600 py-6 rounded-[2.2rem] font-black text-lg">অন্য বিষয় চেষ্টা করুন</button>
    </div>
  );

  const q = questions[currentIndex];

  return (
    <div className="bg-white rounded-[4rem] p-10 md:p-16 shadow-2xl border border-slate-100 animate-fade-in">
      <div className="flex justify-between items-center mb-12">
        <span className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em]">{topic} কুইজ</span>
        <span className="bg-slate-100 px-4 py-1 rounded-full text-xs font-black text-slate-500">{currentIndex + 1} / {questions.length}</span>
      </div>

      <h3 className="text-3xl font-black text-slate-800 leading-tight mb-12">"{q.question}"</h3>

      <div className="grid grid-cols-1 gap-4 mb-10">
        {q.options.map((opt, i) => {
          const isCorrect = i === q.correctAnswer;
          const isSelected = selectedAnswer === i;
          return (
            <button
              key={i}
              onClick={() => handleAnswer(i)}
              className={`text-left p-6 rounded-[2rem] border-2 font-black transition-all text-lg flex items-center space-x-5 ${selectedAnswer === null ? 'bg-slate-50 border-slate-100 hover:border-blue-400 hover:bg-white' :
                  isCorrect ? 'bg-emerald-50 border-emerald-500 text-emerald-700' :
                    isSelected ? 'bg-rose-50 border-rose-500 text-rose-700' : 'bg-slate-50 border-slate-100 opacity-50'
                }`}
            >
              <span className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-xs shadow-sm shrink-0">{String.fromCharCode(65 + i)}</span>
              <span>{opt}</span>
            </button>
          );
        })}
      </div>

      {showExplanation && (
        <div className="p-8 bg-blue-50 rounded-[2.5rem] border border-blue-100 animate-fade-in mb-8">
          <p className="text-[10px] font-black uppercase text-blue-600 tracking-widest mb-2">ব্যাখ্যা (AI Insight)</p>
          <p className="text-sm font-bold text-blue-900 leading-relaxed">{q.explanation}</p>
        </div>
      )}

      {selectedAnswer !== null && (
        <button onClick={nextQuestion} className="w-full bg-slate-900 text-white py-6 rounded-[2.2rem] font-black text-lg shadow-xl active:scale-95 transition-all">পরবর্তী প্রশ্ন</button>
      )}
    </div>
  );
};

/* Sub-Module: Encyclopedia */
const Encyclopedia = ({ lang }: any) => {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<{ text: string; groundingChunks: GroundingChunk[] } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { playSpeech, isSpeaking, stopSpeech } = useSpeech();

  const handleSearch = async () => {
    if (!query.trim()) return;
    setIsLoading(true);
    setResult(null);
    stopSpeech();
    try {
      const data = await searchEncyclopedia(query, lang);
      setResult(data);
      if (data.text) playSpeech(data.text);
    } catch (e) { alert("Search failed."); }
    finally { setIsLoading(false); }
  };

  return (
    <div className="bg-white rounded-[4rem] p-10 md:p-16 shadow-2xl border border-slate-100 animate-fade-in">
      <div className="text-center mb-12">
        <div className="w-20 h-20 bg-indigo-50 rounded-[2rem] flex items-center justify-center mx-auto text-4xl mb-6">📖</div>
        <h2 className="text-3xl font-black text-slate-800 tracking-tight">কৃষি এনসাইক্লোপিডিয়া</h2>
        <p className="text-slate-500 font-medium">যেকোনো কৃষি পরিভাষা বা পদ্ধতি সম্পর্কে বিস্তারিত জানুন।</p>
      </div>

      <div className="flex gap-3 mb-12">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="যেমন: গ্রিনহাউস ইফেক্ট, টিএসপি সার, বালাই ব্যবস্থাপনা..."
          className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-[2rem] px-8 py-5 font-bold outline-none focus:border-indigo-500 transition-all shadow-inner"
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button onClick={handleSearch} disabled={isLoading} className="bg-indigo-600 text-white px-10 rounded-[2rem] font-black active:scale-95 transition-all shadow-xl">
          {isLoading ? '...' : 'অনুসন্ধান'}
        </button>
      </div>

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-20 opacity-50 space-y-4">
          <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
          <p className="text-xs font-black uppercase tracking-widest text-indigo-700">Accessing Digital Archives...</p>
        </div>
      )}

      {result && !isLoading && (
        <div className="bg-slate-50 rounded-[3rem] p-10 border border-slate-100 relative animate-fade-in-up">
          <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-200">
            <h3 className="text-2xl font-black text-slate-800">ফলাফল: {query}</h3>
            <button onClick={() => playSpeech(result.text)} className={`p-4 rounded-full shadow-lg ${isSpeaking ? 'bg-rose-500 text-white animate-pulse' : 'bg-indigo-600 text-white'}`}>
              {isSpeaking ? '🔇' : '🔊'}
            </button>
          </div>
          <div className="prose prose-slate max-w-none text-slate-700 font-medium leading-[1.8] whitespace-pre-wrap text-lg first-letter:text-5xl first-letter:font-black first-letter:text-indigo-600 first-letter:float-left first-letter:mr-3">
            {result.text}
          </div>
          {result.groundingChunks?.length > 0 && (
            <div className="mt-12 pt-8 border-t border-slate-200">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4">যাচাইকৃত তথ্যসূত্র (Grounding)</p>
              <div className="flex flex-wrap gap-2">
                {result.groundingChunks.map((chunk, i) => chunk.web ? (
                  <a key={i} href={chunk.web.uri} target="_blank" rel="noopener noreferrer" className="bg-white border border-slate-200 px-4 py-2 rounded-xl text-[10px] font-black text-indigo-600 hover:border-indigo-300 transition-all shadow-sm">
                    {chunk.web.title}
                  </a>
                ) : null)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LearningCenter;
