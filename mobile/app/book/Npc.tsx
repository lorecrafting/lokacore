// The NPC page: conversation, choices, skills, shop and services, what the NPC holds, with the existing book controls.
import { Text, View } from 'react-native';
import type { GameView } from '../../packages/game-view/session.ts';
import { absent, cap, plain, things, why, type group, type Page as Route } from './model.ts';
import type { Button, DetailLine, presenter } from './presenter.ts';
import { ActionCard, Cards } from './actions.tsx';
import { Asides, LogLines, Note } from './lines.tsx';
import { Control, Page, type Thing } from './pages.tsx';
import { inside } from './Menu.tsx';
import { note, prose, usePalette, type Palette } from './palette.ts';
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
  const answer = (id: string) =>
    p.g.choice.find((b) => (b.input as { choice_id?: string }).choice_id === id);
  return (
    <View style={{ gap: space.sm }}>
      {p.choice.riddle?.attempts && (
        <Text style={note(c)}>
          {p.choice.riddle.attempts.count} / {p.choice.riddle.attempts.limit} wrong answers this
          sitting.
        </Text>
      )}
      {absent(p.view) !== '' && <Text style={note(c)}>{absent(p.view)}</Text>}
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
  since?: number; // outside a conversation, history before this line is hidden (owner 2026-10-09)
  talking?: boolean; // the Book's latch: answered here and not yet left (Book holds it)
  talk?: (on: boolean) => void;
  open: (id: string) => void;
};

export function NpcPage(p: NpcProps) {
  const c = usePalette();
  const choice =
    p.view.choice && (!p.npc || p.npc.id === p.view.choice.speaker_id) ? p.view.choice : undefined;
  const enemy = p.npc && 'hostile' in p.npc && p.npc.hostile ? p.npc : undefined;
  // Where is the Map's control (sections.tsx); on the NPC's own page they are already here.
  const actions = p.npc ? p.g.on(p.npc.id).filter((b) => b.action_key !== 'where') : [];
  const cards = actions.filter((b) => b.command !== 'use_service');
  const { talk, answer, foot } = conversation(p, choice);
  const log = talk ? p.log : p.log.slice(p.since ?? 0);
  const contents = held(p);
  const pennies = priced(p) ? purse(p.view) : undefined;
  return (
    <Page
      title={p.npc ? cap(p.text(p.npc.name)) : 'Conversation'}
      scrollToEnd={log.length > 0}
      foot={foot}
    >
      {about(c, p)}
      {!talk && pennies !== undefined && <Note>{balance(pennies)}</Note>}
      <LogLines lines={log} />
      {npcSkills(c, p)}
      {!talk && enemy && (
        <Note>{enemy.refusal ? p.text(enemy.refusal) : refused(cap(p.text(enemy.name)))}</Note>
      )}
      {!talk && !enemy && !actions.length && !log.length && !contents.length && (
        <Note>Nothing to do here.</Note>
      )}
      {!talk && !enemy && <ShopOptions {...p} />}
      {choice && <Choice {...p} press={answer} choice={choice} />}
      {!talk && (
        <Cards>
          {cards.map((b) => (
            <ActionCard key={b.label + JSON.stringify(b.input)} b={b} press={p.press} />
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

// A shelf, or a service that costs (the bank too), shows the purse beside it (pass-1 E15).
const priced = ({ npc: n }: NpcProps) =>
  !!n &&
  (('shop' in n && !!n.shop?.length) ||
    ('services' in n && !!n.services?.some((s) => s.price > 0)));
// ponytail: GameView has no currency field, so the purse is the resource keyed 'pennies'; name a
// cartridge currency in GameView if a second one appears.
const purse = (v: GameView) => v.resources?.find((r) => r.resource.key === 'pennies')?.current;

const about = (c: Palette, p: NpcProps) => (
  <>
    {p.npc?.description && <Text style={prose(c)}>{plain(p.text(p.npc.description))}</Text>}
    {p.npc && 'asides' in p.npc && <Asides keys={p.npc.asides} text={p.text} />}
    {p.npc && 'carrying' in p.npc && p.npc.carrying && (
      <Text style={note(c)}>{p.text(p.npc.carrying)}</Text>
    )}
  </>
);

// The skills this NPC teaches: learned or not, and whether the player qualifies now.
export const npcSkills = (c: Palette, p: NpcProps) =>
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
    .map((s) => (
      <Text key={s.skill.key} style={note(c)}>
        {p.text(s.label)}: {s.acquired ? 'learned' : s.locked ? 'locked' : 'not learned'}; currently{' '}
        {s.qualified ? 'qualified' : 'unqualified'}. {p.text(s.requirement)}
      </Text>
    ));

function ShopOptions(p: NpcProps) {
  const c = usePalette();
  return (
    <>
      {p.npc &&
        'shop' in p.npc &&
        p.npc.shop?.map((o) => {
          // A price row, not an action card (book-ui.md, Hostile refusal): its reasons are words.
          const buy = buyReason(o.buy.reason ?? '');
          const sell = sellReason(o.sell, p.text);
          return (
            <Text key={o.item_id} style={note(c)}>
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

// Per page visit: how many history lines came before it or before its last Leave the conversation.
const past = new WeakMap<object, number>();

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
  if (p.visit && !past.has(p.visit)) past.set(p.visit, log.length);
  return (
    <NpcPage
      view={view}
      npc={npc}
      text={text}
      g={p.g}
      log={log}
      since={p.visit && past.get(p.visit)}
      press={(b) => p.press(b, id)}
      leave={p.world}
      open={(thing) => p.open({ kind: 'thing', id: thing })}
      talking={!!p.visit && p.talkingOn === p.visit}
      talk={(on) => {
        if (!on && p.visit) past.set(p.visit, log.length);
        p.talkOn?.(on ? p.visit : undefined);
      }}
    />
  );
}
