// docs/state-sections.gen.json: the State section (a `state_row.section` in the save) each
// MutationTarget kind is kept in, as adopt() places it (runtime/rows.ts row()). bin/system_graph.exs
// joins it into the System/Save page. `LOKA_WRITE_GEN=1 node --test test/state_sections.test.ts`
// rewrites it.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { test } from 'node:test';
import { encode } from '../src/foundation/canonical.ts';
import type { MutationTarget } from '../src/contracts.gen.ts';
import { row } from '../src/runtime/rows.ts';
import { read } from './read.ts';

const file = new URL('../../../docs/state-sections.gen.json', import.meta.url);
// row() keys a population plan by its DefinitionRef; the other kinds ignore `plan`.
const plan = { cartridge_id: 'c', cartridge_version: 1, kind: 'population_plan', key: 'p' };

// Breaks: a MutationTarget kind added, or its section renamed in rows.ts, with the file left stale.
test('docs/state-sections.gen.json lists the section of every MutationTarget kind', () => {
  const kinds: string[] = read('protocol/delta.schema.json').$defs.MutationTarget.oneOf.map(
    (b: { properties: { kind: { const: string } } }) => b.properties.kind.const,
  );
  const sections = Object.fromEntries(
    kinds.flatMap((kind) => {
      const at = row({ kind, plan } as unknown as MutationTarget);
      return at ? [[kind, at[0]]] : []; // the clock is the head row, not a section
    }),
  );
  const text = `${encode(sections)}\n`;
  if (process.env.LOKA_WRITE_GEN) writeFileSync(file, text);
  assert.equal(readFileSync(file, 'utf8'), text, 'stale: rerun with LOKA_WRITE_GEN=1');
});
