import React from 'react';
import { useStore } from '../store';
import { GREETINGS } from '../constants';

const BlessingCard = () => {
    const show = useStore(s => s.showGreeting);
    const close = useStore(s => s.setShowGreeting);
    const greeting = useStore(s => s.currentGreeting);

    if (!show) return null;

    return (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-pink-50 border border-pink-200 w-full max-w-sm rounded-[2rem] p-8 shadow-2xl text-center relative animate-[fadeIn_0.5s_ease-out]">
                <div className="absolute top-4 right-6 cursor-pointer text-pink-300 hover:text-pink-500 text-2xl font-light" onClick={() => close(false)}>
                    &times;
                </div>
                <h2 className="text-2xl font-serif text-pink-950 mb-4 tracking-widest uppercase">Holiday Wish</h2>
                <div className="h-px w-16 bg-pink-300 mx-auto mb-6"></div>
                <p className="text-pink-900 font-light text-lg italic leading-relaxed">
                    "{greeting}"
                </p>
                <div className="mt-8">
                    <button 
                        onClick={() => close(false)}
                        className="px-6 py-2 bg-pink-950 text-pink-50 rounded-full text-sm tracking-widest hover:bg-black transition-colors"
                    >
                        RECEIVE
                    </button>
                </div>
            </div>
        </div>
    );
};

export const UI: React.FC = () => {
    const setShowGreeting = useStore(s => s.setShowGreeting);
    const setCurrentGreeting = useStore(s => s.setCurrentGreeting);
    const chaosFactor = useStore(s => s.chaosFactor);
    const setChaosFactor = useStore(s => s.setChaosFactor);
    // const isVisionReady = useStore(s => s.isVisionReady); // Unused for now in minimal UI

    const handleBlessing = () => {
        const randomG = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
        setCurrentGreeting(randomG);
        setShowGreeting(true);
    };

    // Manual toggle fallback
    const toggleChaos = () => {
        setChaosFactor(chaosFactor > 0.5 ? 0 : 1);
    };

    return (
        <>
            <BlessingCard />
            
            {/* Minimal Interactive Buttons */}
            
            {/* Top Right: Blessing */}
            <div className="fixed top-8 right-8 z-10">
                <button 
                    onClick={handleBlessing}
                    className="bg-pink-100/10 backdrop-blur-md border border-pink-100/30 text-pink-50 w-14 h-14 rounded-full flex items-center justify-center hover:bg-pink-100/30 transition-all shadow-[0_0_30px_rgba(255,192,203,0.4)] group"
                    aria-label="Get Blessing"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="group-hover:scale-110 transition-transform">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                    </svg>
                </button>
            </div>

            {/* Bottom Center: Unleash/Reform */}
            <div className="fixed bottom-8 left-0 w-full z-10 flex justify-center pointer-events-none">
                 <button 
                    onClick={toggleChaos}
                    className={`pointer-events-auto px-10 py-4 rounded-full border text-sm tracking-[0.2em] uppercase transition-all duration-700 backdrop-blur-sm ${chaosFactor > 0.5 ? 'bg-pink-500/30 border-pink-400 text-pink-50 shadow-[0_0_50px_rgba(236,72,153,0.6)]' : 'bg-black/20 border-pink-200/30 text-pink-100 hover:bg-pink-100/10'}`}
                 >
                    {chaosFactor > 0.5 ? "Reform" : "Unleash"}
                 </button>
            </div>
        </>
    );
};