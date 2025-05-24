const GOLFBALL_RADIUS = 21.336; // in mm
const MINIMUM_EVIDENCE_COUNT = 10;
const MAXIMUM_EVIDENCE_COUNT = 10;

const STIMPS = {
  slow: 6.0,
  average: 8.0,
  fast: 10.0,
  pga: 13.0
}

export interface Circle {
  x: number;
  y: number;
  radius: number;
}

interface FramePosition {
  x: number;
  y: number;
  frame: number;
}

function calculateRollDistance(v0: number, stimp: number) {
  const stimpmeterSpeed = 1.83; // m/s (Stimpmeter ball release speed)
  const feetToMeters = 0.3048;

  // The Stimpmeter rating gives distance in feet at 1.83 m/s
  // We scale by the square of velocity (kinetic energy) under constant friction
  const distanceFeet = stimp * (v0 ** 2) / (stimpmeterSpeed ** 2);
  const distanceMeters = distanceFeet * feetToMeters;

  return distanceMeters;
}

export default class Physics {
  private circles: Circle[];
  public estimatedMillimetersPerPixel: number | null = null;

  constructor() {
    this.circles = [];
  }

  estimateDistance(startPosition: FramePosition, endPosition: FramePosition, frameRate: number) {
    if (this.estimatedMillimetersPerPixel === null) throw new Error('Estimated millimeters per pixel not set');
    const speed = this.estimateSpeed(startPosition, endPosition, frameRate); // in mm/s
    return calculateRollDistance(speed / 1000, STIMPS.average);
  }

  estimateSpeed(startPosition: FramePosition, endPosition: FramePosition, frameRate: number) {
    const distance = Math.sqrt((endPosition.x - startPosition.x) ** 2 + (endPosition.y - startPosition.y) ** 2);
    const time = (endPosition.frame - startPosition.frame) / frameRate;
    const speed = distance * this.estimatedMillimetersPerPixel! / time;
    return speed; // in mm/s
  }

  addCircles(circles: Circle[]) {
    this.circles.push(...circles);
    if (this.circles.length > MAXIMUM_EVIDENCE_COUNT) {
      this.circles = this.circles.slice(-MAXIMUM_EVIDENCE_COUNT);
    }
    this.analyze();
  }

  analyze() {
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
}