// The Combat and Schedule blocks' writes and reads (kernel/ts/play/blocks.ts).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { addHour, fightOf, rehour, roomPicks } from '../play/blocks.ts';
import { added, allowed, pickKind } from '../play/card.ts';
import { uiSchema } from '../play/ui_schema.ts';

const ROOT = join(import.meta.dirname, '../../..');
const read = (f: string) => JSON.parse(readFileSync(join(ROOT, f), 'utf8'));
const defs = read('schemas/source/defs.schema.json').$defs;
const stub = read('schemas/source/npcs.schema.json');
const npcs = { ...stub, $ref: stub.$ref.replace(/^defs\.schema\.json/, ''), $defs: defs };
const warden = read('cartridges/toolbox_showcase/areas/low_wardle/npcs/warden.json');

// Break: an hour the compiler refuses is written (calendar.ex schedules/3: not below hours_per_day;
// SCHEMA: not a whole number; 24 with no calendar), a moved hour overwrites another, or the move loses rows.
test('an hour moves to a free whole hour below the day, keeping its value', () => {
  const s = { '8': 'gate', '13': 'green' };
  assert.deepEqual(rehour(s, '8', '9', 24), { '9': 'gate', '13': 'green' });
  assert.deepEqual(rehour(s, '8', '23', 24), { '23': 'gate', '13': 'green' });
  assert.deepEqual(rehour(s, '8', '8', 24), s); // the same hour, retyped
  assert.equal(typeof rehour(s, '8', '24', 24), 'string');
  assert.equal(typeof rehour(s, '8', '13', 24), 'string');
  for (const bad of ['', '8.5', '08', '-1', 'x'])
    assert.equal(typeof rehour(s, '8', bad), 'string');
  assert.equal(typeof rehour(s, '8', '24'), 'string'); // no calendar: the compiler's 24
  assert.deepEqual(rehour(s, '8', '23'), { '23': 'gate', '13': 'green' });
});

// Break: the add overwrites a present hour, invents a room, or runs past the day's last hour.
test("an added hour is the first free one, at the NPC's own room", () => {
  assert.deepEqual(addHour({}, 'gate', 24), { '0': 'gate' });
  assert.deepEqual(addHour({ '0': 'a', '2': 'b' }, 'gate', 24), {
    '0': 'a',
    '2': 'b',
    '1': 'gate',
  });
  assert.equal(addHour({ '0': 'a', '1': 'b' }, 'gate', 2), undefined);
  assert.equal(addHour({}, undefined, 24), undefined);
  const day = Object.fromEntries(Array.from({ length: 24 }, (_, h) => [String(h), 'a']));
  assert.equal(addHour(day, 'gate'), undefined); // no calendar: the compiler's 24
});

// Break: a block's write leaves the NPC schema (the compiler's SCHEMA_VIOLATION): an hour, a moved
// hour, or the menu's schedule and attack adds on the showcase warden.
test("the blocks' writes keep the showcase warden a valid NPC", () => {
  const validate = new Ajv2020({ strict: false }).compile(npcs);
  const { daily_schedule: schedule, attack: _a, ...bare } = warden;
  const docs = {
    added: { ...warden, daily_schedule: addHour(schedule, warden.room, 24) },
    moved: { ...warden, daily_schedule: rehour(schedule, '13', '15', 24) },
    schedule: added(bare, 'daily_schedule', defs, 'source.NpcDefinition'),
    attack: added(bare, 'attack', defs, 'source.NpcDefinition'),
  };
  for (const [what, doc] of Object.entries(docs)) {
    assert.ok(validate(doc), `${what}: ${JSON.stringify(validate.errors)}`);
  }
});

// Break: the Combat block shows another target's numbers (a population of the same key, or a key
// that only ends like it), or hides why the report did not run.
test("an NPC's fight rows are its own target's", () => {
  const t = (target: string) => ({
    target,
    rating: { first_win_level: 1, first_win_build: null },
    cells: [],
  });
  const report = {
    report: {
      seeds: 1,
      rounds: 1,
      targets: [t('c@1:npc/old_warden'), t('c@1:population/warden'), t('c@1:npc/warden')],
    },
  };
  assert.equal(fightOf(report, 'warden')?.target, 'c@1:npc/warden');
  assert.equal(fightOf(report, 'rat'), undefined);
  assert.equal(fightOf({ why: 'no world' }, 'warden'), 'no world');
});

// Break: an hour's room key (a lone room, a case list's fallback) stays free text, or the
// walker's other branches (a walking case, a case's own room picker) lose their claims.
test("an hour's room keys are drawn by the room picker", () => {
  const hour = uiSchema('npcs', npcs, defs, {}).daily_schedule.additionalProperties;
  const ui = roomPicks(hour);
  assert.equal(ui.anyOf[0]['ui:field'], 'DefinitionRef');
  assert.equal(ui.anyOf[3].items.anyOf[0]['ui:field'], 'DefinitionRef');
  assert.deepEqual(ui.anyOf[1], hour.anyOf[1]);
  assert.deepEqual(ui.anyOf[3].items.anyOf[1], hour.anyOf[3].items.anyOf[1]);
});

// Break: the add menu offers a block's field the compiler refuses (skills.ex weapon/4: a weapon names
// a skill and is wielded; calendar.ex template_schedules/1: a spawn template has no schedule), or an
// hour's own room key (a lone room, a case list's fallback) loses the room picker's kind.
test("a block's fields are offered only where they compile", () => {
  assert.deepEqual(allowed('items', ['weapon'], { skill: 1 }, { slot: 'wield' }), ['weapon']);
  assert.deepEqual(allowed('items', ['weapon'], { skill: 1 }, { slot: 'body' }), []);
  assert.deepEqual(allowed('items', ['weapon'], {}, { slot: 'wield' }), []);
  const sched = { schedule: 1 };
  assert.deepEqual(allowed('npcs', ['daily_schedule'], sched, {}), ['daily_schedule']);
  assert.deepEqual(allowed('npcs', ['daily_schedule'], sched, { spawn_template: true }), []);
  assert.equal(pickKind(['daily_schedule', '8', '1']), 'room');
});
