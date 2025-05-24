import * as ort from 'onnxruntime-web';

// Analyze the image to determine if the ball is in the frame
const MODEL_PATH: string = "/saved_models/best.onnx";
const CLASS_ID_GOLF_BALL = 0;
const INPUT_SIZE = 640;
function preprocess(imageData: ImageData) {
  const { data } = imageData;
  const floatData = new Float32Array(INPUT_SIZE * INPUT_SIZE * 3);

  for (let i = 0; i < INPUT_SIZE * INPUT_SIZE; i++) {
    floatData[i] = data[i * 4 + 0] / 255;                 // R
    floatData[i + INPUT_SIZE * INPUT_SIZE] = data[i * 4 + 1] / 255; // G
    floatData[i + 2 * INPUT_SIZE * INPUT_SIZE] = data[i * 4 + 2] / 255; // B
  }

  return new ort.Tensor("float32", floatData, [1, 3, INPUT_SIZE, INPUT_SIZE]);
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

  async analyze(image: ImageData) {
  }
}