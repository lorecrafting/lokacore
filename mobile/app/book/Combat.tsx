// A full reading page with the offered actions following its combat history.
import { useState } from 'react';
import type { group } from './model.ts';
import { ActionCard, Cards, PickLists, type Shown } from './actions.tsx';
import { commandOf } from './buttons.ts';
import { LogLines } from './lines.tsx';
import { LABEL } from './labels.ts';
import { Control, Page } from './pages.tsx';
import { RunningHead } from './RunningHead.tsx';
import { UnderInk } from './UnderInk.tsx';
import { Blow } from './Blow.tsx';
import { Reanimated } from './fade.ts';
import { useDry } from './press.ts';
import type { presenter, Button } from './presenter.ts';
import { cardKey } from './presenter.ts';

function Foot(p: { label: typeof LABEL.letGo | typeof LABEL.backToWorld; onPress: () => void }) {
  return (
    <Reanimated.View style={useDry()}>
      <Control label={p.label} onPress={p.onPress} />
    </Reanimated.View>
  );
}

type Props = {
  screen: ReturnType<ReturnType<typeof presenter>['screen']>;
  g: ReturnType<typeof group>;
  press: (button: Button) => void;
  world: () => void;
};

// A live fight's response cards, each foe's Cast a spell… last.
function Responses(p: Props & { shown: Shown }) {
  const { view, text } = p.screen;
  const casts = p.screen.buttons.filter((b) => commandOf(b) === 'cast');
  const foes = view.combat!.active_opponents?.map((o) => o.id) ?? [view.combat!.opponent_id];
  const stand = p.g.position.find((b) => b.action_key === 'stand');
  return (
    <Cards>
      {stand && <ActionCard b={stand} press={p.press} />}
      {p.g.look && <ActionCard b={p.g.look} press={p.press} />}
      {p.g.flee.map((b) => (
        <ActionCard key={cardKey(b)} b={b} press={p.press} />
      ))}
      {p.g.bandage.map((b) => (
        <ActionCard key={b.target_ids[0]} b={b} press={p.press} />
      ))}
      {/* a pick keeps the combat page (loka-x6t.109.5) */}
      {foes.map((id) => (
        <PickLists
          key={id}
          page={id}
          view={view}
          buttons={casts.filter((b) => b.detail_id === id)}
          text={text}
          press={p.press}
          pending={p.screen.pending}
          state={p.shown}
        />
      ))}
    </Cards>
  );
}

/**
 * The combat foreground (book-ui.md, Live combat response).
 * - Use: while a fight is on, and its closed page until the foot is pressed.
 * - Rules: the page opens with its log (no foe or band line above it, owner 2026-11-02), then the
 *   response cards, each live foe's Cast a spell… last; no PageFoot. The page follows its newest
 *   line; each round's lines (one receipt) are one block, a block gap between rounds. A closed
 *   fight has one foot control: Back to World, or Let go when the player fell in it (Falling).
 * - States: one foe; pack; bleeding; rounds; death (held red, Let go, no countdown).
 * - Story: CombatPage.stories.tsx
 */
export function Combat(p: Props) {
  const { view, text, combatLog, ended, fell } = p.screen;
  const shown: Shown = useState(); // one for every foe's list: one list open at a time (book-ui.md)
  if (!view.combat && !ended) return null;
  // A closed encounter keeps its page: no actions, one foot control (book-ui.md, Closure).
  // ponytail: Let go goes to World as Back to World does until the spirit state (loka-kgd.205).
  const foot = !view.combat && (
    <Foot label={fell ? LABEL.letGo : LABEL.backToWorld} onPress={p.world} />
  );
  return (
    // Paper behind the running head too: the leaving page fades over the arriving one.
    <Blow under={<UnderInk view={view} />}>
      <RunningHead view={view} text={text} />
      <Page paperless title="Combat" foot={foot} scrollToEnd={combatLog.length > 0}>
        <LogLines lines={combatLog} />
        {view.combat && <Responses {...p} shown={shown} />}
      </Page>
    </Blow>
  );
}
