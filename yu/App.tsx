import React, { Suspense } from 'react';
import { Experience } from './components/Experience';
import { UI } from './components/UI';
import { GestureController } from './components/GestureController';

// Loading Screen
const Loader = () => (
  <div className="absolute inset-0 flex items-center justify-center bg-black text-pink-100">
    <div className="text-center">
      <div className="w-16 h-16 border-t-2 border-pink-200 rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-xs tracking-[0.3em] animate-pulse">LOADING EXPERIENCE</p>
    </div>
  </div>
);

function App() {
  return (
    <div className="relative w-full h-screen bg-[#050505]">
      {/* 3D Scene */}
      <Suspense fallback={<Loader />}>
        <Experience />
      </Suspense>

      {/* Logic & Overlays */}
      <GestureController />
      <UI />
    </div>
  );
}

export default App;