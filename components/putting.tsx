'use client';

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Camera from "@/lib/detection/camera";
import Realtime from "@/lib/detection/realtime";
import Analyze from "@/lib/detection/analyze";
import { loadOpenCv } from "@/lib/detection/opencv";
import DebugDialog from "./debug-dialog";
import StatsHeader from "./stats-header";
import { log } from "@/lib/detection/logging";
import ConfigurationOptions, { Configuration } from "./configuration-options";
import { StimpKey } from "@/lib/detection/physics";
import { delay } from "@/app/utils";
import { PhysicsEstimate } from "@/lib/detection/physics";

export enum AppState {
  Initializing,
  Ready,
  Analyzing,
}

export default function Putting() {
  const searchParams = useSearchParams();
  const debug = searchParams.get('debug') === 'true';
  const [appState, setAppState] = useState(AppState.Initializing);

  const initialized = useRef(false); // This is a next.js development hack

  const videoRef = useRef<HTMLVideoElement>(null);
  const realtime = useRef<Realtime | null>(null);
  const analyze = useRef<Analyze | null>(null);
  const camera = useRef<Camera | null>(null);
  const [configuration, _setConfiguration] = useState<Configuration>({
    stimpLevel: 'average' as StimpKey,
    alignment: true,
  });

  function setConfiguration(configuration: Configuration) {
    _setConfiguration(configuration);
    analyze.current!.configuration = configuration;
  }

  const [results, setResults] = useState<PhysicsEstimate | undefined>();

  async function resumeReady() {
    realtime.current?.setState("ready");
    setAppState(AppState.Ready);
  }

  async function startCamera() {
    realtime.current = new Realtime(3);
    camera.current = new Camera(
      videoRef.current!,
        (prevFrame: any, frame: any, frameNumber: number) => {
        realtime.current!.ingestFrame(prevFrame, frame, frameNumber);
      });
    camera.current.setDebug(debug);

    realtime.current.onBallHit = () => {
      log("BALL HIT");
      setAppState(AppState.Analyzing);

      //setTimeout(() => {
      //  const recording: Blob | undefined = camera.current?.returnRecording();
      //  if (recording) {
      //    analyzeRecording(recording);
      //    stopCamera();
      //  }
      //}, 2000)
    }
    realtime.current.setDebug(debug);

    await camera.current.start();
    await delay(250);
    resumeReady();
  }

  function stopCamera() {
    camera.current?.stop();
  }

  async function loadAnalyzer() {
    analyze.current = new Analyze();
    console.log("Loading analyzer");
    await analyze.current.load();
    console.log("Analyzer loaded");
  }

  async function initializeModels() {
    await Promise.all([loadAnalyzer(), loadOpenCv()]);
    console.log("Models loaded");
    startCamera();
  }

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    initializeModels();
    videoRef.current!.playsInline = true;
  }, []);

  async function analyzeRecording(recording: Blob) {
    setAppState(AppState.Analyzing);
    const r = await analyze.current?.predict(recording);

    if (r) {
      setResults(r);
    }

    await delay(1000);
    resumeReady();
  }

  return (
    <div>
      <div className="static bg-transparent">
        {appState === AppState.Ready && (
          <div className="flex flex-col items-center text-green-600 font-bold bg-green-100 p-4">
            <p className="text-gray-600">Ready</p>
          </div>
        )}

        {appState === AppState.Initializing && (
          <div className="flex flex-col items-center bg-gray-100 font-bold p-4">
            <p className="text-gray-600">Loading...</p>
          </div>
        )}

        {appState === AppState.Analyzing && (
          <div className="flex flex-col items-center bg-gray-100 font-bold p-4">
            <p className="text-gray-600">Analyzing...</p>
          </div>
        )}
      </div>
      <div className="flex flex-col items-center">
        <StatsHeader results={results} appState={appState} />
      </div>
      <div className="relative w-full h-[400px] overflow-hidden">
        <video 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 min-w-full min-h-full"
          ref={videoRef}
          id="videoInput"
        />
        <div className="absolute top-1/2 left-0 w-full h-[2px] bg-red-500 opacity-50" />
      </div>
      <div className="py-4 flex flex-col items-center">
        <ConfigurationOptions configuration={configuration} setConfiguration={setConfiguration} />
        {debug && (
          <div className="flex flex-col items-center mt-6">
            <DebugDialog analyzeRecording={analyzeRecording} isReady={appState !== AppState.Initializing} />
          </div>
        )}
      </div>
    </div>
  );
}