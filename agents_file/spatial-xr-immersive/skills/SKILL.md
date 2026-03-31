---
name: xr-immersive-developer
description: Creates browser-based AR/VR/XR experiences using the WebXR Device API, builds 3D scenes with Three.js, A-Frame, and Babylon.js, implements hand tracking, raycasting, hit testing, spatial anchors, and controller input, and applies performance optimizations like LOD, occlusion culling, and shader tuning for headsets and mobile AR. Use when the user asks about WebXR, virtual reality, augmented reality, immersive 3D web apps, VR headsets, spatial computing, or mentions frameworks like Three.js, A-Frame, Babylon.js, or file formats like .glb or .gltf.
color: neon-cyan
---

# XR Immersive Developer

---

## 🚀 Workflow: Scaffolding a WebXR Project

### 1. Initialize a WebXR Session (Three.js)

```js
import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);

// Attach the Enter VR button
document.body.appendChild(VRButton.createButton(renderer));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100);

renderer.setAnimationLoop(() => {
  renderer.render(scene, camera);
});
```

**Validation checkpoint:** Open in a WebXR-compatible browser (Chrome on Quest, or desktop with WebXR emulator extension). Confirm the "Enter VR" button appears and clicking it starts an immersive-vr session without console errors.

### 2. Add a Simple A-Frame Scene with Fallback

```html
<!DOCTYPE html>
<html>
  <head>
    <script src="https://aframe.io/releases/1.5.0/aframe.min.js"></script>
  </head>
  <body>
    <a-scene>
      <a-box position="0 1.5 -3" rotation="0 45 0" color="#4CC3D9"></a-box>
      <a-sky color="#ECECEC"></a-sky>
      <a-camera></a-camera>
    </a-scene>
  </body>
</html>
```

**Validation checkpoint:** Load in a desktop browser; confirm the scene renders in 3D with mouse-look. Load on a Quest browser; confirm the VR button appears.

---

## 🤲 Implementing Hand Tracking

```js
// Three.js — XRHandModelFactory
import { XRHandModelFactory } from 'three/addons/webxr/XRHandModelFactory.js';

const handModelFactory = new XRHandModelFactory();

const hand1 = renderer.xr.getHand(0);
hand1.add(handModelFactory.createHandModel(hand1, 'mesh'));
scene.add(hand1);

const hand2 = renderer.xr.getHand(1);
hand2.add(handModelFactory.createHandModel(hand2, 'mesh'));
scene.add(hand2);

// Listen for pinch gestures
hand1.addEventListener('pinchstart', () => console.log('Left pinch started'));
hand1.addEventListener('pinchend',   () => console.log('Left pinch ended'));
```

**Validation checkpoint:** Enable hand tracking in Quest Settings → Movement Tracking → Hand Tracking. Open the app and verify hand mesh renders; confirm pinchstart fires in the browser console when you pinch.

---

## 🎯 Raycasting & Hit Testing

### Controller Raycasting (Three.js)

```js
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';

const controllerModelFactory = new XRControllerModelFactory();
const controller = renderer.xr.getController(0);
scene.add(controller);

// Visual ray line
const rayGeometry = new THREE.BufferGeometry().setFromPoints([
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(0, 0, -5)
]);
const ray = new THREE.Line(rayGeometry, new THREE.LineBasicMaterial({ color: 0xffffff }));
controller.add(ray);

// Raycasting against scene objects
const raycaster = new THREE.Raycaster();
controller.addEventListener('selectstart', () => {
  raycaster.setFromXRController(controller);
  const hits = raycaster.intersectObjects(scene.children, true);
  if (hits.length > 0) console.log('Hit:', hits[0].object.name);
});
```

### AR Hit Testing (WebXR Device API)

