import { CLASS_ID_GOLF_BALL, CLASS_ID_PUTTER, FramePrediction } from "./analyze";

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

function isSquare(prediction: FramePrediction): boolean {
  const width = Math.abs(prediction.x1 - prediction.x2);
  const height = Math.abs(prediction.y1 - prediction.y2);
  if (width === 0 || height === 0) {
    return false;
  }
  // Check width and height are similar
  const ratio = width / height;
  return ratio > 0.9 && ratio < 1.1;
}

function estimateRadius(prediction: FramePrediction): number {
  const width = Math.abs(prediction.x1 - prediction.x2);
  const height = Math.abs(prediction.y1 - prediction.y2);
  const radius = (width + height) / 2;
  return radius;
}

export default class Physics {
  private predictions: FramePrediction[];
  private videoWidth: number | null = null;
  private videoHeight: number | null = null;

  constructor(videoWidth: number, videoHeight: number) {
    this.predictions = [];
    this.videoWidth = videoWidth;
    this.videoHeight = videoHeight;
  }

  addPredictions(predictions: FramePrediction[]) {
    const normalizedPredictions = predictions.map(p => {
      return {
        ...p,
        x1: p.x1 * this.videoWidth!,
        y1: p.y1 * this.videoHeight!,
        x2: p.x2 * this.videoWidth!,
        y2: p.y2 * this.videoHeight!,
      }
    })
    this.predictions = normalizedPredictions;
  }

  stationaryGolfballPredictions() {
    return this.predictions.filter(p => p.classId === CLASS_ID_GOLF_BALL).filter((p) => isSquare(p));
  }

  inferMillimetersPerPixel() {
    const radiuses = this.stationaryGolfballPredictions().map(p => estimateRadius(p));
    radiuses.sort((a, b) => a - b);
    // Discard the smallest and largest 10% of circles
    const startIndex = Math.floor(radiuses.length * 0.1);
    const endIndex = Math.floor(radiuses.length * 0.9);
    const trimmedRadiuses = radiuses.slice(startIndex, endIndex);
    const averageRadiusInPixels = trimmedRadiuses.reduce((sum, radius) => sum + radius, 0) / trimmedRadiuses.length;

    return GOLFBALL_RADIUS / averageRadiusInPixels;
  }

  measureDeltasInMillimeters(predictions: FramePrediction[]) {
    const estimatedMillimetersPerPixel = this.inferMillimetersPerPixel();
    return predictions.slice(0, -1).map((p1, i) => {
      const p2 = predictions[i + 1];
      const startX = p1.x1 * estimatedMillimetersPerPixel; // Use the top left corner of the bounding box
      const startY = p1.y1 * estimatedMillimetersPerPixel;
      const endX = p2.x1 * estimatedMillimetersPerPixel;
      const endY = p2.y1 * estimatedMillimetersPerPixel;
      return {
        start: { x: startX, y: startY },
        end: { x: endX, y: endY },
        delta: Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2)
      };
    });
  }

  estimateSpeed(predictions: FramePrediction[], framesPerSecond: number) {
    const deltas = this.measureDeltasInMillimeters(predictions);
    const hitIndex = deltas.findIndex(d => d.delta > 10);
    const hitDeltas = deltas.slice(hitIndex, hitIndex + 10);
    const mmPerFrame = Math.max(...hitDeltas.map(d => d.delta));
    const metersPerSecond = mmPerFrame * framesPerSecond / 1000;
    return metersPerSecond;
  }

  estimate(framesPerSecond: number) {
    const putterPredictions = this.predictions.filter(p => p.classId === CLASS_ID_PUTTER);
    const golfballPredictions = this.predictions.filter(p => p.classId === CLASS_ID_GOLF_BALL);

    const metersPerSecond = this.estimateSpeed(golfballPredictions, framesPerSecond);
    const metersPerSecondPutter = this.estimateSpeed(putterPredictions, framesPerSecond);
    return {
      distance: calculateRollDistance(metersPerSecond, STIMPS.average),
      speed: metersPerSecond,
      smashFactor: metersPerSecond / metersPerSecondPutter,
      metersPerSecondPutter,
    };
  }

  worldSize(): WorldSize {
    const estimatedMillimetersPerPixel = this.inferMillimetersPerPixel();
    const width = estimatedMillimetersPerPixel * this.videoWidth!;
    const height = estimatedMillimetersPerPixel * this.videoHeight!;
    return {
      xInMillimeters: width,
      yInMillimeters: height
    };
  }
}