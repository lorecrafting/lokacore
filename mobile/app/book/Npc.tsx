// The NPC page: conversation, choices, skills, shop and services, what the NPC holds, with the existing book controls.
import { useState } from 'react';
import { View } from 'react-native';
import { Text } from './Text.tsx';
import type { GameView } from '../../packages/game-view/session.ts';
import { absent, cap, plain, things, why, type group, type Page as Route } from './model.ts';
import type { Button, DetailLine, presenter } from './presenter.ts';
import { cardKey } from './presenter.ts';
import { ActionCard, Cards, PickLists } from './actions.tsx';
import { LogLines, Note } from './lines.tsx';
import { Control, Page, SectionTitle, type Thing } from './pages.tsx';
import { inside } from './Menu.tsx';
import { note, prose, usePalette, useType, type Palette, type Type } from './palette.ts';
import { Riddle } from './Riddle.tsx';
import { npcSkills } from './skills.tsx';
import { space } from './tokens.ts';
import { picks } from './pick.ts';
import { purse } from './Shelf.tsx';
import { LABEL } from './labels.ts';
import { offerLabel, serviceOrder, talkOf } from './offers.ts';
import { balance, refused } from './words.ts';
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
  shelf?: () => void; // opens the person's shelf page (Shelf.tsx)
};
type Offer = NonNullable<GameView['entities'][number]['services']>[number];

/**
 * A person's detail and conversation in the detail-page order (book-ui.md, NPC dialogue and
 * action details).
 * - Use: an NPC route.
 * - Rules: the description, state notes and this visit's history, then one ordered list of Action
 *   cards (owner pick mvlrlvappy4w): Buy or sell (opens the shelf page), one Talk card (the
 *   first available talk; with none, no card and no filler line), Use an
 *   item… and Cast a spell…, Take and other acts, Give an item…, Ask about, then services, an
 *   open order's claim and cancel under Your order with its commission hidden. Leave in the
 *   PageFoot. No Whisper (loka-x6t.115). The purse shows only beside a priced service; shelf
 *   stock is not Held. History restarts after Leave the conversation.
 * - States: choice; shop; services; open order; nothing to say (no line); closed conversation.
 * - Story: NpcPage.stories.tsx
 */
export function NpcPage(p: NpcProps) {
  const [c, t] = [usePalette(), useType()];
  const choice =
    p.view.choice && (!p.npc || p.npc.id === p.view.choice.speaker_id) ? p.view.choice : undefined;
  const enemy = hostile(p.npc);
  // Where is the Map's control (sections.tsx); on the NPC's own page they are already here.
  const actions = p.npc ? p.g.on(p.npc.id).filter((b) => b.action_key !== 'where') : [];
  const { talk, answer, foot } = conversation(p, choice);
  const services = serviceOrder(p.npc && 'services' in p.npc ? (p.npc.services ?? []) : []);
  return (
    <Page
      title={p.npc ? cap(p.text(p.npc.name)) : 'Conversation'}
      scrollToEnd={p.log.length > 0}
      foot={foot}
    >
      {about(c, t, p, !talk && [...services.plain, ...services.order].some((s) => s.price > 0))}
      <LogLines lines={p.log} />
      {npcSkills(c, t, p)}
      {!talk && enemy && (
        <Note>{enemy.refusal ? p.text(enemy.refusal) : refused(cap(p.text(enemy.name)))}</Note>
      )}
      {choice && <Choice {...p} press={answer} choice={choice} />}
      {!talk && <Offered {...p} actions={actions} enemy={!!enemy} services={services} />}
      {!talk && inside({ thing: p.npc, contents: held(p), text: p.text, open: p.open })}
    </Page>
  );
}

const hostile = (n?: Thing) => (n && 'hostile' in n && n.hostile ? n : undefined);

// The person's offers in the page order (NpcPage's Rules); Give an item… shares Use's open state.
function Offered(
  p: NpcProps & { actions: Button[]; enemy: boolean; services: ReturnType<typeof serviceOrder> },
) {
  const shown = useState<{ page: string; label: string }>();
  if (!p.npc) return null;
  const { talk, rest } = talkOf(
    p.npc,
    p.actions.filter((b) => !['buy', 'sell'].includes(b.action_key)),
  );
  const all = picks(p.view, rest, p.npc.id, p.text);
  const lists = (give: boolean) => (
    <PickLists
      {...p}
      page={p.npc!.id}
      lists={all.filter((k) => (k.label === LABEL.giveAnItem) === give)}
      state={shown}
    />
  );
  const card = (b: Button) => <ActionCard key={cardKey(b)} b={b} press={p.press} />;
  const plain = rest.filter((b) => !b.pick && b.command !== 'use_service');
  const shop = !p.enemy && 'shop' in p.npc && !!p.npc.shop?.length && p.shelf;
  return (
    <>
      <Cards>
        {shop && <ActionCard label={LABEL.buyOrSell} onPress={shop} />}
        {talk && card(talk)}
      </Cards>
      {lists(false)}
      <Cards>{plain.filter((b) => b.command !== 'ask').map(card)}</Cards>
      {lists(true)}
      <Cards>
        {plain.filter((b) => b.command === 'ask').map(card)}
        {p.services.plain.map((s) => service(s, p))}
      </Cards>
      {p.services.order.length > 0 && <SectionTitle>{LABEL.yourOrder}</SectionTitle>}
      <Cards>{p.services.order.map((s) => service(s, p))}</Cards>
    </>
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
// Shelf stock is the shelf page's, not Held.
const held = ({ npc, view }: NpcProps) => {
  const stock = npc && 'shop' in npc ? (npc.shop ?? []).map((o) => o.item_id) : [];
  return npc
    ? things(view).filter(
        (e) => 'container_id' in e && e.container_id === npc.id && !stock.includes(e.id),
      )
    : [];
};

// The purse shows beside a priced service (pass-1 E15), the bank's fee too.
const about = (c: Palette, t: Type, p: NpcProps, priced: boolean) => (
  <>
    {p.npc?.description && <Text style={prose(c, t)}>{plain(p.text(p.npc.description))}</Text>}
    {p.npc && 'carrying' in p.npc && p.npc.carrying && (
      <Text style={note(c, t)}>{p.text(p.npc.carrying)}</Text>
    )}
    {priced && purse(p.view) !== undefined && <Note>{balance(purse(p.view)!)}</Note>}
  </>
);

// A service as an Action card; unavailable, its Note with the reason.
function service(s: Offer, p: NpcProps & { actions: Button[] }) {
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
      shelf={() => p.open({ kind: 'shelf', id })}
      talking={!!p.visit && p.talkingOn === p.visit}
      talk={(on) => {
        if (!on) p.screen.leave(id);
        p.talkOn?.(on ? p.visit : undefined);
      }}
    />
  );
}
