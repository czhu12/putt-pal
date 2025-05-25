'use client';

import { useEffect, useRef, useState } from "react";
import Camera from "@/lib/detection/camera";
import Realtime from "@/lib/detection/realtime";
import Analyze from "@/lib/detection/analyze";
import Physics from "@/lib/detection/physics";
import loadOpenCv from "@/lib/detection/opencv";
import DebugDialog from "./debug-dialog";
import StatsHeader from "./stats-header";

export interface Results {
  loading: boolean,
  distance: number,
  speed: number,
  smashFactor: number,
}

const physics = new Physics();
export default function Putting() {
  const [isReady, setIsReady] = useState(false);
  const initialized = useRef(false); // This is a next.js development hack

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const realtime = useRef<Realtime | null>(null);
  const analyze = useRef<Analyze | null>(null);
  const camera = useRef<Camera | null>(null);

  const [recording, setRecording] = useState<Blob | undefined>(undefined);
  const [results, setResults] = useState<Results>({
    loading: false,
    distance: 0,
    speed: 0,
    smashFactor: 1.0,
  });

  async function startCamera() {
    realtime.current = new Realtime(physics);
    camera.current = new Camera(videoRef.current!, canvasRef.current!, (src: any, frameNumber: number) => {
      realtime.current!.ingestFrame(src, frameNumber);
    });
    realtime.current.onBallHit = () => {
      console.log("BALL HIT");
      setTimeout(() => {
        const recording: Blob | undefined = camera.current?.returnRecording();
        if (recording) {
          analyzeRecording(recording);
          setRecording(recording);
          stopCamera();
        }
      }, 2000)
    }

    camera.current.start();
  }

  function stopCamera() {
    camera.current?.stop();
  }

  async function loadAnalyzer() {
    analyze.current = new Analyze();
    await analyze.current.load();
  }

  async function initializeModels() {
    await Promise.all([loadAnalyzer(), loadOpenCv()]);
    setIsReady(true);
    startCamera();
  }

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    initializeModels();
  }, []);

  async function analyzeRecording(recording: Blob) {
    setResults({
      loading: true,
      distance: 0,
      speed: 0,
      smashFactor: 1.0,
    });
    physics.setVideoSize(videoRef.current!.width, videoRef.current!.height);
    const predictions = await analyze.current?.predict(recording);
    const result = physics.estimate(predictions!);
    if (result) {
      setResults({
        loading: false,
        distance: result.distance,
        speed: result.speed,
        smashFactor: result.smashFactor,
      });
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <p className="text-gray-600">{isReady ? "ready" : "loading..."}</p>
      <StatsHeader results={results} />
      <div className="space-y-4">
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
      </div>
      <DebugDialog analyzeRecording={analyzeRecording} isReady={isReady} />
    </div>
  );
}