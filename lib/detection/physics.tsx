import { log } from './logging';
import { CLASS_ID_GOLF_BALL, CLASS_ID_PUTTER, FramePrediction } from "./analyze";
import { center, radiansToDegrees, average, isSquare, estimateDiameter, magnitude, subtract, add, distance, within } from './math';
import { groupBy } from 'lodash';

const GOLFBALL_RADIUS = 42.672; // in mm
const NUM_STABLE_FRAMES_TO_CONSIDER_STROKE_START = 3;
const MIN_DISTANCE_TO_BALL_TO_BE_CONSIDERED_STROKE_START = 100;
const MIN_DISTANCE_FOR_PUTTER_TO_BE_CONSIDERED_STATIONARY = 5;

export const STIMPS = {
  slow: 6.0,
  average: 8.0,
  fast: 10.0,
  pga: 13.0
}


export interface PhysicsEstimate {
  distance: number;
  speed: number;
  metersPerSecondPutter: number;
  smashFactor: number;
  worldSize: WorldSize;
  estimatedImpactFrameNumber: number;
  straightness: PuttStraightness;
  stroke: Stroke;
}

export type StimpKey = keyof typeof STIMPS;

export interface WorldSize {
  xInMillimeters: number;
  yInMillimeters: number;
}

interface WorldSpaceDelta {
  start: {
    x: number;
    y: number;
  };
  end: {
    x: number;
    y: number;
  };
  delta: {
    x: number;
    y: number;
    distance: number;
  };
  frameNumber: number;
}

export interface Stroke {
  inferred: boolean;
  tempo: number; // Ratio of downswing to backswing 3:1 is optimal
  distance: number; // How far the putter travels in the backswing
}

export interface PuttStraightness {
  degrees: number;
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

function stationaryGolfballPredictions(pixelSpacePredictions: FramePrediction[]) {
  return pixelSpacePredictions.filter(p => p.classId === CLASS_ID_GOLF_BALL).filter((p) => isSquare(p));
}

function inferMillimetersPerPixel(pixelSpacePredictions: FramePrediction[]) {
  const radiuses = stationaryGolfballPredictions(pixelSpacePredictions).map(p => estimateDiameter(p));
  radiuses.sort((a, b) => a - b);
  // Discard the smallest and largest 10% of circles
  const startIndex = Math.floor(radiuses.length * 0.1);
  const endIndex = Math.floor(radiuses.length * 0.9);
  const trimmedRadiuses = radiuses.slice(startIndex, endIndex);
  const averageRadiusInPixels = trimmedRadiuses.reduce((sum, radius) => sum + radius, 0) / trimmedRadiuses.length;

  return GOLFBALL_RADIUS / averageRadiusInPixels;
}

function calculateWorldSize(videoWidth: number, videoHeight: number, pixelSpacePredictions: FramePrediction[]): WorldSize {
  const estimatedMillimetersPerPixel = inferMillimetersPerPixel(pixelSpacePredictions);
  const width = estimatedMillimetersPerPixel * videoWidth;
  const height = estimatedMillimetersPerPixel * videoHeight;
  return {
    xInMillimeters: width,
    yInMillimeters: height
  };
}

export default class Physics {
  private _pixelSpacePredictions: FramePrediction[];
  private worldSpacePredictions: FramePrediction[];
  private videoWidth: number | null = null;
  private videoHeight: number | null = null;
  private worldSize: WorldSize | null;

  constructor(
    videoWidth: number,
    videoHeight: number,
  ) {
    this._pixelSpacePredictions = [];
    this.videoWidth = videoWidth;
    this.videoHeight = videoHeight;
    this.worldSpacePredictions = [];
    this.worldSize = null;
  }

  addPredictions(predictions: FramePrediction[]) {
    this._pixelSpacePredictions = predictions;

    const estimatedMillimetersPerPixel = inferMillimetersPerPixel(this._pixelSpacePredictions);
    this.worldSpacePredictions = this._pixelSpacePredictions.map(p => ({
      ...p,
      x1: p.x1 * estimatedMillimetersPerPixel,
      y1: p.y1 * estimatedMillimetersPerPixel,
      x2: p.x2 * estimatedMillimetersPerPixel,
      y2: p.y2 * estimatedMillimetersPerPixel,
    }));
    this.worldSize = calculateWorldSize(this.videoWidth!, this.videoHeight!, this._pixelSpacePredictions);
  }

  measureDeltasInWorldSpace(predictions: FramePrediction[]): WorldSpaceDelta[] {
    return predictions.slice(0, -1).map((p1, i) => {
      const p2 = predictions[i + 1];
      const startX = p1.x1; // Use the top left corner of the bounding box
      const startY = p1.y1;
      const endX = p2.x1;
      const endY = p2.y1;
      const distance = Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2)
      const speed = distance / (p2.time - p1.time);
      return {
        start: { x: startX, y: startY, time: p1.time },
        end: { x: endX, y: endY, time: p2.time },
        frameNumber: p2.frameNumber,
        delta: {
          x: endX - startX,
          y: endY - startY,
          distance: distance,
          speed: speed,
        }
      };
    });
  }

