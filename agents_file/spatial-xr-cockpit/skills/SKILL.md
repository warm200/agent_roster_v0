---
name: xr-cockpit-interaction-specialist
description: Designs and implements immersive cockpit interfaces for XR environments, including 3D control panels, HUDs, dashboards, and spatial input systems using A-Frame or Three.js. Use when the user asks about VR, AR, or mixed reality cockpit layouts, XR dashboard design, spatial control panels, head-up displays, virtual flight controls, immersive vehicle interfaces, seated XR experiences, or multi-input systems combining hand gestures, gaze, and voice controls.
color: orange
---

# XR Cockpit Interaction Specialist

## Workflow

Follow these steps when building a cockpit interface:

1. **Define the seated reference frame** — anchor the user's origin point and establish a fixed forward vector so all controls remain stable relative to the headset.
2. **Place control surfaces within ergonomic reach zones** — keep primary controls (yoke, throttle, levers) within 40–70 cm of the origin; secondary controls (switches, gauges) within 70–100 cm.
3. **Add input handlers** — attach constraint-driven interaction to each control (no free-float motion); bind gesture, gaze, or voice triggers.
4. **Implement audio/visual feedback** — every control state change must emit a sound cue and animate to its new position/value.
5. **Validate comfort metrics** — register the `comfort-monitor` component below on the cockpit root; it logs angular velocity and Z-depth shifts each frame and warns to the console when thresholds are breached. Fix any logged violations before shipping.

---

## A-Frame Cockpit Starter

### Seated reference frame with fixed cockpit root

```html
<!-- index.html -->
<a-scene>
  <!-- Camera rig locked to seat position -->
  <a-entity id="rig" position="0 1.6 0">
    <a-camera look-controls wasd-controls="enabled: false"></a-camera>
  </a-entity>

  <!-- Cockpit root anchored to rig; attach comfort-monitor here -->
  <a-entity id="cockpit" position="0 1.6 -0.6" comfort-monitor>
    <a-box id="dashboard"
      position="0 0 0"
      width="1.2" height="0.4" depth="0.05"
      color="#1a1a2e">
    </a-box>
  </a-entity>
</a-scene>
```

### Hand-interactive yoke with rotation constraint

```html
<!-- Yoke: drag limited to ±20° on X and Z axes -->
<a-entity id="yoke"
  position="0 -0.1 0.1"
  geometry="primitive: cylinder; radius: 0.04; height: 0.15"
  material="color: #888"
  hand-tracking-grab-controls="hand: right"
  constrained-rotation="axisX: 20; axisZ: 20">
</a-entity>
```

```javascript
AFRAME.registerComponent('constrained-rotation', {
  schema: { axisX: { default: 20 }, axisZ: { default: 20 } },
  tick() {
    const rot = this.el.object3D.rotation;
    const limit = THREE.MathUtils.degToRad;
    rot.x = THREE.MathUtils.clamp(rot.x, -limit(this.data.axisX), limit(this.data.axisX));
    rot.z = THREE.MathUtils.clamp(rot.z, -limit(this.data.axisZ), limit(this.data.axisZ));
  }
});
```

### Throttle lever with haptic + audio feedback

```javascript
AFRAME.registerComponent('throttle-lever', {
  schema: { min: { default: 0 }, max: { default: 1 } },
  init() {
    this.value = 0;
    this.el.addEventListener('hand-drag', (e) => {
      const delta = e.detail.positionDelta.y;
      this.value = THREE.MathUtils.clamp(this.value + delta, this.data.min, this.data.max);
      this.el.object3D.position.y = this.value * 0.15; // 15 cm physical travel
      this.el.emit('throttle-change', { value: this.value });
      this.playFeedback();
    });
  },
  playFeedback() {
    document.querySelector('#throttle-gauge').setAttribute('material', {
      color: `hsl(${120 * this.value}, 80%, 50%)`
    });
    document.querySelector('#click-sound').components.sound.playSound();
  }
});
```

---

## Dashboard Gauges & Toggles

### Animated gauge via Three.js canvas texture

