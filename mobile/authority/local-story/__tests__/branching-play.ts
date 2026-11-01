// Shared play and forgery helpers for the branching reload tests.
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  INSTALLED,
  loadCartridge,
  newWorld,
  type Cartridge,
} from '../../../../kernel/ts/src/index.ts';
import { resolved } from '../../../../kernel/ts/src/commands/actions.ts';
import { refString } from '../../../../kernel/ts/src/runtime/decision.ts';
import { pending } from '../../../../kernel/ts/src/mechanics/dialogue/shared.ts';
import { compiled } from './compiled.ts';
import { openStory } from '../authority.ts';
import { dialogueDetail } from '../dialogue-receipt.ts';
import { coldReopen, elapsedHost } from './elapsed-host.test.ts';

const LAST_RECEIPT =
  'SELECT command_id, command, response FROM receipt ORDER BY revision DESC LIMIT 1';
const SET_ROW = 'UPDATE state_row SET value=? WHERE section=? AND key LIKE ?';
const DELETE_SECTION = 'DELETE FROM state_row WHERE section=?';

export type Play = ReturnType<typeof run>;

export const LABEL = 'dialogue.guard.persuade';
export const SAID = 'narration.guard.persuade';
export const VARIANT = 'narration.guard.intimidate';
export const talkTo = (choices: object) => ({
  npc: 'guard',
  prompt: 'dialogue.guard.prompt',
  roles: { guard: { role: 'npc', npc: 'guard' } },
  choices,
});

// The guard's charisma decides the opposed check: 5 loses to the player's 6, 99 beats it.

export function run(
  path: string,
  c: ReturnType<typeof compiled>,
  first = 0,
  clock = { wall: 10000, mono: 0 },
) {
  const l = loadCartridge(
    new TextEncoder().encode(`{"cartridge":${c.canonical},"content_hash":"${c.sha256}"}`),
    INSTALLED,
  );
  if (!l.ok) throw new Error(JSON.stringify(l));
  const fresh = newWorld(
    l.cartridge as Cartridge,
    '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
    [1, 2, 3, 4],
  );
  const p = elapsedHost(path, clock, c);
  const story = openStory(p.db, [{ fresh, content_hash: c.sha256 }], p.host);
  if (story.kind !== 'open') throw new Error(JSON.stringify(story));
  let n = first;
  const go = (command: string, input: object = {}, target_ids: string[] = [], only?: string) => {
    const set = resolved(story.world(), fresh.character);
    const action_key = Object.keys(set).find(
      (k) => set[k]!.command === command && (!only || k.includes(only)),
    )!;
    const r = story.invoke({
      invocation_id: `aaaaaaaa-1414-4414-8414-${String(++n).padStart(12, '0')}`,
      actor_id: fresh.character,
      action_key,
      target_ids,
      input,
    });
    assert.equal(r.kind === 'saved' && (r.decision as any).kind, 'accepted', JSON.stringify(r));
    return (r as any).decision;
  };
  const at = () => {
    const found = pending(story.world(), fresh.character);
    return found && [found[0], found[1].beat, found[1].choice_ids];
  };
  const choose = (choice_id: string) => {
    const [continuation_id] = at()!;
    return go('choose', { choice_id, continuation_id });
  };
  const talk = (only = 'guard') =>
    go('talk', {}, [fresh.entityIds['persuade_sampler@0.0.1:npc/guard']!], only);
  if (!first) talk();
  // The receipt check runs only on an answer with a save-visible consequence (detailNeeded), so
  // the sampler's answer is read as one that starts a patrol.
  const receiptHolds = () => {
    const r = p.sql.prepare(LAST_RECEIPT).get()!;
    const command = JSON.parse(String(r.command));
    const world = structuredClone(story.world());
    const row = world.state.choices![command.payload.continuation_id]!;
    const dialogue = world.cartridge.dialogues![refString(row.source)]!;
    Object.assign(dialogue.choices[command.payload.choice_id]!, { patrol: {} });
    return dialogueDetail(
      { world } as never,
      r.command_id as string,
      command,
      JSON.parse(String(r.response)),
    );
  };
  return { ...p, at, choose, talk, receiptHolds, go, story, fresh };
}

export const line = { label: LABEL, narration: SAID };
export const flag = (value: boolean) => ({ op: 'fact.assign', fact: 'gate_open', value });

