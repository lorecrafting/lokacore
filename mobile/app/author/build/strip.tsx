// The Build strip's look (docs/system/book-ui.md#author-mode): its row, its warnings, the Build switch
// and the keep-my-place notice; Build.tsx holds the state they draw.
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { size, space, type } from '../../book/tokens.ts';
import { ink, refusal } from './build.ts';
import { act, CONTROL } from './sheet.tsx';
import type { Place } from './Build.tsx';

const WORDS = {
  build: 'Build',
  on: '✎ Build',
  drop: 'Drop it and go on',
  back: 'Back to checkpoint',
  room: 'Start in this room',
};
export const STRIP = {
  minHeight: size.touch,
  flexDirection: 'row',
  alignItems: 'center',
  gap: space.md,
  flexWrap: 'wrap',
  // public/index.html's viewport-fit=cover draws under the notch; RN-web passes env() through
  paddingLeft: `max(${space.md}px, env(safe-area-inset-left))` as never,
  paddingRight: `max(${space.md}px, env(safe-area-inset-right))` as never,
  borderBottomWidth: size.rule,
} as const;
export const TOP = { paddingTop: 'env(safe-area-inset-top)' as never }; // the top strip only, not the Notice under it
export const warn = (text: ReactNode) => (
  <Text aria-live="polite" style={{ ...type.small, color: ink('warning') }}>
    {text}
  </Text>
);
/** The keep-my-place notice, while the recorded path's replay stands refused. */
export function Notice({ placed, room }: { placed?: Place; room?: string }) {
  const at = placed?.place();
  if (at?.refused === undefined) return null;
  return (
    <View style={{ ...STRIP, backgroundColor: ink('bg'), borderColor: ink('line') }}>
      {warn(refusal(at.steps, at.refused))}
      {act(WORDS.drop, placed!.drop)}
      {at.checkpoint ? act(WORDS.back, placed!.back) : null}
      {room ? act(WORDS.room, () => placed!.startIn(room)) : null}
    </View>
  );
}
/** The Build switch: on, it reads as on, in action ink. */
export const buildSwitch = (on: boolean, flip: () => void) => (
  <Pressable
    accessibilityRole="switch"
    accessibilityState={{ checked: on }}
    accessibilityLabel={WORDS.build}
    onPress={flip}
    style={CONTROL}
  >
    <Text style={{ ...type.control, color: ink(on ? 'action' : 'fg') }}>
      {on ? WORDS.on : WORDS.build}
    </Text>
  </Pressable>
);
