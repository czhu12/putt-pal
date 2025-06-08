export function add(a: [number, number], b: [number, number]): [number, number] {
  return [a[0] + b[0], a[1] + b[1]];
}

export function subtract(a: [number, number], b: [number, number]): [number, number] {
  return [a[0] - b[0], a[1] - b[1]];
}

export function magnitude(vector: [number, number]): number {
  return Math.sqrt(vector[0] ** 2 + vector[1] ** 2);
}

export function radiansToDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}

export function distance(a: [number, number], b: [number, number]): number {
  return magnitude(subtract(a, b));
}

export function within(a: number, b: number, tolerance: number): boolean {
  return Math.abs(a - b) <= tolerance;
}

export function center(prediction: { x1: number, x2: number, y1: number, y2: number }): [number, number] {
  return [
    (prediction.x1 + prediction.x2) / 2,
    (prediction.y1 + prediction.y2) / 2,
  ]
}

export function average(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function isSquare(prediction: { x1: number, x2: number, y1: number, y2: number }): boolean {
  const width = Math.abs(prediction.x1 - prediction.x2);
  const height = Math.abs(prediction.y1 - prediction.y2);
  if (width === 0 || height === 0) {
    return false;
  }
  // Check width and height are similar
  const ratio = width / height;
  return ratio > 0.9 && ratio < 1.1;
}

export function estimateDiameter(prediction: { x1: number, x2: number, y1: number, y2: number }): number {
  const width = Math.abs(prediction.x1 - prediction.x2);
  const height = Math.abs(prediction.y1 - prediction.y2);
  const diameter = (width + height) / 2;
  return diameter;
}
