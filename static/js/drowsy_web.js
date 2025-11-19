// ----- CONFIG -----
const CLOSED_FRAMES_THRESHOLD = 15; // ~1 second
const ALERT_COOLDOWN = 5000;        // ms
let closedFrames = 0;
let lastAlert = 0;

// ----- DOM -----
const video = document.getElementById("video");
const statusEl = document.getElementById("status");
const closedFramesEl = document.getElementById("closed_frames");
const alarmAudio = document.getElementById("alarm");

// EAR (Eye Aspect Ratio) function
function ear(pts) {
  const A = distance(pts[1], pts[5]);
  const B = distance(pts[2], pts[4]);
  const C = distance(pts[0], pts[3]);
  return (A + B) / (2.0 * C);
}

// EUCLIDEAN DISTANCE
function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

(async () => {
  statusEl.innerText = "Loading FaceMesh...";

  // Load MediaPipe FaceMesh
  const faceMesh = new FaceMesh.FaceMesh({
    locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
  });

  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });

  faceMesh.onResults(onResults);

  // Start webcam
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  video.srcObject = stream;
  await video.play();

  // Camera helper
  const camera = new Camera.Camera(video, {
    onFrame: async () => {
      await faceMesh.send({ image: video });
    },
    width: 640,
    height: 480
  });

  camera.start();
  statusEl.innerText = "Status: Running";
})();

// CALLED EVERY FRAME
function onResults(results) {
  if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
    closedFrames = 0;
    updateUI(0);
    return;
  }

  const lm = results.multiFaceLandmarks[0];

  // Left eye points
  const leftPts = [lm[33], lm[160], lm[158], lm[133], lm[153], lm[144]];
  // Right eye points
  const rightPts = [lm[362], lm[385], lm[387], lm[263], lm[373], lm[380]];

  const leftEAR = ear(leftPts);
  const rightEAR = ear(rightPts);
  const avgEAR = (leftEAR + rightEAR) / 2;

  const EAR_THRESHOLD = 0.21;

  if (avgEAR < EAR_THRESHOLD) {
    closedFrames++;
  } else {
    closedFrames = 0;
  }

  updateUI(closedFrames);

  const now = Date.now();
  if (closedFrames >= CLOSED_FRAMES_THRESHOLD && now - lastAlert > ALERT_COOLDOWN) {
    lastAlert = now;
    alarmAudio.play().catch(()=>{});
  }
}

function updateUI(cf) {
  closedFramesEl.innerText = "Closed frames: " + cf;
}
