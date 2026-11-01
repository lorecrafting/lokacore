// Every source on the dialogue cookbook page compiles with no warnings and plays, over real SQLite.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, test } from 'node:test';
import { gameView } from '../../../../kernel/ts/src/index.ts';
import { validate } from '../../../../kernel/ts/src/foundation/validate.ts';
import { compiled } from './compiled.ts';
import { run } from './branching-play.ts';
import { coldReopen } from './elapsed-host.test.ts';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

// Each ```json <path> block of the page is that file of the cartridge; facts.json blocks merge.
function source(dir: string, edit: (name: string, body: string) => string = (_, b) => b) {
  const page = readFileSync(join(ROOT, 'docs/guides/dialogue-cookbook.md'), 'utf8');
  const facts = {};
  for (const [, name, body] of page.matchAll(/^```json (\S+)\n(.*?)^```$/gms)) {
    if (name === 'facts.json') Object.assign(facts, JSON.parse(body!));
    else {
      mkdirSync(dirname(join(dir, name!)), { recursive: true });
      writeFileSync(join(dir, name!), edit(name!, body!));
    }
  }
  writeFileSync(join(dir, 'facts.json'), JSON.stringify({ facts }));
}

const compile = (edit?: (name: string, body: string) => string) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-cookbook-'));
  source(dir, edit);
  const c = compiled(dir);
  rmSync(dir, { recursive: true });
  return c;
};

let invocations = 0;
function play(c: ReturnType<typeof compile>, path: string) {
  invocations += 100;
  const g = run(path, c, invocations);
  const id = (npc: string) => g.fresh.entityIds[`dialogue_cookbook@0.0.1:npc/${npc}`]!;
  const view = () => {
    const v = gameView(g.story.world());
    assert.deepEqual(validate('GameView', v), []);
    return v;
  };
  return {
    ...g,
    id,
    view,
    talk: (npc: string) => g.go('talk', {}, [id(npc)], npc),
    close: () => g.go('close_choice', { continuation_id: view().choice!.continuation_id }),
    offered: () => view().choice?.choices.map((o) => o.choice_id),
    fact: (name: string) =>
      Object.entries(g.story.world().state.facts ?? {}).find(([k]) =>
        k.includes(`"key":"${name}"`),
      )?.[1],
  };
}

// A fresh save, and `again()` to close it and open the same file as the app's launch does.
function saved(c = COOK) {
  const dir = mkdtempSync(join(tmpdir(), 'loka-cookbook-save-'));
  const path = join(dir, 'save.db');
  let g = play(c, path);
  after(() => rmSync(dir, { recursive: true, force: true }));
  return {
    now: () => g,
    again: () => {
      g.sql.close();
      coldReopen(path, c);
      g = play(c, path);
      return g;
    },
  };
}

const COOK = compile();

// Breaks: Talk opens at the widest nested set ("ask" has more ways on than the top), a later scene is
// shut out by the first, a failed first scene falls through its free choice into its own set, or the
// file names, not `when: not`, decide who opens.
for (const [first, later] of [
  ['sage_1_first', 'sage_2_later'],
  ['sage_2_first', 'sage_1_later'],
])
  test(`a first meeting (${first}) then a later nested scene, across a reload`, () => {
    const dir = mkdtempSync(join(tmpdir(), 'loka-cookbook-'));
    source(dir);
    const npc = {
      keywords: ['sage'],
      name: { prose: 'NPC' },
      room_line: { prose: 'A [NPC](sage).' },
    };
    mkdirSync(join(dir, 'npcs'), { recursive: true });
    writeFileSync(
      join(dir, 'npcs/sage.json'),
      JSON.stringify({ ...npc, description: { prose: 'NPC_TEXT' }, room: 'yard' }),
    );
    const facts = JSON.parse(readFileSync(join(dir, 'facts.json'), 'utf8'));
    facts.facts.sage_met = Object.values<any>(facts.facts).find(
      (f) => f.value_type?.type === 'bool',
    );
    writeFileSync(join(dir, 'facts.json'), JSON.stringify(facts));
    mkdirSync(join(dir, 'scenes'));
    writeFileSync(
      join(dir, `scenes/${first}.scene`),
      `npc: sage
when: not sage_met
sage: TEXT
- Ask
  sage: TEXT
  sets: sage_met
  - Deeper
    sage: TEXT
    - Deepest
      sage: TEXT
  - Back
    sage: TEXT
`,
    );
    writeFileSync(
      join(dir, `scenes/${later}.scene`),
      `npc: sage
when: sage_met
sage: TEXT
- Again
  sage: TEXT
  - More
    sage: TEXT
`,
    );
    const c = compiled(dir);
    rmSync(dir, { recursive: true });
    const s = saved(c);
    // As the Book does: the one Talk row the view lists for the speaker.
    const talk = (g: ReturnType<typeof s.now>) => {
      const npc = g.view().entities.find((e) => e.id === g.id('sage'))!;
      const talks = npc.actions.filter((a) => a.label === 'action.talk');
      assert.equal(talks.length, 1);
      assert.equal(talks[0]!.available, true);
      g.go('talk', {}, [g.id('sage')], talks[0]!.action_key);
    };
    let g = s.now();
    talk(g);
    assert.deepEqual(g.offered(), ['ask']);
    g.choose('ask');
    assert.deepEqual(g.offered(), ['c001_deeper', 'c002_back']);
    g.close();
    g = s.again();
    talk(g);
    assert.deepEqual(g.offered(), ['again']);
  });

