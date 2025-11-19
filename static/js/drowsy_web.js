// drowsy_web.js - uses MediaPipe FaceMesh + EAR (Eye Aspect Ratio)
// matched to your HTML: video#video, overlay#overlay, status span#st, closed span#closed, audio#alarmSound

// CONFIG
const CLOSED_FRAMES_THRESHOLD = 15; // frames (tune)
const ALERT_COOLDOWN = 5000; // ms
const EAR_THRESHOLD = 0.21; // closed if EAR < this

let closedFrames = 0;
let lastAlertAt = 0;

// DOM (match your index.html)
const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const overlayCtx = overlay.getContext('2d');
const statusSpan = document.getElementById('st');
const closedSpan = document.getElementById('closed');
const alarmAudio = document.getElementById('alarmSound');

// small enable-sound button to satisfy autoplay policies
(function addEnableSoundButton(){
  const btn = document.createElement('button');
  btn.id = 'enable-sound';
  btn.innerText = 'Enable sound';
  btn.style.position = 'fixed';
  btn.style.right = '12px';
  btn.style.top = '12px';
  btn.style.zIndex = 9999;
  btn.style.padding = '6px 10px';
  document.body.appendChild(btn);
  btn.addEventListener('click', async () => {
    try {
      await alarmAudio.play();
      alarmAudio.pause();
    } catch(e){}
    btn.style.display = 'none';
  });
})();

// EAR helpers
function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function ear(pts) {
  const A = distance(pts[1], pts[5]);
  const B = distance(pts[2], pts[4]);
  const C = distance(pts[0], pts[3]);
  return (A + B) / (2.0 * C);
}

// Draw overlay boxes/landmarks
function drawEyeBox(box, color='lime') {
  overlayCtx.strokeStyle = color;
  overlayCtx.lineWidth = 2;
  overlayCtx.strokeRect(box.x, box.y, box.w, box.h);
}

// Convert normalized MP coords to pixel coords
function toPixel(coord, videoW, videoH){
  return { x: coord.x * videoW, y: coord.y * videoH };
}

// Main
(async () => {
  statusSpan.textContent = 'Initializing...';

  // create face mesh — CORRECT constructor usage for CDN build
  const faceMesh = new FaceMesh({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
  });
  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });

  faceMesh.onResults(onResults);

  // request camera
  try {
    // If video already has stream (maybe main.js or others), reuse it
    if (!video.srcObject) {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
      video.srcObject = stream;
      await video.play();
    }
  } catch (e) {
    statusSpan.textContent = 'Camera permission required';
    console.error('Camera error', e);
    return;
  }

  // ensure overlay matches video size
  function syncOverlay() {
    overlay.width = video.videoWidth || 640;
    overlay.height = video.videoHeight || 480;
  }
  video.addEventListener('loadedmetadata', syncOverlay);
  syncOverlay();

  // use MediaPipe Camera helper — CORRECT usage
  const camera = new Camera(video, {
    onFrame: async () => {
      await faceMesh.send({ image: video });
    },
    width: 640,
    height: 480
  });
  camera.start();

  statusSpan.textContent = 'Status: Running';
})();

async function onResults(results) {
  overlayCtx.clearRect(0, 0, overlay.width, overlay.height);

  if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
    closedFrames = 0;
    closedSpan.textContent = closedFrames;
    return;
  }

  const landmarks = results.multiFaceLandmarks[0];
  const vw = video.videoWidth, vh = video.videoHeight;

  // left eye indices
  const leftIdx = [33, 160, 158, 133, 153, 144];
  const rightIdx = [362, 385, 387, 263, 373, 380];

  // collect landmarks in pixel coords
  const leftPts = leftIdx.map(i => toPixel(landmarks[i], vw, vh));
  const rightPts = rightIdx.map(i => toPixel(landmarks[i], vw, vh));

  // compute EAR
  const leftEAR = ear(leftPts);
  const rightEAR = ear(rightPts);
  const avgEAR = (leftEAR + rightEAR) / 2;

  // draw small landmark points and approximate box
  overlayCtx.fillStyle = 'rgba(0,255,0,0.8)';
  leftPts.forEach(p => overlayCtx.fillRect(p.x-2, p.y-2, 4, 4));
  rightPts.forEach(p => overlayCtx.fillRect(p.x-2, p.y-2, 4, 4));

  // compute bounding boxes to show where we look
  const getBox = (pts) => {
    const xs = pts.map(p=>p.x), ys = pts.map(p=>p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const w = Math.max(10, maxX - minX), h = Math.max(10, maxY - minY);
    const padX = w * 0.25, padY = h * 0.6;
    return { x: Math.max(0, minX - padX), y: Math.max(0, minY - padY), w: Math.min(overlay.width, w + padX*2), h: Math.min(overlay.height, h + padY*2) };
  }
  const lbox = getBox(leftPts);
  const rbox = getBox(rightPts);
  drawEyeBox(lbox, 'lime');
  drawEyeBox(rbox, 'lime');

  // decide open/closed
  const isClosed = avgEAR < EAR_THRESHOLD;
  if (isClosed) closedFrames++; else closedFrames = 0;

  closedSpan.textContent = closedFrames;
  statusSpan.textContent = `Status: Running (EAR=${avgEAR.toFixed(3)})`;

  // alarm logic
  const now = Date.now();
  if (closedFrames >= CLOSED_FRAMES_THRESHOLD && (now - lastAlertAt) > ALERT_COOLDOWN) {
    lastAlertAt = now;
    // try playing alarm
    alarmAudio.play().catch(()=>{ /* autoplay blocked until user interaction - use Enable sound button */ });
  }
}
