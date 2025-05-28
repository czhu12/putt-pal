import { log } from './logging';

const CHUNK_DURATION_MS = 2500;

export default class Camera {
  private streaming: boolean;
  private video: HTMLVideoElement;
  private stream: MediaStream | null = null;
  private cap: any; //cv.VideoCapture;
  private onFrame: (frame: any, frameNumber: number) => void;
  private frameNumber: number;
  public estimatedFps: number;
  private lastFrameTime: number;
  private alpha: number = 0.1; // smoothing factor
  private recordingBuffer: Blob[];
  private mediaRecorder: MediaRecorder | null = null;
  private debug: boolean = false;

  constructor(video: HTMLVideoElement, onFrame: (frame: any, frameNumber: number) => void) {
    this.frameNumber = 0;
    this.streaming = false;
    this.video = video;
    this.onFrame = onFrame;
    this.estimatedFps = 0;
    this.lastFrameTime = 0;
    this.recordingBuffer = [];
  }

  setDebug(debug: boolean) {
    this.debug = debug;
  }

  async stop() {
    if (this.streaming) {
      this.stream?.getTracks().forEach(function (track) {
        track.stop();
      });

      this.video.srcObject = null;
      this.streaming = false;
    }
  }

  async startVideoCapture() {
    this.cap = new window.cv.VideoCapture(this.video);
    this.processFrame();
  }

  async processFrame() {
    if (!this.streaming) {
      return;
    }
    const cv = window.cv;
    let src = new cv.Mat(this.video.height, this.video.width, cv.CV_8UC4);

    this.cap.read(src);

    await this.onFrame(src, this.frameNumber);
    this.frameNumber++;

    this.trackFps();

    requestAnimationFrame(this.processFrame.bind(this)); // loop
  }

  trackFps() {
    const currentFps = 1000 / (Date.now() - this.lastFrameTime);
    this.estimatedFps = this.alpha * currentFps + (1 - this.alpha) * this.estimatedFps;
    this.lastFrameTime = Date.now();
  }

  async start() {
    const thiz = this;
    return new Promise((resolve, reject) => {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false })
        .then(function (stream: MediaStream) {
          thiz.stream = stream;
          log(`Stream count: ${stream.getVideoTracks().length}`);
          const videoTrack = stream.getVideoTracks()[0];
          const settings = videoTrack.getSettings();
          log(`Video track settings: ${JSON.stringify(settings)}`);

          thiz.video.srcObject = thiz.stream;
          log(`Setting video width and height ${settings.width}x${settings.height}`);
          thiz.video.width = settings.width!;
          thiz.video.height = settings.height!;

          thiz.video.play();

          thiz.video.onloadedmetadata = function () {
            thiz.startVideoCapture();
            resolve(void 0);
          };
          thiz.streaming = true;

          // Start circular buffer recording
          thiz.mediaRecorder = new MediaRecorder(stream);
          thiz.mediaRecorder.start(CHUNK_DURATION_MS);
          thiz.mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
              thiz.recordingBuffer.push(e.data);
            }
          };
        }.bind(this))
        .catch(function (err) {
          reject(err);
        });
    });
  }

  returnRecording(): Blob {
    this.mediaRecorder?.stop();
    return new Blob(this.recordingBuffer, { type: 'video/webm' });
  }

  get recording() {
    return new Blob(this.recordingBuffer, { type: 'video/webm' });
  }
  get latestChunk() {
    return this.recordingBuffer[this.recordingBuffer.length - 1];
  }
}