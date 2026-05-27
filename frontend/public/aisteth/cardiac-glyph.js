// cardiac-glyph.js — Cardiac Signature generator
//
// Produces a unique, deterministic biometric glyph from:
//   • PPG waveform morphology (actual pulse shape — person-specific)
//   • Heart rate (BPM) — controls ridge harmonic frequency
//   • HRV (ms) — controls organic waviness and ring count
//   • SpO₂ (%) — drives colour palette
//   • Breathing rate (br) — encodes outer segmentation
//   • Heart size (fistCm) — sets inner radius
//
// The same biometric data always produces the same glyph.
// Different people → different waveform shapes → different glyphs.
// Changed physiology (stress, fitness, illness) → subtly different glyphs.
// This is the "cardiac fingerprint": no hardware needed.

// ── Seeded LCG RNG ────────────────────────────────────────
// Park-Miller LCG — reproducible across all platforms.
function SeededRng(seed) {
  let s = (Math.abs(Math.round(seed)) % 2147483647) || 1337;
  return {
    next()            { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; },
    range(lo, hi)     { return lo + this.next() * (hi - lo); },
    int(lo, hi)       { return Math.floor(this.range(lo, hi + 1)); },
  };
}

// ── Compute deterministic seed from biometric values ──────
function biometricSeed({ bpm, hrv, spo2, br, fistCm }) {
  return (
    Math.round(bpm)       * 131071 +
    Math.round(hrv)       * 8191   +
    Math.round(spo2)      * 4093   +
    Math.round(br)        * 257    +
    Math.round(fistCm * 10) * 17
  );
}

// ── Extract 32-point waveform fingerprint ─────────────────
// Downsamples the last N samples of the filtered PPG signal to 32 points,
// normalized to [-1, 1]. These 32 points encode the person-specific pulse
// morphology: systolic rise, reflected wave timing, dicrotic notch depth.
export function extractWaveformFeatures(filteredSignal) {
  if (!filteredSignal || filteredSignal.length < 64) return null;
  const n    = filteredSignal.length;
  const step = n / 32;
  const pts  = Array.from({ length: 32 }, (_, i) => filteredSignal[Math.floor(i * step)]);
  const mn   = Math.min(...pts);
  const mx   = Math.max(...pts);
  const rng  = mx - mn;
  if (rng < 1e-9) return null;
  return pts.map(v => (v - mn) / rng * 2 - 1);   // normalised to [-1, 1]
}

