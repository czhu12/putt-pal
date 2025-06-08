import * as ort from 'onnxruntime-web';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { log } from './logging';
import Physics, { STIMPS, PhysicsEstimate } from './physics';
import { Configuration } from '@/components/configuration-options';

// Analyze the image to determine if the ball is in the frame
const CONFIDENCE_THRESHOLD = 0.10;
const MODEL_PATH: string = "/models/best.onnx";
export const CLASS_ID_GOLF_BALL = 0;
export const CLASS_ID_PUTTER = 1;
const INFERENCE_BATCH_SIZE = 10;
const INPUT_SIZE = 640;
const FRAME_RATE = 30;

export interface FramePrediction {
  frameNumber: number;
  time: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  conf: number;
  classId: number;
}

function uniqueFrames(predictions: FramePrediction[]) {
  const frameCounts = new Map<number, number>();
  let unique = true;
  predictions.forEach(p => {
    if (frameCounts.has(p.frameNumber)) {
      frameCounts.set(p.frameNumber, frameCounts.get(p.frameNumber)! + 1);
      unique = false;
    } else {
      frameCounts.set(p.frameNumber, 1);
    }
  })
  return {
    unique,
    frameCounts,
  }
}

function consistency(predictions: FramePrediction[]) {
  const putterPositions = predictions.filter(p => p.classId === CLASS_ID_PUTTER)
  const golfBallPredictions = predictions.filter(p => p.classId === CLASS_ID_GOLF_BALL)
  const golfBall = uniqueFrames(golfBallPredictions)
  const putter = uniqueFrames(putterPositions)
  return {
    golfBall,
    putter,
  }
}


export default class Analyze {
  private session: ort.InferenceSession | null = null;
  private ffmpeg: FFmpeg;
  public configuration: Configuration;

  constructor() {
    this.ffmpeg = new FFmpeg();
    this.ffmpeg.on("log", ({ message }) => {
      log(message);
    })
    this.configuration = {
      stimpLevel: 'average',
      alignment: true,
    }
  }

  async load() {
    await this.ffmpeg.load({
      coreURL: await toBlobURL(`https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm`, 'application/wasm'),
    });
    this.session = await (ort.InferenceSession.create as any)(MODEL_PATH, {
      executionProviders: ['wasm'],
      wasm: { simd: true, threads: true }
    });
  }

  async predict(blob: Blob): Promise<PhysicsEstimate> {
    let startTime = Date.now();
    // Write blob to ffmpeg virtual filesystem
    await this.ffmpeg.writeFile('input.webm', await fetchFile(blob));

    // Extract last 3 seconds
    await this.ffmpeg.exec([
      '-i', 'input.webm',
      '-ss', '-3',
      '-c', 'copy',
      'trimmed.webm'
    ]);

    // Extract frames
    await this.ffmpeg.exec([
      '-i', 'trimmed.webm',
      '-vf', `fps=${FRAME_RATE}`,
      '-frame_pts', '1',
      'frame_%d.jpg'
    ]);

    // Get list of extracted frames
    const files = await this.ffmpeg.listDir('/');
    const frameFiles = files.filter((f) => f.name.startsWith('frame_') && f.name.endsWith('.jpg'));

    const predictions: FramePrediction[] = [];

    let videoWidth: number | null = null;
    let videoHeight: number | null = null;
    // Process each frame
    log(`Extracted ${frameFiles.length} frames in ${Date.now() - startTime}ms`);
    startTime = Date.now();
    for (let f = 0; f < frameFiles.length; f++) {
      const frameFile = frameFiles[f];
      const frameData = await this.ffmpeg.readFile(frameFile.name);
      const blob = new Blob([frameData], { type: 'image/jpeg' });
      const bitmap = await createImageBitmap(blob);
      if (!videoWidth) videoWidth = bitmap.width;
      if (!videoHeight) videoHeight = bitmap.height;
      const scale = INPUT_SIZE / Math.max(bitmap.width, bitmap.height);
      const newW = Math.round(bitmap.width * scale);
      const newH = Math.round(bitmap.height * scale);
      const padW = Math.floor((INPUT_SIZE - newW) / 2);
      const padH = Math.floor((INPUT_SIZE - newH) / 2);

      const canvas = document.createElement('canvas');
      canvas.width = INPUT_SIZE;
      canvas.height = INPUT_SIZE;
      const ctx = canvas.getContext('2d');

      if (!ctx) throw new Error('Failed to get canvas context');

      // Fill background with gray (letterbox padding)
      ctx.fillStyle = 'rgb(114, 114, 114)';
      ctx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);

      // Draw resized image with padding
      ctx.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height, padW, padH, newW, newH);

