// What the chapter card asks of the device. Its own module so the Book's node tests stub it in one
// place (__tests__/react-shim.ts).
import { AppState } from 'react-native';

export { screenReaderOn } from './screenReader';

export const isForeground = () => AppState.currentState === 'active';

export const onForeground = (change: (active: boolean) => void) => {
  const sub = AppState.addEventListener('change', (state) => change(state === 'active'));
  return () => sub.remove();
};
