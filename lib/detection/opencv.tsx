export default function loadOpenCv() {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://docs.opencv.org/4.7.0/opencv.js';
    script.async = true;
    script.onload = () => {
      if (window.cv) {
        window.cv['onRuntimeInitialized'] = () => {
          resolve(window.cv);
        };
      } else {
        reject('Failed to load OpenCV.js');
      }
    };
    script.onerror = () => {
      reject('Error loading OpenCV.js');
    };
    document.body.appendChild(script);
  });
}