// ── Main renderer ─────────────────────────────────────────
// Returns a { meta } object needed by pulseGlyph() and the history panel.
//
// params: { bpm, hrv, spo2, br, fistCm, waveform: float[]|null }
// canvas: square HTMLCanvasElement (caller sets size)
export function renderCardiacGlyph(canvas, params) {
  const {
    bpm     = 72,
    hrv     = 42,
    spo2    = 98,
    br      = 15,
    fistCm  = 8.5,
    waveform = null,
  } = params;

  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2;
  ctx.clearRect(0, 0, W, H);

  const rng  = SeededRng(biometricSeed({ bpm, hrv, spo2, br, fistCm }));

  // ── Colour palette ────────────────────────────────────
  // SpO₂ ≥99% → vivid emerald (hue ~158°)
  // SpO₂  95% → cyan-emerald (hue ~178°)
  // SpO₂  <95% → warning amber
  const hue = spo2 >= 95
    ? 158 + Math.max(0, 99 - spo2) * 5
    : 38 + (spo2 - 88) * 10;
  const sat = spo2 >= 95
    ? 76 + Math.min(spo2 - 95, 4) * 3
    : 60;
  const lum = 56;

  // ── Sizing ────────────────────────────────────────────
  const baseR = Math.min(W, H) * 0.115 * (fistCm / 8.5);   // heart size → inner radius
  const maxR  = Math.min(W, H) * 0.445;

  // Fingerprint rings: more rings = more HRV (more organic / alive-feeling)
  const numRings = Math.max(6, Math.min(16, Math.round(5 + hrv / 4.5)));

  // ── Background aura ───────────────────────────────────
  {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR * 0.75);
    g.addColorStop(0,   `hsla(${hue},${sat}%,22%,0.20)`);
    g.addColorStop(0.6, `hsla(${hue},${sat}%,12%,0.08)`);
    g.addColorStop(1,   'transparent');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // ── Innermost ring: actual PPG waveform (person-specific) ─
  // The waveform is plotted in polar coords with 4-fold symmetry,
  // creating a unique "petal" pattern that encodes pulse morphology.
  if (waveform && waveform.length === 32) {
    const wRad  = baseR * 2.2;
    const wAmp  = baseR * 0.40;
    const folds = 4;  // 4-fold symmetry

    ctx.save();
    ctx.shadowColor = `hsla(${hue},${sat}%,72%,0.65)`;
    ctx.shadowBlur  = 12;
    ctx.strokeStyle = `hsla(${hue},${sat}%,78%,0.92)`;
    ctx.lineWidth   = 2.2;
    ctx.beginPath();

    let first = true;
    for (let fold = 0; fold < folds; fold++) {
      for (let i = 0; i <= 32; i++) {
        const idx   = i % 32;
        const theta = ((fold * 32 + i) / (32 * folds)) * Math.PI * 2 - Math.PI / 2;
        const r     = wRad + waveform[idx] * wAmp;
        const x     = cx + Math.cos(theta) * r;
        const y     = cy + Math.sin(theta) * r;
        first ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        first = false;
      }
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  // ── Fingerprint rings ─────────────────────────────────
  // Each ring is a closed polar curve with overlapping sine harmonics.
  // The harmonic frequencies are driven by BPM so different heart rates
  // produce structurally distinct ridge patterns.
  const ringSpan = maxR - baseR * 2.8;
  const ringStep = ringSpan / numRings;

  for (let ri = 0; ri < numRings; ri++) {
    const r = baseR * 2.8 + ri * ringStep;

    // Primary harmonic: frequency rises with BPM (faster heart → tighter ridges)
    const f1  = Math.round(bpm / 16) + ri;
    const f2  = Math.round(bpm / 9)  + ri;
    const p1  = rng.next() * Math.PI * 2;
    const p2  = rng.next() * Math.PI * 2;
    const p3  = rng.next() * Math.PI * 2;

    // Amplitude shrinks toward outer rings; HRV scales how wild the ridges are
    const amp = ringStep * 0.35 * (hrv / 45) * Math.max(0.3, 1 - ri / numRings * 0.65);

    const alpha = 0.82 - ri * (0.48 / numRings);
    const lw    = Math.max(0.5, 1.9 - ri * (1.1 / numRings));
    const steps = 600;

    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const theta   = (i / steps) * Math.PI * 2;
      const distort =
        Math.sin(theta * f1 + p1) * 1.0 * amp +
        Math.sin(theta * f2 + p2) * 0.38 * amp +
        Math.sin(theta * 3  + p3) * 0.15 * amp;
      const rr = r + distort;
      const x  = cx + Math.cos(theta) * rr;
      const y  = cy + Math.sin(theta) * rr;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();

    if (ri === 0) {
      ctx.shadowColor = `hsla(${hue},${sat}%,65%,0.4)`;
      ctx.shadowBlur  = 8;
    }
    ctx.strokeStyle = `hsla(${hue},${Math.max(40, sat - ri * 2)}%,${Math.max(38, lum - ri * 1.5)}%,${alpha.toFixed(3)})`;
    ctx.lineWidth   = lw;
    ctx.stroke();
    ctx.shadowBlur  = 0;
  }

  // ── Breathing rate arc segments (outermost orbit) ────
  // Number of arcs encodes breathing rate. A slow breather has wider, fewer arcs.
  {
    const brR      = maxR * 0.96;
    const segments = Math.max(4, Math.round(br * 1.8));
    const arcStep  = (Math.PI * 2) / segments;
    for (let s = 0; s < segments; s++) {
      const startA = s * arcStep + rng.next() * 0.04;
      const endA   = startA + arcStep * 0.55;
      ctx.beginPath();
      ctx.arc(cx, cy, brR, startA, endA);
      ctx.strokeStyle = `hsla(${hue + 15},${Math.max(40, sat - 18)}%,68%,0.32)`;
      ctx.lineWidth   = 1.1;
      ctx.stroke();
    }
  }

  // ── Beat markers — dots around outer edge ─────────────
  // Count encodes BPM decade. Each dot is placed slightly uniquely per person.
  {
    const dotCount = Math.round(bpm / 9);
    const dotR     = maxR * 1.01;
    for (let i = 0; i < dotCount; i++) {
      const theta = (i / dotCount) * Math.PI * 2 + rng.range(-0.08, 0.08);
      const x = cx + Math.cos(theta) * dotR;
      const y = cy + Math.sin(theta) * dotR;
      ctx.beginPath();
      ctx.arc(x, y, 2.4, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${hue},${sat}%,80%,0.82)`;
      ctx.fill();
    }
  }

  // ── Centre orb — glows where the heart sits ───────────
  {
    const og = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseR * 1.4);
    og.addColorStop(0,   `hsla(${hue},${sat}%,78%,0.80)`);
    og.addColorStop(0.55,`hsla(${hue},${sat}%,48%,0.40)`);
    og.addColorStop(1,   'transparent');
    ctx.fillStyle = og;
    ctx.beginPath();
    ctx.arc(cx, cy, baseR * 1.4, 0, Math.PI * 2);
    ctx.fill();
  }

  return { hue, sat, baseR, maxR, numRings };
}

// ── Beat pulse animation ──────────────────────────────────
// Call once on each heartbeat. Draws an expanding ring on the glyph canvas.
export function pulseGlyph(canvas, meta) {
  if (!meta) return;
  const { hue, sat, baseR } = meta;
  const ctx = canvas.getContext('2d');
  const cx  = canvas.width / 2, cy = canvas.height / 2;
  let r = baseR * 1.5, alpha = 0.55;

  function step() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = `hsla(${hue},${sat}%,72%,${alpha.toFixed(4)})`;
    ctx.lineWidth   = 2.8;
    ctx.stroke();
    ctx.restore();
    r     *= 1.065;
    alpha *= 0.82;
    if (alpha > 0.005 && r < canvas.width * 0.6) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ── Thumbnail renderer (for history panel) ───────────────
// Renders a small static glyph on a provided canvas element.
export function renderGlyphThumb(canvas, params) {
  return renderCardiacGlyph(canvas, params);
}
