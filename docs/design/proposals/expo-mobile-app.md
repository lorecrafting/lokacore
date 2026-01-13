# Expo Mobile App Proposal

## Executive Summary

This proposal outlines a strategy for shipping Loka to iOS and Android app stores using **Expo with a native shell wrapping the existing LiveView web app**. This approach:

1. Preserves the existing LiveView codebase (no rewrite)
2. Adds native features (IAP, push notifications, camera)
3. Satisfies App Store requirements by providing an "app-like" experience
4. Uses Expo/EAS for streamlined builds and deployment

---

## Problem Statement

### App Store Rejection Risk

Both Apple and Google reject pure WebView wrapper apps:

| Store | Policy | Concern |
|-------|--------|---------|
| **Apple** | Guideline 4.2 "Minimum Functionality" | Rejects apps that are "simple web clippings" or don't differ from mobile web |
| **Google** | "WebView Spam" policy | Rejects apps designed only to drive traffic to a website |

**What gets rejected:**
- Single WebView with no native UI
- No offline capability
- No native navigation (tabs, gestures, headers)
- No push notifications or native features

**What gets approved** (Amazon, Instagram, Basecamp all use WebViews):
- Native navigation shell around WebView content
- Push notifications
- Offline handling / graceful degradation
- Native splash screens and onboarding
- App-specific features that justify native app existence

### Current State

- `_shelved/mobile/` contains a previous React Native/Expo attempt (shelved)
- The web client at `/game` is fully functional and mobile-responsive
- "Living ebook" design relies on CSS (Crimson Text font, grayscale, underlines)

---

## Proposed Architecture

### Native Shell + WebView Hybrid

```
┌─────────────────────────────────────────────────────────────┐
│                    Native Status Bar                        │
├─────────────────────────────────────────────────────────────┤
│  Native Header                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ← Back    LOKA    [Notifications] [Settings]       │   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                                                             │
│                   WebView (LiveView)                        │
│                                                             │
│              Your existing /game client                     │
│              runs here unchanged                            │
│                                                             │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  Native Tab Bar                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │   [Game]      [Shop]      [Profile]    [Settings]   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Tab Structure

| Tab | Content | Native vs WebView |
|-----|---------|-------------------|
| **Game** | LiveView `/game` | WebView |
| **Shop** | RevenueCat purchase flow | Native + WebView overlay |
| **Profile** | Player stats, achievements | Could be either |
| **Settings** | Account, notifications, theme | Native |

### Why This Satisfies App Store Requirements

1. **Native navigation** - Tab bar, header with buttons
2. **Native settings screen** - Push notification preferences, account management
3. **Native purchase flow** - RevenueCat IAP is fully native
4. **Push notifications** - Native integration with game events
5. **Offline handling** - Native "no connection" screen with retry
6. **Splash/onboarding** - Native first-launch experience

---

## Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | Expo SDK 52+ | Managed React Native |
| Navigation | Expo Router | File-based routing, native tabs |
| WebView | react-native-webview | Embed LiveView |
| IAP | react-native-purchases (RevenueCat) | Subscriptions, one-time purchases |
| Push | expo-notifications | Push tokens, local notifications |
| Camera | expo-camera | Future: item scanning, AR features |
| Build | EAS Build | Cloud iOS/Android builds |
| OTA Updates | expo-updates | Push fixes without app store review |

---

## Native Features Detail

### 1. In-App Purchases (RevenueCat)

**Products to offer:**
- Premium subscription (monthly/yearly)
- Cosmetic packs (one-time)
- Currency bundles (consumable)

**Flow:**
```
User taps "Shop" tab
  → Native RevenueCat paywall
  → Apple/Google payment sheet
  → Receipt validation (RevenueCat servers)
  → Webhook to Phoenix backend
  → Player entity updated with purchases
  → WebView receives push event