// The sampler with a Give-restricted token on the guard and the given dialogues beside guard.json.
export function withToken(
  dialogues: Record<string, object>,
  quests: Record<string, object> = {},
  edit: (src: string) => void = () => {},
) {
  const src = mkdtempSync(join(tmpdir(), 'loka-branching-src-'));
  cpSync(fileURLToPath(new URL('../../../../cartridges/persuade_sampler', import.meta.url)), src, {
    recursive: true,
  });
  mkdirSync(join(src, 'items'));
  writeFileSync(
    join(src, 'items/token.json'),
    JSON.stringify({
      keywords: ['token'],
      name: LABEL,
      room_line: LABEL,
      description: LABEL,
      location: { in: 'npc', npc: 'guard' },
      give_allowed: false,
    }),
  );
  cpSync(join(src, 'npcs/guard.json'), join(src, 'npcs/clerk.json'));
  for (const [name, d] of Object.entries(dialogues))
    writeFileSync(join(src, `dialogues/${name}.json`), JSON.stringify(d));
  if (Object.keys(quests).length) {
    mkdirSync(join(src, 'quests'));
    const manifest = JSON.parse(readFileSync(join(src, 'cartridge.json'), 'utf8'));
    manifest.requires.capabilities.quest = 1;
    writeFileSync(join(src, 'cartridge.json'), JSON.stringify(manifest));
  }
  for (const [name, q] of Object.entries(quests))
    writeFileSync(join(src, `quests/${name}.json`), JSON.stringify(q));
  edit(src);
  const c = compiled(src);
  rmSync(src, { recursive: true });
  return c;
}

const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
// Adds whole files (a path under the cartridge to its JSON) and merges facts and capabilities.
export const adding =
  (files: Record<string, object>, facts: object = {}, capabilities: object = {}) =>
  (src: string) => {
    for (const [name, body] of Object.entries(files)) {
      mkdirSync(join(src, name, '..'), { recursive: true });
      writeFileSync(join(src, name), JSON.stringify(body));
    }
    const f = readJson(join(src, 'facts.json'));
    writeFileSync(
      join(src, 'facts.json'),
      JSON.stringify({ ...f, facts: { ...f.facts, ...facts } }),
    );
    const m = readJson(join(src, 'cartridge.json'));
    Object.assign(m.requires.capabilities, capabilities);
    writeFileSync(join(src, 'cartridge.json'), JSON.stringify(m));
  };

// The guard and token moved onto the shoo sampler's world, which has combat and food, under the
// persuade sampler's id so the play helpers' refs still resolve.
export function withWorld(
  dialogues: Record<string, object>,
  quests: Record<string, object> = {},
  edit: (src: string) => void = () => {},
) {
  const src = mkdtempSync(join(tmpdir(), 'loka-branching-src-'));
  cpSync(fileURLToPath(new URL('../../../../cartridges/shoo_sampler', import.meta.url)), src, {
    recursive: true,
  });
  rmSync(join(src, 'transcripts'), { recursive: true });
  const m = readJson(join(src, 'cartridge.json'));
  m.id = 'persuade_sampler';
  m.entry = 'green';
  Object.assign(m.requires.capabilities, {
    dialogue: 1,
    food: 1,
    ...(Object.keys(quests).length ? { quest: 1 } : {}),
  });
  writeFileSync(join(src, 'cartridge.json'), JSON.stringify(m));
  const npc = (name: string) => ({
    keywords: [name],
    name: LABEL,
    room_line: LABEL,
    description: LABEL,
    room: 'green',
    hp: { minimum: 0, maximum: 1, start: 1, gain: 0 },
    attack: { chance: 0, damage_min: 1, damage_max: 1 },
  });
  const text = readJson(join(src, 'text.json'));
  writeFileSync(
    join(src, 'text.json'),
    JSON.stringify({ ...text, [LABEL]: 'x', [SAID]: 'x', 'dialogue.guard.prompt': 'x' }),
  );
  rmSync(join(src, 'populations/crow.json'));
  rmSync(join(src, 'items/old_coin.json'));
  const quest_files = Object.entries(quests).map(([k, q]) => [`quests/${k}.json`, q]);
  const dialogue_files = Object.entries(dialogues).map(([k, d]) => [`dialogues/${k}.json`, d]);
  adding(
    {
      'npcs/guard.json': npc('guard'),
      'npcs/clerk.json': npc('clerk'),
      'items/token.json': {
        keywords: ['token'],
        name: LABEL,
        room_line: LABEL,
        description: LABEL,
        location: { in: 'npc', npc: 'guard' },
        give_allowed: false,
        mass_grams: 10,
        edible: { resource: 'mv', amount: 2, label: LABEL, narration: SAID },
      },
      ...Object.fromEntries([...quest_files, ...dialogue_files]),
    },
    {
      gate_open: {
        version: 1,
        value_type: { type: 'bool', default: false },
        scopes: ['instance'],
        meaning: 'x',
      },
    },
  )(src);
  edit(src);
  const c = compiled(src);
  rmSync(src, { recursive: true });
  return c;
}

export const tokenTalk = (choices: object, has: boolean) => ({
  ...talkTo(choices),
  roles: { guard: { role: 'npc', npc: 'guard' }, token: { role: 'item', item: 'token' } },
  policy: has
    ? { op: 'has_item', item: 'token' }
    : { op: 'not', item: { op: 'has_item', item: 'token' } },
});
export const take = (extra: object = {}) =>
  tokenTalk({ take: { ...line, receive: { item: 'token', from: 'guard' }, ...extra } }, false);
export const give = (extra: object = {}) =>
  tokenTalk({ give: { ...line, hand_over: { item: 'token', to: 'guard' }, ...extra } }, true);

