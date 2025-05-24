import * as ort from 'onnxruntime-web';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

// Analyze the image to determine if the ball is in the frame
const MODEL_PATH: string = "/models/best.onnx";
const CLASS_ID_GOLF_BALL = 0;
const INPUT_SIZE = 640;
const FRAME_RATE = 30;

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

  async processBlobWithYOLO(blob: Blob) {
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

    // Process each frame
    for (const frameFile of frameFiles) {
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
      // TODO: Handle output results
      console.log(output);
    }

    // Cleanup
    //frameFiles.forEach((f) => this.ffmpeg.unlink(f.name));
    //this.ffmpeg.unlink('input.webm');
    //this.ffmpeg.unlink('trimmed.webm');
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