```

**Backend integration:**
```elixir
# lib/loka_web/controllers/api/webhook_controller.ex
def handle_revenuecat_webhook(conn, params) do
  case Purchases.process_webhook(params) do
    {:ok, player_id, entitlements} ->
      # Update player entity
      Player.grant_entitlements(player_id, entitlements)
      # Notify connected LiveView
      Phoenix.PubSub.broadcast(Loka.PubSub, "player:#{player_id}", {:purchases_updated, entitlements})
  end
end
```

### 2. Push Notifications

**Notification types:**
- Quest reminders ("Your crops are ready to harvest!")
- Combat events ("You're under attack!")
- Social ("Player X sent you a message")
- Marketing ("New content available")

**Integration:**
```tsx
// Native side
import * as Notifications from 'expo-notifications';

// Get push token and send to backend
const token = await Notifications.getExpoPushTokenAsync();
await fetch('https://loka.fly.dev/api/v1/devices', {
  method: 'POST',
  body: JSON.stringify({ push_token: token.data, platform: Platform.OS })
});
```

```elixir
# Backend sends notifications
defmodule Loka.Notifications do
  def send_push(player_id, title, body) do
    tokens = Devices.get_push_tokens(player_id)
    ExpoServerSDK.push(tokens, %{title: title, body: body})
  end
end
```

### 3. LiveView ↔ Native Bridge

**Native → LiveView:**
```tsx
// Inject JavaScript to trigger LiveView events
webViewRef.current?.injectJavaScript(`
  window.liveSocket.channels[0].push("purchase_complete", {
    product_id: "${productId}",
    transaction_id: "${transactionId}"
  });
`);
```

**LiveView → Native:**
```javascript
// In LiveView JS hooks
Hooks.NativeBridge = {
  mounted() {
    this.handleEvent("trigger_native", ({action, data}) => {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({action, data}));
      }
    });
  }
}
```

```tsx
// Native side receives
<WebView
  onMessage={(event) => {
    const {action, data} = JSON.parse(event.nativeEvent.data);
    switch(action) {
      case 'open_shop': navigation.navigate('Shop'); break;
      case 'request_notification_permission': requestPermissions(); break;
      case 'haptic_feedback': Haptics.impactAsync(); break;
    }
  }}
