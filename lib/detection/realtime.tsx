import Physics from "./physics";
import { Circle, houghCircles } from "./opencv";

const NUM_FRAMES_WITHOUT_BALL = 60;
const NUM_FRAMES_WITH_BALL = 3;

interface Ball extends Circle {
  frameNumber: number;
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
    //const cv = window.cv;
    //const parsedCircles = houghCircles(src);
    
    //if (parsedCircles.length === 1) {
    //  this.physics.addCircles(parsedCircles);
    //  this.ballPositions.push({
    //    ...parsedCircles[0],
    //    frameNumber // TODO: Maybe this is better use Date.now()?
    //  });
    //  this.stateTransition("ball_found");
    //} else if (parsedCircles.length === 0) {
    //  const mostRecentBall = this.ballPositions[this.ballPositions.length - 1];
    //  if (mostRecentBall && (mostRecentBall.frameNumber + NUM_FRAMES_WITHOUT_BALL < frameNumber)) {
    //    this.stateTransition("ball_lost");
    //  }
    //}

    //if (this.debug) {
    //  // Draw circles on the image
    //  for (const circle of parsedCircles) {
    //    cv.circle(src, new cv.Point(circle.x, circle.y), circle.radius, new cv.Scalar(0, 255, 0, 255), 2);
    //  }
    //  
    //  cv.imshow('canvasOutput', src);
    //}
    src.delete();
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