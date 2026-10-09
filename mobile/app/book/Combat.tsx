// A full reading page with the offered actions following its combat history.
import { Text } from 'react-native';
import { bleedingLine, type group } from './model.ts';
import { ActionCard, Cards } from './actions.tsx';
import { LogLines } from './lines.tsx';
import { Page, RunningHead } from './pages.tsx';
import { prose, usePalette } from './palette.ts';
import type { presenter, Button } from './presenter.ts';

type Screen = ReturnType<ReturnType<typeof presenter>['screen']>;

function Foes({ view, text, combatLog }: Pick<Screen, 'view' | 'text' | 'combatLog'>) {
  const c = usePalette();
  const combat = view.combat!;
  return (
    <>
      {combat.active_opponents?.map((opponent) => (
        <Text key={opponent.id} style={prose(c)}>
          {text(opponent.name)}
          {opponent.id === combat.opponent_id ? ' (your target)' : ''}
        </Text>
      ))}
      <LogLines lines={combatLog} />
    </>
  );
}

export function Combat(p: {
  screen: ReturnType<ReturnType<typeof presenter>['screen']>;
  g: ReturnType<typeof group>;
  press: (button: Button) => void;
}) {
  const c = usePalette();
  const { view, text, combatLog } = p.screen;
  if (!view.combat) return null;
  const stand = p.g.position.find((b) => b.action_key === 'stand');
  return (
    <>
      <RunningHead view={view} text={text} />
      <Page title="Combat">
        <Text style={prose(c)}>{text(view.combat.name)}</Text>
        {view.bleeding && (
          <Text style={prose(c)}>{bleedingLine(view.bleeding, view.time, text)}</Text>
        )}
        <Foes view={view} text={text} combatLog={combatLog} />
        <Cards>
          {stand && <ActionCard b={stand} press={p.press} />}
          {p.g.look && <ActionCard b={p.g.look} press={p.press} />}
          {p.g.flee.map((b) => (
            <ActionCard key={b.label} b={b} press={p.press} />
          ))}
          {p.g.bandage.map((b) => (
            <ActionCard key={b.target_ids[0]} b={b} press={p.press} />
          ))}
        </Cards>
      </Page>
    </>
  );
}
