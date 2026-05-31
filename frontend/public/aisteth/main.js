// Somatic Scanner (lean) — replaces the legacy clinical AiSteth main.js.
// Reuses the validated rPPG / heartbeat / hand-track modules but renders a
// minimal Somatic-themed scan experience and posts a snapshot to the backend.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HeartBeatScheduler } from './heartbeat.js';
import { RPPGEstimator } from './rppg.js';

// ─────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const PHASE_SECONDS = 20; // each of the two phases (face, finger)

// Pick up the API key that the React app stores in localStorage on boot.
// This lets the static scan page authenticate with the same key as the React client.
const API_KEY = (() => { try { return localStorage.getItem('somatic.apiKey') || ''; } catch { return ''; } })();

function detectDevice() {
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}
const DEVICE = detectDevice();

function setStatus(text) {
  const el = $('status-bar');
  if (!el) return;
  el.textContent = text;
  el.classList.remove('hidden');
}
function hideStatus() { $('status-bar')?.classList.add('hidden'); }

function setStartLabel(text, disabled = false) {
  const btn = $('start-btn');
  const lbl = $('start-btn-label');
  if (lbl) lbl.textContent = text;
  if (btn) btn.disabled = !!disabled;
}

function setQuality(quality) {
  const dot = $('quality-dot');
  const lab = $('quality-label');
  if (!dot || !lab) return;
  dot.classList.remove('strong', 'medium', 'weak');
  if (quality >= 0.66) { dot.classList.add('strong'); lab.textContent = 'Strong signal'; }
  else if (quality >= 0.33) { dot.classList.add('medium'); lab.textContent = 'Fair signal — stay still'; }
  else { dot.classList.add('weak'); lab.textContent = 'Weak signal — adjust lighting'; }
}

// ─────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────
let mode = 'face';           // current camera / rPPG mode
let phase = 'idle';          // 'idle' | 'face' | 'transition' | 'finger' | 'done'
let stream = null;
let videoTrack = null;
let torchActive = false;     // true only when torch was successfully applied
let rppg = null;
let hbSched = new HeartBeatScheduler();
let scanRunning = false;
let scanStartedAt = 0;
let countdownInterval = null;
let lastVitals = { bpm: null, hrv_ms: null, spo2: null, brpm: null, quality: 0 };
let bestVitals = { bpm: null, hrv_ms: null, spo2: null, brpm: null, quality: 0 };
let faceVitals = null;       // locked after face phase completes
let fingerVitals = null;     // locked after finger phase completes
let saving = false;

// ─────────────────────────────────────────────────────────
// Phase step indicator
// ─────────────────────────────────────────────────────────
function setPhaseSteps(ph) {
  const faceStep   = $('step-face');
  const fingerStep = $('step-finger');
  if (!faceStep || !fingerStep) return;
  faceStep.classList.remove('active', 'done');
  fingerStep.classList.remove('active', 'done');
  if (ph === 'face')                          { faceStep.classList.add('active'); }
  else if (ph === 'transition' || ph === 'finger') { faceStep.classList.add('done'); fingerStep.classList.add('active'); }
  else if (ph === 'done')                     { faceStep.classList.add('done'); fingerStep.classList.add('done'); }
}

// ─────────────────────────────────────────────────────────
// 3D heart (rose-glow)
// ─────────────────────────────────────────────────────────
let scene, camera, renderer, heartGroup, aura, mixer, beatAction, raf = 0;

