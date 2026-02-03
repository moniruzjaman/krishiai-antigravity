import React, { useState, useEffect } from 'react';

const STORAGE_KEY = 'gemini_api_key';

export const ApiKeyInput: React.FC = () => {
    const [apiKey, setApiKey] = useState('');
    const [isVisible, setIsVisible] = useState(false);
    const [status, setStatus] = useState<'idle' | 'saved'>('idle');

    useEffect(() => {
        const storedKey = localStorage.getItem(STORAGE_KEY);
        if (storedKey) {
            setApiKey(storedKey);
        }
    }, []);

    const handleSave = () => {
        if (!apiKey.trim()) {
            localStorage.removeItem(STORAGE_KEY);
        } else {
            localStorage.setItem(STORAGE_KEY, apiKey.trim());
        }
        setStatus('saved');
        setTimeout(() => setStatus('idle'), 2000);
    };

    return (
        <div className="bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-xl">
             <div className="flex items-center space-x-3 mb-4">
                <span className="text-2xl">🔑</span>
                <div>
                    <h3 className="font-black text-slate-800 dark:text-white uppercase tracking-tight">Gemini API Key</h3>
                    <p className="text-[10px] font-bold text-slate-400">আপনার নিজস্ব API Key ব্যবহার করুন</p>
                </div>
            </div>

            <div className="space-y-4">
                <div className="relative">
                    <input 
                        type={isVisible ? "text" : "password"} 
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="AIzaSy..."
                        className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl py-3 px-4 pr-12 font-mono text-sm text-slate-600 dark:text-slate-300 outline-none focus:border-emerald-500 transition-colors"
                    />
                    <button 
                        onClick={() => setIsVisible(!isVisible)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-500"
                    >
                        {isVisible ? '🙈' : '👁️'}
                    </button>
                </div>

                <div className="flex justify-between items-center">
                    <a 
                        href="https://aistudio.google.com/app/apikey" 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-[10px] font-black text-blue-500 hover:underline uppercase tracking-wider"
                    >
                        GET API KEY ↗
                    </a>
                    
                    <button 
                        onClick={handleSave}
                        className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                            status === 'saved' 
                            ? 'bg-emerald-500 text-white' 
                            : 'bg-slate-900 text-white hover:bg-emerald-600'
                        }`}
                    >
                        {status === 'saved' ? 'Saved ✓' : 'Save Key'}
                    </button>
                </div>
                
                <p className="text-[10px] text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                    Note: Key is stored locally in your browser. It is never sent to any other server.
                </p>
            </div>
        </div>
    );
};
