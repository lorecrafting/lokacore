// A picture of a mounted page for the page curl. Device: react-native-skia's view capture.
import type { View } from 'react-native';
import { makeImageFromView } from '@shopify/react-native-skia';

export const snapshot = (view: View) => makeImageFromView({ current: view });
