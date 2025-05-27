import { CLASS_ID_GOLF_BALL, CLASS_ID_PUTTER, Prediction } from "./analyze";
import { Circle } from "./opencv";

const GOLFBALL_RADIUS = 21.336; // in mm
const MINIMUM_EVIDENCE_COUNT = 10;
const MAXIMUM_EVIDENCE_COUNT = 10;

const STIMPS = {
  slow: 6.0,
  average: 8.0,
  fast: 10.0,
  pga: 13.0
}

export interface WorldSize {
  xInMillimeters: number;
  yInMillimeters: number;
}

function calculateRollDistance(v0: number, stimp: number) {
  const stimpmeterSpeed = 1.829; // m/s (Stimpmeter ball release speed)
  const feetToMeters = 0.3048;
  const stimpInMeters = stimp * feetToMeters;

  // The Stimpmeter rating gives distance in feet at 1.83 m/s
  // We scale by the square of velocity (kinetic energy) under constant friction
  const distanceFeet = (v0 ** 2) / (stimpmeterSpeed ** 2);
  const distanceMeters = distanceFeet * stimpInMeters;

  return distanceMeters;
}

export default class Physics {
  private circles: Circle[];
  public estimatedMillimetersPerPixel: number | null = 0.5; // TODO: Remove this
  private videoWidth: number | null = null;
  private videoHeight: number | null = null;

  constructor() {
    this.circles = [];
  }

  analyzePredictions(circles: Circle[]) {
    this.circles.push(...circles);
    if (this.circles.length > MAXIMUM_EVIDENCE_COUNT) {
      this.circles = this.circles.slice(-MAXIMUM_EVIDENCE_COUNT);
    }
  }

  inferMillimetersPerPixel() {
    if (this.circles.length < MINIMUM_EVIDENCE_COUNT) return;

    // Get the radiuses of the circles
    const radiuses = this.circles.map(c => c.radius);
    radiuses.sort((a, b) => a - b);
    // Discard the smallest and largest 10% of circles
    const startIndex = Math.floor(radiuses.length * 0.1);
    const endIndex = Math.floor(radiuses.length * 0.9);
    const trimmedRadiuses = radiuses.slice(startIndex, endIndex);
    const averageRadiusInPixels = trimmedRadiuses.reduce((sum, radius) => sum + radius, 0) / trimmedRadiuses.length;

    this.estimatedMillimetersPerPixel = GOLFBALL_RADIUS / averageRadiusInPixels;
  }

  setVideoSize(videoWidth: number, videoHeight: number) {
    this.videoWidth = videoWidth;
    this.videoHeight = videoHeight;
  }

  measureDeltas(predictions: Prediction[], worldSize: WorldSize) {
    return predictions.slice(0, -1).map((p1, i) => {
      const p2 = predictions[i + 1];
      const startX = p1.x1 * worldSize.xInMillimeters; // Use the top left corner of the bounding box
      const startY = p1.y1 * worldSize.yInMillimeters;
      const endX = p2.x1 * worldSize.xInMillimeters;
      const endY = p2.y1 * worldSize.yInMillimeters;
      return {
        start: { x: startX, y: startY },
        end: { x: endX, y: endY },
        delta: Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2)
      };
    });
  }

  estimateSpeed(predictions: Prediction[], worldSize: WorldSize, framesPerSecond: number) {
    const deltas = this.measureDeltas(predictions, worldSize);
    const hitIndex = deltas.findIndex(d => d.delta > 10);
    const hitDeltas = deltas.slice(hitIndex, hitIndex + 10);
    const mmPerFrame = Math.max(...hitDeltas.map(d => d.delta));
    const metersPerSecond = mmPerFrame * framesPerSecond / 1000;
    return metersPerSecond;
  }

  estimate(predictions: Prediction[], worldSize: WorldSize) {
    const framesPerSecond = 30;
    const putterPredictions = predictions.filter(p => p.classId === CLASS_ID_PUTTER);
    const golfballPredictions = predictions.filter(p => p.classId === CLASS_ID_GOLF_BALL);

    const metersPerSecond = this.estimateSpeed(golfballPredictions, worldSize, framesPerSecond);
    const metersPerSecondPutter = this.estimateSpeed(putterPredictions, worldSize, framesPerSecond);
    return {
      distance: calculateRollDistance(metersPerSecond, STIMPS.average),
      speed: metersPerSecond,
      smashFactor: metersPerSecond / metersPerSecondPutter,
      metersPerSecondPutter,
    };
  }

  worldSize(): WorldSize {
    this.inferMillimetersPerPixel();
    const width = this.estimatedMillimetersPerPixel! * this.videoWidth!;
    const height = this.estimatedMillimetersPerPixel! * this.videoHeight!;
    return {
      xInMillimeters: width,
      yInMillimeters: height
    };
  }
}