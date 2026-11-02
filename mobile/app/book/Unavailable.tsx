// An action card's refused form: the grey card and its reason (book-ui.md, Unavailable actions).
import { type ReactNode, useState } from 'react';
import { AccessibilityInfo, Pressable, View } from 'react-native';
import { Text } from './Text.tsx';
import { Reanimated } from './fade.ts';
import { haptic } from './haptic';
import { refusedProps, Tap } from './pages.tsx';
import { useDry } from './press.ts';
import { note, prose, usePalette, useType } from './palette.ts';
import { unseen } from './lines.tsx';
import { reasonSentence } from './reasons.ts';
import { radius, size, space, type } from './tokens.ts';

type Refusal = { label: string; reason?: string; name?: string; link?: string; send?: () => void };

export const card = (c: ReturnType<typeof usePalette>, grayed = false) => ({
  backgroundColor: grayed ? c.bg : c.card,
  borderColor: c.line,
  borderWidth: size.rule,
  borderRadius: radius.card,
  minHeight: size.card,
  justifyContent: 'center' as const,
  paddingVertical: space.md,
  paddingHorizontal: space.lg,
});

// A shop line's words with its `link` words drawn as the room link (lines.tsx nameLink's style).
export const linked = (label: string, link: string) => {
  const i = label.indexOf(link);
  return i < 0
    ? [label]
    : [
        label.slice(0, i),
        <Text key="link" style={type.named}>
          {link}
        </Text>,
        label.slice(i + link.length),
      ];
};

// ponytail: announceForAccessibility is a no-op on web, where the card's own polite region reads the
// sentence; where native maps aria-live too, it may be read twice (Footer.tsx, check on device).
/**
 * The unavailable form: its own component, so its pressed state is the card's alone.
 * - Use: ActionCard only; exported from its own file.
 * - Rules: the state keeps the label and reason it was pressed on, so a changed card starts
 *   unpressed. Its name is the shown text, then the rest of `name`, which starts with the label
 *   (label in name). Once pressed the name holds the reason, so the hint drops it: read once either
 *   way. With `send` the press goes to the engine and the log's line reads the sentence (book-ui.md,
 *   Live announcements).
 * - States: at rest; pressed, with its reason; dried reason.
 * - Story: ActionCard.stories.tsx
 */
export function Unavailable(p: Refusal) {
  const c = usePalette();
  const sentence = reasonSentence(p.reason);
  const [pressed, setPressed] = useState<string>();
  const shown = `${p.label}\n${sentence}`;
  const grayed = pressed === shown;
  const label = p.link ? linked(p.label, p.link) : p.label;
  const a11y = (grayed && sentence ? shown : p.label) + (p.name ?? p.label).slice(p.label.length);
  const hint = grayed ? '' : sentence;
  const press = () => {
    setPressed(shown);
    haptic('warning');
    if (p.send) p.send();
    else if (sentence) AccessibilityInfo.announceForAccessibility(sentence);
  };
  const reason = grayed ? sentence : '';
  const body = <RefusedBody grayed={grayed} label={label} reason={reason} />;
  return (
    <View>
      {p.link ? (
        <Tap label={a11y} refused={hint} onPress={press}>
          {body}
        </Tap>
      ) : (
        <Pressable
          accessibilityLabel={a11y}
          {...refusedProps(hint)}
          onPress={press}
          style={card(c, grayed)}
        >
          {body}
        </Pressable>
      )}
      <SaidReason>{p.send ? null : reason || null}</SaidReason>
    </View>
  );
}

const SaidReason = ({ children }: { children: string | null }) => (
  <View aria-live="polite" style={unseen}>
    {children ? <Text>{children}</Text> : null}
  </View>
);

function RefusedBody(p: { grayed: boolean; label: ReactNode; reason: string }) {
  const [c, t] = [usePalette(), useType()];
  return (
    <>
      <Text style={p.grayed ? note(c, t) : prose(c, t)}>
        {p.label}
        {p.reason ? ' ' /* keeps the blocks' text apart: the name contains what is shown */ : null}
      </Text>
      {p.reason ? <DriedReason>{p.reason}</DriedReason> : null}
    </>
  );
}

// Its own block and component: a nested Text cannot animate on native, and this mounts on the press.
function DriedReason({ children }: { children: string }) {
  const [c, t] = [usePalette(), useType()];
  return (
    <Reanimated.View style={useDry()}>
      <Text style={note(c, t)}>{children}</Text>
    </Reanimated.View>
  );
}
