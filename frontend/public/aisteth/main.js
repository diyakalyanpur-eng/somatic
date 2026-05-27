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
const params = new URLSearchParams(location.search);
const initialMode = (params.get('mode') === 'finger') ? 'finger' : 'face';
const SCAN_SECONDS = 30;

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
let mode = initialMode;
let stream = null;
let videoTrack = null;
let rppg = null;
let hbSched = new HeartBeatScheduler();
let scanRunning = false;
let scanStartedAt = 0;
let countdownInterval = null;
let lastVitals = { bpm: null, hrv_ms: null, spo2: null, brpm: null, quality: 0 };
let bestVitals = { bpm: null, hrv_ms: null, spo2: null, brpm: null, quality: 0 };
let saving = false;

// ─────────────────────────────────────────────────────────
// Mode pills
// ─────────────────────────────────────────────────────────
function setMode(m) {
  if (scanRunning) return;
  mode = (m === 'finger') ? 'finger' : 'face';
  document.querySelectorAll('.mode-pill').forEach((el) => {
    el.classList.toggle('active', el.dataset.mode === mode);
  });
  const tag = $('mode-tag');
  if (tag) tag.textContent = mode === 'finger' ? 'Finger · PPG' : 'Face · rPPG';
  $('cal-sub').textContent = mode === 'face'
    ? 'Hold still. Keep your face gently in the frame. This is a wellness signal, not a diagnosis.'
    : 'Place your fingertip lightly over the rear camera and flash. Cover the lens fully.';
  // Restart camera with new constraints if we have one already
  if (stream) restartCamera();
}
document.querySelectorAll('.mode-pill').forEach((el) => {
  el.addEventListener('click', () => setMode(el.dataset.mode));
});
// Set initial pill state
setMode(mode);

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
async function startCamera() {
  const video = $('video');
  if (!video) return;

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
    // Fallback without facingMode constraint
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true }); }
    catch (err) {
      console.error('[somatic] camera denied', err);
      setStartLabel('Camera unavailable', true);
      $('cal-sub').textContent = 'Please allow camera access from your browser to begin a scan.';
      return;
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

  // Try to enable torch on finger mode
  if (mode === 'finger' && videoTrack && typeof videoTrack.getCapabilities === 'function') {
    try {
      const caps = videoTrack.getCapabilities();
      if (caps && caps.torch) {
        await videoTrack.applyConstraints({ advanced: [{ torch: true }] });
      }
    } catch (e) { /* torch optional */ }
  }

  setStartLabel('Begin scan', false);
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
  rppg.mode = mode;
  rppg.deviceType = DEVICE;
  rppg.fitzpatrick = 3;
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
async function saveSnapshot() {
  if (saving) return;
  saving = true;
  setStatus('Saving your reading…');

  // Prefer the best accepted window; fall back to last update; then fall back
  // to the rPPG's internal EMA (updated even when windows are rejected) so we
  // never write pure nulls into Firestore after a completed scan.
  let final = (bestVitals.bpm != null) ? bestVitals : lastVitals;
  if (final.bpm == null && rppg && rppg._emaBPM && rppg._emaBPM !== 75) {
    final = {
      bpm: Math.round(rppg._emaBPM),
      hrv_ms: (rppg.hrv_ms && rppg.hrv_ms !== 45) ? rppg.hrv_ms : null,
      spo2: null,   // SpO2 only valid from accepted windows
      brpm: null,
      quality: rppg.quality || 0,
    };
  }
  const payload = {
    mode,
    deviceType: DEVICE,
    durationSec: Math.round((performance.now() - scanStartedAt) / 1000),
    fused: {
      bpm: final.bpm != null ? Math.round(final.bpm) : null,
      hrv_ms: final.hrv_ms != null ? Math.round(final.hrv_ms) : null,
      spo2: final.spo2 != null ? Math.round(final.spo2) : null,
      brpm: final.brpm != null ? Math.round(final.brpm) : null,
      quality: final.quality ?? 0,
    },
    face: mode === 'face' ? { result: { bpm: final.bpm, hrv_ms: final.hrv_ms, spo2: final.spo2, brpm: final.brpm, quality: final.quality } } : null,
    finger: mode === 'finger' ? { result: { bpm: final.bpm, hrv_ms: final.hrv_ms, spo2: final.spo2, brpm: final.brpm, quality: final.quality } } : null,
  };
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (API_KEY) headers['X-API-Key'] = API_KEY;
    const res = await fetch('/api/snapshot', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data?.ok || !data?.id) throw new Error('Save failed');
    // Cache for Home/Results to read
    try {
      if (payload.fused.bpm != null) localStorage.setItem('somatic.lastBpm', String(payload.fused.bpm));
      if (payload.fused.hrv_ms != null) localStorage.setItem('somatic.lastHrv', String(payload.fused.hrv_ms));
    } catch {}
    // Navigate to React Results
    location.href = `/results/${data.id}`;
  } catch (e) {
    console.error('[somatic] save error', e);
    setStatus('Couldn\u2019t save right now. Try again.');
    saving = false;
  }
}

// ─────────────────────────────────────────────────────────
// Countdown / scan flow
// ─────────────────────────────────────────────────────────
function startScan() {
  if (scanRunning) return;
  scanRunning = true;
  scanStartedAt = performance.now();
  bestVitals = { bpm: null, hrv_ms: null, spo2: null, brpm: null, quality: 0 };
  $('calibration-overlay').classList.add('fade');
  $('video').classList.remove('dim');
  $('hud').classList.add('visible');
  $('mode-tag').classList.remove('hidden');
  $('countdown-overlay').classList.add('visible');
  setStatus(mode === 'face' ? 'Face · measuring…' : 'Finger · measuring…');

  setupRPPG();
  rppg.start();

  // Countdown ring
  const ring = $('ring-fg');
  const num = $('ring-num');
  const totalMs = SCAN_SECONDS * 1000;
  const circumference = 2 * Math.PI * 140; // r=140
  ring.style.strokeDasharray = String(circumference);
  ring.style.strokeDashoffset = String(circumference);

  countdownInterval = setInterval(() => {
    const elapsed = performance.now() - scanStartedAt;
    const remain = Math.max(0, SCAN_SECONDS - Math.floor(elapsed / 1000));
    num.textContent = String(remain);
    const progress = Math.min(1, elapsed / totalMs);
    ring.style.strokeDashoffset = String(circumference * (1 - progress));
    if (elapsed >= totalMs) {
      clearInterval(countdownInterval); countdownInterval = null;
      finishScan(/*auto=*/true);
    }
  }, 150);
}

function finishScan(_auto = false) {
  if (!scanRunning) return;
  scanRunning = false;
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
  try { rppg && rppg.stop(); } catch {}
  $('countdown-overlay').classList.remove('visible');
  $('finish-btn')?.classList.add('ready');
  setStatus('Reading locked');
  saveSnapshot();
}

// ─────────────────────────────────────────────────────────
// Wiring
// ─────────────────────────────────────────────────────────
$('start-btn').addEventListener('click', () => {
  if (!stream) return;
  startScan();
});
$('finish-btn').addEventListener('click', () => {
  if (scanRunning) finishScan(false);
});
window.addEventListener('beforeunload', () => {
  try { rppg && rppg.stop(); } catch {}
  stopCamera();
});

// ─────────────────────────────────────────────────────────
// Boot
// ─────────────────────────────────────────────────────────
(async function boot() {
  setStartLabel('Preparing camera…', true);
  setupHeartScene();
  // Heart is intentionally hidden during scan — clean camera view
  await startCamera();
  $('video').classList.add('dim'); // dim until scan begins for ambience
})();
