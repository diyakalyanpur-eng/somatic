// Direct port of AiSteth Blender beat scheduler
// Generates IBI-accurate beat timing from BPM + HRV

function gaussianRandom(mean, std) {
  const u = 1 - Math.random();
  const v = Math.random();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return mean + std * z;
}

export class HeartBeatScheduler {
  constructor() {
    this.bpm = 72;
    this.hrv_ms = 42;
    this.nextBeatAt = performance.now();
    this.onBeat = null; // callback
  }

  update(bpm, hrv_ms) {
    this.bpm = Math.max(30, Math.min(220, bpm));
    this.hrv_ms = Math.max(1, hrv_ms);
  }

  // Call this every animation frame
  tick(now, triggerBeat) {
    if (now >= this.nextBeatAt) {
      // Schedule next beat with HRV jitter (your Python logic)
      const avg_ibi_ms = (60.0 / this.bpm) * 1000;
      const jitter = gaussianRandom(0, this.hrv_ms);
      const ibi = Math.max(200, avg_ibi_ms + jitter);
      this.nextBeatAt = now + ibi;

      if (triggerBeat) triggerBeat();
    }
  }

  // Returns 0-1 progress within current beat cycle
  beatProgress(now) {
    const avg_ibi_ms = (60.0 / this.bpm) * 1000;
    const elapsed = avg_ibi_ms - (this.nextBeatAt - now);
    return Math.max(0, Math.min(1, elapsed / avg_ibi_ms));
  }
}