  estimateSpeed(predictions: FramePrediction[], framesPerSecond: number) {
    const deltas = this.measureDeltasInWorldSpace(predictions);
    const hitIndex = deltas.findIndex(d => d.delta.distance > 10);
    // If hit index is -1 then the video doesn't work
    const hitDeltas = deltas.slice(hitIndex, hitIndex + 10);
    let mmPerFrame = 0;
    let peakFrameNumber = 0;

    for (let i = 0; i < hitDeltas.length; i++) {
      if (hitDeltas[i].delta.distance > mmPerFrame) {
        mmPerFrame = hitDeltas[i].delta.distance;
        peakFrameNumber = hitDeltas[i].frameNumber;
      }
    }

    // TODO: This needs to take into account the frame number
    const metersPerSecond = mmPerFrame * framesPerSecond / 1000;
    return { metersPerSecond, peakFrameNumber, deltas };
  }

  estimate(framesPerSecond: number, stimpLevel: number): PhysicsEstimate {
    const golfballPredictions = this.worldSpacePredictions.filter(p => p.classId === CLASS_ID_GOLF_BALL);
    const { metersPerSecond, peakFrameNumber: estimatedImpactFrameNumber, deltas: golfballDeltas } = this.estimateSpeed(golfballPredictions, framesPerSecond);

    // Only measure putter motion BEFORE the ball
    const putterPredictions = this.worldSpacePredictions.filter(p => p.classId === CLASS_ID_PUTTER).filter(p => p.frameNumber < estimatedImpactFrameNumber);
    const { metersPerSecond: metersPerSecondPutter } = this.estimateSpeed(putterPredictions, framesPerSecond);
    const degrees = this.straightness(golfballDeltas);
    const stroke = this.analyzeStroke(estimatedImpactFrameNumber);
    return {
      distance: calculateRollDistance(metersPerSecond, stimpLevel),
      speed: metersPerSecond,
      smashFactor: metersPerSecond / metersPerSecondPutter,
      worldSize: this.worldSize!,
      metersPerSecondPutter,
      estimatedImpactFrameNumber,
      stroke,
      straightness: { degrees: degrees },
    };
  }

  analyzeStroke(estimatedImpactFrameNumber: number): Stroke {
    /*
    Overall Strategy:
    - Find the impact frame
    - From the impact frame, search backwards for the first frame where the putter is stationary
    - Check if the putter is contiguous (otherwise, the putter went out of frame)
    - Once we have the putter positions on the back swing, we can calculate:
      - The backswing distance
      - The backswing tempo ratio (downswing frames / backswing frames)
    */
    const putterPositions = this.worldSpacePredictions.filter(p => p.classId === CLASS_ID_PUTTER);
    const { inferred, startStrokeFrameNumber, peakBackswingFrameNumber } = this.analyzeStrokeFrames(estimatedImpactFrameNumber);
    let tempo = 0;
    let backSwingDistance = 0;
    if (inferred) {
      const downFrames = estimatedImpactFrameNumber - peakBackswingFrameNumber!;
      const backFrames = peakBackswingFrameNumber! - startStrokeFrameNumber!;
      tempo = backFrames / downFrames;

      const backSwingPosition = putterPositions.find(p => p.frameNumber === peakBackswingFrameNumber);
      const startStrokePosition = putterPositions.find(p => p.frameNumber === startStrokeFrameNumber);
      if (backSwingPosition && startStrokePosition) {
        backSwingDistance = distance(center(backSwingPosition), center(startStrokePosition));
      }
    }
    
    return {
      inferred,
      tempo,
      distance: backSwingDistance,
    }
  }

  findPeakBackswing(preImpactPutterPositions: FramePrediction[]) {
    const putterDeltas = this.measureDeltasInWorldSpace(preImpactPutterPositions);
    const last = putterDeltas[putterDeltas.length - 1]
    let previousDelta = [last.delta.x, last.delta.y] as [number, number];
    for (let i = putterDeltas.length - 1; i >= 0; i--) {
      const d = putterDeltas[i];
      const delta = [d.delta.x, d.delta.y] as [number, number];
      if (magnitude(subtract(delta, previousDelta)) > magnitude(add(delta, previousDelta))) {
        return d.frameNumber
      }
    }
    return undefined;
  }

  ensureContiguousTracking(
    putterFrames: FramePrediction[],
    estimatedImpactFrameNumber: number
  ): boolean {
    let contiguousFrameNumber = estimatedImpactFrameNumber;
    for (let i = putterFrames.length - 1; i >= 0; i--) {
      const d = putterFrames[i];
      if (contiguousFrameNumber !== d.frameNumber) {
        return false
      }
      contiguousFrameNumber--;
    }

    return true;
  }

