---
name: xr-interface-architect
description: Designs spatial UI layouts, prototypes hand gesture interactions, creates 3D menu systems, and plans gaze-based navigation for AR/VR/XR applications. Provides ergonomic placement guidelines, comfort zone thresholds, input latency budgets, and accessibility fallback patterns for immersive interfaces across platforms including Meta Quest, Apple Vision Pro, and WebXR. Use when the user asks about spatial computing interfaces, VR/AR UI design, mixed reality interactions, hand tracking UX, HUD design, holographic displays, headset UI, immersive environment layouts, 3D interface design, cockpit dashboards, or comfort-zone-compliant panel placement.
color: neon-green
---

# XR Interface Architect

A spatial UI/UX design skill for AR/VR/XR environments. Covers ergonomic thresholds, input models, layout templates, and validated workflows for immersive interface design.

---

## 📐 Ergonomic Thresholds & Comfort Zones

### Spatial Placement Guidelines
| Zone | Vertical Offset | Depth (from user) | Use Case |
|---|---|---|---|
| Primary UI | 0°–15° below eye level | 0.5 m – 2.0 m | HUDs, menus, dashboards |
| Secondary UI | 15°–35° below eye level | 1.0 m – 3.0 m | Contextual panels, tooltips |
| Peripheral | ±35°–60° horizontal | 1.5 m+ | Alerts, ambient indicators |
| Out-of-comfort | >35° below or >30° above | <0.4 m or >5.0 m | Avoid for sustained interaction |

### Typography & Legibility
- **Minimum angular size**: 0.35° arc (≈ 12 px at 1 m for a standard headset)
- **Comfortable reading size**: 0.5°–0.7° arc
- **Line spacing**: 140%–160% of font size in world space
- **Max line width**: 60–70 characters or ~30° of horizontal arc

### Input Latency Budgets
| Input Type | Max Acceptable Latency | Notes |
|---|---|---|
| Direct hand touch | < 20 ms | Mismatch causes discomfort |
| Gaze + pinch select | < 50 ms | Visual feedback must be immediate |
| Controller raycast | < 80 ms | Pointer drift compounds at high latency |
| Voice command | < 300 ms | Confirm with visual acknowledgement |

---

## 🕹️ Input Model Patterns

### Supported Input Types
1. **Direct touch** — fingertip collider on near-field panels (< 0.6 m); use haptic feedback pulse on press.
2. **Gaze + pinch** — dwell highlight at 400–600 ms, confirm on pinch; require visible focus indicator.
3. **Controller raycast** — curved ray preferred over straight; snap-to-target assist within 3° tolerance.
4. **Hand gestures** — limit to ≤ 5 distinct gestures per context; always provide visual gesture guide on first use.

### Multimodal Fallback Hierarchy
```
Primary input → Secondary input → Accessibility fallback
  hand gesture  →  gaze + pinch  →  controller raycast  →  voice command
```
- Always implement at least two input paths.
- Accessibility fallback must not require simultaneous bimanual input.

---

## 🗂️ Layout Templates

### Floating Panel (General Purpose)
```json
{
  "panel": {
    "anchorType": "world",
    "position": { "x": 0, "y": -0.15, "z": 1.2 },
    "rotation": { "pitch": 10, "yaw": 0, "roll": 0 },
    "size": { "width": 0.6, "height": 0.4, "unit": "meters" },
    "billboard": "yaw-only",
    "depthClamp": { "min": 0.5, "max": 3.0 },
    "inputSurface": "front-only",
    "backplateOpacity": 0.85
  }
}
```

### Cockpit / Dashboard Layout
```json
{
  "cockpit": {
    "anchorType": "head-locked",
    "primaryZone":   { "yOffset": -0.12, "depth": 1.0, "arcWidth": 60 },
    "secondaryZone": { "yOffset": -0.28, "depth": 1.5, "arcWidth": 100 },
    "peripheralAlerts": { "yOffset": 0.05, "arcWidth": 120, "opacity": 0.6 }
  }
}
```

---

## 🔧 Code Snippet — Comfort-Zone Panel Placement (Unity / XR Interaction Toolkit)

```csharp
using UnityEngine;

public class ComfortZonePanel : MonoBehaviour
{
    [Header("Placement Settings")]
    public float depth = 1.2f;          // meters in front of camera
    public float verticalOffsetDeg = -10f; // degrees below eye level
    public float smoothSpeed = 5f;

    private Transform _cam;

    void Start() => _cam = Camera.main.transform;

    void Update()
    {
        // Target position: depth ahead, offset below gaze
        Vector3 forward = _cam.forward;
        Vector3 targetPos = _cam.position
            + forward * depth
            + Vector3.down * Mathf.Tan(verticalOffsetDeg * Mathf.Deg2Rad) * depth;

        // Smooth follow (yaw-only billboard)
        transform.position = Vector3.Lerp(transform.position, targetPos, Time.deltaTime * smoothSpeed);
        Vector3 lookDir = transform.position - _cam.position;
        lookDir.y = 0;
        transform.rotation = Quaternion.LookRotation(lookDir);
    }
}
```

### WebXR equivalent (Three.js)
```js
function placeComfortPanel(panel, camera, depthM = 1.2, vertOffsetDeg = -10) {
  const offset = Math.tan((vertOffsetDeg * Math.PI) / 180) * depthM;
  panel.position.copy(camera.position)
    .addScaledVector(camera.getWorldDirection(new THREE.Vector3()), depthM);
  panel.position.y += offset;
  panel.lookAt(camera.position); // billboard toward user
}
```

---

## 🔄 XR Menu Design Workflow

### Step 1 — Define Placement
- Choose anchor type: **world**, **head-locked**, or **body-locked**.
- Set initial depth and vertical offset within comfort zone table above.
- Decide billboard axis (yaw-only recommended for most panels).

### Step 2 — Check Ergonomic Constraints
- [ ] Primary content within 0°–15° below eye level
- [ ] Depth between 0.5 m and 2.0 m
- [ ] Font size ≥ 0.35° arc at target depth
- [ ] No sustained interaction required outside ±35° horizontal

### Step 3 — Assign Input Model
- Select primary + fallback inputs from the multimodal hierarchy.
- Define press/hover/select visual states for each interactive element.
- Add latency-compensating visual feedback (highlight on hover < 16 ms).

### Step 4 — Prototype & Simulate
- Build a grey-box prototype in engine (Unity, Unreal, or A-Frame).
- Test at 72 Hz minimum; target 90 Hz for comfort.
- Record any head movement required to access all controls.

### Step 5 — Comfort Validation
- [ ] No neck rotation > 30° required to read primary content
- [ ] No UI elements closer than 0.4 m
- [ ] Latency within budget for chosen input type
- [ ] Interaction completable with one hand if needed (accessibility)

### Step 6 — Iterate
- Adjust depth/offset based on comfort test results.
- Re-validate font legibility after any scale changes.
- Document final placement values in the panel JSON schema.

---

## ♿ Accessibility Fallback Patterns

| Constraint | Recommended Adaptation |
|---|---|
| No hand tracking | Gaze dwell + controller confirm |
| Limited head mobility | Expand interaction arc; use voice trigger |
| Low vision | Increase angular font size to 0.7°+; high-contrast backplate |
| Single-hand use | All controls reachable one-handed; no pinch-hold combos |
| Motion sensitivity | Reduce UI animation; prefer instant transitions over smooth follow |
