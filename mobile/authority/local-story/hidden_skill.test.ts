// Homestead hs-14 (mechanics.md Skill trees) through real SQLite on an edited craft sampler: an
// opening that leaves out a concealed lesson writes the narrower choice_ids, and reload admits it
// (`openable`, dialogue-save.ts and dialogue-receipt.ts) while a forged row is save_corrupt.
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  INSTALLED,
  loadCartridge,
  newWorld,
  type Cartridge,
} from '../../../kernel/ts/src/index.ts';
import { resolved } from '../../../kernel/ts/src/commands/actions.ts';
import { pending } from '../../../kernel/ts/src/mechanics/dialogue/shared.ts';
import { compiled } from './__tests__/compiled.ts';
import { openStory } from './authority.ts';
import { coldReopen, elapsedHost } from './__tests__/elapsed-host.test.ts';

// Carving (needs whittling 2) and joinery hidden; the carving talk also teaches carpentry (shown,
// its prerequisite dropped so it is learnable at once).
const src = mkdtempSync(join(tmpdir(), 'loka-hidden-skill-src-'));
cpSync(fileURLToPath(new URL('../../../cartridges/craft_sampler', import.meta.url)), src, {
  recursive: true,
});
const edit = (file: string, f: (x: any) => void) => {
  const x = JSON.parse(readFileSync(join(src, file), 'utf8'));
  f(x);
  writeFileSync(join(src, file), JSON.stringify(x));
};
for (const k of ['carving', 'joinery']) edit(`skills/${k}.json`, (s) => (s.hidden = true));
edit('skills/carpentry.json', (s) => delete s.prerequisite);
edit('dialogues/old_carver_carving.json', (d) => {
  d.choices.whittle = {
    label: 'old_carver.carving.prompt',
    narration: 'old_carver.carving.learned',
    sequence: [{ op: 'skill.acquire', skill: 'carpentry' }],
  };
});
const craft = compiled(src);
rmSync(src, { recursive: true });
const l = loadCartridge(
  new TextEncoder().encode(`{"cartridge":${craft.canonical},"content_hash":"${craft.sha256}"}`),
  INSTALLED,
);
if (!l.ok) throw new Error(JSON.stringify(l));
const fresh = newWorld(
  l.cartridge as Cartridge,
  '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
  [1, 2, 3, 4],
);
const id = (k: string) => fresh.entityIds[`craft_sampler@0.0.1:${k}`]!;

// Opens the carver's talk at whittling 1 in a save at `path`; `choose` then takes `whittle`.
function opened(path: string, choose = false) {
  const p = elapsedHost(path, undefined, craft);
  const story = openStory(p.db, [{ fresh, content_hash: craft.sha256 }], p.host);
  if (story.kind !== 'open') throw new Error(JSON.stringify(story));
  let n = 0;
  const go = (command: string, input: object = {}, target_ids: string[] = [], key?: string) => {
    const set = resolved(story.world(), fresh.character);
    const action_key = Object.keys(set).find(
      (k) => set[k]!.command === command && (!key || set[k]!.key === key),
    )!;
    const r = story.invoke({
      invocation_id: `aaaaaaaa-1414-4414-8414-${String(++n).padStart(12, '0')}`,
      actor_id: fresh.character,
      action_key,
      target_ids,
      input,
    });
    assert.equal(r.kind === 'saved' && (r.decision as any).kind, 'accepted', JSON.stringify(r));
  };
  go('choose_ancestry', { ancestry: 'woodfolk' });
  go('take', {}, [id('item/stick_01')]);
  go('take', {}, [id('item/stick_02')]);
  go('perform', {}, [], 'carve_spoon');
  go('talk', {}, [id('npc/old_carver')], 'old_carver_carving');
  const [continuation_id] = pending(story.world(), fresh.character)!;
  assert.deepEqual(story.world().state.choices![continuation_id]!.choice_ids, ['whittle']);
  if (choose) go('choose', { choice_id: 'whittle', continuation_id });
  return p;
}

// Breaks: a reopen check (dialogue-save.ts checkRow on the resolved row via skills-save.ts, or the
// choose receipt check in dialogue-receipt.ts) requires every authored choice, so the narrowed row
// is refused. The pending case reaches neither (no wrong_limit, no custody) and pins only that the
// receipt replay admits it; the chosen case is the red control for both.
test('a talk opened without its concealed lesson reopens, pending and chosen', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-hidden-skill-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const choose of [false, true]) {
    const path = join(dir, `${choose}.db`);
    opened(path, choose).sql.close();
    coldReopen(path, craft);
  }
});

// Breaks: a reopen admits a forged row (an id the dialogue lacks, a dropped choice that teaches
// no hidden skill, another order, empty) or a refusal writes the file. End to end only: the
// receipt replay (receipt-history.ts) refuses these before any row check, so `openable` itself is
// pinned by craft.test.ts 'a saved row may lack only a lesson of a hidden skill'.
test('a forged choice_ids row is save_corrupt and the file is unchanged', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-hidden-skill-forged-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const ids of [['bogus'], ['learn'], ['whittle', 'learn'], []]) {
    const path = join(dir, `${ids.join('_')}.db`);
    const p = opened(path);
    const rows = p.sql.prepare("SELECT key, value FROM state_row WHERE section = 'choices'").all();
    assert.equal(rows.length, 1);
    const row = { ...JSON.parse(String(rows[0]!.value)), choice_ids: ids };
    p.sql
      .prepare("UPDATE state_row SET value = ? WHERE section = 'choices' AND key = ?")
      .run(JSON.stringify(row), rows[0]!.key as string);
    // The talk's receipt carries the same choice.open; forged too, as a consistent forger would.
    const last = p.sql
      .prepare('SELECT command_id, response FROM receipt ORDER BY revision DESC LIMIT 1')
      .get()!;
    const response = JSON.parse(String(last.response));
    const open = response.delta.ops.filter((o: any) => o.op === 'choice.open');
    assert.equal(open.length, 1);
    open[0].choice_ids = ids;
    p.sql
      .prepare('UPDATE receipt SET response = ? WHERE command_id = ?')
      .run(JSON.stringify(response), last.command_id as string);
    p.sql.close();
    const bytes = readFileSync(path);
    assert.throws(() => coldReopen(path, craft), /save_corrupt/, JSON.stringify(ids));
    assert.deepEqual(readFileSync(path), bytes);
  }
});
