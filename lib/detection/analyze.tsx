import * as ort from 'onnxruntime-web';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

// Analyze the image to determine if the ball is in the frame
const MODEL_PATH: string = "/models/best.onnx";
const CLASS_ID_GOLF_BALL = 0;
const INFERENCE_BATCH_SIZE = 10;
const INPUT_SIZE = 640;
const FRAME_RATE = 30;

export interface Prediction {
  frameNumber: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  conf: number;
  classId: number;
}

export default class Analyze {
  private session: ort.InferenceSession | null = null;
  private ffmpeg: FFmpeg;

  constructor() {
    this.ffmpeg = new FFmpeg();
    this.ffmpeg.on("log", ({ message }) => {
      console.log(message);
    })
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

  async predict(blob: Blob): Promise<Prediction[]> {
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

    const predictions: Prediction[] = [];

    // Process each frame
    console.log("Found", frameFiles.length, "frames");
    for (let f = 0; f < frameFiles.length; f++) {
      const frameFile = frameFiles[f];
      const frameData = await this.ffmpeg.readFile(frameFile.name);
      const blob = new Blob([frameData], { type: 'image/jpeg' });
      const bitmap = await createImageBitmap(blob);
      
      const canvas = document.createElement('canvas');
      canvas.width = INPUT_SIZE;
      canvas.height = INPUT_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;

      ctx.drawImage(bitmap, 0, 0, INPUT_SIZE, INPUT_SIZE);
      const imageData = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);
      const tensorData = this.preprocessImageDataToTensor(imageData);

      const feeds = {
        [this.session!.inputNames[0]]: new ort.Tensor('float32', tensorData, [1, 3, INPUT_SIZE, INPUT_SIZE])
      };

      const output = await this.session!.run(feeds);
      const data = output[Object.keys(output)[0]].data;
      for (let i = 0; i < 300; i++) {
        const base = i * 6;
        const prediction: Prediction = {
          frameNumber: f,
          x1: data[base] as number / INPUT_SIZE,
          y1: data[base + 1] as number / INPUT_SIZE,
          x2: data[base + 2] as number / INPUT_SIZE,
          y2: data[base + 3] as number / INPUT_SIZE,
          conf: data[base + 4] as number,
          classId: data[base + 5] as number
        };
        // Stop when confidence drops below threshold
        if (prediction.conf < 0.01) break;
        if (prediction.classId !== CLASS_ID_GOLF_BALL) continue;
        predictions.push(prediction);
      }
    }
    // Cleanup
    frameFiles.forEach((f) => this.ffmpeg.deleteFile(f.name));
    this.ffmpeg.deleteFile('input.webm');
    this.ffmpeg.deleteFile('trimmed.webm');
    return predictions;
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