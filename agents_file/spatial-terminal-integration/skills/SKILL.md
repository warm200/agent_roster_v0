---
name: terminal-integration-specialist
description: Provides concrete guidance on building terminal emulators in Swift using SwiftTerm, including configuring terminal views, parsing ANSI/VT100 escape sequences, managing PTY connections, and optimizing text rendering performance. Use when the user is building a terminal app, console view, or xterm-compatible emulator in Swift, integrating SwiftTerm into a SwiftUI or UIKit/AppKit app, working with PTY or SSH stream bridging, handling keyboard input and escape sequences, or optimizing terminal rendering on macOS, iOS, or visionOS.
color: green
---

# Terminal Integration Specialist

Actionable guidance for SwiftTerm-based terminal emulation on Apple platforms: embedding terminal views, bridging SSH/PTY streams, handling input, and optimizing rendering.

---

## 1. Embedding SwiftTerm in a SwiftUI App

### Step 1 — Add the dependency

In `Package.swift`:
```swift
dependencies: [
    .package(url: "https://github.com/migueldeicaza/SwiftTerm.git", from: "1.2.0")
],
targets: [
    .target(name: "YourApp", dependencies: ["SwiftTerm"])
]
```

### Step 2 — Wrap the platform view

SwiftTerm ships `LocalProcessTerminalView` (macOS) and `TerminalView` (iOS/macOS). Wrap with `UIViewRepresentable` / `NSViewRepresentable`:

```swift
// iOS / visionOS
import SwiftUI
import SwiftTerm

struct TerminalRepresentable: UIViewRepresentable {
    @Binding var terminal: TerminalView?

    func makeUIView(context: Context) -> TerminalView {
        let tv = TerminalView(frame: .zero)
        tv.terminalDelegate = context.coordinator
        DispatchQueue.main.async { terminal = tv }
        return tv
    }

    func updateUIView(_ uiView: TerminalView, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator() }

    class Coordinator: TerminalViewDelegate {
        // Key methods — implement remaining delegate methods as needed
        func send(source: TerminalView, data: ArraySlice<UInt8>) {}
        func sizeChanged(source: TerminalView, newCols: Int, newRows: Int) {}
    }
}
```

### Step 3 — Declare in SwiftUI

```swift
struct ContentView: View {
    @State private var terminal: TerminalView?

    var body: some View {
        TerminalRepresentable(terminal: $terminal)
            .ignoresSafeArea()
            .onAppear {
                terminal?.configureNativeColors()
            }
    }
}
```

✅ **Checkpoint**: The terminal view renders a blank screen with a cursor — no crash on first launch.

---

## 2. Connecting a PTY / Local Process (macOS)

```swift
import SwiftTerm

let termView = LocalProcessTerminalView(frame: view.bounds)
termView.autoresizingMask = [.width, .height]

// Launch a shell
termView.startProcess(executable: "/bin/zsh", args: [], environment: nil, execName: nil)
view.addSubview(termView)
```

**Gotcha**: `startProcess` must be called after the view has a valid frame. Calling it before `viewDidAppear` on macOS leads to a zero-size PTY.

To resize the PTY when the view resizes:
```swift
override func viewDidLayout() {
    super.viewDidLayout()
    termView.frame = view.bounds
    // SwiftTerm detects frame changes and sends SIGWINCH automatically
}
```

✅ **Checkpoint**: Shell prompt appears; typing `ls` returns output.

---

## 3. Bridging an SSH Stream to the Terminal

When using an external SSH library (e.g., SwiftNIO SSH), feed raw bytes directly into the terminal and forward user input back:

