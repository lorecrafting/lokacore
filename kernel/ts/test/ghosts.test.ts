// Build mode's ghost lines (kernel/ts/play/ghosts.ts) on a hand-made cartridge and view.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ghosts, NOT_HERE, NOT_OFFERED, type Cartridge } from '../play/ghosts.ts';
import type { GameView } from '../src/contracts.gen.ts';

const ref = (kind: string, key: string) => ({
  cartridge_id: 'c',
  cartridge_version: '1',
  kind,
  key,
});
const at = (key: string) => ref('room', key);
const NIGHT = { op: 'time_window', from: 20, to: 6 } as const;
const CART = {
  npcs: {
    'c@1:npc/thief': {
      key: 'thief',
      name: 'npc.thief.short',
      room: at('yard'),
      perception: { discovered: ref('fact', 'saw_thief') },
    },
    'c@1:npc/smith': { key: 'smith', name: 'npc.smith.short', room: at('yard') },
    'c@1:npc/far': { key: 'far', name: 'npc.far.short', room: at('hall') },
  },
  items: {
    'c@1:item/coin': {
      key: 'coin',
      name: 'item.coin.short',
      location: { in: 'room', room: at('yard') },
    },
    'c@1:item/held': {
      key: 'held',
      name: 'item.held.short',
      location: { in: 'npc', room: at('yard') },
    },
  },
  rooms: {
    'c@1:room/yard': {
      key: 'yard',
      variants: [
        { when: NIGHT, description: 'room.yard.night' },
        { when: { op: 'sky', lunar: 'full' }, description: 'room.yard.moon' },
      ],
    },
  },
  scripted_actions: {
    'c@1:action/dig': {
      key: 'dig',
      name: 'actions.dig',
      policy: NIGHT,
      target: { kind: 'detail', room: at('yard') },
    },
    'c@1:action/pray': {
      key: 'pray',
      name: 'actions.pray',
      target: { kind: 'detail', room: at('hall') },
    },
    'c@1:action/sing': { key: 'sing', name: 'actions.sing', target: { kind: 'actor' } },
  },
  dialogues: {
    'c@1:dialogue/haggle': {
      key: 'haggle',
      prompt: 'dialogue.haggle.prompt',
      npc: ref('npc', 'smith'),
    },
    'c@1:dialogue/whisper': {
      key: 'whisper',
      prompt: 'dialogue.whisper.prompt',
      npc: ref('npc', 'thief'),
      choices: { pry: { then: 'pry' } },
    },
    'c@1:dialogue/pry': { key: 'pry', prompt: 'dialogue.pry.prompt', npc: ref('npc', 'thief') },
    'c@1:dialogue/aside': {
      key: 'aside',
      prompt: 'dialogue.aside.prompt',
      npc: ref('npc', 'thief'),
      entry: false,
    },
    'c@1:dialogue/gossip': {
      key: 'gossip',
      prompt: 'dialogue.gossip.prompt',
      npc: ref('npc', 'smith'),
    },
  },
} as Cartridge;
const IDS = {
  'c@1:npc/thief': 'e1',
  'c@1:npc/smith': 'e2',
  'c@1:npc/far': 'e3',
  'c@1:item/coin': 'e4',
};
// Only the fields ghosts reads, where the kernel puts them: who is drawn with the talks they offer,
// a detail action on its notice (on a board), the place's own actions and the words the room drew.
const offer = (keys: string[]) => keys.map((action_key) => ({ action_key }));
const view = (entities: string[], talks: string[], details: string[], drawn = 'room.yard.moon') =>
  ({
    entities: entities.map((id, i) => ({ id, actions: offer(i ? [] : talks) })),
    actions: offer(['look']),
    notice_boards: [{ notices: [{ actions: offer(details) }] }],
    place: { description: { key: drawn } },
  }) as unknown as GameView;
const lines = (v: GameView) =>
  ghosts(v, CART, 'yard', IDS).map((g) => `${g.kind}:${g.key} ${g.words} | ${g.reason}`);

// Breaks caught: a drawn person, a drawn item or an offered talk still ghosted (`!seen`/`!offered` dropped, or a
// talk looked for only in the place's actions);
// someone placed in another room ghosted here; an item a person holds ghosted; the variant in force ghosted;
// a non-detail action ghosted in every room; a perception gate said as the generic reason.
test('ghosts: what is placed here and not drawn, each with its reason; nothing drawn or elsewhere', () => {
  assert.deepEqual(lines(view(['e2', 'e4'], ['haggle'], [])), [
    'npc:thief npc.thief.short | hidden: until fact saw_thief',
    'variant:yard room.yard.night | only when: the time of day is from 20 to 6',
    'action:dig actions.dig | only when: the time of day is from 20 to 6',
  ]);
});

// Breaks caught: a detail action offered on a board's notice still ghosted; a dialogue of someone not drawn
// ghosted (the `seen(npc)` filter dropped); a speaker's other dialogue ghosted while one talk is offered;
// a follow-up (an answer's `then`) or an `entry: false` dialogue ghosted; an ungated absent person or
// room item not ghosted; an action or dialogue with no policy given a policy reason.
test('ghosts: the dialogue of who is drawn but not offered; absent people and items say not here', () => {
  assert.deepEqual(lines(view(['e1'], [], ['dig'], 'room.yard.night')), [
    `npc:smith npc.smith.short | ${NOT_HERE}`,
    `item:coin item.coin.short | ${NOT_HERE}`,
    'variant:yard room.yard.moon | only when: the moon is full',
    `dialogue:whisper dialogue.whisper.prompt | ${NOT_OFFERED}`,
  ]);
});
