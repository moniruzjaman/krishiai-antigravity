
import React, { useState, useEffect, useContext, createContext } from 'react';
import { View, User, SavedReport, Language, UserRole } from './types';
import { Hero } from './components/Hero';
import ToolsHub from './components/ToolsHub';
import ChatBot from './components/ChatBot';
import SearchTool from './components/SearchTool';
import Analyzer from './components/Analyzer';
import Weather from './components/Weather';
import NutrientCalculator from './components/NutrientCalculator';
import BiocontrolGuide from './components/BiocontrolGuide';
import SoilGuide from './components/SoilGuide';
import PlantDefenseGuide from './components/PlantDefenseGuide';
import PesticideExpert from './components/PesticideExpert';
import SoilExpert from './components/SoilExpert';
import YieldCalculator from './components/YieldCalculator';
import AIYieldPredictor from './components/AIYieldPredictor';
import { CropDiseaseLibrary } from './components/CropDiseaseLibrary';
import QRGenerator from './components/QRGenerator';
import FieldMonitoring from './components/FieldMonitoring';
import LeafColorChart from './components/LeafColorChart';
import LearningCenter from './components/LearningCenter';
import UserProfile from './components/UserProfile';
import About from './components/About';
import FlashcardView from './components/FlashcardView';
import TaskScheduler from './components/TaskScheduler';
import FAQ from './components/FAQ';
import CropCalendar from './components/CropCalendar';
import AgriPodcast from './components/AgriPodcast';
import CABIDiagnosisTraining from './components/CABIDiagnosisTraining';
import FieldMap from './components/FieldMap';
import { WeatherHorizontal } from './components/WeatherHorizontal';
import { MarketPriceHorizontal } from './components/MarketPriceHorizontal';
import { FeatureHighlights } from './components/FeatureHighlights';
import { NewsTicker, StatsSection, FeaturedCourses, MissionSection, ContactFooter } from './components/HomeSections';
import { generateSpeech, decodeBase64, decodeAudioData } from './services/geminiService';
import { Logo } from './components/Logo';
import { FarmerAvatar } from './components/FarmerAvatar';
import ShareDialog from './components/ShareDialog';
import { syncUserProfile, saveReportToSupabase } from './services/supabase';

interface SpeechContextType {
  playSpeech: (text: string, audioBase64?: string) => Promise<void>;
  stopSpeech: () => void;
  isSpeaking: boolean;
  speechEnabled: boolean;
  setSpeechEnabled: (enabled: boolean) => void;
}

const SpeechContext = createContext<SpeechContextType | null>(null);