function setupHeartScene() {
  const mount = $('heart-mount');
  if (!mount) return;
  scene = new THREE.Scene();
  scene.background = null;
  camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 3);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const size = mount.clientWidth || 230;
  renderer.setSize(size, size, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  mount.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const key = new THREE.DirectionalLight(0xe8445a, 2.0); key.position.set(1.5, 2, 2); scene.add(key);
  const rim = new THREE.DirectionalLight(0xf5c87a, 0.55); rim.position.set(-1.5, -1, 1.5); scene.add(rim);

  heartGroup = new THREE.Group();
  scene.add(heartGroup);

  // Aura sprite
  const auraCanvas = document.createElement('canvas');
  auraCanvas.width = 256; auraCanvas.height = 256;
  const actx = auraCanvas.getContext('2d');
  const grad = actx.createRadialGradient(128, 128, 10, 128, 128, 128);
  grad.addColorStop(0, '#e8445acc');
  grad.addColorStop(0.5, '#e8445a33');
  grad.addColorStop(1, '#e8445a00');
  actx.fillStyle = grad; actx.fillRect(0, 0, 256, 256);
  const auraTex = new THREE.CanvasTexture(auraCanvas);
  const auraMat = new THREE.SpriteMaterial({ map: auraTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  aura = new THREE.Sprite(auraMat);
  aura.scale.set(3.4, 3.4, 1);
  aura.position.set(0, 0, -0.6);
  scene.add(aura);

  // Fallback procedural heart
  const heartShape = new THREE.Shape();
  const x = 0, y = 0;
  heartShape.moveTo(x + 0.5, y + 0.5);
  heartShape.bezierCurveTo(x + 0.5, y + 0.5, x + 0.4, y, x, y);
  heartShape.bezierCurveTo(x - 0.6, y, x - 0.6, y + 0.7, x - 0.6, y + 0.7);
  heartShape.bezierCurveTo(x - 0.6, y + 1.1, x - 0.3, y + 1.54, x + 0.5, y + 1.9);
  heartShape.bezierCurveTo(x + 1.2, y + 1.54, x + 1.6, y + 1.1, x + 1.6, y + 0.7);
  heartShape.bezierCurveTo(x + 1.6, y + 0.7, x + 1.6, y, x + 1, y);
  heartShape.bezierCurveTo(x + 0.7, y, x + 0.5, y + 0.5, x + 0.5, y + 0.5);
  const extrude = { depth: 0.4, bevelEnabled: true, bevelSegments: 4, steps: 2, bevelSize: 0.12, bevelThickness: 0.12 };
  const geom = new THREE.ExtrudeGeometry(heartShape, extrude);
  geom.translate(-0.5, -1, 0);
  geom.scale(0.65, 0.65, 0.65);
  geom.rotateZ(Math.PI);
  const heartMat = new THREE.MeshStandardMaterial({ color: 0xff5c6f, roughness: 0.35, metalness: 0.15, emissive: 0x330005, emissiveIntensity: 0.3 });
  const fallbackMesh = new THREE.Mesh(geom, heartMat);
  heartGroup.add(fallbackMesh);

  // Load GLB
  new GLTFLoader().load('/models/beating_heart.glb', (gltf) => {
    const root = gltf.scene;
    // Hide any embedded text labels in the original GLB (legacy clinical labels)
    root.traverse((c) => {
      const n = (c.name || '').toLowerCase();
      if (['hr', 'hrv', 'bpm', 'text', 'label', 'display', 'sitting', 'beat', 'high', 'low', 'brady', 'tachy', 'normal'].some((kw) => n.includes(kw))) c.visible = false;
    });
    const box = new THREE.Box3().setFromObject(root);
    const sz = box.getSize(new THREE.Vector3());
    const scale = 1.45 / Math.max(sz.x, sz.y, sz.z);
    root.scale.setScalar(scale);
    box.setFromObject(root);
    const center = box.getCenter(new THREE.Vector3());
    root.position.sub(center);
    heartGroup.remove(fallbackMesh);
    heartGroup.add(root);
    if (gltf.animations?.length) {
      mixer = new THREE.AnimationMixer(root);
      beatAction = mixer.clipAction(gltf.animations[0]);
      beatAction.setLoop(THREE.LoopOnce);
      beatAction.clampWhenFinished = true;
    }
  }, undefined, () => { /* fallback in scene */ });

  let last = performance.now();
  let pulseT = 1;
  function animate() {
    raf = requestAnimationFrame(animate);
    const now = performance.now();
    const dt = (now - last) / 1000; last = now;

    hbSched.tick(now, () => {
      pulseT = 0;
      if (mixer && beatAction) beatAction.reset().play();
      if (aura) aura.material.opacity = 1.0;
    });
    pulseT = Math.min(1, pulseT + dt * 6);
    const pulse = 1 + (1 - pulseT) * (1 - pulseT) * 0.22;
    heartGroup.scale.setScalar(pulse);
    heartGroup.rotation.y += dt * 0.18;
    if (aura) aura.material.opacity = THREE.MathUtils.lerp(aura.material.opacity, 0.45, dt * 4);
    if (mixer) mixer.update(dt);
    renderer.render(scene, camera);
  }
  animate();
}

// ─────────────────────────────────────────────────────────
// Camera lifecycle
// ─────────────────────────────────────────────────────────
// Returns true on success, false on failure.
// Must be callable from a user-gesture context (required by iOS PWA).
async function startCamera() {
  const video = $('video');
  if (!video) return false;

  // mediaDevices not available (e.g. non-HTTPS, or very old browser)
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    console.error('[somatic] mediaDevices unavailable');
    setStartLabel('Camera not supported', true);
    $('cal-sub').textContent = 'Your browser does not support camera access. Try opening in Safari or Chrome.';
    return false;
  }

  const facingMode = mode === 'finger' ? { exact: 'environment' } : 'user';
  const constraints = {
    audio: false,
    video: {
      facingMode,
      width: { ideal: 640 },
      height: { ideal: 480 },
      frameRate: { ideal: 30, max: 30 },
    },
  };

  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch (e) {
    // Fallback 1: drop the facingMode constraint (works when exact: 'environment' fails)
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
      });
    } catch (err) {
      console.error('[somatic] camera denied', err);
      // Permission denied vs not found — give user actionable message
      const isDenied = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError';
      setStartLabel('Allow camera & retry', false); // keep button enabled so they can retry
      $('cal-sub').textContent = isDenied
        ? 'Camera permission denied. Open your phone Settings → Safari/Chrome → Camera → Allow, then tap the button again.'
        : 'Camera unavailable. Make sure no other app is using it, then tap the button again.';
      return false;
    }
  }

  video.srcObject = stream;
  videoTrack = stream.getVideoTracks()[0] || null;

  // Mirror only for face/front-facing camera
  video.classList.toggle('no-mirror', mode === 'finger');

  await new Promise((resolve) => {
    if (video.readyState >= 2) return resolve();
    video.onloadedmetadata = () => resolve();
  });
  await video.play().catch(() => {});

  // Try to enable torch on finger mode — track success so rPPG adjusts its gate
  torchActive = false;
  if (mode === 'finger' && videoTrack && typeof videoTrack.getCapabilities === 'function') {
    try {
      const caps = videoTrack.getCapabilities();
      if (caps && caps.torch) {
        await videoTrack.applyConstraints({ advanced: [{ torch: true }] });
        torchActive = true;
        console.log('[somatic] torch enabled');
      } else {
        console.log('[somatic] torch not supported on this device — using no-torch finger mode');
      }
    } catch (e) {
      console.log('[somatic] torch failed:', e.message);
    }
  }

  setStartLabel('Begin scan', false);
  return true;
}

