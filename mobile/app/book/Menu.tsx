// NPC/conversation, thing and Contents views use the existing book controls.
import { Text, View } from 'react-native';
import type { GameView } from '../../packages/game-view/session.ts';
import { absent, cap, plain, things, why, type group, type Page as Route } from './model.ts';
import type { Button, DetailLine, presenter } from './presenter.ts';
import { ActionCard, Cards } from './actions.tsx';
import { EntityLine, LogLines } from './lines.tsx';
import { Control, Page, SectionTitle, type Thing } from './pages.tsx';
import { ItemDetails } from './skills.tsx';
import { reason } from './words.ts';
import { note, prose, usePalette, type Palette } from './palette.ts';
import { Riddle } from './Riddle.tsx';
import { space } from './tokens.ts';
type Say = (key: string) => string;
type Grouped = ReturnType<typeof group>;

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
        return (
          <Text key={o.choice_id} style={note(c)}>{`${p.text(o.label)}: ${why(o, p.text)}`}</Text>
        );
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
  talking?: boolean; // the Book's latch: answered here and not yet left (Body holds it)
  talk?: (on: boolean) => void;
};

export function NpcPage(p: NpcProps) {
  const c = usePalette();
  const choice =
    p.view.choice && (!p.npc || p.npc.id === p.view.choice.speaker_id) ? p.view.choice : undefined;
  // Where is the Map's control (sections.tsx); on the NPC's own page they are already here.
  const actions = p.npc ? p.g.on(p.npc.id).filter((b) => b.action_key !== 'where') : [];
  const cards = actions.filter((b) => b.command !== 'use_service');
  const close = choice && p.g.choice.find((b) => b.action_key === 'close_choice');
  // Answering keeps the page in conversation even after the kernel closes it; only Leave the
  // conversation returns to the NPC's own actions (Talk, shop, services).
  const talk = !!choice || !!p.talking;
  const answer = (b: Button) => {
    if (b.action_key === 'choose') p.talk?.(true);
    p.press(b);
  };
  const stop = () => {
    p.talk?.(false);
    if (close) p.press({ ...close, label: 'Leave the conversation' });
    else if (!p.npc) p.leave();
  };
  const foot =
    talk && (close || !choice) ? (
      <Control label="Leave the conversation" onPress={stop} />
    ) : (
      <Control label="Leave" onPress={p.leave} />
    );
  return (
    <Page
      title={p.npc ? cap(p.text(p.npc.name)) : 'Conversation'}
      scrollToEnd={p.log.length > 0}
      foot={foot}
    >
      {p.npc?.description && <Text style={prose(c)}>{plain(p.text(p.npc.description))}</Text>}
      {p.npc && 'carrying' in p.npc && p.npc.carrying && (
        <Text style={note(c)}>{p.text(p.npc.carrying)}</Text>
      )}
      <LogLines lines={p.log} />
      {npcSkills(c, p)}
      {!talk && !actions.length && !p.log.length && (
        <Text style={note(c)}>Nothing to do here.</Text>
      )}
      {!talk && <ShopOptions {...p} />}
      {choice && <Choice {...p} press={answer} choice={choice} />}
      {!talk && (
        <Cards>
          {cards.map((b) => (
            <ActionCard key={b.label} b={b} press={p.press} />
          ))}
          <ServiceOptions {...p} actions={actions} />
        </Cards>
      )}
    </Page>
  );
}

// The skills this NPC teaches: learned or not, and whether the player qualifies now.
const npcSkills = (c: Palette, p: NpcProps) =>
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
        {p.text(s.label)}: {s.acquired ? 'learned' : 'not learned'}; currently{' '}
        {s.qualified ? 'qualified' : 'unqualified'}. {p.text(s.requirement)}
      </Text>
    ));

export type Section = 'character' | 'carrying' | 'map' | 'journal' | 'settings';
const SECTIONS: [Section, string][] = [
  ['character', 'Character'],
  ['carrying', 'Equipment & Inventory'],
  ['map', 'Map'],
  ['journal', 'Journal'],
  ['settings', 'Settings'],
];
export function ContentsPage(p: { open: (section: Section) => void; world: () => void }) {
  return (
    <Page title="Contents" foot={<Control label="Back to World" onPress={p.world} />}>
      <View>
        {SECTIONS.map(([kind, label]) => (
          <EntityLine key={kind} name={label} onPress={() => p.open(kind)} />
        ))}
      </View>
    </Page>
  );
}

type Screen = ReturnType<ReturnType<typeof presenter>['screen']>;

