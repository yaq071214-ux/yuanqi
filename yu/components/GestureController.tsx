import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';

// We access the global MediaPipe object loaded via CDN
declare global {
  interface Window {
    FilesetResolver: any;
    HandLandmarker: any;
  }
}

export const GestureController: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const requestRef = useRef<number | null>(null);
  const handLandmarkerRef = useRef<any>(null);
  
  const setChaosFactor = useStore((s) => s.setChaosFactor);
  const setCameraRotationOffset = useStore((s) => s.setCameraRotationOffset);
  const setVisionReady = useStore((s) => s.setVisionReady);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let timeoutId: any;

    const initVision = async () => {
      try {
        // Poll for globals if script hasn't loaded yet
        if (!window.FilesetResolver || !window.HandLandmarker) {
          console.log("Waiting for MediaPipe...");
          timeoutId = setTimeout(initVision, 500);
          return;
        }

        const vision = await window.FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );

        handLandmarkerRef.current = await window.HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1
        });

        // Start Camera
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.addEventListener('loadeddata', predict);
          setVisionReady(true);
        }
      } catch (err) {
        console.error("Vision Init Error:", err);
        setError("Camera/Gesture unavailable. Use mouse interactions.");
      }
    };

    initVision();

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (timeoutId) clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const predict = async () => {
    if (handLandmarkerRef.current && videoRef.current && videoRef.current.readyState >= 2) {
      const results = handLandmarkerRef.current.detectForVideo(videoRef.current, performance.now());

      if (results.landmarks && results.landmarks.length > 0) {
        const landmarks = results.landmarks[0];
        
        // 1. Detect Open/Closed Hand (Pinch Thumb Tip [4] vs Index Tip [8])
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        const wrist = landmarks[0];

        // Simple Euclidean distance 
        const distance = Math.sqrt(
          Math.pow(thumbTip.x - indexTip.x, 2) + 
          Math.pow(thumbTip.y - indexTip.y, 2)
        );

        // Thresholding: If close, it's "Formed" (0), if far, it's "Chaos" (1)
        // Adjust these thresholds based on typical normalized coordinates
        const isClosed = distance < 0.08; 
        
        // Smoothly interpolate the chaos factor would be handled in the 3D loop, 
        // here we just set target.
        // If hand is closed: Tree Formed (Chaos = 0)
        // If hand is open: Unleash (Chaos = 1)
        setChaosFactor(isClosed ? 0 : 1);

        // 2. Detect Horizontal Position for Camera Rotation
        // Landmarks are 0-1. 0.5 is center.
        // Map 0 -> 1 to -1 -> 1
        const xPos = (wrist.x - 0.5) * 2; 
        // Invert X because webcam is mirrored usually
        setCameraRotationOffset(-xPos);
      } else {
        // No hand detected, default to formed
        setChaosFactor(0);
      }
    }
    requestRef.current = requestAnimationFrame(predict);
  };

  if (error) return null;

  return (
    <div className="fixed bottom-4 right-4 w-32 h-24 rounded-xl overflow-hidden border-2 border-pink-200/30 z-50 bg-black/50 backdrop-blur-md shadow-lg hidden md:block group">
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted 
        className="w-full h-full object-cover opacity-50 group-hover:opacity-100 transition-opacity"
      />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className="text-[10px] text-pink-100 font-mono tracking-widest uppercase opacity-70">
          Sensor Active
        </span>
      </div>
    </div>
  );
};