// MediaPipe Hands — fist detection + wrist position + size estimate
// Loads via CDN, no install needed

export class HandTracker {
  constructor(videoElement, canvasElement) {
    this.video = videoElement;
    this.canvas = canvasElement;
    this.hands = null;
    this.result = {
      detected: false,
      isFist: false,
      wristX: 0.5,   // normalized 0-1
      wristY: 0.7,
      fistWidthNorm: 0.12  // normalized width estimate
    };
    this.onResult = null;
  }

  async init() {
    // Load MediaPipe Hands from CDN
    await new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js';
      script.onload = resolve;
      document.head.appendChild(script);
    });

    this.hands = new Hands({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    this.hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.5
    });

    this.hands.onResults((results) => this._onResults(results));
    this._running = true;
    this._loop();
  }

  async _loop() {
    if (!this._running) return;
    if (this.video.readyState >= 2) {
      await this.hands.send({ image: this.video });
    }
    requestAnimationFrame(() => this._loop());
  }

  _onResults(results) {
    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      this.result.detected = false;
      return;
    }

    const lm = results.multiHandLandmarks[0];
    // Wrist = landmark 0
    this.result.wristX = lm[0].x;
    this.result.wristY = lm[0].y;
    this.result.detected = true;

    // Fist detection: fingertips (4,8,12,16,20) close to palm base (0)
    const tips = [4, 8, 12, 16, 20];
    const palm = lm[0];
    const avgDist = tips.reduce((sum, i) => {
      const dx = lm[i].x - palm.x;
      const dy = lm[i].y - palm.y;
      return sum + Math.sqrt(dx*dx + dy*dy);
    }, 0) / tips.length;

    this.result.isFist = avgDist < 0.15;

    // Estimate hand width from wrist to pinky MCP (landmark 17)
    const dx = lm[17].x - lm[0].x;
    const dy = lm[17].y - lm[0].y;
    this.result.fistWidthNorm = Math.sqrt(dx*dx + dy*dy) * 2.5;

    // Bounding box from all 21 landmarks (normalized 0-1)
    const xs = lm.map(p => p.x), ys = lm.map(p => p.y);
    this.result.bbox = {
      x: Math.min(...xs),
      y: Math.min(...ys),
      w: Math.max(...xs) - Math.min(...xs),
      h: Math.max(...ys) - Math.min(...ys),
    };

    // Raw landmarks for dot overlay
    this.result.landmarks = lm;

    if (this.onResult) this.onResult(this.result);
  }

  stop() { this._running = false; }
}
