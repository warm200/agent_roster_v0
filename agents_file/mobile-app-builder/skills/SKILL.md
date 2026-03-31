---
name: mobile-app-builder
description: Builds native iOS and Android apps, creates cross-platform mobile applications using React Native or Flutter, configures mobile build systems, and debugs platform-specific issues including crashes, permissions, and store rejections. Use when the user asks about mobile app development, iOS or Android projects, Swift, SwiftUI, Kotlin, Jetpack Compose, React Native, Flutter, mobile UI design, push notifications, offline sync, in-app purchases, .ipa or .apk builds, or app store submission.
color: purple
---

# Mobile App Builder

## Workflow

### 1. Clarify Scope
- Determine target platforms (iOS, Android, or both), minimum OS versions, and offline requirements.
- Identify native capabilities needed: camera, biometrics, location, notifications, background tasks.
- Confirm framework choice (native Swift/Kotlin vs. React Native vs. Flutter) based on team skills, performance needs, and maintenance horizon.

### 2. Scaffold the Project

**SwiftUI screen scaffold (iOS)**
```swift
import SwiftUI

struct ContentView: View {
    @StateObject private var viewModel = ContentViewModel()

    var body: some View {
        NavigationStack {
            List(viewModel.items) { item in
                Text(item.title)
            }
            .navigationTitle("Home")
            .task { await viewModel.load() }
        }
    }
}

@MainActor
final class ContentViewModel: ObservableObject {
    @Published var items: [Item] = []

    func load() async {
        // fetch or load from local store
    }
}
```

**Jetpack Compose screen scaffold (Android)**
```kotlin
@Composable
fun HomeScreen(viewModel: HomeViewModel = viewModel()) {
    val items by viewModel.items.collectAsStateWithLifecycle()

    Scaffold(topBar = { TopAppBar(title = { Text("Home") }) }) { padding ->
        LazyColumn(contentPadding = padding) {
            items(items) { item -> Text(item.title) }
        }
    }
}
```

**React Native project bootstrap**
```bash
npx react-native init MyApp --template react-native-template-typescript
cd MyApp
npx react-native run-ios        # launch on iOS simulator
npx react-native run-android    # launch on connected Android device/emulator
```

**Flutter project bootstrap**
```bash
flutter create my_app
cd my_app
flutter pub get
flutter analyze                 # static analysis before first run
flutter run                     # hot-reload dev session
```

### 3. Implement Core Flows
- Handle permissions at the point of need with graceful degradation when denied — including the "never ask again" path on Android, which requires routing the user to Settings manually.
- Avoid storing sensitive tokens in plain app storage; use Keychain (iOS) or Keystore (Android) regardless of framework.

### 4. Integrate Device and Backend Features
- **Push notifications:** a single APNs/FCM credential error will silently drop notifications on production; verify the certificate/key rotation schedule and test with a real device before each release.
- **Offline sync:** queue mutations locally and replay on reconnect — define a conflict resolution strategy (last-write-wins vs. user-prompted merge) before implementation, as retrofitting it is costly.
- **Analytics and crash reporting:** initialize before first screen render; never block the main thread during SDK setup.
- For deeper platform-specific setup (push notification entitlements, offline sync patterns, background task limits), consider dedicated reference files per topic.

### 5. Validate on Real Devices
```bash
# Android — install debug build on connected device
adb install -r build/app/outputs/flutter-apk/app-debug.apk
adb logcat | grep MyApp          # stream logs

# iOS — run on physical device via Xcode scheme
xcodebuild -scheme MyApp -destination 'platform=iOS,name=iPhone' build

# Flutter — profile-mode run to catch jank
flutter run --profile

# React Native — bundle analyzer
npx react-native bundle --platform ios --dev false --entry-file index.js \
  --bundle-output /tmp/main.jsbundle --sourcemap-output /tmp/main.map
```

**Validation checkpoints before each milestone:**
- [ ] No `flutter analyze` or `swiftlint` warnings in CI.
- [ ] Startup time < 2 s cold launch on a mid-range device.
- [ ] Memory profile shows no steady leak over 10-minute session.
- [ ] All permission flows tested with "deny" and "never ask again" paths.
- [ ] Offline scenario: airplane mode during sync does not corrupt local state.

### 6. Prepare for Store Release

**Framework decision tree**
```
Need maximum native performance or heavy platform APIs?
  └─ Yes → Native (Swift/Kotlin)
  └─ No → Shared codebase acceptable?
       └─ Single codebase, rich UI → Flutter
       └─ JS/TS team, web code reuse → React Native
```

**Release checklist**
- [ ] App icons and splash screens at all required resolutions.
- [ ] Privacy manifest (iOS 17+) and `NSUsageDescription` keys populated.
- [ ] `minSdkVersion` / deployment target set to the lowest supported OS.
- [ ] ProGuard / R8 rules verified; no runtime crashes after obfuscation (Android).
- [ ] TestFlight or Firebase App Distribution build tested by QA on real hardware.
- [ ] Crash monitoring (Sentry, Crashlytics) enabled and reporting to the correct environment.
- [ ] App Store / Play Store metadata, screenshots, and content rating complete.

## Constraints
- Follow Human Interface Guidelines (iOS) and Material Design (Android); do not port one platform's patterns onto the other.
- Treat offline behavior, synchronization conflicts, and permission flows as first-class product requirements.
- Call out battery drain, background execution limits, and store-review risks explicitly.
- Prefer real-device validation over simulator-only confidence.
