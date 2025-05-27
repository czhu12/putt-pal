const MOVEMENT_SMOOTHING_SIZE = 10;
const WARMUP_PERIOD = 100;

export default class Realtime {
  private _onBallHit: () => void = () => {};
  private debug: boolean = false;
  private previousFrame: any = null;
  private movementThreshold: number;
  private movements: number[] = [];
  private frameCounter: number = 0;
  private state: "ready" | "analyzing" = "ready";

  constructor(movementThreshold: number) {
    this.movementThreshold = movementThreshold;
    this.movements = []
    this.frameCounter = 0;
  }

  addMovement(movement: number) {
    this.movements.push(movement);
    if (this.movements.length > MOVEMENT_SMOOTHING_SIZE) {
      this.movements.shift();
    }
  }

  setDebug(debug: boolean) {
    this.debug = debug;
  }

  ingestFrame(src: any, frameNumber: number) {
    if (this.state === "analyzing") {
      // No point since we are already detecting and waiting for a ball to be hit
      return;
    }
    this.frameCounter = frameNumber;
    const cv = window.cv;
    cv.cvtColor(src, src, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(src, src, new cv.Size(5, 5), 0);
    
    if (this.previousFrame) {
      const diff = new cv.Mat();

      cv.absdiff(src, this.previousFrame, diff);
      let meanScalar = cv.mean(diff);
      this.addMovement(meanScalar[0]);
      cv.threshold(diff, diff, 25, 255, cv.THRESH_BINARY);

      diff.delete();
      this.previousFrame.delete();
    }
    this.previousFrame = src;
    this.checkForMovement();
   
    //if (this.debug) {
    //  // Draw circles on the image
    //  for (const circle of parsedCircles) {
    //    cv.circle(src, new cv.Point(circle.x, circle.y), circle.radius, new cv.Scalar(0, 255, 0, 255), 2);
    //  }
    //  
    //  cv.imshow('canvasOutput', src);
    //}
  }

  checkForMovement() {
    if (this.frameCounter < WARMUP_PERIOD) {
      return;
    }
    const averageMovement = this.movements.reduce((sum, value) => sum + value, 0) / this.movements.length;
    if (averageMovement > this.movementThreshold) {
      this.state = "analyzing";
      this._onBallHit();
    }
  }

  setState(state: "ready" | "analyzing") {
    this.state = state;
  }

  set onBallHit(f: () => void) {
    this._onBallHit = f;
  }
}