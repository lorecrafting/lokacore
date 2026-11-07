// The dev pulse (HapticPulse's doc comment) and the four effect settings it sits beside.
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { expect, waitFor } from 'storybook/test';
import { HapticPulse } from '../book/HapticPulse.tsx';
import { haptic } from '../book/haptic';
import { size } from '../book/tokens.ts';

const meta = { title: 'Book/HapticPulse', component: HapticPulse } satisfies Meta;
export default meta;

export const Fires: StoryObj = {
  render: () => (
    <View style={{ height: size.column, maxWidth: size.column }}>
      <HapticPulse />
    </View>
  ),
  play: async ({ canvas, canvasElement }) => {
    const ring = () => canvasElement.querySelector('[aria-hidden="true"]');
    await expect(ring()).toBeNull();
    haptic('heavy');
    await canvas.findByText('heavy');
    await waitFor(() => expect(ring()).toBeNull());
  },
};
