
import React, { useState, useEffect, useRef } from 'react';
import { searchNearbySellers } from '../services/geminiService';
import { Language, GroundingChunk } from '../types';
import { ToolGuideHeader } from './ToolGuideHeader';

interface FieldMapProps {
  onBack: () => void;
  lang: Language;
}

const FieldMap: React.FC<FieldMapProps> = ({ onBack, lang }) => {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [sellers, setSellers] = useState<{ text: string; groundingChunks: GroundingChunk[] } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchType, setSearchType] = useState('Agri Seed and Pesticide Store');
  const [customSearch, setCustomSearch] = useState('');
  const [selectedPlaceQuery, setSelectedPlaceQuery] = useState<string | null>(null);
  const [mapZoom, setMapZoom] = useState(14);
  const [isTracking, setIsTracking] = useState(false);

  const requestLocation = (isManualTrigger: boolean = false) => {
    setIsLoading(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const newCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCoords(newCoords);
          setIsTracking(true);
          
          if (isManualTrigger) {
            // If the user specifically clicked the icon, reset to current location view
            setSelectedPlaceQuery(null);
            setMapZoom(16);
          }
          
          performSearch(searchType, newCoords);
        },
        () => {
          setIsLoading(false);
          setIsTracking(false);
          alert(lang === 'bn' ? "লোকেশন পাওয়া যায়নি। অনুগ্রহ করে GPS চালু করুন।" : "Location access denied. Please enable GPS.");
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  };

  useEffect(() => {
    requestLocation();
  }, []);

  const performSearch = async (type: string, overrideCoords?: { lat: number, lng: number }) => {
    const targetCoords = overrideCoords || coords;
    if (!targetCoords) return;
    
    setSearchType(type);
    setIsLoading(true);
    try {
      const data = await searchNearbySellers(targetCoords.lat, targetCoords.lng, type, lang);
      setSellers(data);
    } catch (e) {
      console.error("Maps Search Error:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFocusPlace = (title: string) => {
    setSelectedPlaceQuery(title);
    setIsTracking(false); // No longer tracking self once we focus on a specific place
    setMapZoom(18); 
    const mapElement = document.getElementById('main-field-map');
    if (mapElement && window.innerWidth < 1024) {
      mapElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Construct Embed URL. center property ensures map is physically centered on the determined lat/lng
  const mapUrl = coords 
    ? `https://www.google.com/maps/embed/v1/search?key=${process.env.API_KEY}&q=${encodeURIComponent(selectedPlaceQuery || searchType)}&center=${coords.lat},${coords.lng}&zoom=${mapZoom}`
    : '';

  return (
    <div className="max-w-6xl mx-auto p-4 pb-32 animate-fade-in font-sans">
      <ToolGuideHeader 
        title={lang === 'bn' ? 'এগ্রি-ম্যাপ ও বিক্রেতা হাব' : 'Agri-Map & Hub'}
        subtitle={lang === 'bn' ? 'আপনার ক্ষেতের অবস্থান এবং নিকটস্থ কৃষি উপকরণ বিক্রেতা খুঁজুন।' : 'Locate your field and find authentic nearby agri-input sellers.'}
        protocol="Grounding via Google Maps"
        source="Real-time Location Intelligence"
        lang={lang}
        onBack={onBack}
        icon="📍"
        themeColor="emerald"
        guideSteps={lang === 'bn' ? [
          "আপনার মোবাইলের লোকেশন (GPS) চালু আছে কি না নিশ্চিত করুন।",
          "ম্যাপের ডান পাশের 'লোকেশন আইকন' টিপে আপনার বর্তমান অবস্থান শনাক্ত করুন।",
          "বীজ বা বালাইনাশক বিক্রেতা খুঁজতে ক্যাটাগরি বেছে নিন অথবা সার্চ করুন।",
          "তালিকা থেকে কোনো দোকানে ক্লিক করলে ম্যাপে সেটির সুনির্দিষ্ট অবস্থান দেখা যাবে।"
        ] : [
          "Ensure your device GPS is turned on for accurate field mapping.",
          "Tap the 'Location Icon' on the map to dynamically determine your current field position.",
          "Select a category or use custom search to find sellers grounded by AI.",
          "Click on a store from the sidebar to pinpoint its exact location on the map."
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Map Section */}
        <div className="lg:col-span-8 space-y-6">
          <div id="main-field-map" className="bg-white rounded-[3rem] p-4 shadow-2xl border border-slate-100 overflow-hidden aspect-video relative group transition-all duration-500">
            {coords ? (
              <iframe
                title="Field Location Map"
                width="100%"
                height="100%"
                frameBorder="0"
                style={{ border: 0, borderRadius: '2rem' }}
                src={mapUrl}
                allowFullScreen
              ></iframe>
            ) : (
              <div className="flex flex-col items-center justify-center h-full space-y-6 text-slate-400 bg-slate-50 rounded-[2rem]">
                <div className="relative">
                  <div className="w-20 h-20 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center text-2xl">🌍</div>
                </div>
                <p className="font-black uppercase tracking-[0.2em] text-xs">Awaiting Geolocation...</p>
              </div>
            )}
            
            {/* Overlay Controls */}
            <div className="absolute top-8 right-8 flex flex-col space-y-2">
               <button 
                onClick={() => requestLocation(true)}
                className={`p-4 rounded-2xl shadow-xl border transition-all active:scale-90 flex items-center justify-center ${
                  isTracking 
                  ? 'bg-emerald-600 border-emerald-500 text-white animate-pulse' 
                  : 'bg-white/95 backdrop-blur-md border-white text-slate-800 hover:bg-emerald-50'
                }`}
                title={lang === 'bn' ? "আমার বর্তমান অবস্থান" : "My Current Location"}
               >
                 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                 </svg>
               </button>
            </div>

            <div className="absolute bottom-8 right-8 bg-white/95 backdrop-blur-md px-5 py-2.5 rounded-2xl shadow-xl border border-white flex items-center space-x-3 pointer-events-none">
               <span className="relative flex h-3 w-3">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isTracking ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
                  <span className={`relative inline-flex rounded-full h-3 w-3 ${isTracking ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
               </span>
               <span className="text-[10px] font-black uppercase text-slate-800 tracking-wider">
                 {isTracking ? (lang === 'bn' ? 'বর্তমান অবস্থানে লক করা' : 'Locked on Current GPS') : (lang === 'bn' ? 'ফিল্ড মোড সক্রিয়' : 'Field Mode Active')}
               </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
             <div className="flex flex-wrap gap-2 flex-1">
                <MapActionBtn active={searchType === 'Agri Seed Store' && !selectedPlaceQuery} icon="🌱" label={lang === 'bn' ? 'বীজ' : 'Seeds'} onClick={() => { setSelectedPlaceQuery(null); performSearch('Agri Seed Store'); }} />
                <MapActionBtn active={searchType === 'Pesticide Store' && !selectedPlaceQuery} icon="🧪" label={lang === 'bn' ? 'কীটনাশক' : 'Pesticides'} onClick={() => { setSelectedPlaceQuery(null); performSearch('Pesticide Store'); }} />
                <MapActionBtn active={searchType === 'Upazila Agriculture Office' && !selectedPlaceQuery} icon="🏛️" label={lang === 'bn' ? 'অফিস' : 'DAE'} onClick={() => { setSelectedPlaceQuery(null); performSearch('Upazila Agriculture Office'); }} />
                <MapActionBtn active={searchType === 'Fertilizer Retailer' && !selectedPlaceQuery} icon="⚖️" label={lang === 'bn' ? 'সার' : 'Fertilizer'} onClick={() => { setSelectedPlaceQuery(null); performSearch('Fertilizer Retailer'); }} />
             </div>
             <div className="flex gap-2 w-full sm:w-auto">
                <input 
                  type="text" 
                  value={customSearch}
                  onChange={(e) => setCustomSearch(e.target.value)}
                  placeholder={lang === 'bn' ? "অন্য কিছু খুঁজুন..." : "Custom search..."}
                  className="bg-white border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500 shadow-sm"
                  onKeyDown={(e) => e.key === 'Enter' && performSearch(customSearch)}
                />
                <button 
                  onClick={() => performSearch(customSearch)}
                  className="bg-slate-900 text-white p-4 rounded-2xl hover:bg-slate-800 transition-all shadow-lg active:scale-95"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </button>
             </div>
          </div>
        </div>

        {/* Sellers List Section */}
        <div className="lg:col-span-4 space-y-6 h-full">
           <div className="bg-slate-900 rounded-[3rem] p-8 text-white shadow-2xl h-full flex flex-col border-b-[12px] border-emerald-600 max-h-[600px] lg:max-h-none">
              <div className="flex justify-between items-center mb-8 shrink-0">
                <h3 className="text-xl font-black flex items-center">
                   <span className="mr-3 p-2 bg-white/10 rounded-xl">🏬</span> 
                   {lang === 'bn' ? 'নিকটস্থ কেন্দ্র' : 'Nearby Hubs'}
                </h3>
                {isLoading && (
                  <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                )}
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-hide">
                 {isLoading && !sellers ? (
                   <div className="flex flex-col items-center justify-center py-20 space-y-4 opacity-50">
                      <div className="w-10 h-10 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-400">Grounding Maps...</p>
                   </div>
                 ) : sellers?.groundingChunks?.length ? (
                   sellers.groundingChunks.map((chunk, idx) => chunk.maps ? (
                     <div 
                        key={idx} 
                        onClick={() => handleFocusPlace(chunk.maps!.title)}
                        className={`p-5 rounded-[2.2rem] border transition-all cursor-pointer group ${
                          selectedPlaceQuery === chunk.maps.title 
                          ? 'bg-emerald-600 border-emerald-500 shadow-xl scale-[1.02]' 
                          : 'bg-white/5 border-white/10 hover:bg-white/10'
                        }`}
                      >
                        <h4 className="font-black text-sm mb-1 leading-tight group-hover:text-white">{chunk.maps.title}</h4>
                        <p className="text-[9px] font-bold text-slate-400 group-hover:text-emerald-100 uppercase tracking-widest mb-4">Click to focus on map</p>
                        <div className="flex items-center justify-between">
                           <button 
                              onClick={(e) => { e.stopPropagation(); window.open(chunk.maps!.uri, '_blank'); }}
                              className="text-[9px] font-black uppercase text-emerald-400 group-hover:text-white underline underline-offset-4"
                           >
                              Navigate
                           </button>
                           <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${selectedPlaceQuery === chunk.maps.title ? 'bg-white text-emerald-600' : 'bg-white/10 text-white group-hover:bg-white group-hover:text-emerald-600'}`}>
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                           </div>
                        </div>
                     </div>
                   ) : null)
                 ) : (
                   <div className="text-center py-20 opacity-30 flex flex-col items-center space-y-4">
                      <div className="text-6xl">🏜️</div>
                      <p className="text-xs font-bold leading-relaxed px-8">
                        {lang === 'bn' ? 'নিকটস্থ কোনো বিক্রেতা পাওয়া যায়নি। অন্য কিছু লিখে খুঁজুন।' : 'No nearby sellers found. Try a custom search.'}
                      </p>
                   </div>
                 )}
              </div>

              {sellers?.text && !isLoading && (
                 <div className="mt-8 p-5 bg-white/5 rounded-3xl text-[10px] text-slate-400 leading-relaxed italic border border-white/5 shrink-0">
                    {sellers.text}
                 </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
};

const MapActionBtn = ({ icon, label, onClick, active }: any) => (
  <button 
    onClick={onClick}
    className={`px-6 py-4 rounded-2xl shadow-sm transition-all flex items-center space-x-3 active:scale-95 group border-2 ${
      active 
      ? 'bg-emerald-600 border-emerald-600 text-white shadow-xl' 
      : 'bg-white border-slate-100 text-slate-700 hover:shadow-md hover:border-emerald-200'
    }`}
  >
     <span className={`text-xl transition-transform ${active ? 'scale-110' : 'group-hover:scale-125'}`}>{icon}</span>
     <span className={`text-[10px] font-black uppercase tracking-widest ${active ? 'text-white' : 'text-slate-600'}`}>{label}</span>
  </button>
);

export default FieldMap;
