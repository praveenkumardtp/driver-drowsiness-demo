// main.js - sends small frames to server (non-blocking, waits for camera started by drowsy_web.js)

const socket = io();

// Use a different variable name to avoid re-declaration conflicts
const camVideo = document.getElementById('video');
const overlay = document.getElementById('overlay');
const ctx = overlay.getContext('2d');
const statusEl = document.getElementById('st');
const closedEl = document.getElementById('closed');
const alarm = document.getElementById('alarmSound');

const CAPTURE_INTERVAL = 150; // ms
let senderInterval = null;

function startSendingFrames() {
  if (senderInterval) return; // already running

  const tmpCanvas = document.createElement('canvas');
  const w = 320, h = 240;
  tmpCanvas.width = w; tmpCanvas.height = h;
  const tctx = tmpCanvas.getContext('2d');

  senderInterval = setInterval(() => {
    if (!camVideo || camVideo.readyState < 2) return;
    try {
      tctx.drawImage(camVideo, 0, 0, w, h);
      const dataUrl = tmpCanvas.toDataURL('image/jpeg', 0.6);
      socket.emit('frame', { image: dataUrl });
    } catch (e) {
      // sometimes drawImage throws if video not ready
      console.warn('frame send error', e);
    }
  }, CAPTURE_INTERVAL);
}

// If the page's video element already has a stream, start sending right away.
// Otherwise, poll until a stream becomes available (drowsy_web.js will usually attach it).
(function waitForVideoThenStart(){
  if (camVideo && camVideo.srcObject) {
    startSendingFrames();
  } else {
    const iv = setInterval(() => {
      if (camVideo && camVideo.srcObject) {
        clearInterval(iv);
        startSendingFrames();
      }
    }, 500);
  }
})();

socket.on('connect', () => {
  // only update UI; detection UI is handled by drowsy_web
  if (statusEl) statusEl.innerText = 'Connected';
});

socket.on('drowsiness', (data) => {
  const { drowsy, closed_frames, alarm: playAlarm } = data;
  if (closedEl) closedEl.innerText = closed_frames;
  if (statusEl) statusEl.innerText = drowsy ? 'DROWSY' : 'Alert';

  if (playAlarm) {
    try {
      alarm.currentTime = 0;
      alarm.play().catch(()=>{ /* may be blocked until user interaction */ });
    } catch (e) {
      console.log('Alarm play blocked', e);
    }
  }
});
