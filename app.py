# app.py - Flask + SocketIO server for Drowsiness Detection
import os
import base64
import time
from collections import deque

from flask import Flask, render_template, request, has_request_context
from flask_socketio import SocketIO, emit

import numpy as np
from PIL import Image
import io

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app, cors_allowed_origins='*')

# Try to import tensorflow and cv2; if unavailable, we'll run a fallback.
HAS_TF = False
HAS_CV2 = False
try:
    import cv2
    HAS_CV2 = True
except Exception:
    cv2 = None

try:
    from tensorflow.keras.models import load_model
    HAS_TF = True
except Exception:
    load_model = None

MODEL_PATH = "models/eye_classifier.h5"
EYE_IMG_SIZE = (64, 64)
CONSEC_FRAMES_FOR_DROWSY = 20

# session tracker
session_states = {}

def preprocess_eye_cv2(eye_img):
    # eye_img: numpy grayscale
    try:
        resized = cv2.resize(eye_img, EYE_IMG_SIZE)
    except Exception:
        return None
    norm = resized.astype('float32') / 255.0
    norm = np.expand_dims(norm, axis=(0, -1))
    return norm

# load model if possible
model = None
if HAS_TF and os.path.exists(MODEL_PATH):
    try:
        model = load_model(MODEL_PATH)
        print("Loaded Keras model.")
    except Exception as e:
        print("Failed loading model:", e)
else:
    print("TensorFlow or model not available. Server will run in fallback mode (heuristic).")

# Load Haar cascades if OpenCV available
face_cascade = None
eye_cascade = None
if HAS_CV2:
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye.xml')

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('frame')
def handle_frame(data):
    sid = request.sid
    payload = data.get('image', '')
    if not payload:
        return
    header, b64 = payload.split(',', 1) if ',' in payload else ('', payload)
    img_bytes = base64.b64decode(b64)
    arr = np.frombuffer(img_bytes, dtype=np.uint8)

    # Try to decode via OpenCV if available, else use PIL
    frame = None
    if HAS_CV2:
        frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    else:
        img = Image.open(io.BytesIO(img_bytes)).convert('RGB')
        gray = np.array(img.convert('L'))

    if sid not in session_states:
        session_states[sid] = {'closed_count': 0, 'last_alert': 0}

    state = session_states[sid]
    eye_closed_flag = False

    if HAS_CV2 and face_cascade is not None:
        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(80,80))
        for (x,y,w,h) in faces:
            face_gray = gray[y:y+h, x:x+w]
            eyes = eye_cascade.detectMultiScale(face_gray, scaleFactor=1.1, minNeighbors=3, minSize=(20,20))
            eye_states = []
            for (ex,ey,ew,eh) in eyes[:2]:
                eye_img = face_gray[ey:ey+eh, ex:ex+ew]
                if model is not None:
                    proc = preprocess_eye_cv2(eye_img)
                    if proc is None: continue
                    p = float(model.predict(proc)[0][0])
                    is_open = p >= 0.5
                    eye_states.append(is_open)
                else:
                    # heuristic: if mean intensity very low -> closed (blink)
                    meanv = np.mean(eye_img)
                    is_open = meanv > 60  # heuristic threshold
                    eye_states.append(is_open)
            if len(eye_states)>0:
                eye_closed_flag = all(not s for s in eye_states)
                break
    else:
        # Fallback: no OpenCV — return not drowsy
        eye_closed_flag = False

    if eye_closed_flag:
        state['closed_count'] += 1
    else:
        state['closed_count'] = 0

    is_drowsy = state['closed_count'] >= CONSEC_FRAMES_FOR_DROWSY
    now = time.time()
    trigger_alarm = False
    if is_drowsy and (now - state['last_alert'] > 5.0):
        trigger_alarm = True
        state['last_alert'] = now

    emit('drowsiness', {
        'drowsy': bool(is_drowsy),
        'closed_frames': int(state['closed_count']),
        'alarm': bool(trigger_alarm)
    })

@socketio.on('connect')
def on_connect():
    emit('connected', {'msg':'connected'})

@socketio.on('disconnect')
def on_disconnect():
    sid = request.sid
    session_states.pop(sid, None)

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000)