  findStartStroke(putterFrames: FramePrediction[]) {
    const grouped = groupBy(this.worldSpacePredictions.filter(p => p.classId === CLASS_ID_GOLF_BALL), 'frameNumber');
    const ballPositionsByFrameNumber = new Map(Object.entries(grouped).map(([frame, preds]) => [Number(frame), preds[0] as FramePrediction]));
    const distancesByFrameNumber = new Map<number, number>();
    for (let i = putterFrames.length - 1; i >= 0; i--) {
      let d = putterFrames[i];
      const ballPosition = ballPositionsByFrameNumber.get(d.frameNumber);
      if (!ballPosition) {
        continue;
      }
      const distanceToBall = distance(center(d), center(ballPosition));
      distancesByFrameNumber.set(d.frameNumber, distanceToBall);
    }

    // Iterate over the frameNumbers in reverse order and look for the first frame where the distance is consistent for NUM_STABLE_FRAMES_TO_CONSIDER_STROKE_START frames
    const finalFrameNumber = putterFrames[putterFrames.length - 1].frameNumber;
    for (let potentialStartFrameNumber = finalFrameNumber; potentialStartFrameNumber >= 0; potentialStartFrameNumber--) {
      const anchorDistance = distancesByFrameNumber.get(potentialStartFrameNumber);
      let consistent = true;
      if (!anchorDistance) {
        continue;
      }
      for (let testFrameNumber = potentialStartFrameNumber; testFrameNumber >= Math.max(0, potentialStartFrameNumber - NUM_STABLE_FRAMES_TO_CONSIDER_STROKE_START); testFrameNumber--) {
        const testDistance = distancesByFrameNumber.get(testFrameNumber);
        if (!testDistance) {
          consistent = false;
          break;
        }
        // TODO: This 30 probably needs to be adjusted. (30mm)
        if (
          !within(testDistance, anchorDistance, MIN_DISTANCE_FOR_PUTTER_TO_BE_CONSIDERED_STATIONARY) ||
          testDistance > MIN_DISTANCE_TO_BALL_TO_BE_CONSIDERED_STROKE_START
        ) {
          consistent = false;
          break;
        }
      }

      if (consistent) {
        return potentialStartFrameNumber;
      }
    }
  }

  analyzeStrokeFrames(estimatedImpactFrameNumber: number) {
    const putterPositions = this.worldSpacePredictions.filter(p => p.classId === CLASS_ID_PUTTER)
    const preImpactPutterPositions = putterPositions.filter(p => p.frameNumber <= estimatedImpactFrameNumber);

    const peakBackswingFrameNumber = this.findPeakBackswing(preImpactPutterPositions);
    if (!peakBackswingFrameNumber) {
      return {
        inferred: false,
        reason: 'Peak backswing not found'
      }
    }
    const preBackSwingPutterPositions = putterPositions.filter(p => p.frameNumber <= peakBackswingFrameNumber);
    const startStrokeFrameNumber = this.findStartStroke(preBackSwingPutterPositions);
    if (!startStrokeFrameNumber) {
      return {
        inferred: false,
        reason: 'Start stroke not found'
      }
    }

    const betweenStartAndImpact = putterPositions.filter(p => p.frameNumber >= startStrokeFrameNumber && p.frameNumber <= estimatedImpactFrameNumber);
    if (!this.ensureContiguousTracking(betweenStartAndImpact, estimatedImpactFrameNumber)) {
      return {
        inferred: false,
        reason: 'Putter tracking is not contiguous'
      }
    }

    return {
      inferred: true,
      startStrokeFrameNumber,
      peakBackswingFrameNumber,
    }
  }

  straightness(golfballDeltas: WorldSpaceDelta[]) {
    // Only keep deltas that are moving
    const startIndex = golfballDeltas.findIndex(d => d.delta.distance > 10);
    const stationaryBalls = golfballDeltas
      .slice(0, startIndex)
      .filter(d => d.delta.distance < 1);

    const startingPositionX = average(stationaryBalls.map(d => d.start.x));
    const startingPositionY = average(stationaryBalls.map(d => d.start.y));

    const endIndex = golfballDeltas.slice(startIndex, golfballDeltas.length - 1).findIndex(d => d.delta.distance < 10);
    const farEnoughToMeasure = golfballDeltas.slice(startIndex, endIndex).filter(d => {
      return distance([d.end.x, d.end.y], [startingPositionX, startingPositionY]) > 50;
    })

    const movingBallAngles = farEnoughToMeasure.map(d => {
      const adj = d.end.x - startingPositionX;
      const opp = d.end.y - startingPositionY;
      const angle = Math.abs(Math.atan(opp / adj));
      return angle;
    });

    debugger
    const averageAngle = average(movingBallAngles);
    return radiansToDegrees(averageAngle);
  }
}