export const useSpeech = () => {
  const context = useContext(SpeechContext);
  if (!context) throw new Error("useSpeech must be used within a SpeechProvider");
  return context;
};

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>(View.HOME);
  const [lang, setLang] = useState<Language>('bn');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  const [user, setUser] = useState<User>({
    uid: 'guest_user_' + Math.random().toString(36).substr(2, 5),
    displayName: 'কৃষক বন্ধু',
    role: 'farmer_entrepreneur',
    progress: {
      rank: 'নবিশ কৃষক',
      level: 1,
      xp: 120,
      streak: 3,
      skills: { soil: 40, protection: 30, technology: 50 }
    },
    myCrops: [],
    savedReports: [],
    preferredCategories: ['cereals', 'vegetables'],
    settings: {
      theme: 'light',
      notifications: { weather: true, market: true, cropHealth: true }
    }
  });

  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioCtx, setAudioCtx] = useState<AudioContext | null>(null);
  const [currentSource, setCurrentSource] = useState<AudioBufferSourceNode | null>(null);

  // Auto-sync user data to Supabase when profile changes
  useEffect(() => {
    if (user.uid) {
      syncUserProfile(user);
    }
  }, [user.displayName, user.role, user.progress, user.farmLocation]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const stopSpeech = () => {
    if (currentSource) {
      currentSource.stop();
      setCurrentSource(null);
    }
    setIsSpeaking(false);
  };

  const playSpeech = async (text: string, audioBase64?: string) => {
    if (!speechEnabled) return;
    stopSpeech();
    
    try {
      setIsSpeaking(true);
      const ctx = audioCtx || new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      if (!audioCtx) setAudioCtx(ctx);
      if (ctx.state === 'suspended') await ctx.resume();

      let base64 = audioBase64;
      if (!base64) {
        base64 = await generateSpeech(text.replace(/[*#_~]/g, ''));
      }

      const buffer = await decodeAudioData(decodeBase64(base64), ctx, 24000, 1);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.onended = () => setIsPlayingState(false);
      source.start(0);
      setCurrentSource(source);
    } catch (e) {
      console.error("Speech Error:", e);
      setIsSpeaking(false);
    }
  };

  const setIsPlayingState = (val: boolean) => {
    // Fix: Changed non-existent setIsPlaying to setIsSpeaking to resolve compilation error.
    setIsSpeaking(val);
    if (!val) setCurrentSource(null);
  };

  const handleNavigate = (view: View) => {
    stopSpeech();
    setCurrentView(view);
    setIsDrawerOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAction = (xp: number) => {
    setUser(prev => ({
      ...prev,
      progress: {
        ...prev.progress,
        xp: prev.progress.xp + xp,
        level: Math.floor((prev.progress.xp + xp) / 500) + 1
      }
    }));
  };

  const handleSaveReport = async (report: Omit<SavedReport, 'id' | 'timestamp'>) => {
    const newReport: SavedReport = {
      ...report,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now()
    };
    
    setUser(prev => ({
      ...prev,
      savedReports: [newReport, ...prev.savedReports]
    }));

    if (user.uid) {
      saveReportToSupabase(user.uid, newReport);
    }
  };

  useEffect(() => {
    const onGlobalNav = (e: any) => handleNavigate(e.detail as View);
    const onSaveReportEvent = (e: any) => handleSaveReport(e.detail);
    window.addEventListener('agritech_navigate', onGlobalNav);
    window.addEventListener('agritech_save_report', onSaveReportEvent);
    return () => {
      window.removeEventListener('agritech_navigate', onGlobalNav);
      window.removeEventListener('agritech_save_report', onSaveReportEvent);
    }
  }, [user.uid]);

  const renderView = () => {
    switch (currentView) {
      case View.HOME:
        return (
          <div className="animate-fade-in space-y-0">
            <Hero onNavigate={handleNavigate} lang={lang} />
            <div className="max-w-7xl mx-auto px-4 -mt-16 relative z-50 space-y-8 pb-12">
               <WeatherHorizontal lang={lang} />
               <MarketPriceHorizontal onNavigate={handleNavigate} lang={lang} />
               <NewsTicker lang={lang} />
            </div>
            <StatsSection />
            <FeatureHighlights onNavigate={handleNavigate} lang={lang} />
            <FeaturedCourses onNavigate={handleNavigate} />
            <MissionSection />
            <ContactFooter />
          </div>
        );
      case View.TOOLS:
        return <ToolsHub onNavigate={handleNavigate} lang={lang} />;
      case View.CHAT:
        return <ChatBot user={user} userRank={user.progress.rank} userCrops={user.myCrops} onBack={() => handleNavigate(View.HOME)} onAction={() => handleAction(20)} />;
      case View.SEARCH:
        return <SearchTool onBack={() => handleNavigate(View.HOME)} onAction={() => handleAction(10)} onSaveReport={handleSaveReport} />;
      case View.ANALYZER:
        return <Analyzer onBack={() => handleNavigate(View.HOME)} onAction={() => handleAction(50)} onSaveReport={handleSaveReport} userRank={user.progress.rank} userCrops={user.myCrops} onNavigate={handleNavigate} lang={lang} />;
      case View.WEATHER:
        return <Weather onBack={() => handleNavigate(View.HOME)} lang={lang} />;
      case View.NUTRIENT_CALC:
        return <NutrientCalculator user={user} onBack={() => handleNavigate(View.HOME)} onAction={() => handleAction(30)} onSaveReport={handleSaveReport} onNavigate={handleNavigate} lang={lang} />;
      case View.BIOCONTROL:
        return <BiocontrolGuide onBack={() => handleNavigate(View.HOME)} onAction={() => handleAction(15)} onSaveReport={handleSaveReport} />;
      case View.SOIL_GUIDE:
        return <SoilGuide onBack={() => handleNavigate(View.HOME)} onAction={() => handleAction(10)} onSaveReport={handleSaveReport} />;
      case View.DEFENSE_GUIDE:
        return <PlantDefenseGuide onBack={() => handleNavigate(View.HOME)} />;
      case View.PEST_EXPERT:
        return <PesticideExpert onBack={() => handleNavigate(View.HOME)} onNavigate={handleNavigate} onAction={() => handleAction(40)} onSaveReport={handleSaveReport} lang={lang} />;
      case View.SOIL_EXPERT:
        return <SoilExpert onBack={() => handleNavigate(View.HOME)} onAction={() => handleAction(45)} onSaveReport={handleSaveReport} lang={lang} />;
      case View.YIELD_CALCULATOR:
        return <YieldCalculator onBack={() => handleNavigate(View.HOME)} onAction={() => handleAction(25)} />;
      case View.AI_YIELD_PREDICTION:
        return <AIYieldPredictor user={user} onBack={() => handleNavigate(View.HOME)} onAction={handleAction} onSaveReport={handleSaveReport} lang={lang} />;
      case View.CROP_DISEASE_LIBRARY:
        return <CropDiseaseLibrary onBack={() => handleNavigate(View.HOME)} onAction={() => handleAction(15)} onSaveReport={handleSaveReport} />;
      case View.QR_GENERATOR:
        return <QRGenerator onBack={() => handleNavigate(View.HOME)} onAction={() => handleAction(5)} />;
      case View.MONITORING:
        return <FieldMonitoring onBack={() => handleNavigate(View.HOME)} onAction={() => handleAction(60)} onSaveReport={handleSaveReport} />;
      case View.LEAF_COLOR_CHART:
        return <LeafColorChart onBack={() => handleNavigate(View.HOME)} onAction={() => handleAction(35)} />;
      case View.LEARNING_CENTER:
        return <LearningCenter onBack={() => handleNavigate(View.HOME)} onAction={handleAction} />;
      case View.PROFILE:
        return <UserProfile user={user} onUpdateUser={(updates) => setUser(prev => ({ ...prev, ...updates }))} onSaveReport={handleSaveReport} onToggleSpeech={() => setSpeechEnabled(!speechEnabled)} speechEnabled={speechEnabled} onBack={() => handleNavigate(View.HOME)} />;
      case View.ABOUT:
        return <About onNavigate={handleNavigate} onBack={() => handleNavigate(View.HOME)} />;
      case View.FLASHCARDS:
        return <FlashcardView onBack={() => handleNavigate(View.HOME)} onAction={handleAction} />;
      case View.TASK_SCHEDULER:
        return <TaskScheduler user={user} onBack={() => handleNavigate(View.HOME)} onAction={() => handleAction(10)} />;
      case View.FAQ:
        return <FAQ onBack={() => handleNavigate(View.HOME)} />;
      case View.CROP_CALENDAR:
        return <CropCalendar user={user} onBack={() => handleNavigate(View.HOME)} onAction={() => handleAction(20)} onSaveReport={handleSaveReport} />;
      case View.PODCAST:
        return <AgriPodcast onBack={() => handleNavigate(View.HOME)} onAction={handleAction} />;
      case View.CABI_TRAINING:
        return <CABIDiagnosisTraining onBack={() => handleNavigate(View.HOME)} onAction={() => handleAction(100)} />;
      case View.MAPS:
        return <FieldMap onBack={() => handleNavigate(View.HOME)} lang={lang} />;
      default:
        return <Hero onNavigate={handleNavigate} lang={lang} />;
    }
  };

  return (
    <SpeechContext.Provider value={{ playSpeech, stopSpeech, isSpeaking, speechEnabled, setSpeechEnabled }}>
      <div className={`min-h-screen transition-colors duration-500 ${user.settings?.theme === 'dark' ? 'dark bg-slate-950' : 'bg-slate-50'}`}>
        
        {isShareOpen && (
          <ShareDialog 
            isOpen={isShareOpen} 
            onClose={() => setIsShareOpen(false)} 
            title={lang === 'bn' ? "কৃষি এআই: স্মার্ট কৃষি ইকোসিস্টেম" : "Krishi AI: Smart Agri Ecosystem"} 
            content={lang === 'bn' ? "বাংলাদেশের কৃষকদের জন্য একটি সমন্বিত এআই ইকোসিস্টেম।" : "An integrated AI ecosystem for Bangladeshi farmers."}
            installPrompt={installPrompt}
            onInstall={() => {
              if (installPrompt) {
                installPrompt.prompt();
                setInstallPrompt(null);
              }
            }}
          />
        )}

        <div className={`fixed inset-0 z-[1000] pointer-events-none ${isDrawerOpen ? 'pointer-events-auto' : ''}`}>
           <div className={`absolute inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity duration-500 ${isDrawerOpen ? 'opacity-100' : 'opacity-0'}`} onClick={() => setIsDrawerOpen(false)}></div>
           <div className={`absolute top-0 left-0 bottom-0 w-[85%] max-w-sm bg-white dark:bg-slate-900 shadow-2xl transition-transform duration-500 transform ${isDrawerOpen ? 'translate-x-0' : '-translate-x-full'} overflow-y-auto`}>
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-emerald-600">
                 <Logo size="md" showText style={{ color: 'white' }} />
                 <button onClick={() => setIsDrawerOpen(false)} className="p-2 bg-white/20 rounded-xl text-white">✕</button>
              </div>
              <div className="p-6 space-y-8">
                 <DrawerSection title={lang === 'bn' ? "প্রধান মেনু" : "Main Menu"}>
                    <DrawerItem icon="🏠" label={lang === 'bn' ? "হোম স্ক্রিন" : "Home"} onClick={() => handleNavigate(View.HOME)} active={currentView === View.HOME} />
                    <DrawerItem icon="👤" label={lang === 'bn' ? "আমার প্রোফাইল" : "Profile"} onClick={() => handleNavigate(View.PROFILE)} active={currentView === View.PROFILE} />
                    <DrawerItem icon="🛠️" label={lang === 'bn' ? "সকল টুলস" : "All Tools"} onClick={() => handleNavigate(View.TOOLS)} active={currentView === View.TOOLS} />
                    <DrawerItem icon="🎓" label={lang === 'bn' ? "শিখন কেন্দ্র" : "Learning Center"} onClick={() => handleNavigate(View.LEARNING_CENTER)} active={currentView === View.LEARNING_CENTER} />
                 </DrawerSection>
                 <DrawerSection title={lang === 'bn' ? "বিশেষজ্ঞ ডায়াগনোসিস" : "Expert Diagnosis"}>
                    <DrawerItem icon="📸" label={lang === 'bn' ? "এআই স্ক্যানার" : "AI Scanner"} onClick={() => handleNavigate(View.ANALYZER)} active={currentView === View.ANALYZER} />
                    <DrawerItem icon="🧪" label={lang === 'bn' ? "বালাইনাশক বিশেষজ্ঞ" : "Pesticide Expert"} onClick={() => handleNavigate(View.PEST_EXPERT)} active={currentView === View.PEST_EXPERT} />
                    <DrawerItem icon="🔬" label={lang === 'bn' ? "CABI ট্রেনিং" : "CABI Training"} onClick={() => handleNavigate(View.CABI_TRAINING)} active={currentView === View.CABI_TRAINING} />
                 </DrawerSection>
              </div>
           </div>
        </div>

        <header className="fixed top-0 left-0 right-0 h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-100 dark:border-slate-800 z-[100] px-4 flex items-center justify-between shadow-sm">
           <div className="flex items-center space-x-3">
             <button onClick={() => setIsDrawerOpen(true)} className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl hover:bg-emerald-50 transition-colors">
               <svg className="w-6 h-6 text-slate-800 dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16m-7 6h7" /></svg>
             </button>
             <div className="flex items-center space-x-2 cursor-pointer" onClick={() => handleNavigate(View.HOME)}>
               <Logo size="sm" showText={false} />
               <span className="font-black text-lg tracking-tighter text-slate-800 dark:text-white hidden xs:block">Krishi <span className="text-emerald-600">AI</span></span>
             </div>
           </div>
           
           <div className="flex items-center space-x-2 md:space-x-4">
              <button 
                onClick={() => setIsShareOpen(true)}
                className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-emerald-50 transition-all active:scale-90 border border-transparent hover:border-emerald-200"
                title="Share & Install"
              >
                <svg className="w-5 h-5 text-slate-600 dark:text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              </button>

              <button 
                onClick={() => { if (isSpeaking) stopSpeech(); setSpeechEnabled(!speechEnabled); }}
                className={`p-2.5 rounded-xl transition-all flex items-center space-x-2 border shadow-sm active:scale-95 ${speechEnabled ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
                title={speechEnabled ? "Mute Read Aloud" : "Enable Read Aloud"}
              >
                <div className="relative">
                  {speechEnabled ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
                  )}
                  {isSpeaking && <span className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full animate-ping"></span>}
                </div>
                <span className="text-[10px] font-black uppercase hidden sm:block">
                  {speechEnabled ? 'Read On' : 'Read Off'}
                </span>
              </button>

              <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-full flex items-center space-x-1 border border-slate-200 dark:border-slate-700">
                <button 
                  onClick={() => setLang('bn')} 
                  className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${lang === 'bn' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 dark:text-slate-500 hover:text-emerald-500'}`}
                >
                  বাংলা
                </button>
                <button 
                  onClick={() => setLang('en')} 
                  className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${lang === 'en' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 dark:text-slate-500 hover:text-emerald-500'}`}
                >
                  EN
                </button>
              </div>
              <FarmerAvatar 
                user={user} 
                size="md" 
                showProgress={true} 
                onClick={() => handleNavigate(View.PROFILE)} 
              />
           </div>
        </header>

        <main className="pt-16 pb-24 min-h-screen">
          {renderView()}
        </main>

        <nav className="fixed bottom-4 left-4 right-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200 dark:border-slate-800 z-[100] px-2 py-2 flex justify-around items-center max-w-sm mx-auto rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.15)]">
          <NavButton active={currentView === View.HOME} icon="🏠" label={lang === 'bn' ? "হোম" : "Home"} onClick={() => handleNavigate(View.HOME)} />
          <NavButton active={currentView === View.TOOLS} icon="🛠️" label={lang === 'bn' ? "টুলস" : "Tools"} onClick={() => handleNavigate(View.TOOLS)} />
          <div className="relative -mt-10 group">
             <div className="absolute inset-0 bg-emerald-500 blur-2xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
             <button 
               onClick={() => handleNavigate(View.ANALYZER)}
               className={`relative w-16 h-16 rounded-[1.8rem] flex items-center justify-center text-3xl shadow-2xl transition-all duration-300 transform active:scale-90 ${currentView === View.ANALYZER ? 'bg-white text-emerald-600 border-4 border-emerald-500 rotate-12' : 'bg-emerald-600 text-white'}`}
             >
                📸
             </button>
             <p className="text-[7px] font-black uppercase text-center mt-2 tracking-widest text-emerald-600 dark:text-emerald-400">{lang === 'bn' ? 'এআই স্ক্যান' : 'AI Scan'}</p>
          </div>
          <NavButton active={currentView === View.LEARNING_CENTER} icon="🎓" label={lang === 'bn' ? "শিখন" : "Learn"} onClick={() => handleNavigate(View.LEARNING_CENTER)} />
          <NavButton active={currentView === View.PROFILE} icon="👤" label={lang === 'bn' ? "প্রোফাইল" : "Profile"} onClick={() => handleNavigate(View.PROFILE)} />
        </nav>
      </div>
    </SpeechContext.Provider>
  );
};

const DrawerSection = ({ title, children }: any) => (
  <div className="space-y-3">
     <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{title}</h4>
     <div className="grid grid-cols-1 gap-2">
        {children}
     </div>
  </div>
);

const DrawerItem = ({ icon, label, onClick, active }: any) => (
  <button 
     onClick={onClick}
     className={`flex items-center space-x-4 p-4 rounded-2xl transition-all ${active ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 shadow-sm' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
  >
     <span className="text-xl">{icon}</span>
     <span className="font-bold text-sm">{label}</span>
  </button>
);

const NavButton = ({ active, icon, label, onClick }: any) => (
  <button onClick={onClick} className={`flex-1 flex flex-col items-center p-2 rounded-2xl transition-all duration-300 ${active ? 'text-[#0A8A1F] scale-110' : 'text-slate-400 hover:text-slate-600'}`}>
    <span className="text-xl leading-none">{icon}</span>
    <span className="text-[7px] md:text-[8px] font-black uppercase mt-1 tracking-tighter">{label}</span>
  </button>
);

export default App;