      // Now you can read imageData
      const imageData = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);

      const tensorData = this.preprocessImageDataToTensor(imageData);

      const feeds = {
        [this.session!.inputNames[0]]: new ort.Tensor('float32', tensorData, [1, 3, INPUT_SIZE, INPUT_SIZE])
      };

      const output = await this.session!.run(feeds);
      const data = output[Object.keys(output)[0]].data;
      // We know its good up to here
      for (let i = 0; i < 300; i++) {
        const base = i * 6;

        const rawX1 = data[base] as number;
        const rawY1 = data[base + 1] as number;
        const rawX2 = data[base + 2] as number;
        const rawY2 = data[base + 3] as number;
        const conf = data[base + 4] as number;
        const classId = data[base + 5] as number;

        if (conf < CONFIDENCE_THRESHOLD) break;

        // Undo letterbox padding and scaling
        const x1_no_pad = (rawX1 - padW) / scale;
        const y1_no_pad = (rawY1 - padH) / scale;
        const x2_no_pad = (rawX2 - padW) / scale;
        const y2_no_pad = (rawY2 - padH) / scale;

        // Clamp to original image size
        const x1_pixel = Math.max(0, Math.min(videoWidth - 1, x1_no_pad));
        const y1_pixel = Math.max(0, Math.min(videoHeight - 1, y1_no_pad));
        const x2_pixel = Math.max(0, Math.min(videoWidth - 1, x2_no_pad));
        const y2_pixel = Math.max(0, Math.min(videoHeight - 1, y2_no_pad));

        const prediction: FramePrediction = {
          frameNumber: f,
          time: f / FRAME_RATE,
          x1: x1_pixel,
          y1: y1_pixel,
          x2: x2_pixel,
          y2: y2_pixel,
          conf: conf,
          classId: classId
        };

        predictions.push(prediction);
      }

      if (f % 10 === 0) {
        log(`Processed ${f} / ${frameFiles.length} frames`);
      }
    }
    const physics = new Physics(videoWidth!, videoHeight!);
    // Cleanup
    frameFiles.forEach((f) => this.ffmpeg.deleteFile(f.name));
    this.ffmpeg.deleteFile('input.webm');
    this.ffmpeg.deleteFile('trimmed.webm');
    log(`Processed ${frameFiles.length} frames in ${Date.now() - startTime}ms`);
    physics.addPredictions(predictions);
    log(`Estimating with ${STIMPS[this.configuration.stimpLevel]} stimp level`);
    //const predictionsConsistent = consistency(predictions);

    return physics.estimate(FRAME_RATE, STIMPS[this.configuration.stimpLevel]);
  }

  private preprocessImageDataToTensor(imageData: ImageData): Float32Array {
    const { data, width, height } = imageData;
    const float32 = new Float32Array(3 * width * height);

    for (let i = 0; i < width * height; i++) {
      const base = i * 4;
      float32[i] = data[base] / 255.0;                      // R
      float32[i + width * height] = data[base + 1] / 255.0; // G
      float32[i + 2 * width * height] = data[base + 2] / 255.0; // B
    }

    return float32;
  }
}