async function stopCamera() {
  try {
    if (videoTrack && videoTrack.getCapabilities && videoTrack.getCapabilities().torch) {
      await videoTrack.applyConstraints({ advanced: [{ torch: false }] }).catch(() => {});
    }
  } catch {}
  if (stream) { stream.getTracks().forEach((t) => t.stop()); }
  stream = null; videoTrack = null;
}

async function restartCamera() {
  await stopCamera();
  await startCamera();
}

// ─────────────────────────────────────────────────────────
// rPPG lifecycle
// ─────────────────────────────────────────────────────────
function setupRPPG() {
  const video = $('video');
  rppg = new RPPGEstimator(video);
  rppg.mode        = mode;
  rppg.deviceType  = DEVICE;
  rppg.fitzpatrick = 3;
  rppg.torchActive = (mode === 'finger') ? torchActive : false;
  rppg.onUpdate = (bpm, hrv_ms, spo2, brpm, quality) => {
    lastVitals = { bpm, hrv_ms, spo2, brpm, quality };
    if (bpm && Number.isFinite(bpm)) hbSched.update(bpm, hrv_ms || 35);
    // Update HUD
    if (bpm) $('hr-value').textContent = Math.round(bpm);
    if (hrv_ms != null) $('hrv-value').textContent = Math.round(hrv_ms);
    if (brpm != null) $('br-value').textContent = Math.round(brpm);
    setQuality(quality || 0);
    // Track best window for the saved snapshot — only replace on quality improvement
    if ((quality || 0) > 0 && (quality || 0) >= (bestVitals.quality || 0)) bestVitals = { bpm, hrv_ms, spo2, brpm, quality };
  };
}

