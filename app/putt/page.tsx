'use client';

import { useEffect, useRef, useState } from "react";
import Camera from "@/lib/detection/camera";
import Realtime from "@/lib/detection/realtime";
import Physics from "@/lib/detection/physics";

declare global {
  interface Window {
    cv: any;
  }
}


//const realtime = new Realtime();
//const camera = new Camera();
export default function Putt() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [status, setStatus] = useState('OpenCV.js is loading...');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const realtime = useRef<Realtime | null>(null);
  const camera = useRef<Camera | null>(null);

  async function startCamera() {
    realtime.current = new Realtime();
    camera.current = new Camera(videoRef.current!, canvasRef.current!, (src: any, frameNumber: number) => {
      realtime.current!.ingestFrame(src, frameNumber);
    });
    camera.current.start();
    setIsStreaming(true);
  }

  function stopCamera() {
    //cameraRef.current?.stop();
    setIsStreaming(false);
  }

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://docs.opencv.org/4.7.0/opencv.js';
    script.async = true;
    script.onload = () => {
      if (window.cv) {
        window.cv['onRuntimeInitialized'] = () => {
          setStatus('OpenCV.js is ready!');
        };
      } else {
        setStatus('Failed to load OpenCV.js');
      }
    };
    script.onerror = () => {
      setStatus('Error loading OpenCV.js');
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);


  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <h1 className="text-2xl font-bold mb-4">Putt Pal Camera</h1>
      
      <div className="space-y-4">
        <div className="flex gap-4">
          <button 
            onClick={startCamera}
            disabled={isStreaming}
            className="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded"
          >
            Start Camera
          </button>
          <button 
            onClick={stopCamera}
            disabled={!isStreaming}
            className="bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded"
          >
            Stop Camera
          </button>
        </div>

        <div className="relative top-0 left-0">
          <video 
            className="w-full h-full object-cover bg-black "
            ref={videoRef}
            id="videoInput"
            width="640"
            height="480"
          />
          <canvas 
            className="top-0 left-0"
            ref={canvasRef}
            id="canvasOutput"
            width="640"
            height="480"
          />
        </div>

        <p className="text-gray-600">{status}</p>
      </div>

    </div>
  );
}