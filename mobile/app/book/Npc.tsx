// The NPC page: conversation, choices, skills, shop and services, what the NPC holds, with the existing book controls.
import { View } from 'react-native';
import { Text } from './Text.tsx';
import type { GameView } from '../../packages/game-view/session.ts';
import { absent, cap, plain, things, why, type group, type Page as Route } from './model.ts';
import type { Button, DetailLine, presenter } from './presenter.ts';
import { cardKey } from './presenter.ts';
import { ActionCard, Cards } from './actions.tsx';
import { Asides, LogLines, Note } from './lines.tsx';
import { Control, Page, type Thing } from './pages.tsx';
import { inside } from './Menu.tsx';
import { note, prose, usePalette, useType, type Palette, type Type } from './palette.ts';
import { Riddle } from './Riddle.tsx';
import { space } from './tokens.ts';
import { LABEL } from './labels.ts';
import { offerLabel } from './offers.ts';
import { balance, buyReason, refused, sellReason } from './words.ts';
type Say = (key: string) => string;
type Grouped = ReturnType<typeof group>;
type Screen = ReturnType<ReturnType<typeof presenter>['screen']>;

// The pending choice (06 §43): the prompt, each answer (an unavailable one with its reason, not
// pressable), inside the full NPC/conversation detail page.
function Choice(p: {
  view: GameView;
  choice: NonNullable<GameView['choice']>;
  text: Say;
  g: Grouped;
  press: (b: Button) => void;
}) {
  const c = usePalette();
  const t = useType();
  const answer = (id: string) =>
    p.g.choice.find((b) => (b.input as { choice_id?: string }).choice_id === id);
  return (
    <View style={{ gap: space.sm }}>
      {p.choice.riddle?.attempts && (
        <Text style={note(c, t)}>
          {p.choice.riddle.attempts.count} / {p.choice.riddle.attempts.limit} wrong answers this
          sitting.
        </Text>
      )}
      {absent(p.view) !== '' && <Text style={note(c, t)}>{absent(p.view)}</Text>}
      {p.choice.choices.map((o) => {
        const b = answer(o.choice_id);
        const riddle = p.choice.riddle;
        if (b && riddle?.choice_id === o.choice_id)
          return (
            <Riddle
              key={`${p.choice.continuation_id}:${p.choice.speaker_id}:${riddle.bank.join('')}`}
              bank={riddle.bank}
              button={b}
              press={p.press}
            />
          );
        if (b) return <ActionCard key={o.choice_id} b={b} press={p.press} />;
        return <ActionCard key={o.choice_id} label={p.text(o.label)} reason={why(o, p.text)} />;
      })}
    </View>
  );
}

type NpcProps = {
  view: GameView;
  npc?: Thing;
  text: Say;
  g: Grouped;
  press: (b: Button) => void;
  log: DetailLine[];
  leave: () => void;
  talking?: boolean; // the Book's latch: answered here and not yet left (Book holds it)
  talk?: (on: boolean) => void;
  open: (id: string) => void;
};

/**
 * A person's detail and conversation in the detail-page order (book-ui.md, NPC dialogue and
 * action details).
 * - Use: an NPC route.
 * - Rules: choices and services as Action cards, the conversation log, Controls in the PageFoot.
 *   History belongs to the page visit and restarts after Leave the conversation.
 * - States: choice; shop; services; closed conversation.
 * - Story: NpcPage.stories.tsx
 */
export function NpcPage(p: NpcProps) {
  const [c, t] = [usePalette(), useType()];
  const choice =
    p.view.choice && (!p.npc || p.npc.id === p.view.choice.speaker_id) ? p.view.choice : undefined;
  const enemy = p.npc && 'hostile' in p.npc && p.npc.hostile ? p.npc : undefined;
  // Where is the Map's control (sections.tsx); on the NPC's own page they are already here.
  const actions = p.npc ? p.g.on(p.npc.id).filter((b) => b.action_key !== 'where') : [];
  const cards = actions.filter((b) => b.command !== 'use_service');
  const { talk, answer, foot } = conversation(p, choice);
  const log = p.log;
  const contents = held(p);
  return (
    <Page
      title={p.npc ? cap(p.text(p.npc.name)) : 'Conversation'}
      scrollToEnd={log.length > 0}
      foot={foot}
    >
      {about(c, t, p, !talk)}
      <LogLines lines={log} />
      {npcSkills(c, t, p)}
      {!talk && enemy && (
        <Note>{enemy.refusal ? p.text(enemy.refusal) : refused(cap(p.text(enemy.name)))}</Note>
      )}
      {!talk && !enemy && !actions.length && !listed(p) && !log.length && !contents.length && (
        <Note>Nothing to do here.</Note>
      )}
      {!talk && !enemy && <ShopOptions {...p} />}
      {choice && <Choice {...p} press={answer} choice={choice} />}
      {!talk && (
        <Cards>
          {cards.map((b) => (
            <ActionCard key={cardKey(b)} b={b} press={p.press} />
          ))}
          <ServiceOptions {...p} actions={actions} />
        </Cards>
      )}
      {!talk && inside({ thing: p.npc, contents, text: p.text, open: p.open })}
    </Page>
  );
}

// Answering keeps the page in conversation even after the kernel closes it; only Leave the
// conversation returns to the NPC's own actions (Talk, shop, services).
const conversation = (p: NpcProps, choice?: NonNullable<GameView['choice']>) => {
  const close = choice && p.g.choice.find((b) => b.action_key === 'close_choice');
  const talk = !!choice || !!p.talking;
  const answer = (b: Button) => {
    if (b.action_key === 'choose') p.talk?.(true);
    p.press(b);
  };
  const stop = () => {
    p.talk?.(false);
    if (close) p.press({ ...close, label: LABEL.leaveConversation });
    else if (!p.npc) p.leave();
  };
  const foot =
    talk && (close || !choice) ? (
      <Control label={LABEL.leaveConversation} onPress={stop} />
    ) : (
      <Control label={LABEL.leave} onPress={p.leave} />
    );
  return { talk, answer, foot };
};

