// A full reading page with the offered actions following its combat history.
import { useState } from 'react';
import type { group } from './model.ts';
import { ActionCard, Cards, PickLists, type Shown } from './actions.tsx';
import { picks } from './pick.ts';
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

/**
 * The one foot control of an ended page: Let go or Back to World, dry until the page is read.
 * - Use: the closed Combat page's foot, the dead page's Let go.
 * - Story: CombatPage.stories.tsx
 */
export function Foot(p: {
  label: typeof LABEL.letGo | typeof LABEL.backToWorld;
  onPress: () => void;
}) {
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

type Foe = { name: string; words?: { bare: string; article?: string } };
// A foe as its projected name, definite with name words ("the goblin"); a proper name stays bare.
const named = (o: Foe, text: (key: string) => string) =>
  o.words ? `${o.words.article ? `${LABEL.the} ` : ''}${text(o.words.bare)}` : text(o.name);

// A foe's pick lists, its Cast a spell… option naming it.
const foeLists = (
  view: Parameters<typeof picks>[0],
  casts: Button[],
  o: Foe & { id: string },
  text: (key: string) => string,
) =>
  picks(
    view,
    casts.filter((b) => b.detail_id === o.id),
    o.id,
    text,
  ).map((k) =>
    k.label === LABEL.castASpell ? { ...k, label: LABEL.castASpellOn(named(o, text)) } : k,
  );

// A live fight's response cards, each foe's Cast a spell on it… last. ponytail: two foes of one
// name read alike (book-ui.md, Aimed spells off the target's page).
function Responses(p: Props & { shown: Shown }) {
  const { view, text } = p.screen;
  const casts = p.screen.buttons.filter((b) => commandOf(b) === 'cast');
  const c = view.combat!;
  const foes = c.active_opponents ?? [{ ...c, id: c.opponent_id }];
  const stand = p.g.position.find((b) => b.action_key === 'stand');
  return (
    <Cards>
      {stand && <ActionCard b={stand} press={p.press} />}
      {p.g.flee.map((b) => (
        <ActionCard key={cardKey(b)} b={b} press={p.press} />
      ))}
      {p.g.bandage.map((b) => (
        <ActionCard key={b.target_ids[0]} b={b} press={p.press} />
      ))}
      {/* a pick keeps the combat page (loka-x6t.109.5) */}
      {foes.map((o) => (
        <PickLists
          key={o.id}
          page={o.id}
          view={view}
          lists={foeLists(view, casts, o, text)}
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
 *   response cards, each live foe's Cast a spell on it… last; no PageFoot. The page follows its newest
 *   line; each round's lines (one receipt) run on as one block, one blank line between rounds. A closed
 *   fight has one foot control: Back to World, or Let go when the player fell in it (Falling).
 * - States: one foe; pack; bleeding; rounds; death (held red, Let go, no countdown).
 * - Story: CombatPage.stories.tsx
 */
export function Combat(p: Props) {
  const { view, text, combatLog, ended, fell } = p.screen;
  const shown: Shown = useState(); // one for every foe's list: one list open at a time (book-ui.md)
  if (!view.combat && !ended) return null;
  // A closed encounter keeps its page: no actions, one foot control (book-ui.md, Closure).
  // Let go goes to World; with `revival` the presenter's leaveCombat makes it the spirit state.
  const foot = !view.combat && (
    <Foot label={fell ? LABEL.letGo : LABEL.backToWorld} onPress={p.world} />
  );
  return (
    // Paper behind the running head too: the leaving page fades over the arriving one.
    <Blow under={<UnderInk view={view} />}>
      <RunningHead view={view} text={text} />
      <Page
        paperless
        title={p.screen.title ?? 'Combat'}
        foot={foot}
        scrollToEnd={combatLog.length > 0}
      >
        <LogLines lines={combatLog} rounds />
        {view.combat && <Responses {...p} shown={shown} />}
      </Page>
    </Blow>
  );
}
