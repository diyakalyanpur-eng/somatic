// rPPG v3 — Hybrid pipeline: Face rPPG + Finger PPG spot-check
//
// Face pipeline (per frame):
//   1. Multi-ROI RGB sampling (forehead + cheeks) with motion artifact rejection
//   2. Windowed POS (Wang et al. 2017) — N=32 windows
//      S1 = G − B,  S2 = G + B − 2R,  α = σ(S1)/σ(S2),  pulse = S1 + α·S2
//   3. FFT bandpass 0.75–3.0 Hz (45–180 BPM) before Welch
//   4. 256-point Welch, 75% overlap — prior-guided peak selection
//   5. Parabolic interpolation + harmonic verification
//   6. Overlapping 30-s windows, 1.5 s step → median BPM output
//   7. Window-to-window SD tracking + jump gate (>5 BPM → reject)
//   8. Confidence scoring: high / medium / low
//
// Finger pipeline:
//   1. Center-crop (40×40 px) red channel only
//   2. Saturation check: R>250 or R<40 → reject frame
//   3. FFT + peak-to-peak BPM — accept only if |FFT − peaks| < 3 BPM
//
// Hybrid flow: face high-confidence → done; else → finger spot-check → fuse
//
// Skin tone adaptation: Fitzpatrick I–VI (Sjoding et al. NEJM 2020)
// Device adaptation: iOS (Smart HDR gain), Android (exposure-jitter guard)