// What a living NPC holds (Held, book-ui.md Item details): Take on it is the steal (row 33).
const held = (p: NpcProps) =>
  p.npc ? things(p.view).filter((e) => 'container_id' in e && e.container_id === p.npc?.id) : [];

// Price and service rows draw even when unavailable: something to read (pass-2, UH3 on NPC pages).
const listed = ({ npc: n }: NpcProps) =>
  !!n && (('shop' in n && !!n.shop?.length) || ('services' in n && !!n.services?.length));

// A shelf, or a service that costs (the bank too), shows the purse beside it (pass-1 E15).
const priced = ({ npc: n }: NpcProps) =>
  !!n &&
  (('shop' in n && !!n.shop?.length) ||
    ('services' in n && !!n.services?.some((s) => s.price > 0)));
// ponytail: GameView has no currency field, so the purse is the resource keyed 'pennies'; name a
// cartridge currency in GameView if a second one appears.
const purse = (v: GameView) => v.resources?.find((r) => r.resource.key === 'pennies')?.current;

const about = (c: Palette, t: Type, p: NpcProps, shelf: boolean) => (
  <>
    {p.npc?.description && <Text style={prose(c, t)}>{plain(p.text(p.npc.description))}</Text>}
    {p.npc && 'asides' in p.npc && <Asides keys={p.npc.asides} text={p.text} />}
    {p.npc && 'carrying' in p.npc && p.npc.carrying && (
      <Text style={note(c, t)}>{p.text(p.npc.carrying)}</Text>
    )}
    {shelf && priced(p) && purse(p.view) !== undefined && <Note>{balance(purse(p.view)!)}</Note>}
  </>
);

// The skills this NPC teaches: learned or not, and whether the player qualifies now.
export const npcSkills = (c: Palette, t: Type, p: NpcProps) =>
  p.view.skills
    ?.filter(
      (s) =>
        p.npc &&
        'lessons' in p.npc &&
        p.npc.lessons?.some(
          (r) =>
            r.cartridge_id === s.skill.cartridge_id &&
            r.cartridge_version === s.skill.cartridge_version &&
            r.kind === s.skill.kind &&
            r.key === s.skill.key,
        ),
    )
    .map((s) => {
      const locked = s.locked && !s.acquired; // learned reads first, as on the Character page
      return (
        <Text key={s.skill.key} style={note(c, t)}>
          {s.acquired || locked
            ? `${p.text(s.label)}: ${locked ? 'locked' : s.qualified ? 'learned' : 'learned, unqualified'}`
            : `${cap(p.text(p.npc!.name))} teaches ${p.text(s.label)}`}
          {/* a qualified skill asks nothing more (pass-1 H3); a locked one always names its need */}
          {s.qualified && !locked ? '.' : `; ${p.text(s.requirement)}`}
        </Text>
      );
    });

function ShopOptions(p: NpcProps) {
  const c = usePalette();
  const t = useType();
  return (
    <>
      {p.npc &&
        'shop' in p.npc &&
        p.npc.shop?.map((o) => {
          // A price row, not an action card (book-ui.md, Hostile refusal): its reasons are words.
          const buy = buyReason(o.buy.reason ?? '');
          const sell = sellReason(o.sell, p.text);
          return (
            <Text key={o.item_id} style={note(c, t)}>
              {p.text(o.name)}: Buy {o.buy.price}p{o.buy.available ? '' : ` (${buy})`}; Sell{' '}
              {o.sell.price}p{o.sell.available ? '' : ` (${sell})`}.
            </Text>
          );
        })}
    </>
  );
}

function ServiceOptions(p: NpcProps & { actions: Button[] }) {
  const offers = p.npc && 'services' in p.npc ? p.npc.services : undefined;
  return offers?.map((s) => {
    const b = p.actions.find((b) => b.action_key === s.action.action_key);
    return b ? (
      <ActionCard key={s.service.key} b={b} press={p.press} />
    ) : (
      <ActionCard
        key={s.service.key}
        label={offerLabel(s, p.text, (n) => ` (${n})`)}
        reason={s.action.available ? undefined : why(s.action, p.text)}
      />
    );
  });
}

/**
 * The NPC route: gathers the person's offers and history, then draws NpcPage.
 * - Use: Body only.
 * - Story: NpcPage.stories.tsx
 */
export function NpcDetail(p: {
  screen: Screen;
  g: ReturnType<typeof group>;
  press: (b: Button, detail?: string) => void;
  speaker?: string;
  world: () => void;
  talkingOn?: Route; // Body's conversation latch
  talkOn?: (page?: Route) => void;
  visit?: Route; // this opening of the page (Body's page entry)
  open: (page: Route) => void;
}) {
  const { view, text } = p.screen;
  const npc = view.entities.find((e) => e.id === (p.speaker ?? view.choice?.speaker_id));
  const id = npc?.id ?? p.speaker ?? view.choice?.speaker_id ?? 'conversation';
  const log = p.screen.detail(id);
  return (
    <NpcPage
      view={view}
      npc={npc}
      text={text}
      g={p.g}
      log={log}
      press={(b) => p.press(b, id)}
      leave={p.world}
      open={(thing) => p.open({ kind: 'thing', id: thing })}
      talking={!!p.visit && p.talkingOn === p.visit}
      talk={(on) => {
        if (!on) p.screen.leave(id);
        p.talkOn?.(on ? p.visit : undefined);
      }}
    />
  );
}
