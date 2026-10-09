// A picture of a mounted page for the page curl. Device: react-native-skia's view capture.
import type { View } from 'react-native';
import { makeImageFromView } from '@shopify/react-native-skia';

export const snapshot = (view: View) => makeImageFromView({ current: view });
// Nothing to warm on a device: its capture is ready on the first turn.
export const warm = (_view: View) => {};
