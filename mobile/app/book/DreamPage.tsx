import type { GameView } from '../../packages/game-view/session.ts';
import type { Page } from './model.ts';
// A resumable child of the actual bed, using the existing detail/control grammar.
import { Text } from 'react-native';
import type { Button, presenter } from './presenter.ts';
import { dreamAt, dreamOwner } from './dreams.ts';
import { Act, Tap, Sheet, prose, note } from './pages.tsx';

type Screen = ReturnType<ReturnType<typeof presenter>['screen']>;
export function DreamPage(p: {
  screen: Screen;
  id: string;
  press: (b: Button, detail?: string) => void;
  close: () => void;
}) {
  const dream = dreamAt(p.screen.view, p.id),
    owner = dreamOwner(p.id);
  if (!dream) return null;
  const buttons = p.screen.buttons.filter((b) => b.detail_id === owner);
  return (
    <Sheet title={p.screen.text(dream.title)}>
      <Text style={prose}>{p.screen.text(dream.description)}</Text>
      {p.screen.detail(owner).map((line, i) => (
        <Text key={i} style={prose}>
          {typeof line === 'string' ? line : line.text}
        </Text>
      ))}
      <Text style={prose}>{p.screen.text(dream.line)}</Text>
      {buttons.map((b) => (
        <Act key={b.action_key + JSON.stringify(b.input)} b={b} press={(b) => p.press(b, owner)} />
      ))}
      <Tap label="Close" onPress={p.close}>
        <Text style={prose}>Close</Text>
      </Tap>
    </Sheet>
  );
}

export function DreamResume(p: {
  detail: NonNullable<GameView['notices']>[number];
  open: (page: Page) => void;
}) {
  const d = p.detail.dream;
  return d?.available ? (
    <Tap label="Resume dream" onPress={() => p.open({ kind: 'dream', id: p.detail.id })}>
      <Text style={prose}>Resume dream</Text>
    </Tap>
  ) : d?.index === -1 ? (
    <Text style={note}>Dream acknowledged.</Text>
  ) : null;
}