```js
let hitTestSource = null;

session.requestReferenceSpace('viewer').then(viewerSpace => {
  session.requestHitTestSource({ space: viewerSpace }).then(source => {
    hitTestSource = source;
  });
});

// In the render loop
function onXRFrame(time, frame) {
  if (hitTestSource) {
    const hits = frame.getHitTestResults(hitTestSource);
    if (hits.length > 0) {
      const pose = hits[0].getPose(referenceSpace);
      reticle.visible = true;
      reticle.matrix.fromArray(pose.transform.matrix);
    } else {
      reticle.visible = false;
    }
  }
  session.requestAnimationFrame(onXRFrame);
}
```

---

## ⚡ Performance Optimization Patterns

### LOD (Level of Detail) in Three.js

```js
import { LOD } from 'three';

const lod = new LOD();

// High-detail mesh at close range
lod.addLevel(highDetailMesh, 0);
// Medium-detail mesh beyond 5 units
lod.addLevel(medDetailMesh, 5);
// Low-detail mesh beyond 15 units
lod.addLevel(lowDetailMesh, 15);

scene.add(lod);

// Update every frame — LOD switches based on camera distance
renderer.setAnimationLoop(() => {
  lod.update(camera);
  renderer.render(scene, camera);
});
```

### Draw Call Reduction with InstancedMesh

```js
const count = 500;
const mesh = new THREE.InstancedMesh(geometry, material, count);
const dummy = new THREE.Object3D();

for (let i = 0; i < count; i++) {
  dummy.position.set(Math.random() * 20 - 10, 0, Math.random() * 20 - 10);
  dummy.updateMatrix();
  mesh.setMatrixAt(i, dummy.matrix);
}
scene.add(mesh); // 500 objects — 1 draw call
```

### Shader / Texture Tips
- Use **compressed textures** (KTX2/Basis) via `THREE.KTX2Loader` to cut VRAM usage
- Prefer **MeshBasicMaterial** or **MeshLambertMaterial** over PBR materials for distant/background objects
- Set `renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))` on Quest to cap resolution overhead

---

## 📱 Device Compatibility Reference

| Device | Browser | AR | VR | Hand Tracking | Notes |
|---|---|---|---|---|---|
| Meta Quest 2/3 | Meta Browser / Chrome | ✅ (passthrough) | ✅ | ✅ | Best WebXR support overall |
| Apple Vision Pro | Safari (visionOS) | ✅ | ✅ | ✅ | Requires `immersive-vr` mode; limited controller API |
| HoloLens 2 | Edge (Chromium) | ✅ | ❌ | ✅ | `immersive-ar` only; no immersive-vr |
| Android (ARCore) | Chrome 81+ | ✅ | ❌ | ❌ | Hit testing via WebXR AR module |
| iOS (Safari) | Safari 16+ | ⚠️ Partial | ❌ | ❌ | Limited; use WebXR Viewer app for testing |
| Desktop Chrome | Chrome + emulator | ❌ | ✅ (emulated) | ❌ | Use WebXR API Emulator extension |

**Graceful degradation pattern:**

```js
if (navigator.xr) {
  navigator.xr.isSessionSupported('immersive-vr').then(supported => {
    if (supported) {
      showEnterVRButton();
    } else {
      showFlatFallback(); // render as standard 3D scene
    }
  });
} else {
  showFlatFallback();
}
```

---

## 🐛 Debugging Spatial Input

- **Desktop:** Install [WebXR API Emulator](https://chrome.google.com/webstore/detail/webxr-api-emulator) for Chrome; simulate headset pose and controllers without hardware
- **On-device:** Use `chrome://inspect` over USB to view console logs from Quest/Android Chrome in real time
- **Common issues:**
  - `XRSession` not starting → check `https://` origin (WebXR requires secure context)
  - Controller pose is `null` → ensure reference space is `local-floor` or `bounded-floor`, not `viewer`
  - Hand tracking not triggering → confirm the feature flag: `optionalFeatures: ['hand-tracking']` in `requestSession`

```js
navigator.xr.requestSession('immersive-vr', {
  requiredFeatures: ['local-floor'],
  optionalFeatures: ['hand-tracking', 'hit-test', 'anchors']
}).then(session => { /* ... */ });
```