// ─────────────────────────────────────────────────────────
// Snapshot save
// ─────────────────────────────────────────────────────────
async function saveSnapshot(prebuiltPayload = null) {
  if (saving) return;
  saving = true;
  setStatus('Saving your reading…');

  // Use pre-built payload (from dual scan) or build one from single-mode vitals
  const payload = prebuiltPayload ?? (() => {
    let final = (bestVitals.bpm != null) ? bestVitals : lastVitals;
    if (final.bpm == null && rppg && rppg._emaBPM && rppg._emaBPM !== 75) {
      final = { bpm: Math.round(rppg._emaBPM), hrv_ms: (rppg.hrv_ms && rppg.hrv_ms !== 45) ? rppg.hrv_ms : null, spo2: null, brpm: null, quality: rppg.quality || 0 };
    }
    return {
      mode,
      deviceType: DEVICE,
      durationSec: Math.round((performance.now() - scanStartedAt) / 1000),
      fused: { bpm: final.bpm != null ? Math.round(final.bpm) : null, hrv_ms: final.hrv_ms != null ? Math.round(final.hrv_ms) : null, spo2: final.spo2 != null ? Math.round(final.spo2) : null, brpm: final.brpm != null ? Math.round(final.brpm) : null, quality: final.quality ?? 0 },
      face: mode === 'face' ? { result: { bpm: final.bpm, hrv_ms: final.hrv_ms, spo2: final.spo2, brpm: final.brpm, quality: final.quality } } : null,
      finger: mode === 'finger' ? { result: { bpm: final.bpm, hrv_ms: final.hrv_ms, spo2: final.spo2, brpm: final.brpm, quality: final.quality } } : null,
    };
  })();
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (API_KEY) headers['X-API-Key'] = API_KEY;
    const res = await fetch('/api/snapshot', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      let msg = `Server error ${res.status}`;
      if (res.status === 401 || res.status === 403) {
        msg = `Auth error (${res.status}) \u2014 API key mismatch or missing`;
      } else {
        // Try to extract the detail message from the response body
        try {
          const errBody = await res.clone().json();
          if (errBody?.detail) msg = `${res.status}: ${errBody.detail}`;
        } catch {}
      }
      console.error('[somatic] save failed:', msg);
      throw new Error(msg);
    }
    const data = await res.json();
    if (!data?.ok || !data?.id) throw new Error('Save response missing id');
    // Cache for Home/Results to read
    try {
      if (payload.fused.bpm != null) localStorage.setItem('somatic.lastBpm', String(payload.fused.bpm));
      if (payload.fused.hrv_ms != null) localStorage.setItem('somatic.lastHrv', String(payload.fused.hrv_ms));
    } catch {}
    // Navigate to React Results
    location.href = `/results/${data.id}`;
  } catch (e) {
    console.error('[somatic] save error:', e.message);
    setStatus('Couldn\u2019t save \u2014 tap to retry');
    const sb = $('status-bar');
    if (sb) {
      sb.style.cursor = 'pointer';
      sb.addEventListener('click', () => { sb.style.cursor = ''; saving = false; saveSnapshot(); }, { once: true });
    }
    saving = false;
  }
}