export function reopened(
  c: ReturnType<typeof compiled>,
  play: (g: ReturnType<typeof run>) => void,
) {
  const dir = mkdtempSync(join(tmpdir(), 'loka-branching-'));
  try {
    const path = join(dir, 'save.db');
    const g = run(path, c);
    play(g);
    g.sql.close();
    coldReopen(path, c);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export const takeGive = (g: ReturnType<typeof run>) => {
  g.choose('take');
  g.talk('back');
  g.choose('give');
};

export const quest = {
  name: LABEL,
  objective: { evidence: 'current_state', policy: { op: 'has_item', item: 'token' } },
  journal: {
    active: LABEL,
    objectives_met: LABEL,
    resolved: LABEL,
    failed: LABEL,
    abandoned: LABEL,
  },
};
export const retakeQuest = () => {
  const open = { op: 'fact_compare', fact: 'gate_open', equals: true };
  const accepted = { op: 'quest_state', quest: 'job', state: 'active' };
  return withToken(
    {
      guard: take(),
      a_back: {
        ...give({ steps: [flag(true)] }),
        policy: {
          op: 'all',
          items: [
            { op: 'has_item', item: 'token' },
            { op: 'not', item: open },
          ],
        },
      },
      b_offer: {
        ...talkTo({ job: { ...line, accept: 'job' } }),
        policy: { op: 'all', items: [open, { op: 'not', item: accepted }] },
      },
      z_q: {
        ...give(),
        quest: 'job',
        policy: { op: 'all', items: [{ op: 'has_item', item: 'token' }, open] },
      },
    },
    { job: quest },
  );
};
export const retakePlay = (g: ReturnType<typeof run>) => {
  g.choose('take');
  g.talk('a_back');
  g.choose('give');
  g.talk('b_offer');
  g.choose('job');
  g.talk();
  g.choose('take');
  g.talk('z_q');
  g.choose('give');
};

// One way: taken from the guard, handed to the clerk, so custody has one history; the receive sets
// gate_open, the delivery clears it, and the quest answers also offer a way out.
export const oneWay = (more: Record<string, object> = {}, quests: Record<string, object> = {}) =>
  withToken(
    {
      guard: take({ steps: [flag(true)] }),
      b_offer: {
        ...talkTo({ job: { ...line, accept: 'job' } }),
        policy: {
          op: 'all',
          items: [
            { op: 'has_item', item: 'token' },
            { op: 'not', item: { op: 'quest_state', quest: 'job', state: 'active' } },
          ],
        },
      },
      z_q: {
        ...talkTo({
          give: { ...line, hand_over: { item: 'token', to: 'clerk' }, steps: [flag(false)] },
          decline: line,
        }),
        roles: {
          guard: { role: 'npc', npc: 'guard' },
          clerk: { role: 'npc', npc: 'clerk' },
          token: { role: 'item', item: 'token' },
        },
        quest: 'job',
        policy: {
          op: 'all',
          items: [
            { op: 'has_item', item: 'token' },
            { op: 'quest_state', quest: 'job', state: 'active' },
          ],
        },
      },
      ...more,
    },
    { job: quest, ...quests },
  );
export const accept = (g: ReturnType<typeof run>) => {
  g.talk('b_offer');
  g.choose('job');
};

export const TOKEN = 'persuade_sampler@0.0.1:item/token';
export const put = (sql: DatabaseSync, section: string, like: string, value: unknown) => {
  const r = sql.prepare(SET_ROW).run(JSON.stringify(value), section, like);
  assert.equal(r.changes, 1);
};
export const del = (sql: DatabaseSync, section: string) =>
  assert.equal(sql.prepare(DELETE_SECTION).run(section).changes, 1);

// Open, act, reopen: a forged save that loads must keep playing and saving, not throw every launch.
export function survives(
  c: ReturnType<typeof compiled>,
  play: (g: ReturnType<typeof run>) => void,
  edit: (g: ReturnType<typeof run>) => void,
  act: (g: ReturnType<typeof run>) => void,
  after: (g: ReturnType<typeof run>) => void,
) {
  const dir = mkdtempSync(join(tmpdir(), 'loka-branching-'));
  try {
    const path = join(dir, 'save.db');
    const g = run(path, c);
    play(g);
    edit(g);
    g.sql.close();
    const open = run(path, c, 100);
    act(open);
    open.sql.close();
    const last = run(path, c, 200);
    after(last);
    last.sql.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
export const holder = (g: ReturnType<typeof run>) =>
  g.story.world().state.containers[g.fresh.entityIds[TOKEN]!];

export const quests = (g: Play) => Object.entries(g.story.world().state.quests!)[0]!;

export function refused(
  c: ReturnType<typeof compiled>,
  play: (g: Play) => void,
  edit: (g: Play) => void,
) {
  const dir = mkdtempSync(join(tmpdir(), 'loka-branching-'));
  try {
    const path = join(dir, 'save.db');
    const g = run(path, c);
    play(g);
    edit(g);
    g.sql.close();
    assert.throws(() => coldReopen(path, c), /save_corrupt/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
