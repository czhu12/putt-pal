'use client';

import { useEffect, useRef, useState } from "react";
import Camera from "@/lib/detection/camera";
import Realtime from "@/lib/detection/realtime";
import Analyze from "@/lib/detection/analyze";

//const realtime = new Realtime();
//const camera = new Camera();
export default function Putting() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [status, setStatus] = useState('OpenCV.js is loading...');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const realtime = useRef<Realtime | null>(null);
  const analyze = useRef<Analyze | null>(null);
  const camera = useRef<Camera | null>(null);
  const initialized = useRef(false);

  const [data, setData] = useState<any>({});
  const [recording, setRecording] = useState<Blob | undefined>(undefined);

  const predictionCanvasRef = useRef<HTMLCanvasElement>(null);

  async function startCamera() {
    realtime.current = new Realtime();
    camera.current = new Camera(videoRef.current!, canvasRef.current!, (src: any, frameNumber: number) => {
      realtime.current!.ingestFrame(src, frameNumber);
    });
    realtime.current.onBallHit = () => {
      console.log("BALL HIT");
      setTimeout(() => {
        const recording: Blob | undefined = camera.current?.returnRecording();
        if (recording) {
          setRecording(recording);
          //analyze.current?.processBlobWithYOLO(recording!);
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
      estimatedMillimetersPerPixel: realtime.current?.estimatedMillimetersPerPixel,
    });
  }

  async function loadAnalyzer() {
    analyze.current = new Analyze();
    await analyze.current.load();
    setStatus('Analyzer loaded!');
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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <h1 className="text-2xl font-bold mb-4">Putt Pal Camera</h1>
      <button
        className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded"
        onClick={async () => {
          const response = await fetch('/examples/putt.webm');
          const blob = await response.blob();
          const {blob: imageBlob, prediction} = await analyze.current?.processBlobWithYOLO(blob);
          const ctx = predictionCanvasRef.current!.getContext('2d');
          if (ctx) {
            const img = new Image();
            img.src = URL.createObjectURL(imageBlob);
            img.onload = () => {
              predictionCanvasRef.current!.width = img.width;
              predictionCanvasRef.current!.height = img.height;
              ctx.drawImage(img, 0, 0, img.width, img.height);
              if (prediction) {
                ctx.strokeStyle = '#00ff00';
                ctx.lineWidth = 2;
                ctx.strokeRect(
                  prediction.x1 * img.width / 640,
                  prediction.y1 * img.height / 640,
                  (prediction.x2 - prediction.x1) * img.width / 640,
                  (prediction.y2 - prediction.y1) * img.height / 640
                );
                ctx.fillStyle = '#00ff00';
                ctx.font = '16px Arial';
                ctx.fillText(`${prediction.classId} (${(prediction.conf * 100).toFixed(1)}%)`, prediction.x1 * img.width / 640, prediction.y1 * img.height / 640 - 5);
              }
              URL.revokeObjectURL(img.src);
            };
            
          }
        }}>
          Test Analyze
        </button>
        <canvas ref={predictionCanvasRef}></canvas>
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
                Estimated Frame Size (cm): {(data.estimatedMillimetersPerPixel * 640 / 10).toFixed(2)} x {(data.estimatedMillimetersPerPixel * 480 / 10).toFixed(2)}
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