// ─────────────────────────────────────────────────────────
// Phase transition overlay helpers
// ─────────────────────────────────────────────────────────
let _ptInterval = null;
function showPhaseTransition() {
  const el = $('phase-transition');
  if (!el) return;
  el.classList.remove('hidden');
  let count = 3;
  const countEl = $('pt-count');
  if (countEl) countEl.textContent = `Starting in ${count}…`;
  _ptInterval = setInterval(() => {
    count--;
    if (countEl) countEl.textContent = count > 0 ? `Starting in ${count}…` : 'Get ready…';
  }, 1000);
}
function hidePhaseTransition() {
  if (_ptInterval) { clearInterval(_ptInterval); _ptInterval = null; }
  $('phase-transition')?.classList.add('hidden');
}

// ─────────────────────────────────────────────────────────
// Scan flow
// ─────────────────────────────────────────────────────────
function startScan() {
  if (scanRunning || phase !== 'idle') return;
  faceVitals = null;
  fingerVitals = null;
  runPhase('face');
}

function runPhase(ph) {
  mode = ph;
  phase = ph;
  scanRunning = true;
  scanStartedAt = performance.now();
  bestVitals = { bpm: null, hrv_ms: null, spo2: null, brpm: null, quality: 0 };

  // Reset HUD live values
  $('hr-value').textContent = '—';
  $('hrv-value').textContent = '—';
  $('br-value').textContent = '—';

  if (ph === 'face') {
    $('calibration-overlay').classList.add('fade');
    $('video').classList.remove('dim');
    $('hud').classList.add('visible');
    $('mode-tag').classList.remove('hidden');
    $('countdown-overlay').classList.add('visible');
  }

  const tag = $('mode-tag');
  if (tag) tag.textContent = ph === 'face' ? 'Phase 1 · Face · rPPG' : 'Phase 2 · Finger · PPG';
  setStatus(ph === 'face' ? 'Phase 1 · Face · measuring…' : 'Phase 2 · Finger · measuring…');
  setPhaseSteps(ph);

  // Finish button label: during face → "Next: Finger →", during finger → "Save reading"
  const finishBtn = $('finish-btn');
  if (finishBtn) {
    finishBtn.textContent = ph === 'face' ? 'Skip to Finger →' : 'Save reading';
    finishBtn.classList.add('ready');
  }

  setupRPPG();
  rppg.start();

  // Countdown ring
  const ring = $('ring-fg');
  const num  = $('ring-num');
  const circumference = 2 * Math.PI * 140;
  ring.style.strokeDasharray  = String(circumference);
  ring.style.strokeDashoffset = String(circumference);
  num.textContent = String(PHASE_SECONDS);

  countdownInterval = setInterval(() => {
    const elapsed  = performance.now() - scanStartedAt;
    const remain   = Math.max(0, PHASE_SECONDS - Math.floor(elapsed / 1000));
    num.textContent = String(remain);
    ring.style.strokeDashoffset = String(circumference * (1 - Math.min(1, elapsed / (PHASE_SECONDS * 1000))));
    if (elapsed >= PHASE_SECONDS * 1000) {
      clearInterval(countdownInterval); countdownInterval = null;
      finishPhase(/*auto=*/true);
    }
  }, 150);
}

async function finishPhase(_auto = false) {
  if (!scanRunning) return;
  scanRunning = false;
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
  try { rppg && rppg.stop(); } catch {}

  // Capture best vitals; EMA fallback if no window was accepted
  let captured = { ...bestVitals };
  if (captured.bpm == null && rppg && rppg._emaBPM && rppg._emaBPM !== 75) {
    captured = { bpm: Math.round(rppg._emaBPM), hrv_ms: (rppg.hrv_ms && rppg.hrv_ms !== 45) ? rppg.hrv_ms : null, spo2: null, brpm: null, quality: rppg.quality || 0 };
  }

  if (phase === 'face') {
    faceVitals = captured;
    phase = 'transition';
    mode  = 'finger';
    $('countdown-overlay').classList.remove('visible');
    setPhaseSteps('transition');

    // Stop front camera immediately (saves battery, avoids confusion)
    await stopCamera();
    showPhaseTransition();

    // After countdown, start rear camera + finger phase
    setTimeout(async () => {
      hidePhaseTransition();
      await startCamera();  // mode='finger' → rear camera + torch attempt
      $('countdown-overlay').classList.add('visible');
      runPhase('finger');
    }, 3000);

  } else if (phase === 'finger') {
    fingerVitals = captured;
    phase = 'done';
    $('countdown-overlay').classList.remove('visible');
    setPhaseSteps('done');
    const finishBtn = $('finish-btn');
    if (finishBtn) finishBtn.classList.remove('ready');
    setStatus('Both readings captured · saving…');
    fuseAndSave();
  }
}

