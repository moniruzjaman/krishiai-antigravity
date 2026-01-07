
import React, { useState } from 'react';
import { 
  getWhatsAppUrl, 
  getMessengerUrl,
  getFacebookUrl,
  getQRCodeUrl, 
  copyToClipboard, 
  shareContentNative,
  getXUrl
} from '../services/shareService';

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: string;
  installPrompt?: any;
  onInstall?: () => void;
}

const ShareDialog: React.FC<ShareDialogProps> = ({ isOpen, onClose, title, content, installPrompt, onInstall }) => {
  const [showQR, setShowQR] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const appUrl = window.location.origin;
  const fullShareText = `${title}\n\n${content.replace(/[*#_~]/g, '')}\n\nApp: ${appUrl}`;
  
  const handleCopy = async () => {
    const success = await copyToClipboard(fullShareText);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleNativeShare = () => {
    shareContentNative({ title: `Krishi AI`, text: fullShareText, url: appUrl });
  };

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

  const ShareButton = ({ onClick, icon, label, color }: any) => (
    <button 
      onClick={onClick}
      className="flex flex-col items-center space-y-2 group transition-all active:scale-90"
    >
      <div className={`w-14 h-14 ${color} rounded-2xl flex items-center justify-center text-2xl shadow-lg group-hover:shadow-xl transition-all border-b-4 border-black/10`}>
        {icon}
      </div>
      <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">{label}</span>
    </button>
  );

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fade-in font-sans">
      <div className="bg-white w-full max-w-sm rounded-[3rem] shadow-2xl overflow-hidden flex flex-col relative border border-slate-100 max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-slate-50 p-6 flex justify-between items-center border-b border-slate-100">
           <div>
             <h3 className="text-xl font-black text-slate-800 tracking-tight">শেয়ার ও সেভ করুন</h3>
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Share & Install App</p>
           </div>
           <button onClick={onClose} className="p-2 bg-white rounded-xl shadow-sm text-slate-400 hover:text-slate-600 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
           </button>
        </div>

        <div className="p-8 overflow-y-auto scrollbar-hide">
          {/* Action Row: Install App */}
          <section className="mb-8">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 ml-1">কুইক অ্যাক্সেস (Installation)</h4>
            {installPrompt ? (
               <button 
               onClick={onInstall}
               className="w-full bg-emerald-600 hover:bg-emerald-700 text-white p-5 rounded-3xl shadow-xl flex items-center justify-center space-x-4 transition-all active:scale-95 group border-b-4 border-emerald-800"
             >
               <span className="text-2xl group-hover:scale-110 transition-transform">📲</span>
               <div className="text-left">
                 <p className="text-[10px] font-black uppercase tracking-widest opacity-80 leading-none mb-1">Add to Home Screen</p>
                 <p className="text-sm font-black leading-none">অ্যাপটি মোবাইলে সেভ করুন</p>
               </div>
             </button>
            ) : isIOS ? (
              <div className="bg-blue-50 p-4 rounded-3xl border border-blue-100">
                 <div className="flex items-center space-x-3 mb-3">
                    <span className="text-xl">🍎</span>
                    <p className="text-xs font-black text-blue-800">iOS ইন্সটলেশন গাইড</p>
                 </div>
                 <p className="text-[10px] font-medium text-blue-700 leading-relaxed">
                   নিচে থাকা <span className="font-bold">Share</span> বাটন চেপে <span className="font-bold">"Add to Home Screen"</span> বাটনে ক্লিক করুন।
                 </p>
              </div>
            ) : (
              <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 text-center">
                 <p className="text-[10px] font-bold text-slate-400 leading-relaxed uppercase">ব্রাউজার মেনু থেকে "Install App" ব্যবহার করুন</p>
              </div>
            )}
          </section>

          {/* Share Grid */}
          <section>
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 ml-1">বন্ধুদের পাঠান (Sharing)</h4>
            {showQR ? (
              <div className="flex flex-col items-center space-y-6 animate-fade-in">
                <div className="bg-slate-50 p-4 rounded-3xl border-2 border-slate-100 shadow-inner">
                    <img src={getQRCodeUrl(appUrl)} alt="QR Code" className="w-48 h-48" />
                </div>
                <p className="text-xs text-slate-500 font-medium text-center px-4">স্ক্যান করে সরাসরি অ্যাপটি ওপেন করুন</p>
                <button 
                  onClick={() => setShowQR(false)}
                  className="text-emerald-600 font-black text-xs uppercase tracking-widest border-b-2 border-emerald-600"
                >অন্যান্য অপশন</button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-y-8 gap-x-4">
                <ShareButton 
                  onClick={() => window.open(getWhatsAppUrl(fullShareText), '_blank')} 
                  icon={<img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" className="w-8 h-8" alt="WhatsApp" />} 
                  label="WhatsApp" 
                  color="bg-green-500" 
                />
                <ShareButton 
                  onClick={() => window.open(getMessengerUrl(appUrl), '_blank')} 
                  icon={<img src="https://upload.wikimedia.org/wikipedia/commons/b/be/Facebook_Messenger_logo_2020.svg" className="w-8 h-8" alt="Messenger" />} 
                  label="Messenger" 
                  color="bg-blue-500" 
                />
                <ShareButton 
                  onClick={() => window.open(getFacebookUrl(appUrl), '_blank')} 
                  icon={<img src="https://upload.wikimedia.org/wikipedia/commons/0/05/Facebook_Logo_%282019%29.png" className="w-8 h-8" alt="Facebook" />} 
                  label="Facebook" 
                  color="bg-blue-700" 
                />
                <ShareButton 
                  onClick={() => window.open(getXUrl(fullShareText), '_blank')} 
                  icon={<span className="text-white">𝕏</span>} 
                  label="X / Twitter" 
                  color="bg-black" 
                />
                <ShareButton 
                  onClick={() => setShowQR(true)} 
                  icon="📲" 
                  label="QR Code" 
                  color="bg-emerald-600 text-white" 
                />
                <ShareButton 
                  onClick={handleNativeShare} 
                  icon="📱" 
                  label="More" 
                  color="bg-blue-600 text-white" 
                />
                <ShareButton 
                  onClick={handleCopy} 
                  icon={copied ? "✓" : "📋"} 
                  label={copied ? "Copied" : "Copy Link"} 
                  color="bg-slate-800 text-white" 
                />
              </div>
            )}
          </section>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-center">
           <div className="flex items-center space-x-2 opacity-50">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Secure Agri-Sharing Protocol</span>
           </div>
        </div>
      </div>
    </div>
  );
};

export default ShareDialog;
