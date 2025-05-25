'use client';

import { useEffect, useRef, useState } from "react";
import Camera from "@/lib/detection/camera";
import Realtime from "@/lib/detection/realtime";
import Analyze from "@/lib/detection/analyze";
import Physics from "@/lib/detection/physics";

interface Results {
  loading: boolean,
  distance: number,
  speed: number,
  smashFactor: number,
}

const physics = new Physics();
export default function Putting() {
  const [isReady, setIsReady] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const realtime = useRef<Realtime | null>(null);
  const analyze = useRef<Analyze | null>(null);
  const camera = useRef<Camera | null>(null);
  const initialized = useRef(false);

  const [data, setData] = useState<any>({});
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

  function runTimer() {
    setData({
      ...data,
      worldSize: physics.worldSize(),
    });
  }

  async function loadAnalyzer() {
    analyze.current = new Analyze();
    await analyze.current.load();
  }

  async function loadOpenCv() {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://docs.opencv.org/4.7.0/opencv.js';
      script.async = true;
      script.onload = () => {
        if (window.cv) {
          window.cv['onRuntimeInitialized'] = () => {
            resolve(true);
          };
        } else {
          reject(new Error('Failed to load OpenCV.js'));
        }
      };
      script.onerror = () => {
        reject(new Error('Failed to load OpenCV.js'));
      };
      document.body.appendChild(script);
    })
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

    const interval = setInterval(() => {
      runTimer();
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  async function analyzeRecording(recording: Blob) {
    physics.setVideoSize(videoRef.current!.width, videoRef.current!.height);
    const predictions = await analyze.current?.predict(recording);
    const result = physics.estimate(predictions!);
    if (result) {
      setResults({
        ...results,
        loading: false,
      });
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <p className="text-gray-600">{isReady ? "ready" : "loading..."}</p>
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
        disabled={!isReady}>
          Test Analyze
        </button>
      <div>

      </div>
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

        {recording && (
          <div className="flex bg-gray-200 flex-col items-center justify-center mt-4">
            <video width="640" height="480" src={URL.createObjectURL(recording)} autoPlay muted loop></video>
          </div>
        )}
      </div>
    </div>
  );
}