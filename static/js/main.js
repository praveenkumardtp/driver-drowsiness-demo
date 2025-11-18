const socket = io();

const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const ctx = overlay.getContext('2d');
const statusEl = document.getElementById('st');
const closedEl = document.getElementById('closed');
const alarm = document.getElementById('alarmSound');

const CAPTURE_INTERVAL = 150; // ms

async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    video.srcObject = stream;
    video.play();
    startSendingFrames();
  } catch (e) {
    console.error("Camera error", e);
    statusEl.innerText = 'Camera access denied';
  }
}

function startSendingFrames() {
  const tmpCanvas = document.createElement('canvas');
  const w = 320, h = 240;
  tmpCanvas.width = w; tmpCanvas.height = h;
  const tctx = tmpCanvas.getContext('2d');

  setInterval(() => {
    if (video.readyState < 2) return;
    tctx.drawImage(video, 0, 0, w, h);
    const dataUrl = tmpCanvas.toDataURL('image/jpeg', 0.6);
    socket.emit('frame', { image: dataUrl });
  }, CAPTURE_INTERVAL);
}

socket.on('connect', () => {
  statusEl.innerText = 'Connected';
});

socket.on('drowsiness', (data) => {
  const { drowsy, closed_frames, alarm: playAlarm } = data;
  closedEl.innerText = closed_frames;
  statusEl.innerText = drowsy ? 'DROWSY' : 'Alert';

  ctx.clearRect(0,0,overlay.width, overlay.height);
  ctx.font = "30px Arial";
  ctx.fillStyle = drowsy ? "rgba(255,0,0,0.8)" : "rgba(0,255,0,0.6)";
  ctx.fillText(drowsy ? "DROWSY" : "Alert", 10, 40);

  if (playAlarm) {
    try {
      alarm.currentTime = 0;
      alarm.play();
    } catch (e) {
      console.log('Alarm play blocked', e);
    }
  }
});

startCamera();