```javascript
function createGauge(value /* 0–1 */) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(128, 128, 120, 0, Math.PI * 2);
  ctx.fill();

  const angle = -Math.PI * 0.75 + value * Math.PI * 1.5;
  ctx.strokeStyle = '#f00';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(128, 128);
  ctx.lineTo(128 + Math.cos(angle) * 90, 128 + Math.sin(angle) * 90);
  ctx.stroke();

  return new THREE.CanvasTexture(canvas);
}
```

### Toggle switch with gaze + dwell activation

```html
<a-entity id="toggle-switch"
  position="-0.3 0 0"
  geometry="primitive: box; width: 0.04; height: 0.08; depth: 0.04"
  material="color: #444"
  cursor-listener
  dwell-toggle="duration: 800">
</a-entity>
```

```javascript
AFRAME.registerComponent('dwell-toggle', {
  schema: { duration: { default: 800 } },
  init() {
    this.timer = null;
    this.active = false;
    this.el.addEventListener('mouseenter', () => {
      this.timer = setTimeout(() => this.toggle(), this.data.duration);
    });
    this.el.addEventListener('mouseleave', () => clearTimeout(this.timer));
  },
  toggle() {
    this.active = !this.active;
    this.el.setAttribute('material', 'color', this.active ? '#0f0' : '#f00');
    this.el.emit('toggle-change', { active: this.active });
  }
});
```

---

## Comfort Metrics Validation

```javascript
AFRAME.registerComponent('comfort-monitor', {
  schema: {
    maxAngularVelocityDeg: { default: 30 },  // °/s
    maxZDepthShiftCm: { default: 10 }         // cm per frame
  },
  init() {
    this._prevRotY = 0;
    this._prevZ = this.el.object3D.position.z;
    this._prevTime = performance.now();
  },
  tick() {
    const now = performance.now();
    const dt = (now - this._prevTime) / 1000; // seconds
    if (dt === 0) return;

    const obj = this.el.object3D;
    const rotY = THREE.MathUtils.radToDeg(obj.rotation.y);
    const angularVel = Math.abs(rotY - this._prevRotY) / dt;

    const zShiftCm = Math.abs(obj.position.z - this._prevZ) * 100;

    if (angularVel > this.data.maxAngularVelocityDeg) {
      console.warn(`[comfort-monitor] WARN angular velocity ${angularVel.toFixed(1)}°/s exceeds ${this.data.maxAngularVelocityDeg}°/s`);
    }
    if (zShiftCm > this.data.maxZDepthShiftCm) {
      console.warn(`[comfort-monitor] WARN Z-depth shift ${zShiftCm.toFixed(1)} cm exceeds ${this.data.maxZDepthShiftCm} cm`);
    }

    this._prevRotY = rotY;
    this._prevZ = obj.position.z;
    this._prevTime = now;
  }
});
```

If violations appear during testing, reduce animation speed, clamp motion curves, or anchor the offending element more tightly to the cockpit root.

---

## Multi-Input Integration

| Input modality | Recommended use | A-Frame component |
|---|---|---|
| Hand gestures (grab/pinch) | Levers, throttles, yoke | `hand-tracking-grab-controls` |
| Gaze + dwell | Switches, buttons, menu items | `cursor` + custom dwell component |
| Voice commands | Mode changes, confirmations | `speech-command` (aframe-extras) |
| Physical props | High-fidelity simulation | `tracked-controls` mapped to prop pose |

---

## Ergonomic & Comfort Parameters

| Parameter | Recommended value |
|---|---|
| Primary control reach | 40–70 cm from origin |
| Secondary control reach | 70–100 cm from origin |
| Max element angular velocity | ≤ 30°/s |
| HUD depth (focal comfort) | ≥ 1 m optical distance |
| Cockpit FOV coverage | ≤ 180° horizontal |
| Seated eye height (default) | 1.6 m above floor |
| Max Z-depth shift per frame | ≤ 10 cm (beyond triggers discomfort) |

---

## Sound & Visual Feedback Checklist

- [ ] Every control emits a distinct audio cue on state change
- [ ] Animated transition on all moving parts (no snap/teleport positioning)
- [ ] Gauge/indicator updates within one frame of the input event
- [ ] Error states use amber/red colour with a distinct sound
- [ ] Idle-state indicators use low-contrast colours to reduce visual noise
