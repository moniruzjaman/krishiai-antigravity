
import React, { useState, useEffect, useRef } from 'react';
import { AgriTask, User } from '../types';
import { getAICropSchedule } from '../services/geminiService';
import { AGRI_SEASONS } from '../constants';

interface TaskSchedulerProps {
  user: User;
  onAction?: () => void;
  // Fix: Added missing onBack prop
  onBack?: () => void;
}

const STORAGE_KEY = 'agritech_tasks';

const schedulerLoadingSteps = [
  "শস্যের রোপণ তারিখ ও বর্তমান ধাপ নির্ধারণ হচ্ছে...",
  "চাষাবাদের বৈজ্ঞানিক ধাপগুলো (Stages) সাজানো হচ্ছে...",
  "মাঠের আবহাওয়া ও সিজনাল চ্যালেঞ্জ বিশ্লেষণ চলছে...",
  "CABI ডায়াগনোসিস লজিক অনুযায়ী সুরক্ষা ধাপ যুক্ত হচ্ছে...",
  "আগামী দিনগুলোর জন্য প্রয়োজনীয় কাজের তালিকা চূড়ান্ত হচ্ছে..."
];

const TaskScheduler: React.FC<TaskSchedulerProps> = ({ user, onAction, onBack }) => {
  const [tasks, setTasks] = useState<AgriTask[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [isListening, setIsListening] = useState(false);
  
  // New Task Form
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newTime, setNewTime] = useState('09:00');
  const [newCategory, setNewCategory] = useState<AgriTask['category']>('other');
  const [selectedCrop, setSelectedCrop] = useState<string>(user.myCrops?.[0]?.name || 'ধান');

  const recognitionRef = useRef<any>(null);
  const currentMonth = new Date().getMonth();
  const currentSeason = AGRI_SEASONS.find(s => s.months.includes(currentMonth)) || AGRI_SEASONS[0];

  useEffect(() => {
    let interval: any;
    if (isGenerating) {
      interval = setInterval(() => {
        setLoadingStep(prev => (prev + 1) % schedulerLoadingSteps.length);
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [isGenerating]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setTasks(JSON.parse(saved));
      } catch (e) {
        setTasks([]);
      }
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.lang = 'bn-BD';
      recognitionRef.current.onstart = () => setIsListening(true);
      recognitionRef.current.onresult = (event: any) => {
        setNewTitle(prev => prev + ' ' + event.results[0][0].transcript);
      };
      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  const toggleListening = () => {
    if (!recognitionRef.current) return alert("ভয়েস ইনপুট সমর্থিত নয়।");
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  const addTask = (task?: Partial<AgriTask>) => {
    const newTask: AgriTask = {
      id: Math.random().toString(36).substr(2, 9),
      title: task?.title || newTitle,
      dueDate: task?.dueDate || newDate,
      dueTime: task?.dueTime || newTime,
      completed: false,
      category: task?.category || newCategory,
      crop: task?.crop || selectedCrop,
      notes: task?.notes || ''
    };
    setTasks(prev => [newTask, ...prev]);
    if (!task) {
      setNewTitle('');
      setShowAddModal(false);
      if (onAction) onAction();
    }
  };

  const toggleTask = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const deleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const handleAiSchedule = async () => {
    if (!selectedCrop) return alert('অনুগ্রহ করে একটি শস্য নির্বাচন করুন।');
    setIsGenerating(true);
    setLoadingStep(0);
    try {
      const today = new Date().toISOString().split('T')[0];
      const aiTasks = await getAICropSchedule(selectedCrop, today, currentSeason.name);
      const formattedTasks: AgriTask[] = aiTasks.map(t => ({
        id: Math.random().toString(36).substr(2, 9),
        title: t.title || '',
        dueDate: t.dueDate || today,
        dueTime: '08:00',
        completed: false,
        category: (t.category as any) || 'other',
        crop: selectedCrop,
        notes: t.notes || 'AI generated'
      }));
      setTasks(prev => [...formattedTasks, ...prev]);
      if (onAction) onAction();
    } catch (e) {
      alert('শিডিউল তৈরি করতে সমস্যা হয়েছে।');
    } finally {
      setIsGenerating(false);
    }
  };

  const categories = [
    { id: 'planting', label: 'বপন', icon: '🌱' },
    { id: 'fertilizer', label: 'সার', icon: '⚖️' },
    { id: 'irrigation', label: 'সেচ', icon: '💧' },
    { id: 'pesticide', label: 'কীটনাশক', icon: '🧪' },
    { id: 'harvest', label: 'কর্তন', icon: '🌾' },
    { id: 'other', label: 'অন্যান্য', icon: '📝' },
  ];

  return (
    <div className="max-w-4xl mx-auto p-4 pb-32 font-sans animate-fade-in min-h-screen">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
        <div className="flex items-center space-x-4">
          {/* Fix: Added back button usage */}
          <button onClick={() => onBack?.()} className="p-3 bg-white rounded-2xl shadow-sm border hover:bg-slate-50 transition-all active:scale-90 text-slate-400">
            <svg className="h-6 w-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </button>
          <div>
            <h1 className="text-3xl font-black text-gray-800 tracking-tight">শস্য কর্মপরিকল্পনা</h1>
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-1">Smart Task Scheduler & Planner</p>
          </div>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button 
            onClick={handleAiSchedule} 
            disabled={isGenerating}
            className="flex-1 md:flex-none bg-blue-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            <span>🤖 AI শিডিউল জেনারেট</span>
          </button>
          <button 
            onClick={() => setShowAddModal(true)} 
            className="flex-1 md:flex-none bg-[#0A8A1F] text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all"
          >
            + নতুন কাজ
          </button>
        </div>
      </div>

      {isGenerating ? (
        <div className="bg-white rounded-[3.5rem] p-16 md:p-24 shadow-2xl border border-slate-100 flex flex-col items-center justify-center text-center space-y-10 animate-fade-in my-10">
           <div className="relative w-32 h-32">
              <div className="absolute inset-0 border-[10px] border-blue-50 rounded-full"></div>
              <div className="absolute inset-0 border-[10px] border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center text-5xl">📅</div>
           </div>
           <div className="max-w-md mx-auto">
              <h3 className="text-2xl md:text-3xl font-black text-slate-800 mb-4">{schedulerLoadingSteps[loadingStep]}</h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-[0.3em]">AI Strategic Farming Engine Active</p>
           </div>
           <div className="w-full max-w-xs h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 transition-all duration-700" style={{ width: `${((loadingStep + 1) / schedulerLoadingSteps.length) * 100}%` }}></div>
           </div>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-[2.5rem] p-6 mb-8 border border-emerald-100 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full -mr-16 -mt-16 opacity-40"></div>
            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="flex items-center space-x-4">
                <div className="w-14 h-14 bg-emerald-600 rounded-2xl flex items-center justify-center text-2xl text-white shadow-lg">📅</div>
                <div>
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">বর্তমান কৃষি ঋতু (Season)</p>
                  <h3 className="text-xl font-black text-slate-800">{currentSeason.name}</h3>
                  <p className="text-xs font-medium text-slate-500 mt-1">{currentSeason.desc}</p>
                </div>
              </div>
              <div className="w-full md:w-auto bg-slate-50 p-4 rounded-2xl border border-slate-100">
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">মৌসুমি পরামর্শ (Quick Add)</p>
                 <div className="flex flex-wrap gap-2">
                    {currentSeason.suggestions.map((s, idx) => (
                      <button 
                        key={idx}
                        onClick={() => addTask({ title: s.title, category: s.category as any, dueDate: new Date().toISOString().split('T')[0] })}
                        className="bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-[10px] font-bold text-slate-600 hover:border-emerald-500 hover:text-emerald-600 transition-all flex items-center space-x-1"
                      >
                        <span>+ {s.title}</span>
                      </button>
                    ))}
                 </div>
              </div>
            </div>
          </div>

          {tasks.length === 0 ? (
            <div className="bg-white rounded-[3rem] p-16 text-center border-4 border-dashed border-slate-100 flex flex-col items-center opacity-60">
               <div className="text-7xl mb-6">📅</div>
               <h3 className="text-xl font-black text-slate-800 mb-2">আপনার কোনো পরিকল্পনা নেই</h3>
               <p className="text-sm font-medium text-slate-400 max-w-xs">উপরে 'নতুন কাজ' যোগ করুন অথবা এআই ব্যবহার করে একটি পূর্ণাঙ্গ চাষ পরিকল্পনা তৈরি করুন।</p>
            </div>
          ) : (
            <div className="space-y-4">
              {tasks.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()).map(task => (
                <div key={task.id} className={`group bg-white p-6 rounded-[2.2rem] shadow-sm border-l-8 transition-all hover:shadow-lg flex items-center justify-between gap-4 ${task.completed ? 'border-gray-200 opacity-60' : 'border-emerald-500'}`}>
                   <div className="flex items-center space-x-5 flex-1 min-w-0">
                      <button onClick={() => toggleTask(task.id)} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${task.completed ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-transparent border-2 border-slate-200 hover:border-emerald-500'}`}>
                         <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                      </button>
                      <div className="flex-1 min-w-0">
                         <h3 className={`font-black text-lg tracking-tight truncate ${task.completed ? 'line-through text-slate-400' : 'text-slate-800'}`}>{task.title}</h3>
                         <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                            <span className="text-[10px] font-black uppercase text-emerald-600 flex items-center">
                               <span className="mr-1.5">{categories.find(c => c.id === task.category)?.icon}</span>
                               {categories.find(c => c.id === task.category)?.label}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 flex items-center">
                               <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                               {task.dueDate} • {task.dueTime}
                            </span>
                            {task.crop && <span className="text-[10px] font-black bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{task.crop}</span>}
                         </div>
                      </div>
                   </div>
                   <button onClick={() => deleteTask(task.id)} className="p-3 bg-white text-slate-300 hover:text-rose-500 rounded-xl transition-all">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                   </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-[3rem] p-10 shadow-2xl space-y-6">
             <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-black text-slate-800">নতুন কাজ যোগ করুন</h2>
                <button onClick={() => setShowAddModal(false)} className="p-2 bg-slate-50 rounded-xl text-slate-400">✕</button>
             </div>
             <div className="space-y-4">
                <div>
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">কাজের নাম</label>
                   <div className="relative">
                     <input 
                       type="text" 
                       value={newTitle} 
                       onChange={(e) => setNewTitle(e.target.value)} 
                       placeholder="যেমন: ইউরিয়া সার প্রয়োগ" 
                       className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-6 pr-12 font-bold text-slate-700 outline-none focus:border-emerald-500 shadow-inner" 
                     />
                     <button 
                       onClick={toggleListening}
                       className={`absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-white text-slate-300 hover:text-emerald-600'}`}
                     >
                       <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                     </button>
                   </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">তারিখ</label>
                      <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-6 font-bold text-slate-700 outline-none focus:border-emerald-500 shadow-inner" />
                   </div>
                   <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">সময়</label>
                      <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-6 font-bold text-slate-700 outline-none focus:border-emerald-500 shadow-inner" />
                   </div>
                </div>
                <div>
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">ক্যাটাগরি</label>
                   <select value={newCategory} onChange={(e) => setNewCategory(e.target.value as any)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-6 font-bold text-slate-700 outline-none focus:border-emerald-500 shadow-inner">
                      {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                   </select>
                </div>
                <div>
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">শস্য</label>
                   <select value={selectedCrop} onChange={(e) => setSelectedCrop(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-6 font-bold text-slate-700 outline-none focus:border-emerald-500 shadow-inner">
                      {user.myCrops.length > 0 ? user.myCrops.map(c => <option key={c.id} value={c.name}>{c.name}</option>) : <option value="অন্যান্য">অন্যান্য</option>}
                   </select>
                </div>
                <button onClick={() => addTask()} className="w-full bg-slate-900 text-white font-black py-5 rounded-[2rem] shadow-xl hover:shadow-none transition-all active:scale-95 text-lg mt-4">কাজ যোগ করুন</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskScheduler;
