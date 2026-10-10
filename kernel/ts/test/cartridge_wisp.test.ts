import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { bundle, ids, fresh, ref } from './wisp_fixture.ts';
import { loadCartridge, INSTALLED } from '../src/index.ts';
import { encode } from '../src/foundation/canonical.ts';
const prefix = 'ashmere_missing_child@0.0.23:';

// Break: the loader trusts compiler output for newly typed source references or admits duplicate knowledge mappings.
test('loader independently rejects wrong-kind refs, non-Boolean topics and malformed bounded consumers', () => {
  const rows: [string[], unknown, string][] = [
    [['topics', prefix + 'topic/ward', 'fact', 'kind'], 'npc', 'UNRESOLVED_REFERENCE'],
    [['facts', prefix + 'fact/topic_ward_known', 'scopes'], ['instance'], 'FACT_TYPE_MISMATCH'],
    [
      ['npcs', prefix + 'npc/wisp', 'perception', 'discovered', 'key'],
      'missing',
      'UNRESOLVED_REFERENCE',
    ],
    [
      ['recipes', prefix + 'recipe/seek_wisp', 'check', 'attribute', 'key'],
      'missing',
      'UNRESOLVED_REFERENCE',
    ],
    [
      ['rooms', prefix + 'room/marsh_light', 'details', 'glow', 'perception', 'title'],
      'missing',
      'UNRESOLVED_REFERENCE',
    ],
    [
      ['dialogues', prefix + 'dialogue/b_wisp_riddle', 'choices', 'answer', 'sequence'],
      [
        {
          op: 'topic.grant',
          topic: {
            cartridge_id: 'ashmere_missing_child',
            cartridge_version: '0.0.23',
            kind: 'topic',
            key: 'missing',
          },
        },
      ],
      'UNRESOLVED_REFERENCE',
    ],
    [['manifest', 'requires', 'kernel_api', 'at_least'], '1.20', 'KERNEL_API_RANGE_INVALID'],
  ];
  for (const [path, value, code] of rows) {
    const c = structuredClone(bundle.value);
    let at = c;
    for (const k of path.slice(0, -1)) at = at[k];
    at[path.at(-1)!] = value;
    const canonical = encode(c),
      hash = createHash('sha256').update(canonical).digest('hex');
    const loaded = loadCartridge(
      new TextEncoder().encode(JSON.stringify({ cartridge: c, content_hash: hash })),
      INSTALLED,
    );
    assert.equal(loaded.ok, false, path.join('.'));
    if (!loaded.ok) assert.equal(loaded.diagnostic.code, code, path.join('.'));
  }
});

// Break: room/detail additions shift fresh entity IDs differently from the independently pinned initial order.
test('Wisp release keeps its independently generated initial IDs', () => {
  const w = fresh();
  assert.equal(w.character, ids.character);
  assert.equal(w.body, ids.body);
  for (const [name, id] of Object.entries(ids)) {
    const [kind, key, detail] = name.split('/');
    if (kind === 'character' || kind === 'body' || kind === 'job' || kind === 'slot') continue;
    const actual =
      kind === 'detail'
        ? Object.entries(w.details).find(
            ([, d]) => d.key === detail && d.room === w.roomIds[prefix + 'room/' + key],
          )?.[0]
        : kind === 'room'
          ? w.roomIds[prefix + 'room/' + key]
          : w.entityIds[prefix + kind + '/' + key];
    assert.equal(actual, id, name);
  }
});

// Breaks (loka-x6t.5 save re-check): a hub answer (b_aldric reopens after each answer) that
// directly assigns a fact topics-save.ts proves by one receipt (topic, perception discovery,
// bounded riddle answer) loads, so repeating it turns the save corrupt; or the check flags any fact.
test('a reopening dialogue rejects a direct assignment of a once-proven fact', () => {
  const at = `.cartridge.dialogues["${prefix}dialogue/b_aldric"].choices.leave.sequence[0].op`;
  for (const [key, code] of [
    ['topic_ward_known', 'OUTCOME_MISMATCH'],
    ['fen_wisp_discovered', 'OUTCOME_MISMATCH'],
    ['fen_wisp_answered', 'OUTCOME_MISMATCH'],
    ['chapel_bell_rung', undefined],
  ] as const) {
    const c = structuredClone(bundle.value);
    c.dialogues[`${prefix}dialogue/b_aldric`].choices.leave.sequence = [
      { op: 'fact.assign', fact: ref('fact', key), value: true },
    ];
    const canonical = encode(c),
      hash = createHash('sha256').update(canonical).digest('hex');
    const loaded = loadCartridge(
      new TextEncoder().encode(JSON.stringify({ cartridge: c, content_hash: hash })),
      INSTALLED,
    );
    assert.deepEqual(
      loaded.ok ? undefined : [loaded.diagnostic.code, loaded.diagnostic.path],
      code && [code, at],
      key,
    );
  }
});