/>
```

### 4. Camera (Future)

Potential uses:
- QR code scanning for friend invites
- AR overlay for location-based features
- Photo upload for player avatars

---

## Offline Handling

### Strategy: Graceful Degradation

```tsx
function GameScreen() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected);
    });
    return unsubscribe;
  }, []);

  if (!isOnline) {
    return <OfflineScreen onRetry={() => webViewRef.current?.reload()} />;
  }

  return (
    <WebView
      source={{ uri: GAME_URL }}
      onError={() => setIsOnline(false)}
      renderError={() => <ConnectionError />}
    />
  );
}
```

### Native Offline Screen

- Show last-known player stats (cached)
- Display "Connection Lost" message styled to match game aesthetic
- "Retry" button
- Access to offline content (lore, bestiary from local storage)

---

## Project Structure

```
loka-mobile/
├── app/                          # Expo Router screens
│   ├── (tabs)/
│   │   ├── _layout.tsx          # Tab bar configuration
│   │   ├── game.tsx             # WebView to LiveView
│   │   ├── shop.tsx             # RevenueCat paywall
│   │   ├── profile.tsx          # Player stats
│   │   └── settings.tsx         # Native settings
│   ├── onboarding/
│   │   └── index.tsx            # First-launch experience
│   └── _layout.tsx              # Root layout
├── components/
│   ├── GameWebView.tsx          # Configured WebView
│   ├── OfflineScreen.tsx        # No connection UI
│   └── NativeHeader.tsx         # Styled header
├── lib/
│   ├── bridge.ts                # LiveView ↔ Native communication
│   ├── purchases.ts             # RevenueCat wrapper
│   └── notifications.ts         # Push notification handlers
├── app.json                     # Expo config
├── eas.json                     # EAS Build config
└── package.json
```

---

## Implementation Phases

### Phase 1: Minimal Viable Shell (1-2 weeks)

**Goal:** App Store-approvable wrapper

- [ ] Initialize Expo project with Expo Router
- [ ] Create native tab bar with 4 tabs
- [ ] Implement GameWebView with proper sizing
- [ ] Add native Settings screen (account, notifications toggle)
- [ ] Implement offline detection and fallback screen
- [ ] Create native splash screen and app icon
- [ ] Configure EAS Build for iOS and Android
- [ ] Submit to TestFlight and Google Play internal testing

**Deliverable:** Installable app that wraps LiveView with native navigation

### Phase 2: Push Notifications (1 week)

- [ ] Integrate expo-notifications
- [ ] Create device registration endpoint in Phoenix
- [ ] Store push tokens per player
- [ ] Implement notification permission flow
- [ ] Add notification preferences in Settings
- [ ] Send test notifications from admin dashboard
- [ ] Handle notification tap → deep link to game

**Deliverable:** Working push notifications with opt-in/out

### Phase 3: In-App Purchases (2 weeks)

- [ ] Set up RevenueCat account and products
- [ ] Integrate react-native-purchases SDK
- [ ] Create native Shop tab with paywall
- [ ] Implement RevenueCat webhook handler in Phoenix
- [ ] Add entitlements to Player entity
- [ ] Bridge purchase status to LiveView
- [ ] Test sandbox purchases on iOS and Android

**Deliverable:** Working subscription and one-time purchase flow

### Phase 4: Polish & Launch (1 week)

- [ ] First-launch onboarding flow
- [ ] App Store screenshots and metadata
- [ ] Privacy policy and terms updates
- [ ] Performance optimization
- [ ] Crash reporting (Sentry)
- [ ] Analytics (optional)
- [ ] Submit for App Store review

---

## App Store Submission Checklist

### Apple Requirements

- [ ] Native tab navigation ✓
- [ ] Native settings screen ✓
- [ ] Push notifications ✓
- [ ] Offline handling ✓
- [ ] IAP via StoreKit (RevenueCat) ✓
- [ ] Privacy nutrition labels
- [ ] IDFA disclosure (if using analytics)
- [ ] Sign in with Apple (if offering social login)

### Google Requirements

- [ ] Target API level 35 (Android 15)
- [ ] Play Billing Library integration ✓
- [ ] Data safety form
- [ ] Content rating questionnaire
- [ ] Privacy policy link

---

## Cost Estimates

| Item | Cost | Frequency |
|------|------|-----------|
| Apple Developer Program | $99 | Annual |
| Google Play Developer | $25 | One-time |
| RevenueCat | Free tier (up to $2.5k/mo revenue) | Monthly |
| EAS Build | Free tier (30 builds/mo) | Monthly |
| Expo Push | Free | - |

**Total first year:** ~$125

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| App Store rejection for "minimal functionality" | Native tabs, settings, offline screen provide clear native value |
| WebView performance issues | LiveView is lightweight text; test on older devices |
| LiveView socket disconnection on background | Handle reconnection in WebView, show native loading state |
| Push notification token expiration | Refresh tokens on app launch |
| RevenueCat webhook failures | Implement retry queue, manual sync option |

---

## Success Criteria

1. **App Store approval** on first or second submission
2. **Sub-3 second** initial load time on 4G
3. **Push notification opt-in rate** > 50%
4. **No LiveView changes required** - web and mobile share identical backend
5. **IAP revenue** covering app store fees within 3 months

---

## References

- [Expo Documentation](https://docs.expo.dev/)
- [RevenueCat Expo Guide](https://www.revenuecat.com/docs/getting-started/installation/expo)
- [Apple Guideline 4.2 Compliance](https://www.mobiloud.com/blog/app-store-review-guidelines-webview-wrapper)
- [Google Play WebView Policy](https://median.co/blog/will-google-play-approve-my-webview-app)
- [expo-notifications](https://docs.expo.dev/push-notifications/overview/)
- [react-native-webview](https://github.com/react-native-webview/react-native-webview)
