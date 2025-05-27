export interface Circle {
  x: number;
  y: number;
  radius: number;
}

export async function loadOpenCv() {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://docs.opencv.org/4.7.0/opencv.js';
    script.async = true;
    script.onload = () => {
      if (window.cv) {
        window.cv['onRuntimeInitialized'] = () => {
          resolve(true);
        };
      } else {
        reject(new Error('Failed to load OpenCV.js'));
      }
    };
    script.onerror = () => {
      reject(new Error('Failed to load OpenCV.js'));
    };
    document.body.appendChild(script);
  })
}

export function houghCircles(src: any): Circle[] {
  const cv = window.cv;
  cv.cvtColor(src, src, cv.COLOR_RGBA2GRAY);
  let circles = new cv.Mat();
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
  //const results = parseCircles(circles);
  circles.delete();
  return [];
  //return results;
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
