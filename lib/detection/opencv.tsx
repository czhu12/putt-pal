export default async function loadOpenCv() {
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
