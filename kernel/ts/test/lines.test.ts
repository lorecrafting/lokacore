// The lines sheet (docs/design/story-tooling.md, W3) over a planted cartridge: a gated dialogue
// (`maud`, `when: met_maud`), an ungated one (`fen`), a `.scene` whose keys exist only after
// lowering, and a `~` still to write.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, test } from 'node:test';
import { csv, lines } from '../play/lines.ts';

const root = resolve(import.meta.dirname, '../../..');
const dir = mkdtempSync(join(tmpdir(), 'loka-lines-'));
after(() => rmSync(dir, { recursive: true, force: true }));
const src = join(dir, 'src');
for (const d of ['rooms', 'npcs', 'dialogues', 'scenes'])
  mkdirSync(join(src, d), { recursive: true });
const put = (rel: string, bytes: string | unknown) =>
  writeFileSync(join(src, rel), typeof bytes === 'string' ? bytes : JSON.stringify(bytes));

put(
  'cartridge.json',
  JSON.stringify({
    api_version: 'loka/v3',
    id: 'lines_probe',
    version: '0.0.1',
    title: 'Lines Probe',
    requires: {
      kernel_api: { at_least: '1.155', below: '2.0' },
      content_schema: 1,
      rule_ir: 1,
      capabilities: {
        movement: 1,
        containment: 1,
        fact: 1,
        policy: 1,
        dialogue: 1,
        scene: 1,
      },
      client_features: [],
    },
    supported_profiles: ['offline_private'],
    entry: 'square',
  }),
);
put(
  'facts.json',
  JSON.stringify({
    facts: {
      met_maud: {
        version: 1,
        value_type: { type: 'bool', default: false },
        scopes: ['player'],
        meaning: 'Whether Maud was met.',
      },
      maud_visits: {
        version: 1,
        value_type: { type: 'int', default: 0, minimum: 0, maximum: 9 },
        scopes: ['player'],
        meaning: 'How many times Maud was visited.',
      },
    },
  }),
);
// one key per line: the sheet's `file:line` column is text.json's own line for each
put(
  'text.json',
  `{
  "room.square.title": "Square",
  "room.square.description": "Café cobbles.",
  "npc.maud.short": "Maud",
  "npc.maud.line": "Maud stands here.",
  "npc.maud.description": "Grey hair.",
  "npc.fen.short": "Fen",
  "npc.fen.line": "Fen waits.",
  "npc.fen.description": "A thin man.",
  "dialogue.maud.prompt": "Maud nods.",
  "dialogue.maud.greet": "Greet her",
  "narration.maud.greet": "You greet her.",
  "dialogue.fen.prompt": "Fen shrugs.",
  "dialogue.fen.leave": "Leave him",
  "narration.fen.leave": "You walk off.",
  "narration.mark": "~"
}
`,
);
put('rooms/square.json', {
  name: 'room.square.title',
  description: 'room.square.description',
  exits: {},
});
put('npcs/maud.json', {
  keywords: ['maud'],
  name: 'npc.maud.short',
  room_line: 'npc.maud.line',
  description: 'npc.maud.description',
  room: 'square',
});
put('npcs/fen.json', {
  keywords: ['fen'],
  name: 'npc.fen.short',
  room_line: 'npc.fen.line',
  description: 'npc.fen.description',
  room: 'square',
});
put('dialogues/maud.json', {
  npc: 'maud',
  policy: { op: 'fact_compare', fact: 'met_maud', equals: true },
  prompt: 'dialogue.maud.prompt',
  roles: { maud: { role: 'npc', npc: 'maud' } },
  choices: {
    greet: {
      label: 'dialogue.maud.greet',
      narration: 'narration.maud.greet',
      policy: { op: 'fact_at_least', fact: 'maud_visits', at_least: 1 },
    },
  },
});
put('dialogues/fen.json', {
  npc: 'fen',
  prompt: 'dialogue.fen.prompt',
  roles: { fen: { role: 'npc', npc: 'fen' } },
  choices: { leave: { label: 'dialogue.fen.leave', narration: 'narration.fen.leave' } },
});
put('scenes/wave.scene', 'npc: fen\n\n* Fen waves you over.\n- Wave back\n  * You wave back.\n');
const artifact = join(dir, 'artifact.json');
execFileSync('mix', ['loka.compile', src, artifact, '--allow-placeholders'], {
  cwd: root,
  stdio: 'ignore',
});
const [, canonical, sha256] = /^\{"cartridge":(.*),"content_hash":"([0-9a-f]{64})"\}$/s.exec(
  readFileSync(artifact, 'utf8'),
)!;
const dev = { canonical: canonical!, sha256: sha256! };
const rows = lines(src, {}, dev);
const row = (key: string) => rows.find((r) => r.key === key);

