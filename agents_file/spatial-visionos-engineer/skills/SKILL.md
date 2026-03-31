---
name: visionos-spatial-engineer
description: Builds native visionOS and Apple Vision Pro apps using SwiftUI, RealityKit, and the Liquid Glass design system. Creates volumetric views, implements Liquid Glass materials, configures immersive spaces, manages spatial WindowGroups, designs 3D UI layouts, and wires up RealityKit entities with gestures and attachments. Use when building visionOS apps, Apple Vision Pro experiences, volumetric windows, immersive spaces, mixed reality interfaces, or applying Liquid Glass effects with SwiftUI and RealityKit on visionOS 26.
color: indigo
---

# visionOS Spatial Engineer

**Specialization**: Native visionOS 26 spatial computing — SwiftUI volumetric interfaces, Liquid Glass design, RealityKit integration, and immersive space architecture.

## Documentation References
- [visionOS](https://developer.apple.com/documentation/visionos/)
- [What's new in visionOS 26 - WWDC25](https://developer.apple.com/videos/play/wwdc2025/317/)
- [Set the scene with SwiftUI in visionOS - WWDC25](https://developer.apple.com/videos/play/wwdc2025/290/)
- [visionOS 26 Release Notes](https://developer.apple.com/documentation/visionos-release-notes/visionos-26-release-notes)
- [What's new in SwiftUI - WWDC25](https://developer.apple.com/videos/play/wwdc2025/256/)

---

## Workflows at a Glance

| # | Workflow | Key API |
|---|----------|---------|
| 1 | Liquid Glass Window | `.glassBackgroundEffect()` |
| 2 | Volumetric WindowGroup | `.windowStyle(.volumetric)` |
| 3 | Immersive Space | `ImmersiveSpace`, `openImmersiveSpace` |
| 4 | Ornaments & RealityKit Attachments | `.ornament()`, `ViewAttachmentComponent` |

---

## Workflow 1 — Liquid Glass Window

**Goal**: Create a visionOS 26 window with a translucent Liquid Glass background that adapts to its surroundings.

### Step 1 — Declare the WindowGroup scene

```swift
import SwiftUI

@main
struct MyApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .windowStyle(.plain)          // required for custom glass backgrounds
        .defaultSize(width: 600, height: 400, depth: 0)
    }
}
```

### Step 2 — Apply `glassBackgroundEffect`

```swift
struct ContentView: View {
    var body: some View {
        VStack(spacing: 20) {
            Text("Spatial Panel")
                .font(.title)
            ControlsView()
        }
        .padding(32)
        .glassBackgroundEffect()      // Liquid Glass material
    }
}
```

**Validation**: Run on visionOS 26 Simulator. The panel should appear translucent against PassThrough and adapt tint when placed near coloured surfaces.

### Step 3 — Configure display mode (tinted vs. clear)

```swift
.glassBackgroundEffect(in: RoundedRectangle(cornerRadius: 24),
                       displayMode: .always)  // .always | .implicit | .never
```

---

## Workflow 2 — Volumetric WindowGroup

**Goal**: Open a unique (single-instance) volumetric window for 3D content.

### Step 1 — Declare a volumetric scene

```swift
WindowGroup(id: "model-viewer") {
    ModelViewerContent()
}
.windowStyle(.volumetric)
.defaultSize(width: 0.4, height: 0.4, depth: 0.4, in: .meters)
```

### Step 2 — Open the window from another scene

```swift
struct LaunchView: View {
    @Environment(\.openWindow) private var openWindow

    var body: some View {
        Button("Open 3D Viewer") {
            openWindow(id: "model-viewer")
        }
    }
}
```

### Step 3 — Place 3D content inside the volume

```swift
struct ModelViewerContent: View {
    var body: some View {
        RealityView { content in
            let sphere = ModelEntity(
                mesh: .generateSphere(radius: 0.1),
                materials: [SimpleMaterial(color: .systemBlue, isMetallic: true)]
            )
            content.add(sphere)
        }
        .frame(depth: 0.4)
    }
}
```

**Validation**: The volume should present as a floating 3D box in the user's space with correct meter-scale sizing.

---

## Workflow 3 — Immersive Space

**Goal**: Enter a fully immersive RealityKit scene.

### Step 1 — Declare the ImmersiveSpace scene

```swift
ImmersiveSpace(id: "main-immersive") {
    ImmersiveView()
}
.immersionStyle(selection: .constant(.mixed), in: .mixed)
```

### Step 2 — Build the immersive view with observable entities

```swift
import SwiftUI
import RealityKit

@Observable
class SceneModel {
    var rootEntity = Entity()
}

struct ImmersiveView: View {
    @State private var scene = SceneModel()

    var body: some View {
        RealityView { content in
            content.add(scene.rootEntity)
            await setupEnvironment(root: scene.rootEntity)
        } update: { content in
            // react to @Observable changes here
        }
        .gesture(
            TapGesture()
                .targetedToAnyEntity()
                .onEnded { value in
                    value.entity.components[OpacityComponent.self] =
                        OpacityComponent(opacity: 0.5)
                }
        )
    }

    private func setupEnvironment(root: Entity) async {
        guard let anchor = try? await ModelEntity(named: "scene", in: .main) else { return }
        root.addChild(anchor)
    }
}
```

### Step 3 — Enter/exit the space

```swift
struct HomeView: View {
    @Environment(\.openImmersiveSpace) private var openImmersiveSpace
    @Environment(\.dismissImmersiveSpace) private var dismissImmersiveSpace
    @State private var isImmersed = false

    var body: some View {
        Toggle(isImmersed ? "Exit Space" : "Enter Space", isOn: $isImmersed)
            .onChange(of: isImmersed) { _, entering in
                Task {
                    if entering {
                        await openImmersiveSpace(id: "main-immersive")
                    } else {
                        await dismissImmersiveSpace()
                    }
                }
            }
    }
}
```

**Validation**: Toggling should smoothly enter/exit the immersive context without leaving orphaned windows open.

---

## Workflow 4 — Spatial Widgets and Ornaments

**Goal**: Add a persistent ornament to a window and configure spatial widget snap behaviour.

### Ornament placement

```swift
struct ContentView: View {
    var body: some View {
        MainContent()
            .ornament(attachmentAnchor: .scene(.bottom)) {
                HStack(spacing: 16) {
                    Button(action: {}) { Image(systemName: "house") }
                    Button(action: {}) { Image(systemName: "gearshape") }
                }
                .padding(12)
                .glassBackgroundEffect()
            }
    }
}
```

### ViewAttachmentComponent for RealityKit entities

```swift
RealityView { content, attachments in
    if let label = attachments.entity(for: "entityLabel") {
        label.position = [0, 0.15, 0]
        content.add(label)
    }
} attachments: {
    Attachment(id: "entityLabel") {
        Text("My Object")
            .padding(8)
            .glassBackgroundEffect()
    }
}
```

---

## Key Patterns & Pitfalls

| Situation | Guidance |
|-----------|----------|
| `glassBackgroundEffect` not visible | Ensure `.windowStyle(.plain)` is set on the `WindowGroup` |
| Volumetric window reopens multiple instance | Use `WindowGroup(id:)` with `.unique` presentation; visionOS 26 enforces single-instance by default |
| RealityKit entity gestures not firing | Attach `.targetedToAnyEntity()` on the `RealityView`, not on child views |
| Immersive space hangs on open | `openImmersiveSpace` is async — always `await` inside a `Task` |
| Depth/z ordering looks wrong | Use `.zIndex` for SwiftUI layers; use `entity.position.z` for RealityKit objects |
