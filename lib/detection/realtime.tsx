import Physics, { Circle } from "./physics";

const NUM_FRAMES_WITHOUT_BALL = 60;
const NUM_FRAMES_WITH_BALL = 3;

interface Ball extends Circle {
  frameNumber: number;
}

function parseCircles(circles: any): Circle[] {
  const parsedCircles = [];
  for (let i = 0; i < circles.cols; ++i) {
    let x = circles.data32F[i * 3];
    let y = circles.data32F[i * 3 + 1];
    let radius = circles.data32F[i * 3 + 2];
    parsedCircles.push({ x, y, radius });
  }

  return parsedCircles;
}

export default class Realtime {
  private state: "ready" | "ball_found" | "ball_lost" = "ready";
  private ballPositions: Ball[] = [];
  private _onBallHit: () => void = () => {};
  private physics: Physics;
  private debug: boolean = false;

  constructor(physics: Physics) {
    this.physics = physics;
  }

  setDebug(debug: boolean) {
    this.debug = debug;
  }

  ingestFrame(src: any, frameNumber: number) {
    const cv = window.cv;
    let dst = new cv.Mat(src.rows, src.cols, cv.CV_8UC4);
    let circles = new cv.Mat();
    cv.cvtColor(src, src, cv.COLOR_RGBA2GRAY);
    //cv.Canny(src, dst, 40, 200, 3, false);
    cv.HoughCircles(
      src,
      circles,
      cv.HOUGH_GRADIENT,
      0.5,
      250,
      300,
      40,
      0,
      0
    );
    const parsedCircles = parseCircles(circles);
    
    if (this.debug) {
      // Draw circles on the image
      for (const circle of parsedCircles) {
        cv.circle(src, new cv.Point(circle.x, circle.y), circle.radius, new cv.Scalar(0, 255, 0, 255), 2);
      }
      
      cv.imshow('canvasOutput', src);
    }
    src.delete();
    dst.delete();
    circles.delete();

    if (parsedCircles.length === 1) {
      this.physics.addCircles(parsedCircles);
      this.ballPositions.push({
        ...parsedCircles[0],
        frameNumber // TODO: Maybe this is better use Date.now()?
      });
      this.stateTransition("ball_found");
    } else if (parsedCircles.length === 0) {
      const mostRecentBall = this.ballPositions[this.ballPositions.length - 1];
      if (mostRecentBall && (mostRecentBall.frameNumber + NUM_FRAMES_WITHOUT_BALL < frameNumber)) {
        this.stateTransition("ball_lost");
      }
    }
  }

  set onBallHit(f: () => void) {
    this._onBallHit = f;
  }

  private stateTransition(newState: "ready" | "ball_found" | "ball_lost") {
    if (newState === "ball_lost" && this.state === "ball_found") {
      this._onBallHit();
    }
    this.state = newState;
  }
}