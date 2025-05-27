'use client';

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Camera from "@/lib/detection/camera";
import Realtime from "@/lib/detection/realtime";
import Analyze from "@/lib/detection/analyze";
import Physics from "@/lib/detection/physics";
import { loadOpenCv } from "@/lib/detection/opencv";
import DebugDialog from "./debug-dialog";
import StatsHeader from "./stats-header";
import { log } from "@/lib/detection/logging";

export interface Results {
  loading: boolean,
  distance: number,
  speed: number,
  smashFactor: number,
}

const physics = new Physics();
export default function Putting() {
  const searchParams = useSearchParams();
  const debug = searchParams.get('debug') === 'true';
  const [isReady, setIsReady] = useState(false);

  const initialized = useRef(false); // This is a next.js development hack

  const videoRef = useRef<HTMLVideoElement>(null);
  const realtime = useRef<Realtime | null>(null);
  const analyze = useRef<Analyze | null>(null);
  const camera = useRef<Camera | null>(null);

  const [results, setResults] = useState<Results>({
    loading: false,
    distance: 0,
    speed: 0,
    smashFactor: 1.0,
  });

  async function startCamera() {
    realtime.current = new Realtime(physics);
    camera.current = new Camera(
      videoRef.current!,
        (src: any, frameNumber: number) => {
        realtime.current!.ingestFrame(src, frameNumber);
      });
    camera.current.setDebug(debug);

    realtime.current.onBallHit = () => {
      log("BALL HIT");
      //setTimeout(() => {
      //  const recording: Blob | undefined = camera.current?.returnRecording();
      //  if (recording) {
      //    analyzeRecording(recording);
      //    stopCamera();
      //  }
      //}, 2000)
    }
    realtime.current.setDebug(debug);

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
    videoRef.current!.playsInline = true;
  }, []);

  async function analyzeRecording(recording: Blob) {
    setResults({
      loading: true,
      distance: 0,
      speed: 0,
      smashFactor: 1.0,
    });
    physics.setVideoSize(videoRef.current!.width, videoRef.current!.height);
    const output = await analyze.current?.predict(recording);

    debugger
    const result = physics.estimate(output!.predictions, output!.worldSize);
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
    <div>
      <div className="static bg-transparent">
        <p className="text-gray-600">{isReady ? "ready" : "loading..."}</p>
        <StatsHeader results={results} />
      </div>
      <div className="relative w-full h-[300px] overflow-hidden">
        <video 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 min-w-full min-h-full"
          ref={videoRef}
          id="videoInput"
        />
      </div>
      {debug && (
        <div>
          <DebugDialog analyzeRecording={analyzeRecording} isReady={isReady} />
          <canvas
            className="top-0 left-0"
            id="canvasOutput"
          />
        </div>
      )}
    </div>
  );
}