import * as ort from 'onnxruntime-web';

// Analyze the image to determine if the ball is in the frame
const MODEL_PATH: string = "/saved_models/best.onnx";
const CLASS_ID_GOLF_BALL = 0;
const INPUT_SIZE = 640;

function preprocessImageDataToTensor(imageData: ImageData): Float32Array {
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

class Analyze {
  private session: ort.InferenceSession | null = null;

  async load() {
    // Load the onnx model
    const session = await (ort.InferenceSession.create as any)(MODEL_PATH, {
      executionProviders: ['wasm'],
      wasm: {
        simd: true,
        threads: true
      }
    });
  }

  async processBlobWithYOLO(
    blob: Blob,
    session: ort.InferenceSession,
    inputSize: number = 640
  ): Promise<ort.InferenceSession.OnnxValueMapType> {
    const imgBitmap: ImageBitmap = await createImageBitmap(blob);
  
    const canvas = document.createElement('canvas');
    canvas.width = inputSize;
    canvas.height = inputSize;
  
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');
  
    ctx.drawImage(imgBitmap, 0, 0, inputSize, inputSize);
    const imageData: ImageData = ctx.getImageData(0, 0, inputSize, inputSize);
  
    const tensorData: Float32Array = preprocessImageDataToTensor(imageData);
  
    const feeds: Record<string, ort.Tensor> = {
      [session.inputNames[0]]: new ort.Tensor('float32', tensorData, [1, 3, inputSize, inputSize])
    };
  
    const output = await session.run(feeds);
    return output;
  }
  }