// The too-heavy notes are one block (BOOK-UI-COMPONENTS.md, Page: a run of rows of one kind).
const tooHeavy = (c: Palette, thing: Thing | undefined, text: Say) => {
  const heavy = thing?.actions.filter((a) => !a.available && a.reason.code === 'too_heavy') ?? [];
  return (
    heavy.length > 0 && (
      <View>
        {heavy.map((a) => (
          <Text key={a.action_key} style={note(c)}>
            {text(a.label)}: {reason('too_heavy')}.
          </Text>
        ))}
      </View>
    )
  );
};

// A container's Inside heading, then its rows as one block.
const inside = (p: { contents: Thing[]; text: Say; open: (id: string) => void }) =>
  p.contents.length > 0 && (
    <>
      <SectionTitle>Inside</SectionTitle>
      <View>
        {p.contents.map((e) => (
          <EntityLine key={e.id} name={cap(p.text(e.name))} onPress={() => p.open(e.id)} />
        ))}
      </View>
    </>
  );

export function ThingPage(p: {
  thing?: Thing;
  text: Say;
  actions: Button[];
  log: DetailLine[];
  press: (b: Button) => void;
  contents: Thing[];
  open: (id: string) => void;
  leave: () => void;
  back?: () => void;
}) {
  const c = usePalette();
  return (
    <Page
      title={p.thing ? cap(p.text(p.thing.name)) : 'Item'}
      foot={
        <>
          {p.back && <Control label="Back to container" onPress={p.back} />}
          <Control label="Leave" onPress={p.leave} />
        </>
      }
    >
      <ItemDetails thing={p.thing} text={p.text} />
      <LogLines lines={p.log} />
      {tooHeavy(c, p.thing, p.text)}
      {!p.actions.length && !p.contents.length && <Text style={note(c)}>Nothing to do here.</Text>}
      <Cards>
        {p.actions.map((b) => (
          <ActionCard key={`${b.label}:${b.target_ids.join(',')}`} b={b} press={p.press} />
        ))}
      </Cards>
      {inside(p)}
    </Page>
  );
}

export function Item(p: {
  id: string;
  screen: Screen;
  g: ReturnType<typeof group>;
  press: (b: Button, detail?: string) => void;
  open: (p: Route) => void;
  world: () => void;
  back?: () => void;
}) {
  const items = things(p.screen.view);
  const thing = items.find((e) => e.id === p.id);
  return (
    <ThingPage
      thing={thing}
      text={p.screen.text}
      actions={p.g.on(p.id)}
      log={p.screen.detail(p.id)}
      press={(b) => p.press(b, p.id)}
      contents={items.filter((e) => 'container_id' in e && e.container_id === p.id)}
      open={(id) => p.open({ kind: 'thing', id })}
      leave={p.world}
      back={thing && 'container_id' in thing ? p.back : undefined}
    />
  );
}

function ShopOptions(p: NpcProps) {
  const c = usePalette();
  return (
    <>
      {p.npc &&
        'shop' in p.npc &&
        p.npc.shop?.map((o) => (
          <Text key={o.item_id} style={note(c)}>
            {p.text(o.name)}: Buy {o.buy.price}p
            {o.buy.available
              ? ''
              : ` (${o.buy.reason === 'not_owned' ? 'sold out' : o.buy.reason?.replaceAll('_', ' ')})`}
            ; Sell {o.sell.price}p
            {o.sell.available ? '' : ` (${o.sell.reason?.replaceAll('_', ' ')})`}.
          </Text>
        ))}
    </>
  );
}

function ServiceOptions(p: NpcProps & { actions: Button[] }) {
  const c = usePalette();
  const offers = p.npc && 'services' in p.npc ? p.npc.services : undefined;
  return offers?.map((s) => {
    const b = p.actions.find((b) => b.action_key === s.action.action_key);
    return b ? (
      <ActionCard key={s.service.key} b={b} press={p.press} />
    ) : (
      <Text key={s.service.key} style={note(c)}>
        {p.text(s.label)}: {s.price}p
        {s.benefit.kind === 'entitlement' ? '' : `; up to +${s.benefit.amount} MV, capped`}
        {!s.action.available && ` (${why(s.action, p.text)})`}
      </Text>
    );
  });
}

export function NpcDetail(p: {
  screen: Screen;
  g: ReturnType<typeof group>;
  press: (b: Button, detail?: string) => void;
  speaker?: string;
  world: () => void;
  talking?: boolean;
  talk?: (on: boolean) => void;
}) {
  const { view, text } = p.screen;
  const npc = view.entities.find((e) => e.id === (p.speaker ?? view.choice?.speaker_id));
  const id = npc?.id ?? p.speaker ?? view.choice?.speaker_id ?? 'conversation';
  return (
    <NpcPage
      view={view}
      npc={npc}
      text={text}
      g={p.g}
      log={p.screen.detail(id)}
      press={(b) => p.press(b, id)}
      leave={p.world}
      talking={p.talking}
      talk={p.talk}
    />
  );
}