// Break: the gate column is dropped or blank, the ungated line takes its neighbour's gate, or a
// scene file's lowered keys are not rows at all (the sheet read from source alone).
test('a gated line and an ungated line are both listed, the gate words on the gated one', () => {
  assert.equal(row('dialogue.maud.prompt')?.gate, 'fact met_maud on the target needs true');
  assert.equal(row('dialogue.fen.prompt')?.gate, '');
  assert.equal(row('dialogue.wave.prompt')?.words, 4); // "Fen waves you over."
  assert.equal(row('npc.maud.line')?.speaker, 'npcs/maud'); // no speaker: its owning node
  assert.equal(row('dialogue.wave.prompt')?.speaker, 'fen');
});

test('a line that trims to ~ is flagged; a written one is not', () => {
  // Break: the `~` column skipped, or every row flagged (the flag read from the key, not the words).
  assert.equal(row('narration.mark')?.placeholder, true);
  assert.equal(row('dialogue.fen.prompt')?.placeholder, false);
});

test("--speaker keeps the speaker's lines, not its definition file's", () => {
  // Break: filtered on the owning node (keeps npcs/maud rows), or not filtered at all.
  const maud = lines(src, { speaker: 'maud' }, dev);
  assert.equal(maud.length, 3); // prompt, label, narration — the greetings Maud says and offers
  assert.ok(maud.every((r) => r.speaker === 'maud'));
  assert.equal(
    maud.find((r) => r.key === 'npc.maud.line'),
    undefined,
  );
});

test("a choice's own policy gates its words, not the dialogue's", () => {
  // Break: the choice-policy branch dropped, so a gated label reports its dialogue's `when:` (or
  // no gate at all) and a proofreader cannot tell which rule hides the option.
  // The choice's policy covers everything inside it, its narration included: you only read that
  // line after passing the gate and picking the option.
  const choiceGate = 'fact maud_visits is at least 1';
  assert.equal(row('dialogue.maud.greet')?.gate, choiceGate);
  assert.equal(row('narration.maud.greet')?.gate, choiceGate);
  // An ungated choice in a gated dialogue still takes the dialogue's gate.
  assert.equal(row('dialogue.fen.prompt')?.gate, '');
});

test('a known line counts words and UTF-8 bytes, and names its source line', () => {
  // Break: bytes counted as characters ("Café" is 5 bytes, 4 characters), the word count read
  // over all lines including a `~` one, or the location taken from the wrong file or line.
  const cafe = row('room.square.description');
  assert.deepEqual([cafe?.words, cafe?.bytes, cafe?.at], [2, 14, 'text.json:3']);
  assert.deepEqual(row('narration.mark')?.words, 0); // a `~` is not written words
});

test('CSV: one header and one row per key, quoted where a field holds a comma', () => {
  // Break: no header, a row per definition instead of per key, or an unquoted field that shifts
  // every column after it.
  const out = csv([
    {
      key: 'a.b',
      words: 2,
      speaker: 'maud',
      at: 'text.json:3',
      gate: 'x, "y"',
      placeholder: false,
      bytes: 14,
    },
  ]);
  assert.deepEqual(
    out,
    'key,words,speaker,at,gate,placeholder,bytes\na.b,2,maud,text.json:3,"x, ""y""",false,14\n',
  );
  // The row count is the fixture's literal: 15 keys written in text.json above, plus the three
  // the `.scene` lowers into. Never lines()'s own length: a dropped or duplicated key must fail.
  const sheet = csv(rows).split('\n');
  assert.equal(sheet[0], 'key,words,speaker,at,gate,placeholder,bytes');
  assert.equal(sheet.length, 18 + 2); // one header, 18 rows, and the final newline's empty string
});

// Break: the command is not wired into bin/loka, --csv prints JSON (or the header is lost), or a
// usage error exits 0.
test('bin/loka lines prints the sheet, CSV on --csv', () => {
  // mise is stubbed as CI has none (as check.test.ts); mix comes from PATH.
  const bin = join(dir, 'bin');
  mkdirSync(bin);
  writeFileSync(join(bin, 'mise'), '#!/bin/sh\nshift 2\nexec "$@"\n');
  chmodSync(join(bin, 'mise'), 0o755);
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}` };
  const run = (args: string[]) =>
    spawnSync(join(root, 'bin/loka'), ['lines', ...args], { encoding: 'utf8', env });
  const out = run([src, '--csv']);
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /^key,words,speaker,at,gate,placeholder,bytes\n/);
  assert.match(
    out.stdout,
    /\ndialogue\.maud\.prompt,2,maud,text\.json:10,fact met_maud on the target needs true,false,10\n/,
  );
  assert.equal(run([src, '--speaker', 'maud', '--csv']).stdout.split('\n').length, 5); // header, 3, blank
  assert.equal(run([]).status, 2); // usage
  assert.equal(run([src, '--speaker']).status, 2);
  // Break: the compile runs against the kernel's cwd, not the given directory.
  const near = spawnSync(join(root, 'bin/loka'), ['lines', 'src', '--csv'], {
    cwd: dir,
    encoding: 'utf8',
    env,
  });
  assert.equal(near.stdout, out.stdout);
});