function fuseAndSave() {
  const fQ     = faceVitals?.quality   || 0;
  const fiQ    = fingerVitals?.quality || 0;
  const totalQ = (fQ + fiQ) || 1;

  // BPM: quality-weighted average of both phases
  let fusedBpm = null;
  if (faceVitals?.bpm != null && fingerVitals?.bpm != null) {
    fusedBpm = Math.round((faceVitals.bpm * fQ + fingerVitals.bpm * fiQ) / totalQ);
  } else {
    fusedBpm = faceVitals?.bpm != null   ? Math.round(faceVitals.bpm)
             : fingerVitals?.bpm != null ? Math.round(fingerVitals.bpm) : null;
  }

  // HRV: prefer finger (contact PPG more reliable for HRV)
  const fusedHrv  = fingerVitals?.hrv_ms  ?? faceVitals?.hrv_ms  ?? null;
  // SpO2: finger only (face rPPG cannot reliably estimate SpO2)
  const fusedSpo2 = fingerVitals?.spo2    ?? null;
  // Breathing rate: prefer face rPPG (respiratory signal stronger in face)
  const fusedBrpm = faceVitals?.brpm      ?? fingerVitals?.brpm   ?? null;

  const payload = {
    mode: 'dual',
    deviceType: DEVICE,
    durationSec: PHASE_SECONDS * 2,
    fused: {
      bpm:    fusedBpm,
      hrv_ms: fusedHrv  != null ? Math.round(fusedHrv)  : null,
      spo2:   fusedSpo2 != null ? Math.round(fusedSpo2) : null,
      brpm:   fusedBrpm != null ? Math.round(fusedBrpm) : null,
      quality: (fQ + fiQ) / 2,
    },
    face:   faceVitals   ? { result: faceVitals }   : null,
    finger: fingerVitals ? { result: fingerVitals } : null,
  };

  saveSnapshot(payload);
}

// ─────────────────────────────────────────────────────────
// Wiring
// ─────────────────────────────────────────────────────────
$('start-btn').addEventListener('click', async () => {
  // If camera isn't running yet (auto-start failed, or PWA needed a user gesture),
  // start it now — this tap IS the required user gesture on iOS PWA.
  if (!stream) {
    setStartLabel('Starting camera…', true);
    const ok = await startCamera();
    if (!ok) return; // error message already set inside startCamera()
    $('video')?.classList.add('dim');
  }
  startScan();
});
$('finish-btn').addEventListener('click', () => {
  // During face phase: skip to finger. During finger phase: end early and save.
  if (scanRunning) finishPhase(false);
});
window.addEventListener('beforeunload', () => {
  try { rppg && rppg.stop(); } catch {}
  stopCamera();
});

// ─────────────────────────────────────────────────────────
// Boot
// ─────────────────────────────────────────────────────────
(async function boot() {
  // Show an enabled button immediately — on iOS PWA getUserMedia must be
  // called inside a user gesture, so we can't block the button on auto-start.
  setStartLabel('Begin scan', false);
  setPhaseSteps('idle'); // no step highlighted yet
  setupHeartScene();

  // Attempt to auto-start front camera (face phase). Works on Android PWA and
  // desktop; may be silently skipped on iOS PWA if permission hasn't been
  // granted yet — click handler retries startCamera() as a user gesture.
  const ok = await startCamera(); // mode='face' → front camera
  if (ok) {
    $('video')?.classList.add('dim'); // dim for ambience before scan starts
  }
})();
