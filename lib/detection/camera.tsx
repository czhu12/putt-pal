export default class Camera {
  private streaming: boolean;
  private video: HTMLVideoElement;
  private stream: MediaStream | null = null;
  private canvas: HTMLCanvasElement;
  private cap: any; //cv.VideoCapture;
  private onFrame: (frame: any, frameNumber: number) => void;
  private frameNumber: number;
  public estimatedFps: number;
  private lastFrameTime: number;
  private alpha: number = 0.1; // smoothing factor

  constructor(video: HTMLVideoElement, canvas: HTMLCanvasElement, onFrame: (frame: any, frameNumber: number) => void) {
    this.frameNumber = 0;
    this.streaming = false;
    this.video = video;
    this.canvas = canvas;
    this.onFrame = onFrame;
    this.estimatedFps = 0;
    this.lastFrameTime = 0;
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
    let src = new cv.Mat(this.video.videoHeight, this.video.videoWidth, cv.CV_8UC4);

    this.cap.read(src);

    this.onFrame(src, this.frameNumber);
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
      navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        .then(function (s: MediaStream) {
          thiz.stream = s;
          thiz.video.srcObject = thiz.stream;
          thiz.video.play();

          thiz.video.onloadedmetadata = function () {
            thiz.canvas.width = thiz.video.videoWidth;
            thiz.canvas.height = thiz.video.videoHeight;
            thiz.startVideoCapture();
            resolve(void 0);
          };
          thiz.streaming = true;
        }.bind(this))
        .catch(function (err) {
          reject(err);
        });
    });
  }
}