// Breaks: an edit to the page, or a compiler warning a source shape starts to draw.
test('the page compiles with no warnings', () => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-cookbook-'));
  source(dir);
  const r = spawnSync('mix', ['loka.compile', dir, join(dir, 'a.json')], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  rmSync(dir, { recursive: true });
  assert.equal(r.status, 0, r.stderr);
  // Parallel test files share the build directory: mix's wait notice is no compiler warning.
  assert.equal(r.stderr.replace(/^.*Waiting for lock on the build directory.*\n/m, ''), '');
});

// Breaks: a stage's policy shows the wrong choice, the reminder is spent, the turn-in leaves the
// quest unresolved, or a reload loses the talk or the stage.
test('a quest before, during and after: start, reminder, turn-in, thanks, across reloads', () => {
  const s = saved();
  let g = s.now();
  g.talk('giver');
  assert.deepEqual(g.offered(), ['start_errand']);
  g.choose('start_errand');
  assert.deepEqual(g.offered(), ['do_errand', 'remind_errand']);
  g.choose('remind_errand');
  g.choose('remind_errand');
  assert.deepEqual(g.offered(), ['do_errand', 'remind_errand']);
  g = s.again();
  g.choose('do_errand');
  assert.deepEqual(g.offered(), ['hand_in_errand']);
  g = s.again();
  assert.deepEqual(g.offered(), ['hand_in_errand']);
  g.choose('hand_in_errand');
  assert.deepEqual(g.offered(), ['thanks_errand']);
  assert.equal(g.view().journal?.[0]?.state, 'resolved');
  g = s.again();
  assert.deepEqual(g.offered(), ['thanks_errand']);
  g.choose('thanks_errand');
});

// Breaks: both labels show together, neither shows, or the reply ignores the variant.
test('a label and a reply follow the state', () => {
  const s = saved();
  let g = s.now();
  g.talk('watcher');
  assert.deepEqual(g.offered(), ['ask_before', 'whats_new']);
  assert.equal(
    g.choose('whats_new').narration[0].key,
    'dialogue.watcher.choices.whats_new.narration',
  );
  g.close();
  g.talk('giver');
  g.choose('start_errand');
  g.choose('do_errand');
  g.close();
  g = s.again();
  g.talk('watcher');
  assert.deepEqual(g.offered(), ['ask_after', 'whats_new']);
  assert.equal(
    g.choose('whats_new').narration[0].key,
    'dialogue.watcher.choices.whats_new.narration_variants.0.description',
  );
});

// Breaks: the mark lands on the wrong option, refuses a repeat, or a reload forgets it.
test('an option once taken is marked asked and stays usable, across a reload', () => {
  const s = saved();
  let g = s.now();
  const asked = () =>
    g.view().choice!.choices.map((o) => [o.choice_id, o.available, 'asked' in o && o.asked]);
  g.talk('gossip');
  assert.deepEqual(asked(), [
    ['ask_road', true, false],
    ['ask_weather', true, false],
  ]);
  g.choose('ask_road');
  g = s.again();
  assert.deepEqual(asked(), [
    ['ask_road', true, true],
    ['ask_weather', true, false],
  ]);
  g.choose('ask_road');
  assert.deepEqual(asked(), [
    ['ask_road', true, true],
    ['ask_weather', true, false],
  ]);
});

