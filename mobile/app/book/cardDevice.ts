// What the chapter card asks of the device. Its own module so the Book's node tests stub it in one
// place (__tests__/react-shim.ts).
import { AccessibilityInfo, AppState, Platform } from 'react-native';

// ponytail: react-native-web always answers true, so the web cannot tell and auto-turns; its screen
// reader hears the title and has the tap. Upgrade if a web reader ever needs the explicit Continue.
export const screenReaderOn = () =>
  Platform.OS === 'web' ? Promise.resolve(false) : AccessibilityInfo.isScreenReaderEnabled();

export const isForeground = () => AppState.currentState === 'active';

export const onForeground = (change: (active: boolean) => void) => {
  const sub = AppState.addEventListener('change', (state) => change(state === 'active'));
  return () => sub.remove();
};