```swift
// Receiving data from SSH channel → terminal
func sshChannelDidReceive(data: Data) {
    let bytes = [UInt8](data)
    DispatchQueue.main.async {
        self.terminalView.feed(byteArray: ArraySlice(bytes))
    }
}

// Sending user keystrokes → SSH channel  (TerminalViewDelegate.send)
func send(source: TerminalView, data: ArraySlice<UInt8>) {
    let outData = Data(data)
    sshChannel.writeData(outData)   // your SSH channel write call
}

// Propagate terminal size to SSH server
func sizeChanged(source: TerminalView, newCols: Int, newRows: Int) {
    sshChannel.sendWindowChange(cols: newCols, rows: newRows)
}
```

**Gotcha**: Always call `feed` on the main thread — SwiftTerm's internal terminal state is not thread-safe.

✅ **Checkpoint**: Remote shell prompt appears; resize the window and the server-side `$COLUMNS` updates.

---

## 4. Handling Keyboard Input and Special Keys

Inject special sequences manually when needed:

```swift
// Sending a raw escape sequence (e.g., arrow up = ESC [ A)
func sendEscapeSequence(_ seq: String) {
    terminalView.send(txt: seq)   // convenience wrapper
}

// Common sequences
sendEscapeSequence("\u{1B}[A")  // Arrow Up
sendEscapeSequence("\u{1B}[B")  // Arrow Down
sendEscapeSequence("\u{1B}[1;5C") // Ctrl+Right
sendEscapeSequence("\u{03}")    // Ctrl+C (ETX)
```

For paste operations:
```swift
UIPasteboard.general.string.map { text in
    terminalView.send(txt: text)   // SwiftTerm handles bracketed paste mode automatically
}
```

---

## 5. Appearance Customization

```swift
// Apply a color theme
var theme = ColorTheme()
theme.background   = .black
theme.foreground   = .white
theme.cursor       = .green
theme.selection    = UIColor.white.withAlphaComponent(0.3)
terminalView.applyTheme(theme: theme)

// Font
terminalView.font = UIFont.monospacedSystemFont(ofSize: 14, weight: .regular)

// Cursor style
terminalView.caretStyle = .blinkBlock    // .steadyBar, .blinkUnderline, etc.
```

---

## 6. Performance Optimization

| Problem | Cause | Fix |
|---|---|---|
| Jank during rapid output | Too many `CALayer` invalidations | Call `feed` in batches; coalesce data before calling `feed` |
| High memory on large scrollback | Default scrollback is 500 lines | Set `terminalView.terminal.options.maxScrollback = 1000` |
| CPU spike on idle blink | Cursor blink timer always active | Pause blink when app is backgrounded: `terminalView.caretStyle = .steadyBlock` |
| Slow initial render | Font metrics computed late | Pre-warm font cache by creating a throwaway `TerminalView` off-screen |

---

## 7. Accessibility

```swift
terminalView.accessibilityLabel = "Terminal"
terminalView.accessibilityTraits = .updatesFrequently

// Recompute font size on trait changes for dynamic type:
override func traitCollectionDidChange(_ previous: UITraitCollection?) {
    super.traitCollectionDidChange(previous)
    let size = UIFontMetrics.default.scaledValue(for: 14)
    terminalView.font = UIFont.monospacedSystemFont(ofSize: size, weight: .regular)
}
```

---

## 8. Common Errors and Solutions

| Error | Likely Cause | Fix |
|---|---|---|
| Terminal renders garbage characters | Wrong encoding fed to `feed` | Ensure bytes are raw UTF-8, not NSString-encoded |
| PTY size is 0×0 | `startProcess` called before layout | Call after `viewDidAppear`/`viewDidLayout` |
| `send` never called | Delegate not set | Set `terminalView.terminalDelegate` before first interaction |
| Colors look wrong on macOS | Light/dark mode mismatch | Call `terminalView.configureNativeColors()` on appearance change |

---

## Reference Links
- [SwiftTerm GitHub](https://github.com/migueldeicaza/SwiftTerm)
- [SwiftTerm API Docs](https://migueldeicaza.github.io/SwiftTerm/)
- [VT100 Specification](https://vt100.net/docs/)
- [ANSI Escape Codes](https://en.wikipedia.org/wiki/ANSI_escape_code)