// Breaks: the marker's lowered fact silently overwrites the author's own, or an overlong name reaches the schema as noise.
test('an asked mark that could not work is refused at the choice', () => {
  const refused = (edit: (name: string, body: string) => string, facts = {}) => {
    const dir = mkdtempSync(join(tmpdir(), 'loka-cookbook-'));
    source(dir, edit);
    const file = join(dir, 'facts.json');
    const all = JSON.parse(readFileSync(file, 'utf8'));
    Object.assign(all.facts, facts);
    writeFileSync(file, JSON.stringify(all));
    const r = spawnSync('mix', ['loka.compile', dir, join(dir, 'a.json')], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    rmSync(dir, { recursive: true });
    return r.status !== 0 && r.stdout + r.stderr;
  };
  const spec = {
    version: 1,
    value_type: { type: 'bool', default: false },
    scopes: ['player'],
    meaning: 'M',
  };
  assert.match(
    String(refused((_, b) => b, { gossip_ask_road_asked: spec })),
    /asked_marker.json:20 .*already exists/,
  );
  // 'gossip_' + choice + '_asked' is 13 bytes around the choice id: 51 fits 64 exactly.
  const rename = (size: number) => (name: string, b: string) =>
    name.endsWith('asked_marker.json') ? b.replaceAll('ask_road', 'q'.repeat(size)) : b;
  assert.match(String(refused(rename(52))), /longer than 64/);
  assert.equal(refused(rename(51)), false);
  // A riddle's answer is drawn as tiles, so a mark there could never show.
  const riddle =
    '"riddle": { "choice_id": "ask_road", "answer": "a", "bank": ["A"], "wrong": { "prose": "W" } }, "choices":';
  assert.match(
    String(
      refused((n, b) => (n.endsWith('asked_marker.json') ? b.replace('"choices":', riddle) : b)),
    ),
    /letter tiles with no label to dim/,
  );
  // asked_when is compiled only, so it can never overwrite or dodge the generated one.
  const hand = (n: string, b: string) =>
    n.endsWith('asked_marker.json')
      ? b.replace(
          '"asked": true',
          '"asked": true, "asked_when": { "op": "fact_compare", "fact": "x", "equals": true }',
        )
      : b;
  assert.match(String(refused(hand)), /asked_when/);
});

// Breaks: the mark is set before the check resolves, so a failed try reads as asked.
test('a failed check leaves the option unasked', () => {
  const s = saved(
    compile((name, body) =>
      name.endsWith('check_branches.json')
        ? body
            .replace('"value": 5', '"value": 99')
            .replace('"persuade_doubter": {', '"persuade_doubter": { "asked": true,')
        : body,
    ),
  );
  const g = s.now();
  g.talk('doubter');
  g.choose('persuade_doubter');
  assert.deepEqual(g.offered(), ['shrug_doubter']);
  assert.equal(g.fact('doubter_persuade_doubter_asked'), undefined);
});

// Breaks: skill.acquire stops working from a choice, or the skill is lost on reload.
test('a choice teaches a skill', () => {
  // asked on a choice that closes itself: view() validates, so the closed option must not carry it.
  const s = saved(
    compile((name, body) =>
      name.endsWith('learn_skill.json')
        ? body.replace('"learn_knack": {', '"learn_knack": { "asked": true,')
        : body,
    ),
  );
  let g = s.now();
  g.talk('teacher');
  g.choose('learn_knack');
  g = s.again();
  assert.equal(g.view().skills?.[0]?.acquired, true);
  g.talk('teacher');
  assert.equal(
    g.view().choice!.choices.find((o) => o.choice_id === 'learn_knack')!.available,
    false,
  );
});

// Breaks: then and then_failed swap or stop, or the hand-off keeps the first speaker.
test('a check branches both ways and passes to another speaker', () => {
  const pass = saved();
  let g = pass.now();
  g.talk('doubter');
  g.choose('persuade_doubter');
  assert.deepEqual(g.offered(), ['greet_friend']);
  assert.equal(g.view().choice!.speaker_id, g.id('friend'));
  g = pass.again();
  g.choose('greet_friend');

  const fail = saved(
    compile((name, body) =>
      name.endsWith('check_branches.json') ? body.replace('"value": 5', '"value": 99') : body,
    ),
  );
  g = fail.now();
  g.talk('doubter');
  g.choose('persuade_doubter');
  assert.deepEqual(g.offered(), ['shrug_doubter']);
  assert.equal(g.view().choice!.speaker_id, g.id('doubter'));
  g = fail.again();
  g.choose('shrug_doubter');
});

// Breaks: a choice_resolved reaction stops reaching a step the page promises.
test('a choice curses, cures, heals, grants experience and fires an event', () => {
  const s = saved();
  let g = s.now();
  g.talk('healer');
  g.choose('take_curse');
  assert.equal(g.view().conditions?.length, 1);
  g = s.again();
  assert.equal(g.view().conditions?.length, 1);
  g.choose('take_cure');
  assert.equal(g.view().conditions, undefined);
  g.choose('take_heal');
  assert.equal(g.view().conditions?.[0]?.per_tick, 1);
  g.choose('take_lesson');
  assert.equal(g.view().levelling?.experience, 5);
  g.choose('ring_bell');
  assert.equal(g.fact('bell_heard'), true);
});
