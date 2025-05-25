'use client';

import { useEffect, useRef, useState } from "react";
import Camera from "@/lib/detection/camera";
import Realtime from "@/lib/detection/realtime";
import Analyze from "@/lib/detection/analyze";
import Physics from "@/lib/detection/physics";

const physics = new Physics();
//const realtime = new Realtime();
//const camera = new Camera();
export default function Putting() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [status, setStatus] = useState('OpenCV.js is loading...');
  const [analyzerLoaded, setAnalyzerLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const realtime = useRef<Realtime | null>(null);
  const analyze = useRef<Analyze | null>(null);
  const camera = useRef<Camera | null>(null);
  const initialized = useRef(false);

  const [data, setData] = useState<any>({});
  const [recording, setRecording] = useState<Blob | undefined>(undefined);
  const [results, setResults] = useState<{
    loading: boolean,
    distance: number,
    speed: number,
    smashFactor: number,
  }>({
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
    setIsStreaming(true);
  }

  function stopCamera() {
    camera.current?.stop();
    setIsStreaming(false);
  }

  function runTimer() {
    setData({
      ...data,
      worldSize: physics.worldSize(),
    });
  }

  async function loadAnalyzer() {
    analyze.current = new Analyze();
    await analyze.current.load();
    setAnalyzerLoaded(true);
  }

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    loadAnalyzer();

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

    const interval = setInterval(() => {
      runTimer();
    }, 1000);

    return () => {
      clearInterval(interval);
      document.body.removeChild(script);
    };
  }, []);

  async function analyzeRecording(recording: Blob) {
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
      <div className="grid grid-cols-3 gap-4 max-w-[640px] w-full text-center p-4">
        <div className="border-r-1 border-gray-300">
          <p>
            <span className="text-4xl font-bold">
              {results.loading ? "..." : results.distance.toFixed(2)}
            </span>
            <span className="text-sm ml-2">meters</span>
          </p>
          <div>Distance</div>
        </div>
        <div className="border-r-1 border-gray-300">
          <p>
            <span className="text-4xl font-bold">
              {results.loading ? "..." : results.speed.toFixed(2)}
            </span>
            <span className="text-sm ml-2">m/s</span>
          </p>
          <div>Speed</div>
        </div>
        <div>
          <p>
            <span className="text-4xl font-bold">
              {results.loading ? "..." : results.smashFactor.toFixed(2)}
            </span>
          </p>
          <div>Smash Factor</div>
        </div>
      </div>

      <button
        className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded"
        onClick={async () => {
          setResults({
            loading: true,
            distance: 0,
            speed: 0,
            smashFactor: 1.0,
          });
          const response = await fetch('/examples/putt.webm');
          const blob = await response.blob();
          analyzeRecording(blob);
        }}
        disabled={!analyzerLoaded}>
          Test Analyze
        </button>
      <div>

      </div>
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
        <div className="p-4 bg-gray-200 border-gray-300 border-2 rounded-md">
          <h4 className="text-lg font-bold">Stats</h4>
          {data.estimatedMillimetersPerPixel && (
            <code>
              <p>
                Estimated Millimeters Per Pixel: {data.estimatedMillimetersPerPixel.toFixed(4)}
              </p>
              <p>
                Estimated Frame Size (cm): {(data.worldSize.xInMillimeters / 10).toFixed(2)} x {(data.worldSize.yInMillimeters / 10).toFixed(2)}
              </p>
            </code>
          )}
        </div>
        <p>Analyzing: {!!recording ? "true" : "false"}</p>

        <p className="text-gray-600">{status}</p>
        {recording && (
          <div className="flex bg-gray-200 flex-col items-center justify-center mt-4">
            <video width="640" height="480" src={URL.createObjectURL(recording)} autoPlay muted loop></video>
          </div>
        )}
      </div>
    </div>
  );
}