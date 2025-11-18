# Driver Drowsiness Detection - Full Demo

This repository contains a Driver Drowsiness Detection demo (OpenCV + Keras) with a live demo website (browser webcam → server inference → alert).

**NOTE:** This full demo requires additional Python packages (OpenCV, TensorFlow). See `requirements_full.txt`.

## Quick start (recommended)

1. Open a terminal (Command Prompt recommended on Windows):
```cmd
cd "C:\Users\Admin\Downloads\New folder"  # or wherever you extract this repo
python -m venv venv
venv\Scripts\activate.bat
python -m pip install --upgrade pip
python -m pip install -r requirements_full.txt
python app.py
```

2. Open `http://localhost:5000` in Chrome and allow camera access.

If you cannot install TensorFlow or OpenCV, you can still run the demo UI but detection won't run until you install the required packages.

## Files
- `app.py` — Flask + Flask-SocketIO server. Loads Keras model from `models/eye_classifier.h5` if available, otherwise falls back to a simple heuristic (OpenCV required).
- `train.py` — Keras training script to train an eye open/closed classifier.
- `templates/index.html` — Frontend page.
- `static/js/main.js`, `static/css/style.css` — Frontend assets.
- `requirements_full.txt` — Full dependency list for realistic detection (large).
- `requirements_min.txt` — Minimal dependencies for running the server without ML (smaller).

## Notes
- For best results, use Python 3.10 or 3.11 and install CPU TensorFlow (tensorflow==2.13) or a matching version.
- If you plan to run inference on the client side, consider converting the Keras model to TensorFlow.js.
