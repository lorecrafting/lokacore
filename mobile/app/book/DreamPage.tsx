import type { GameView } from '../../packages/game-view/session.ts';
import type { Page as Route } from './model.ts';
// A resumable child of the actual bed, using the existing detail/control grammar.
import { Text } from 'react-native';
import type { Button, presenter } from './presenter.ts';
import { dreamAt, dreamOwner } from './dreams.ts';
import { ActionCard, Cards } from './actions.tsx';
import { LogLines } from './lines.tsx';
import { Control, Page } from './pages.tsx';
import { note, prose, usePalette } from './palette.ts';
import { LABEL } from './labels.ts';

type Screen = ReturnType<ReturnType<typeof presenter>['screen']>;
export function DreamPage(p: {
  screen: Screen;
  id: string;
  press: (b: Button, detail?: string) => void;
  close: () => void;
}) {
  const c = usePalette();
  const dream = dreamAt(p.screen.view, p.id),
    owner = dreamOwner(p.id);
  if (!dream) return null;
  const buttons = p.screen.buttons.filter((b) => b.detail_id === owner);
  return (
    <Page
      title={p.screen.text(dream.title)}
      foot={<Control label={LABEL.close} onPress={p.close} />}
    >
      <Text style={prose(c)}>{p.screen.text(dream.description)}</Text>
      <LogLines lines={p.screen.detail(owner)} />
      <Text style={prose(c)}>{p.screen.text(dream.line)}</Text>
      <Cards>
        {buttons.map((b) => (
          <ActionCard
            key={b.action_key + JSON.stringify(b.input)}
            b={b}
            press={(b) => p.press(b, owner)}
          />
        ))}
      </Cards>
    </Page>
  );
}

export function DreamResume(p: {
  detail: NonNullable<GameView['notices']>[number];
  open: (page: Route) => void;
}) {
  const c = usePalette();
  const d = p.detail.dream;
  return d?.available ? (
    <Control label={LABEL.resumeDream} onPress={() => p.open({ kind: 'dream', id: p.detail.id })} />
  ) : d?.index === -1 ? (
    <Text style={note(c)}>Dream acknowledged.</Text>
  ) : null;
}
