// docs/state-sections.gen.json: the State section (a `state_row.section` in the save) each
// MutationTarget kind, and each DeltaOp, is kept in, as adopt() places it (runtime/rows.ts row(),
// of compose_target.ts target() for an op). bin/system_graph.exs joins it into the System pages. `LOKA_WRITE_GEN=1 node --test test/state_sections.test.ts`
// rewrites it.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { test } from 'node:test';
import { encode } from '../src/foundation/canonical.ts';
import { target } from '../src/foundation/compose_target.ts';
import type { DeltaOp, MutationTarget } from '../src/contracts.gen.ts';
import { row } from '../src/runtime/rows.ts';
import { read } from './read.ts';

const file = new URL('../../../docs/state-sections.gen.json', import.meta.url);
// row() keys a population plan by its DefinitionRef; the other kinds ignore `plan`.
const plan = { cartridge_id: 'c', cartridge_version: 1, kind: 'population_plan', key: 'p' };

type Branch = { properties: Record<string, { const?: string }> };
const section = (t: MutationTarget) => row({ ...t, plan } as MutationTarget)?.[0];

// Breaks: a MutationTarget kind or DeltaOp added, or a section renamed in rows.ts (or an op's target
// in compose_target.ts), with the file left stale.
test('docs/state-sections.gen.json lists the section of every MutationTarget kind and DeltaOp', () => {
  const $defs = read('protocol/delta.schema.json').$defs;
  // The clock (time.advance) is the head row, not a section.
  const sections = (pairs: [string, string | undefined][]) =>
    Object.fromEntries(pairs.filter((p) => p[1]));
  const kinds = sections(
    $defs.MutationTarget.oneOf.map(({ properties: p }: Branch) => {
      const kind = p.kind.const!;
      return [kind, section({ kind } as MutationTarget)];
    }),
  );
  // Each op built from its branch's field names alone: target() reads the op and which fields it has.
  const ops = sections(
    $defs.DeltaOp.oneOf.map(({ properties: p }: Branch) => {
      const op = Object.fromEntries(Object.keys(p).map((k) => [k, p[k].const ?? {}]));
      return [op.op, section(target(op as DeltaOp))];
    }),
  );
  const text = `${encode({ kinds, ops })}\n`;
  if (process.env.LOKA_WRITE_GEN) writeFileSync(file, text);
  assert.equal(readFileSync(file, 'utf8'), text, 'stale: rerun with LOKA_WRITE_GEN=1');
});
