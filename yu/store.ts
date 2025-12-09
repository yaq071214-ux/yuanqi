import { create } from 'zustand';

interface AppState {
  // 0 = Formed (Tree), 1 = Chaos (Unleash)
  chaosFactor: number;
  setChaosFactor: (v: number) => void;
  
  // Camera orbit angle offset driven by hand position (-1 to 1)
  cameraRotationOffset: number;
  setCameraRotationOffset: (v: number) => void;

  // UI States
  showGreeting: boolean;
  setShowGreeting: (v: boolean) => void;
  currentGreeting: string;
  setCurrentGreeting: (s: string) => void;
  
  // System State
  isVisionReady: boolean;
  setVisionReady: (v: boolean) => void;
}

export const useStore = create<AppState>((set) => ({
  chaosFactor: 0, 
  setChaosFactor: (v) => set({ chaosFactor: v }),

  cameraRotationOffset: 0,
  setCameraRotationOffset: (v) => set({ cameraRotationOffset: v }),

  showGreeting: false,
  setShowGreeting: (v) => set({ showGreeting: v }),
  
  currentGreeting: "",
  setCurrentGreeting: (s) => set({ currentGreeting: s }),

  isVisionReady: false,
  setVisionReady: (v) => set({ isVisionReady: v }),
}));