export class RPPGEstimator {
  constructor(videoElement) {
    this.video  = videoElement;

    // Larger canvas = more skin pixels = less shot noise
    this.canvas = document.createElement('canvas');
    this.canvas.width  = 160;
    this.canvas.height = 120;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });

    this.fs        = 30;    // sampling rate (fps)
    this.windowSec = 30;    // keep 30 s of data → 900 samples → 4–6 Welch segments
    this.stepMs    = 1500;  // estimate every 1.5 s (more estimates per scan → faster convergence)

    this.buffer  = [];      // { t, r, g, b }
    this.bpm     = 60;
    this.hrv_ms  = 45;
    this.spo2    = 98;
    this.brpm    = 15;
    this.quality = 0;

    this.onUpdate = null;   // (bpm, hrv_ms, spo2, brpm, quality) => {}

    this.fitzpatrick = 3;
    this.deviceType  = 'desktop';
    this.mode        = 'face';
    this.torchActive = false;  // set by main.js; relaxes finger gate when torch unavailable

    // Internal EMA (used only as prior for Welch peak selection — not the output BPM)
    this._emaBPM    = 75;
    this._emaHRV    = 45;
    this._emaSPO2   = 98;
    this._emaBRPM   = 15;
    this._emaSeeded = false;
    this._estCount  = 0;

    // Overlapping-window median BPM history
    this._bpmHistory = [];   // accepted window estimates (max 10)

    // Current confidence for this window: 'high' | 'medium' | 'low'
    this.confidence = 'low';
    // Best confidence sustained over ≥3 consecutive windows — used by main.js
    // for the hybrid skip-finger decision so one noisy end-window can't downgrade
    // what was otherwise a high-quality scan.
    this._peakConfidence      = 'low';
    this._peakConfHiStreak    = 0;   // consecutive high-confidence windows
    this._peakConfMedStreak   = 0;   // consecutive medium-confidence windows

    // Last good filtered signal — exposed so cardiac-glyph.js can use the
    // actual PPG waveform shape (person-specific morphology) in the signature.
    this.lastFilteredSignal = null;

    this._interval   = null;
    this._lastEst    = 0;
    this._prevLum    = null;
    this._motionBuf  = [];
    this._expHistory = [];

    // Motion rejection counters — exposed via motionRate getter for UI warnings
    this._sampledFrames  = 0;
    this._rejectedFrames = 0;
  }

  start() {
    this._emaSeeded      = false;
    this._estCount       = 0;
    this._emaBPM         = 75;
    this._sampledFrames  = 0;
    this._rejectedFrames = 0;
    this._bpmHistory          = [];
    this.confidence           = 'low';
    this._peakConfidence      = 'low';
    this._peakConfHiStreak    = 0;
    this._peakConfMedStreak   = 0;
    this._interval       = setInterval(() => this._sample(), 1000 / this.fs);
  }
  stop()  { clearInterval(this._interval); }

  // Fraction of recent frames rejected due to motion (0–1).
  // UI uses this to show "Hold still" warning when > 0.35.
  get motionRate() {
    return this._sampledFrames >= 10
      ? this._rejectedFrames / this._sampledFrames
      : 0;
  }

  get _st() { return (this.fitzpatrick - 1) / 5; }  // 0=light, 1=dark

  // ── 1. Sample ─────────────────────────────────────────────
  _sample() {
    if (this.video.readyState < 2) return;
    this.ctx.drawImage(this.video, 0, 0, 160, 120);

    let r = 0, g = 0, b = 0, count = 0;
    const st = this._st;

    if (this.mode === 'finger') {
      // Finger: center crop 40×40 px of the 160×120 canvas — red channel primary.
      // The center crop avoids lens-edge vignetting and maximises signal from
      // the fingertip capillary bed directly over the flash.
      const d = this.ctx.getImageData(60, 40, 40, 40).data;
      count = d.length / 4;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i+1]; b += d[i+2]; }

      this._sampledFrames++;
      const rm_check = r / count;
      // Saturation check: R > 250 → overexposed (flash too strong, no AC component)
      //                   R < 40  → finger not covering lens
      if (rm_check > 250 || rm_check < 40) {
        this._rejectedFrames++;
        this._prevLum = 0.299*rm_check + 0.587*(g/count) + 0.114*(b/count);
        return;
      }

    } else {
      // Face: sample 3 ROIs — forehead (top-center) + left cheek + right cheek
      // This avoids nose/eyes/hair and concentrates on high-vascularity skin
      const rois = [
        this.ctx.getImageData(48, 8,  64, 30).data,   // forehead (center top)
        this.ctx.getImageData(10, 50, 45, 35).data,   // left cheek
        this.ctx.getImageData(105,50, 45, 35).data,   // right cheek
      ];

      const minBright = 30 + st * 15;
      const maxBright = 245 - st * 35;

      for (const d of rois) {
        for (let i = 0; i < d.length; i += 4) {
          const ri = d[i], gi = d[i+1], bi = d[i+2];
          const lum = 0.299*ri + 0.587*gi + 0.114*bi;
          let isSkin;
          if (this.fitzpatrick <= 3) {
            isSkin = ri > bi && gi > bi && ri > minBright && ri < maxBright;
          } else if (this.fitzpatrick <= 5) {
            isSkin = lum > minBright && lum < maxBright && ri >= bi;
          } else {
            isSkin = lum > minBright && lum < maxBright;
          }
          if (isSkin) { r += ri; g += gi; b += bi; count++; }
        }
      }

      // Fallback: use all ROI pixels if skin filter too strict
      if (count < 150) {
        r = 0; g = 0; b = 0; count = 0;
        for (const d of rois) {
          count += d.length / 4;
          for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i+1]; b += d[i+2]; }
        }
      }
    }

    if (count === 0) return;
    const rm = r/count, gm = g/count, bm = b/count;
    const curLum = 0.299*rm + 0.587*gm + 0.114*bm;

    // ── Motion artifact rejection ──────────────────────────
    // Frame-to-frame luminance change > 6% = likely motion/flicker → reject
    // (finger mode already incremented _sampledFrames in its saturation check above)
    if (this.mode !== 'finger') this._sampledFrames++;
    if (this._prevLum !== null) {
      const motionScore = Math.abs(curLum - this._prevLum) / (this._prevLum + 1);
      this._motionBuf.push(motionScore);
      if (this._motionBuf.length > 10) this._motionBuf.shift();
      if (motionScore > 0.06) {
        this._rejectedFrames++;
        this._prevLum = curLum;
        return;   // reject this sample
      }
    }
    this._prevLum = curLum;

    // ── Android auto-exposure guard ────────────────────────
    if (this.deviceType === 'android') {
      if (this._expHistory.length > 0) {
        const prevL = this._expHistory.at(-1);
        if (prevL > 0 && Math.abs(curLum - prevL) / prevL > 0.18) {
          this._expHistory.push(curLum);
          if (this._expHistory.length > 10) this._expHistory.shift();
          return;
        }
      }
      this._expHistory.push(curLum);
      if (this._expHistory.length > 10) this._expHistory.shift();
    }

    this.buffer.push({ t: performance.now(), r: rm, g: gm, b: bm });

    // Keep only windowSec of data
    const cutoff = performance.now() - this.windowSec * 1000;
    while (this.buffer.length > 0 && this.buffer[0].t < cutoff) this.buffer.shift();

    const now = performance.now();
    if (this.buffer.length >= this.fs * 9 && now - this._lastEst >= this.stepMs) {
      this._lastEst = now;
      this._estimate();
    }
  }

  // ── 2. POS — Plane-Orthogonal-to-Skin (Wang et al. 2017) ──────
  //
  // Replaces windowed CHROM as the primary extraction step.
  // POS outperforms CHROM on mobile/webcam benchmarks because α is derived
  // from the actual signal variance in each window rather than from fixed
  // skin-tone model coefficients — so it self-corrects for lighting changes
  // mid-scan without needing Fitzpatrick parameters.
  //
  // Per-window algorithm:
  //   1. Normalise each RGB channel by its window mean → removes DC / slow drift
  //   2. Project onto two orthogonal axes:
  //        H1 = Rn − Gn                    (differential chrominance)
  //        H2 = Rn + Gn − 2·Bn             (blue-weighted complement)
  //   3. Scale H2 so its variance matches H1:  α = σ(H1) / σ(H2)
  //   4. PPG signal:  H = H1 + α·H2
  //
  // The combined signal lies in the plane orthogonal to the skin-tone
  // vector [μR, μG, μB], cancelling specular/diffuse illumination noise.
  //
  // Window length N = 32 samples (~1.07 s at 30 fps) — same as previous CHROM
  // window so the rest of the pipeline (bandpass → Welch) is unchanged.
  _posWindowed(buf) {
    const N   = 32;
    const out = [];

    for (let s = 0; s + N <= buf.length; s += N) {
      const win = buf.slice(s, s + N);

      // Step 1: window means — skin-tone direction in RGB space
      let mr = 0, mg = 0, mb = 0;
      for (const x of win) { mr += x.r; mg += x.g; mb += x.b; }
      mr /= N; mg /= N; mb /= N;

      // Skip dark / near-zero windows (finger not covering lens, or very dark skin + bad light)
      if (mr < 5 || mg < 5 || mb < 5) {
        for (let i = 0; i < N; i++) out.push(0);
        continue;
      }

      // Step 2 & 3: normalise channels, project onto two orthogonal skin-plane axes
      const S1 = new Float64Array(N);
      const S2 = new Float64Array(N);
      for (let i = 0; i < N; i++) {
        const rn = win[i].r / mr;
        const gn = win[i].g / mg;
        const bn = win[i].b / mb;
        S1[i] = gn - bn;             // axis 1: G - B
        S2[i] = gn + bn - 2 * rn;   // axis 2: G + B - 2R
      }

      // Step 4: variance-matched combination  P = S1 + alpha*S2
      const sS1   = this._std(S1);
      const sS2   = this._std(S2);
      const alpha = sS2 > 1e-9 ? sS1 / sS2 : 1.0;

      const P = new Float64Array(N);
      for (let i = 0; i < N; i++) P[i] = S1[i] + alpha * S2[i];

      // iOS Smart HDR compresses AC variance ~35% → re-inflate
      if (this.deviceType === 'ios') {
        const m = this._mean(P);
        for (let i = 0; i < N; i++) P[i] = m + (P[i] - m) * 1.40;
      }

      out.push(...P);
    }
    return out;
  }

  // ── 2b. CHROM fallback (de Haan & Jeanne 2013) ────────────────
  // Kept for comparison / A-B testing via snapshot replay.
  // Call loadSnapshot(snap, { algo: 'chrom' }) to re-run with CHROM.
  _chromWindowed(buf) {
    const N   = 32;
    const out = [];
    const st  = this._st;
    const rX  = 3.0 + st * 0.6;
    const rY  = 1.5 + st * 0.4;
    const bY  = 1.5 - st * 0.9;

    for (let s = 0; s + N <= buf.length; s += N) {
      const win = buf.slice(s, s + N);
      let mr = 0, mg = 0, mb = 0;
      for (const x of win) { mr += x.r; mg += x.g; mb += x.b; }
      mr /= N; mg /= N; mb /= N;
      if (mr < 5 || mg < 5 || mb < 5) { for (let i = 0; i < N; i++) out.push(0); continue; }

      const Xs = win.map(x => rX*(x.r/mr) - 2*(x.g/mg));
      const Ys = win.map(x => rY*(x.r/mr) + (x.g/mg) - bY*(x.b/mb));
      const sX = this._std(Xs), sY = this._std(Ys);
      const a  = sY > 1e-9 ? sX/sY : 1;
      const S  = Xs.map((x, i) => x - a*Ys[i]);
      if (this.deviceType === 'ios') {
        const m = this._mean(S);
        S.forEach((v, i) => S[i] = m + (v - m) * 1.40);
      }
      out.push(...S);
    }
    return out;
  }

  // ── 3. FFT-based zero-phase bandpass (0.7–3.5 Hz) ─────────
  // Applied BEFORE Welch to remove baseline wander + high-freq noise.
  // Zero-phase (forward + reverse FFT symmetry) — no phase distortion.
  _bandpass(signal, fLow = 0.75, fHigh = 3.0) {
    const n    = signal.length;
    const nfft = Math.pow(2, Math.ceil(Math.log2(n)));
    const re   = new Float64Array(nfft);
    const im   = new Float64Array(nfft);
    for (let i = 0; i < n; i++) re[i] = signal[i];

    this._fft(re, im);

    for (let k = 0; k < nfft; k++) {
      const f  = k * this.fs / nfft;
      const fm = (nfft - k) * this.fs / nfft;
      if (!((f >= fLow && f <= fHigh) || (fm >= fLow && fm <= fHigh))) {
        re[k] = 0; im[k] = 0;
      }
    }

    // IFFT via conjugate trick
    for (let i = 0; i < nfft; i++) im[i] = -im[i];
    this._fft(re, im);
    const out = new Array(n);
    for (let i = 0; i < n; i++) out[i] = re[i] / nfft;
    return out;
  }

  // ── 4. Welch periodogram — multi-peak, prior-guided selection ─────
  //
  // segLen reduced from 512 → 256 so the first quality estimate arrives
  // after ~9 s instead of ~17 s (512 samples at 30 fps).  Parabolic
  // interpolation preserves sub-bin accuracy despite coarser resolution.
  //
  // Freq resolution: 30/256 ≈ 0.117 Hz ≈ 7 BPM per raw bin.
  // Parabolic interpolation brings effective accuracy to ~0.5–1 BPM.
  _welchBPM(signal) {
    const n      = signal.length;
    const segLen = 256;
    const step   = 64;     // 75% overlap

    if (n < segLen) return { bpm: this._emaBPM, quality: 0 };

    // Hann window
    const hann = new Float64Array(segLen);
    for (let i = 0; i < segLen; i++) hann[i] = 0.5 * (1 - Math.cos(2*Math.PI*i/(segLen-1)));

    const psd  = new Float64Array(segLen);
    let   nSeg = 0;

    // Most-recent segments first (freshest signal = highest quality)
    for (let s = n - segLen; s >= 0 && nSeg < 8; s -= step) {
      const re = new Float64Array(segLen);
      const im = new Float64Array(segLen);
      for (let i = 0; i < segLen; i++) re[i] = signal[s + i] * hann[i];
      this._fft(re, im);
      for (let k = 0; k < segLen/2; k++) psd[k] += re[k]**2 + im[k]**2;
      nSeg++;
    }

    if (nSeg === 0) return { bpm: this._emaBPM, quality: 0 };
    for (let k = 0; k < segLen/2; k++) psd[k] /= nSeg;

    // Collect band statistics
    let totalP = 0, bandBins = 0;
    const kLow  = Math.ceil(0.75 * segLen / this.fs);
    const kHigh = Math.floor(3.0  * segLen / this.fs);
    for (let k = kLow; k <= kHigh && k < segLen/2; k++) {
      totalP += psd[k]; bandBins++;
    }
    if (bandBins === 0) return { bpm: this._emaBPM, quality: 0 };
    const meanBandP = totalP / bandBins;

    // ── Find top-5 local maxima in cardiac band ──────────────
    // A local max must be larger than both neighbours and above 10% of global peak in band.
    let globalPeak = 0;
    for (let k = kLow; k <= kHigh && k < segLen/2; k++) {
      if (psd[k] > globalPeak) globalPeak = psd[k];
    }

    const localMaxima = [];
    for (let k = kLow + 1; k < kHigh && k < segLen/2 - 1; k++) {
      if (psd[k] > psd[k-1] && psd[k] > psd[k+1] && psd[k] > globalPeak * 0.10) {
        localMaxima.push(k);
      }
    }

    if (localMaxima.length === 0) return { bpm: this._emaBPM, quality: 0 };

    // Keep top 5 by power
    localMaxima.sort((a, b) => psd[b] - psd[a]);
    const candidates = localMaxima.slice(0, 5);

    // ── Score each candidate ──────────────────────────────────
    const priorBPM = this._emaBPM;
    const sigma    = 20;  // BPM — physiological drift window

    let bestScore = -1, bestK = -1;
    for (const k of candidates) {
      // Parabolic interpolation for sub-bin precision
      const p0 = psd[k - 1], p1 = psd[k], p2 = (k + 1 < segLen/2) ? psd[k + 1] : 0;
      const denom = p0 - 2*p1 + p2;
      const delta = denom !== 0 ? 0.5 * (p0 - p2) / denom : 0;
      const rk    = k + Math.max(-0.5, Math.min(0.5, delta));
      const cBPM  = rk * this.fs / segLen * 60;

      // Harmonic factor: look for 2×f₀ or ½×f₀ peaks in PSD
      let harmonicFactor = 1.0;
      const k2   = Math.round(rk * 2);
      const kHlf = Math.round(rk * 0.5);
      if (k2 > 0 && k2 < segLen/2 && psd[k2] > psd[k] * 0.08)   harmonicFactor = 1.6;
      if (kHlf > 0 && kHlf < segLen/2 && psd[kHlf] > psd[k] * 0.08) harmonicFactor = Math.max(harmonicFactor, 1.3);

      // Gaussian prior: always applied — keeps the picker away from harmonic
      // artefacts (e.g. 125 BPM when true HR is 70) from the very first window.
      // Before the EMA is seeded we use a wider sigma (35 BPM) so it guides
      // without over-constraining; once seeded, sigma tightens to 20 BPM.
      const priorSigma    = this._emaSeeded ? sigma : 35;
      const priorGaussian = Math.exp(-0.5 * ((cBPM - priorBPM) / priorSigma) ** 2);

      const score = psd[k] * harmonicFactor * priorGaussian;
      if (score > bestScore) { bestScore = score; bestK = k; }
    }

    if (bestK < 1) return { bpm: this._emaBPM, quality: 0 };

    // Final parabolic interpolation on chosen peak
    const p0f = psd[bestK - 1], p1f = psd[bestK], p2f = (bestK + 1 < segLen/2) ? psd[bestK + 1] : 0;
    const denomF = p0f - 2*p1f + p2f;
    const deltaF = denomF !== 0 ? 0.5 * (p0f - p2f) / denomF : 0;
    const refinedK = bestK + Math.max(-0.5, Math.min(0.5, deltaF));
    const rawBPM   = refinedK * this.fs / segLen * 60;

    // Harmonic verification for quality boost
    let harmonicBoost = 0;
    const k2q = Math.round(refinedK * 2);
    if (k2q < segLen/2 && psd[k2q] > p1f * 0.08) harmonicBoost = 0.18;

    // SNR quality — divisor 6 (was 12, which was too strict for real webcam/phone SNR).
    // Typical good face rPPG SNR is 4–8; divisor 6 maps that to quality 0.67–1.0 (green).
    // Red (<0.3) now requires SNR < 1.8 — genuinely unusable signal.
    const snr     = meanBandP > 0 ? p1f / meanBandP : 0;
    const quality = Math.min(1, (snr / 6) + harmonicBoost);

    return { bpm: rawBPM, quality };
  }

  // ── 5. Cooley-Tukey in-place FFT ──────────────────────────
  _fft(re, im) {
    const n = re.length;
    let j = 0;
    for (let i = 1; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        [re[i], re[j]] = [re[j], re[i]];
        [im[i], im[j]] = [im[j], im[i]];
      }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = -2 * Math.PI / len;
      const wR = Math.cos(ang), wI = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cR = 1, cI = 0;
        for (let k = 0; k < len / 2; k++) {
          const uR = re[i+k], uI = im[i+k];
          const vR = re[i+k+len/2]*cR - im[i+k+len/2]*cI;
          const vI = re[i+k+len/2]*cI + im[i+k+len/2]*cR;
          re[i+k]         = uR + vR; im[i+k]         = uI + vI;
          re[i+k+len/2]   = uR - vR; im[i+k+len/2]   = uI - vI;
          [cR, cI] = [cR*wR - cI*wI, cR*wI + cI*wR];
        }
      }
    }
  }

  // ── 6. HRV — time-domain RMSSD from IBI detection ─────────
  //
  // Two modes:
  //   finger: threshold 20% of peak (clean high-SNR torch signal).
  //           Requires ≥4 detected peaks. RMSSD capped 8–150 ms.
  //   face:   threshold 28% of peak (noisier reflected-light signal).
  //           Requires ≥3 detected peaks. RMSSD capped 8–120 ms.
  //
  // Note: 30fps gives ±33ms IBI quantisation. Finger HRV is reliable for
  // direction / trend; absolute RMSSD values have ~10–15ms uncertainty.
  // At 30fps you need ≥45s to accumulate enough IBIs for stable RMSSD.
  _computeHRV(filteredSig, bpmGuess) {
    const isFinger = this.mode === 'finger';
    const minDist  = Math.max(5, Math.round(this.fs * 55 / bpmGuess));
    const thr_pct  = isFinger ? 0.20 : 0.28;   // lower threshold = more sensitive peaks
    const minPeaks = isFinger ? 4   : 3;

    const tryDir = (s) => {
      const mx = s.reduce((a, v) => a > v ? a : v, -Infinity);
      if (mx < 1e-6) return null;
      const thr = thr_pct * mx;
      const pk  = [];
      for (let i = minDist; i < s.length - minDist; i++) {
        if (s[i] < thr) continue;
        let ok = true;
        for (let k = i - minDist; k <= i + minDist; k++) {
          if (k !== i && s[k] >= s[i]) { ok = false; break; }
        }
        if (ok) pk.push(i);
      }
      if (pk.length < minPeaks) return null;
      const ibis = pk.slice(1).map((p, i) => (p - pk[i]) / this.fs * 1000);
      const avg  = this._mean(ibis);
      if (60000/avg < bpmGuess * 0.70 || 60000/avg > bpmGuess * 1.30) return null;
      return ibis;
    };

    const ibis = tryDir(filteredSig) ?? tryDir(filteredSig.map(v => -v));
    if (!ibis || ibis.length < 2) return null;

    const diffs = ibis.slice(1).map((v, i) => v - ibis[i]);
    const rmssd = Math.sqrt(this._mean(diffs.map(d => d * d)));
    const cap   = isFinger ? 150 : 120;
    return Math.max(8, Math.min(cap, Math.round(rmssd)));
  }

  // ── 6b. Autocorrelation BPM — secondary estimate for dual-method validation ─
  //
  // Replaces threshold-based peak detection which was systematically detecting
  // at half the true HR due to respiratory amplitude modulation.
  //
  // Autocorrelation finds the dominant PERIOD of the signal regardless of
  // amplitude — a signal that alternates strong/weak beats still autocorrelates
  // strongly at the heartbeat period, whereas a threshold detector skips the
  // weak beats and reports half the rate.
  //
  // Algorithm: normalised autocorrelation over lags 40–180 BPM range,
  // pick the lag with highest correlation, require correlation > 0.30.
  // O(n × 35) ≈ 9,500 ops — fast enough per estimate cycle.
  _autocorrBPM(signal, bpmGuess) {
    if (!bpmGuess || bpmGuess < 30 || signal.length < 60) return null;

    // Detrend
    const mean = this._mean(signal);
    const s    = signal.map(v => v - mean);

    // Zero-lag variance (normalisation denominator)
    const var0 = s.reduce((a, v) => a + v * v, 0) / s.length;
    if (var0 < 1e-12) return null;

    // Lag range corresponding to 40–180 BPM
    const lagMin = Math.max(1, Math.round(this.fs * 60 / 180));
    const lagMax = Math.min(Math.round(this.fs * 60 / 40), Math.floor(s.length / 2));

    let bestLag = -1, bestCorr = -Infinity;
    for (let lag = lagMin; lag <= lagMax; lag++) {
      let corr = 0;
      const len = s.length - lag;
      for (let i = 0; i < len; i++) corr += s[i] * s[i + lag];
      corr /= len * var0;   // normalise to [-1, 1]
      if (corr > bestCorr) { bestCorr = corr; bestLag = lag; }
    }

    // Reject weak correlations — signal too noisy to determine period
    if (bestLag < 0 || bestCorr < 0.25) return null;

    const acBPM = this.fs * 60 / bestLag;
    // Plausibility: within 35% of FFT estimate
    if (Math.abs(acBPM - bpmGuess) > bpmGuess * 0.35) return null;
    return acBPM;
  }

  // ── 7. SpO₂ ───────────────────────────────────────────────
  //
  // TWO separate methods depending on mode:
  //
  // FINGER (reliable):
  //   Beer-Lambert ratio using BANDPASS AC components of red vs green.
  //   With torch illumination + contact, SNR is ~10× better than face.
  //   R = (AC_red/DC_red) / (AC_green/DC_green)
  //   Green acts as pseudo-reference (analogous to 940nm IR in hardware oximeters).
  //   Literature calibration: SpO₂ ≈ 109 − 22·R for smartphone contact PPG.
  //   Accuracy: ±1–2% in 94–100% range under good conditions.
  //
  // FACE (estimate only):
  //   Low-SNR reflected light — good enough for direction/trend, not clinical values.
  //   Still returned so the UI can show something, but flagged internally.
  //
  _computeSpO2(buf) {
    if (this.mode === 'finger') {
      return this._computeFingerSpO2(buf);
    }
    return this._computeFaceSpO2(buf);
  }

  // Contact finger PPG SpO₂ — reliable with torch
  _computeFingerSpO2(buf) {
    // Need ≥15 s for stable AC/DC ratio
    if (buf.length < this.fs * 15) return null;

    const reds   = buf.map(x => x.r);
    const greens = buf.map(x => x.g);

    const dcR = this._mean(reds);
    const dcG = this._mean(greens);
    if (dcR < 20 || dcG < 20) return null;   // underexposed
    if (dcR > 248)             return null;   // overexposed / saturated

    // AC: std of bandpass-filtered cardiac component (0.75–3.0 Hz)
    // Using bandpass removes DC drift, breathing-rate baseline wander, and 50/60 Hz flicker.
    const acR = this._std(this._bandpass(reds,   0.75, 3.0));
    const acG = this._std(this._bandpass(greens, 0.75, 3.0));
    if (acR < 0.005 || acG < 0.005) return null;

    // Perfusion index gate — if the pulsatile component is too weak, finger
    // isn't covering the lens properly or torch isn't on.
    // Without torch the signal is weaker, so we accept a slightly lower PI threshold
    // (0.001 vs 0.002) — this still filters noise but allows no-torch readings through.
    const pi = acR / dcR;
    const piThreshold = this.torchActive ? 0.002 : 0.001;
    if (pi < piThreshold) return null;

    // Beer-Lambert R ratio
    const R = (acR / dcR) / (acG / dcG);

    // Empirical calibration for red/green on smartphone (Scully et al. 2012,
    // adjusted for modern CMOS sensors). Melanin correction via Fitzpatrick scale.
    const st        = this._st ?? this.fitzpatrick ?? 3;
    const intercept = 109 + (st - 3) * 0.4;   // slight upward shift for darker skin
    const slope     = 22  - (st - 3) * 0.3;
    const spo2      = Math.round(intercept - slope * R);

    // Only return values in the physiologically plausible range
    if (spo2 < 88 || spo2 > 100) return null;
    return spo2;
  }

  // Reflected-light face SpO₂ — low confidence, directional only
  _computeFaceSpO2(buf) {
    const reds  = buf.map(x => x.r);
    const blues = buf.map(x => x.b);
    const dcR   = this._mean(reds);
    const dcB   = this._mean(blues);
    if (dcR < 10 || dcB < 10) return null;
    const acR = this._std(reds);
    const acB = this._std(blues);
    if (acB < 1e-6) return null;
    const R         = (acR / dcR) / (acB / dcB);
    const st        = this._st ?? this.fitzpatrick ?? 3;
    const intercept = 110 + st * 4;
    const slope     = 25  - st * 6;
    return Math.max(90, Math.min(100, Math.round(intercept - slope * R)));
  }

  // ── 8. Breathing rate ─────────────────────────────────────
  _breathingRate(buf) {
    const green = buf.map(x => x.g);
    const n     = green.length;
    const nfft  = Math.pow(2, Math.ceil(Math.log2(n)));
    const re    = new Float64Array(nfft);
    const im    = new Float64Array(nfft);
    for (let i = 0; i < n; i++) re[i] = green[i];
    this._fft(re, im);

    let bestBRPM = this._emaBRPM, bestP = 0;
    for (let k = 1; k < nfft/2; k++) {
      const f = k * this.fs / nfft;
      if (f < 0.15 || f > 0.50) continue;
      const p = re[k]**2 + im[k]**2;
      if (p > bestP) { bestP = p; bestBRPM = Math.round(f * 60); }
    }
    return bestBRPM;
  }

  // ── Snapshot: export / replay 30 s of raw buffer ─────────
  //
  // getSnapshot() — call after scan completes.
  // Returns a compact object you can JSON.stringify and store or POST to the server.
  // Format: { fs, fitzpatrick, deviceType, mode, t0, samples: [[r,g,b], ...] }
  // Timestamps are stored as deltas (ms since first sample) to save space.
  // A 30-s buffer at 30 fps ≈ 900 samples × 3 channels × 2 bytes ≈ ~5 KB as JSON.
  getSnapshot() {
    if (this.buffer.length === 0) return null;
    const t0 = this.buffer[0].t;
    return {
      fs:          this.fs,
      fitzpatrick: this.fitzpatrick,
      deviceType:  this.deviceType,
      mode:        this.mode,
      t0,
      samples: this.buffer.map(s => [
        Math.round(s.r * 10) / 10,   // 1 decimal place — sufficient for rPPG
        Math.round(s.g * 10) / 10,
        Math.round(s.b * 10) / 10,
        Math.round(s.t - t0),         // ms offset (uint16 range for 30 s)
      ]),
      // Include final estimates so the snapshot is self-contained
      result: {
        bpm:     this.bpm,
        hrv_ms:  this.hrv_ms,
        spo2:    this.spo2,
        brpm:    this.brpm,
        quality: Math.round(this.quality * 100) / 100,
      },
    };
  }

  // loadSnapshot(snap, opts) — re-runs the full pipeline on a stored snapshot.
  // Useful for server-side reprocessing or offline A/B testing.
  //
  // opts.algo: 'pos' (default) | 'chrom'  — which extraction algorithm to use
  //
  // Example — compare POS vs CHROM on Krithika's bad recording:
  //   const est = new RPPGEstimator(video);
  //   const pos  = est.loadSnapshot(window._faceSnapshot, { algo: 'pos'  });
  //   const chrom = est.loadSnapshot(window._faceSnapshot, { algo: 'chrom' });
  //   console.log('POS:', pos.bpm, '  CHROM:', chrom.bpm);
  loadSnapshot(snap, opts = {}) {
    const algo = opts.algo ?? 'pos';

    // Restore config from snapshot
    this.fs          = snap.fs          ?? this.fs;
    this.fitzpatrick = snap.fitzpatrick ?? this.fitzpatrick;
    this.deviceType  = snap.deviceType  ?? this.deviceType;
    this.mode        = snap.mode        ?? this.mode;

    // Rebuild buffer
    this.buffer = snap.samples.map(([r, g, b, dt]) => ({
      t: snap.t0 + (dt ?? 0), r, g, b,
    }));

    // Reset all state so replay is clean
    this._emaBPM     = 75;
    this._emaHRV     = 45;
    this._emaSPO2    = 98;
    this._emaBRPM    = 15;
    this._emaSeeded  = false;
    this._estCount   = 0;
    this._bpmHistory = [];
    this.confidence  = 'low';

    // Temporarily override extraction method if requested
    const origPos  = this._posWindowed.bind(this);
    const origChrm = this._chromWindowed.bind(this);
    if (algo === 'chrom') this._posWindowed = origChrm;

    this._estimate();

    // Restore
    this._posWindowed = origPos;

    return {
      bpm:     this.bpm,
      hrv_ms:  this.hrv_ms,
      spo2:    this.spo2,
      brpm:    this.brpm,
      quality: this.quality,
      algo,
    };
  }

  // ── helpers ───────────────────────────────────────────────
  _std(a) {
    const m = this._mean(a);
    return Math.sqrt(a.reduce((s, v) => s + (v-m)**2, 0) / a.length);
  }
  _mean(a) { return a.reduce((s, v) => s + v, 0) / a.length; }

  // ── 9. Main estimate — overlapping windows, median BPM, confidence ──────────
  //
  // Each call processes the most recent 30 s of buffer (or whatever is available)
  // and produces ONE window estimate. Accepted estimates accumulate in _bpmHistory.
  // The published this.bpm is the median of the last 8 history entries — far more
  // robust than EMA for users with very high or very low resting HR.
  //
  // Rejection gates (applied per window, not per frame):
  //   Jump gate : |this_bpm - prev_accepted| > 5 BPM after ≥3 history entries
  //   Finger    : |FFT_bpm - peak_bpm| >= 3 BPM (dual-method disagreement)
  //
  // Confidence (exposed for hybrid flow in main.js):
  //   'high'   : quality > 0.65, window SD < 2, motionRate < 0.15
  //   'medium' : quality > 0.35, window SD < 4
  //   'low'    : else
  _estimate() {
    if (this.buffer.length < this.fs * 9) return;

    // ── Step 1: extract raw signal ───────────────────────────
    let rawSignal;
    if (this.mode === 'finger') {
      // Red channel only — most responsive to arterial pulsation under torch
      rawSignal = this.buffer.map(s => s.r);
    } else {
      // POS (Wang 2017) for face — multi-ROI, motion-robust
      rawSignal = this._posWindowed(this.buffer);
      if (rawSignal.length < 256) return;
    }

    // ── Step 2: bandpass 0.75–3.0 Hz (45–180 BPM) ───────────
    const filtered = this._bandpass(rawSignal, 0.75, 3.0);
    // Store the most recent clean signal for cardiac signature generation
    this.lastFilteredSignal = filtered.slice(-256);

    // ── Step 3: Welch FFT BPM ────────────────────────────────
    const { bpm: fftBPM, quality } = this._welchBPM(filtered);
    this.quality = quality;
    if (quality === 0) {
      // Still fire onUpdate so the HUD shows "Weak signal" and lastVitals gets written
      if (this.onUpdate) this.onUpdate(this.bpm, this.hrv_ms, this.spo2, this.brpm, 0);
      return;
    }

    // ── Step 4: autocorrelation BPM cross-validation ─────────
    // Autocorrelation is robust to respiratory amplitude modulation that caused
    // the old peak-to-peak detector to report half the true HR consistently.
    const acBPM    = this._autocorrBPM(filtered, fftBPM);
    const agreement = acBPM !== null ? Math.abs(fftBPM - acBPM) : 999;

    // ── Step 5: finger dual-method gate ─────────────────────
    // With torch (high SNR): require FFT and autocorr to agree within 8 BPM.
    // Without torch (iOS PWA — torch API unsupported): torch-less signal is
    // noisy but still measurable; accept FFT alone when quality ≥ 0.25.
    // Autocorr is still used as a soft blend when available.
    let windowBPM = fftBPM;
    if (this.mode === 'finger') {
      if (this.torchActive) {
        // ── Torch ON: strict dual-method agreement required ──
        if (acBPM === null || agreement >= 8) {
          if (!this._emaSeeded && quality > 0.25) { this._emaBPM = fftBPM; this._emaSeeded = true; }
          else if (quality > 0.15) { this._emaBPM = this._emaBPM * 0.90 + fftBPM * 0.10; }
          const acStr = acBPM != null ? Math.round(acBPM) : '?';
          console.log(`[rPPG finger+torch] dual-method disagree ${Math.round(fftBPM)}↔${acStr} BPM — window rejected`);
          return;
        }
        windowBPM = (fftBPM + acBPM) / 2; // average for precision when both agree
      } else {
        // ── Torch OFF (iOS/unsupported): FFT-only, quality gate ──
        if (quality < 0.25) {
          if (quality > 0.10) { this._emaBPM = this._emaBPM * 0.95 + fftBPM * 0.05; }
          console.log(`[rPPG finger-notorch] quality ${Math.round(quality*100)}% too low — window skipped`);
          return;
        }
        // Soft-blend autocorr when it's available and plausible
        if (acBPM !== null && agreement < 15) {
          windowBPM = fftBPM * 0.65 + acBPM * 0.35;
        }
        console.log(`[rPPG finger-notorch] FFT=${Math.round(fftBPM)} Q=${Math.round(quality*100)}%`);
      }
    }

    // ── Step 6: jump gate ────────────────────────────────────
    // Applied only once we have ≥3 history entries (allow initial convergence).
    // Compare against the MEDIAN of current history (not the last entry) — a single
    // outlier that slipped through shouldn't permanently block all future windows.
    // Threshold raised from 5→10 BPM: 5 was too strict for normal HR variability
    // across 1.5-second overlapping windows.
    if (this._bpmHistory.length >= 3) {
      const histMedian = [...this._bpmHistory].sort((a, b) => a - b)[Math.floor(this._bpmHistory.length / 2)];
      const jump = Math.abs(windowBPM - histMedian);
      if (jump > 10) {
        this._emaBPM = this._emaBPM * 0.90 + windowBPM * 0.10;
        console.log(`[rPPG ${this.mode}] jump gate: median=${Math.round(histMedian)}->${Math.round(windowBPM)} BPM (${Math.round(jump)} > 10) — rejected`);
        return;
      }
    }

    // ── Step 7: accept window, update history ────────────────
    this._bpmHistory.push(windowBPM);
    if (this._bpmHistory.length > 10) this._bpmHistory.shift();

    // Update internal EMA prior for Welch peak selection in next window
    if (!this._emaSeeded && quality > 0.25) {
      this._emaBPM    = windowBPM;
      this._emaSeeded = true;
    } else {
      const alpha = quality > 0.6 ? 0.42 : quality > 0.35 ? 0.28 : 0.10;
      const delta = Math.abs(windowBPM - this._emaBPM);
      const w     = delta > 25 ? 0.10 : alpha;
      this._emaBPM = this._emaBPM * (1 - w) + windowBPM * w;
    }
    this._estCount++;

    // ── Step 8: median output BPM ────────────────────────────
    const sorted = [...this._bpmHistory].sort((a, b) => a - b);
    const med    = sorted[Math.floor(sorted.length / 2)];
    this.bpm = Math.round(Math.max(40, Math.min(220, med)));

    // ── Step 9: window SD (stability metric for confidence) ──
    const windowSD = this._bpmHistory.length >= 3
      ? this._std(this._bpmHistory)
      : 99;

    // ── Step 10: confidence scoring ──────────────────────────
    const agreeOK = this.mode === 'finger' ? agreement < 8 : true; // face: trust FFT alone
    if (quality > 0.65 && windowSD < 2 && this.motionRate < 0.15 && agreeOK) {
      this.confidence = 'high';
    } else if (quality > 0.35 && windowSD < 4) {
      this.confidence = 'medium';
    } else {
      this.confidence = 'low';
    }

    // Track best sustained confidence (≥2 consecutive windows) so one bad
    // end-window doesn't undo what was a genuinely high-quality scan.
    if (this.confidence === 'high') {
      this._peakConfHiStreak++;
      this._peakConfMedStreak = 0;
      if (this._peakConfHiStreak >= 2) this._peakConfidence = 'high';
    } else if (this.confidence === 'medium') {
      this._peakConfMedStreak++;
      this._peakConfHiStreak = 0;
      if (this._peakConfMedStreak >= 2 && this._peakConfidence === 'low') this._peakConfidence = 'medium';
    } else {
      this._peakConfHiStreak  = 0;
      this._peakConfMedStreak = 0;
    }

    // ── Step 11: HRV ─────────────────────────────────────────
    // Finger: lower quality gate (clean signal) + larger EMA alpha per update.
    // Face: higher gate (noisy) + smaller alpha (more smoothing needed).
    const hqThresh = this.mode === 'finger' ? 0.20 : 0.28;
    if (quality > hqThresh) {
      const rmssd = this._computeHRV(filtered, this.bpm);
      if (rmssd !== null) {
        const hAlpha = this.mode === 'finger' ? 0.35 : 0.25;
        this._emaHRV = this._emaHRV * (1 - hAlpha) + rmssd * hAlpha;
        this.hrv_ms  = Math.round(this._emaHRV);
      }
    }

    // ── Step 12: SpO₂ ────────────────────────────────────────
    // Finger uses the reliable AC/DC ratio (bandpass red/green).
    // Larger alpha = trust each finger estimate more; smaller for face.
    const rawSPO2 = this._computeSpO2(this.buffer);
    if (rawSPO2 !== null) {
      const sAlpha = this.mode === 'finger' ? 0.18 : 0.12;
      this._emaSPO2 = this._emaSPO2 * (1 - sAlpha) + rawSPO2 * sAlpha;
      this.spo2 = Math.round(this._emaSPO2);
    }

    // ── Step 13: breathing rate (needs ≥15 s) ────────────────
    if (this.buffer.length >= this.fs * 15) {
      const rawBRPM = this._breathingRate(this.buffer);
      this._emaBRPM = this._emaBRPM * 0.80 + rawBRPM * 0.20;
      this.brpm = Math.round(Math.max(8, Math.min(30, this._emaBRPM)));
    }

    const pkStr = acBPM != null ? `,ac=${Math.round(acBPM)}` : '';
    console.log(
      `[rPPG ${this.mode}] BPM=${this.bpm} (fft=${Math.round(fftBPM)}${pkStr})  ` +
      `Q=${Math.round(quality*100)}%  conf=${this.confidence}  SD=${Math.round(windowSD*10)/10}  ` +
      `motion=${Math.round(this.motionRate*100)}%rej  hist=${this._bpmHistory.length}`
    );

    if (this.onUpdate) this.onUpdate(this.bpm, this.hrv_ms, this.spo2, this.brpm, quality);
  }
}
