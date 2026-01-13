# Mobile UX Iteration Session

Interactive UX improvement for the Expo mobile app.

> **Mode**: Interactive with screenshots

## Prerequisites

Start the app in one of these modes:

```bash
# Option 1: Web mode (fastest for iteration)
npm run web

# Option 2: iOS Simulator
npm run ios

# Option 3: Physical device via Expo Go
npm start
```

## Iteration Loop

### 1. Capture Current State

For **web mode**: Use Claude-in-Chrome to screenshot localhost:8081

For **simulator**: Run in terminal:
```bash
xcrun simctl io booted screenshot /tmp/mobile-screenshot.png
```

For **physical device**: Take screenshot on phone and upload

### 2. Analyze Against Mobile Style Guide

Compare against src/theme.ts and living ebook principles:

**Colors** (grayscale only):
- background: #FAFAFA
- text: #222222
- textMuted: #767676
- border: #E5E5E5

**Typography**:
- Serif font (Georgia)
- Title: 28px bold
- Prose: 18px, line-height 27
- Links: underlined, same color as text

**Spacing**:
- xs: 4, sm: 8, md: 16, lg: 24, xl: 32

**Mobile-specific**:
- Touch targets: minimum 44x44 points
- Safe area handling
- Keyboard avoidance
- Bottom bar visibility

### 3. Common Mobile UX Issues

Check for:
1. Touch targets too small (< 44pt)
2. Text too small for mobile (< 16px body)
3. Not enough breathing room (padding)
4. ScrollView not scrolling smoothly
5. Safe area violations (notch, home indicator)
6. No loading states for network actions
7. Keyboard blocking input fields

### 4. Generate Fixes

For each issue:
- File path (mobile/src/components/...)
- Current code
- Proposed change
- React Native specifics (StyleSheet, flex, etc.)

## Key Files

| Component | Path |
|-----------|------|
| Theme | src/theme.ts |
| Room View | src/components/RoomView.tsx |
| Bottom Bar | src/components/BottomBar.tsx |
| Typography | src/components/EbookText.tsx |
| Game Screen | app/game.tsx |
| Login Screen | app/index.tsx |
| Types | src/types/game.ts |

## Quick Commands

- "screenshot" - Capture current state
- "analyze" - Check against style guide
- "fix [component]" - Apply suggested fix
- "touch targets" - Audit touch target sizes
- "spacing" - Check spacing consistency
