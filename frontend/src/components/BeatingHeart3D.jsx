import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * BeatingHeart3D — renders the AiSteth GLB heart pulsing at a given BPM.
 * Always visible (no camera or rPPG lock required) so the user always sees
 * a live cardiac visual when they're on the Assessment page.
 *
 * Props:
 *   bpm     — number, pulse rate (default 72)
 *   hrv     — number, beat-to-beat variability in ms (default 40)
 *   color   — hex int, accent emerald (default 0x22e8a8)
 *   size    — css px size of the canvas square (default 320)
 */
export default function BeatingHeart3D({ bpm = 60, hrv = 30, color = 0xe8445a, size = 320 }) {
  const mountRef = useRef(null);
  const bpmRef = useRef(bpm);
  const hrvRef = useRef(hrv);
  useEffect(() => { bpmRef.current = bpm; }, [bpm]);
  useEffect(() => { hrvRef.current = hrv; }, [hrv]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;

    const scene = new THREE.Scene();
    scene.background = null;
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0.25, 2.8);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(size, size, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const amb = new THREE.AmbientLight(0xffffff, 0.55);
    scene.add(amb);
    const key = new THREE.DirectionalLight(color, 2.0);
    key.position.set(1.5, 2, 2);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xf5c87a, 0.55);
    rim.position.set(-1.5, -1, 1.5);
    scene.add(rim);

    const heartGroup = new THREE.Group();
    heartGroup.position.y = 0.45; // lift heart into upper portion of canvas
    scene.add(heartGroup);

    // Glowing aura sprite behind heart
    const auraCanvas = document.createElement("canvas");
    auraCanvas.width = 256; auraCanvas.height = 256;
    const actx = auraCanvas.getContext("2d");
    const grad = actx.createRadialGradient(128,128,10,128,128,128);
    const hex = `#${color.toString(16).padStart(6,"0")}`;
    grad.addColorStop(0, hex + "cc");
    grad.addColorStop(0.5, hex + "33");
    grad.addColorStop(1, hex + "00");
    actx.fillStyle = grad; actx.fillRect(0,0,256,256);
    const auraTex = new THREE.CanvasTexture(auraCanvas);
    const auraMat = new THREE.SpriteMaterial({ map: auraTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const aura = new THREE.Sprite(auraMat);
    aura.scale.set(2.2, 2.2, 1);
    aura.position.set(0, 0.45, -0.6);
    scene.add(aura);

    // Fallback procedural heart shape (used until GLB loads / if it fails)
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

    // Load GLB (best-effort)
    const loader = new GLTFLoader();
    let gltfRoot = null;
    let mixer = null;
    let beatAction = null;
    loader.load("/models/beating_heart.glb", (gltf) => {
      if (disposed) return;
      gltfRoot = gltf.scene;
      gltfRoot.traverse((c) => {
        const n = (c.name || "").toLowerCase();
        if (["hr","hrv","bpm","text","label","display","sitting","beat","high","low","brady","tachy","normal"].some((kw) => n.includes(kw))) c.visible = false;
      });
      const box = new THREE.Box3().setFromObject(gltfRoot);
      const sz = box.getSize(new THREE.Vector3());
      const scale = 1.45 / Math.max(sz.x, sz.y, sz.z);
      gltfRoot.scale.setScalar(scale);
      // Re-center
      box.setFromObject(gltfRoot);
      const center = box.getCenter(new THREE.Vector3());
      gltfRoot.position.sub(center);
      heartGroup.remove(fallbackMesh);
      heartGroup.add(gltfRoot);
      if (gltf.animations?.length) {
        mixer = new THREE.AnimationMixer(gltfRoot);
        beatAction = mixer.clipAction(gltf.animations[0]);
        beatAction.setLoop(THREE.LoopOnce);
        beatAction.clampWhenFinished = true;
      }
    }, undefined, () => { /* fallback already in scene */ });

    // Beat scheduler
    let nextBeatAt = performance.now();
    let pulseT = 0; // 0..1 lerp for non-animated fallback pulse
    let lastFrame = performance.now();
    function gaussianJitter(std) {
      const u = 1 - Math.random(), v = Math.random();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * std;
    }
    function triggerBeat() {
      pulseT = 0;
      if (mixer && beatAction) { beatAction.reset().play(); }
      // Aura flash
      aura.material.opacity = 1.0;
    }

    let raf = 0;
    const animate = () => {
      if (disposed) return;
      raf = requestAnimationFrame(animate);
      const now = performance.now();
      const dt = (now - lastFrame) / 1000;
      lastFrame = now;
      if (now >= nextBeatAt) {
        const ibi = Math.max(200, (60.0 / bpmRef.current) * 1000 + gaussianJitter(hrvRef.current));
        nextBeatAt = now + ibi;
        triggerBeat();
      }
      pulseT = Math.min(1, pulseT + dt * 6);
      const pulse = 1 + (1 - pulseT) * (1 - pulseT) * 0.22; // overshoot + decay
      heartGroup.scale.setScalar(pulse);
      aura.material.opacity = THREE.MathUtils.lerp(aura.material.opacity, 0.45, dt * 4);
      if (mixer) mixer.update(dt);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      renderer.dispose();
      try { mount.removeChild(renderer.domElement); } catch {}
      geom.dispose(); heartMat.dispose();
      auraTex.dispose(); auraMat.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, color]);

  return (
    <div
      ref={mountRef}
      style={{ width: size, height: size }}
      data-testid="beating-heart-3d"
      aria-label={`Beating heart at ${bpm} bpm`}
    />
  );
}
