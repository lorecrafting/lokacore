# Loka Mobile

Native mobile client for Loka using Expo and React Native.

## Quick Start

### 1. Install Dependencies

```bash
cd mobile
npm install
```

### 2. Start the Phoenix Server

```bash
cd ../server
mix phx.server
```

### 3. Configure Server URL

Edit `src/hooks/usePhoenix.ts` and `src/hooks/useAuth.ts`:

```typescript
// For development on a physical device, use your computer's local IP
// Find it with: ifconfig (Mac/Linux) or ipconfig (Windows)
const API_URL = 'http://192.168.1.XXX:4000';  // Replace with your IP
```

### 4. Start Expo

```bash
npm start
```

### 5. Open on Your Phone

1. Install **Expo Go** from App Store / Play Store
2. Scan the QR code shown in terminal
3. The app loads on your phone!

## Development Flow

1. Make changes to React Native code → see them instantly on phone
2. Make changes to Phoenix backend → app reconnects automatically
3. Share your Expo URL with testers (they need Expo Go installed)

## Project Structure

```
mobile/
├── app/                    # Expo Router screens
│   ├── _layout.tsx         # Root layout
│   ├── index.tsx           # Login screen
│   └── game.tsx            # Main game screen
├── src/
│   ├── components/         # UI components
│   │   ├── BottomBar.tsx   # Navigation & vitals
│   │   ├── EbookText.tsx   # Typography components
│   │   └── RoomView.tsx    # Room display
│   ├── hooks/              # React hooks
│   │   ├── useAuth.ts      # Authentication
│   │   └── usePhoenix.ts   # Phoenix channel connection
│   ├── types/              # TypeScript types
│   │   └── game.ts         # Game state types
│   └── theme.ts            # Colors, fonts, spacing
├── app.json                # Expo configuration
├── package.json            # Dependencies
└── tsconfig.json           # TypeScript config
```

## Styling

The app uses the same "Living Ebook" aesthetic as the web client:

- Grayscale color palette (#FAFAFA background, #222222 text)
- Serif typography (Georgia)
- Underlined links instead of buttons
- Centered, book-like layout

## Building for Production

### Preview Build (for testers)

```bash
npx expo install expo-dev-client
npx eas build --profile preview --platform ios
npx eas build --profile preview --platform android
```

### Production Build

```bash
npx eas build --profile production --platform ios
npx eas build --profile production --platform android
```

See [Expo Build docs](https://docs.expo.dev/build/introduction/) for details.

## Troubleshooting

### "Network request failed"

- Make sure Phoenix server is running
- Use your computer's local IP, not `localhost`
- Check firewall settings

### "Invalid token"

- Try logging out and back in
- Check that GUARDIAN_SECRET_KEY is set in server

### "character_not_created"

- Create a character on the web client first
- Mobile character creation coming soon
