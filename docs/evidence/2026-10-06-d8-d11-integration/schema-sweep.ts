// Controlled malformed values and one removed guard at a time; no production schema writes.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFS } from '../../../kernel/ts/src/contracts.gen.ts';
import { validate } from '../../../kernel/ts/src/foundation/validate.ts';
const defs: any = DEFS;
const id = '11111111-1111-4111-8111-111111111111';
const fixture = JSON.parse(readFileSync('protocol/fixtures/crow_composition.json', 'utf8'));
const chapter = JSON.parse(readFileSync('protocol/fixtures/missing_child_v039_hash.json', 'utf8')).value;
const branch = (name: string, tag: string) => defs[name].oneOf.findIndex((b: any) => Object.values(b.properties).some((v: any) => v.const === tag));
const at = (o: any, path: any[]) => path.reduce((v, k) => v[k], o);
const put = (o: any, path: any[], v: any) => { at(o, path.slice(0, -1))[path.at(-1)] = v; };
let killed = 0;
const survivors: any[] = [];
function probe(name: string, base: any, guard: any[], invalid: any, path: string, code: string, field?: string) {
  assert.equal(validate(name, base).length, 0, 'valid controlled base ' + name);
  assert.ok(validate(name, invalid).some((e) => e.path === path && e.code === code), name + ' baseline ' + guard.join('/'));
  const changed: any = structuredClone(defs);
  const parent = at(changed[name], guard.slice(0, -1));
  if (field) parent[guard.at(-1)] = parent[guard.at(-1)].filter((v: string) => v !== field);
  else delete parent[guard.at(-1)];
  if (validate(name, invalid, changed).some((e) => e.path === path && e.code === code)) survivors.push({ name, guard, path });
  else { killed++; console.log('RED ' + name + ' ' + guard.join('/') + (field ? '/' + field : '')); }
}
function walk(name: string, base: any, schema: any, guard: any[], path: any[]) {
  for (const field of schema.required ?? []) {
    if (schema.properties?.[field]?.const !== undefined) continue; // source compiler owns required discriminators
    const bad = structuredClone(base); delete at(bad, path)[field];
    probe(name, base, guard.concat('required'), bad, '/' + path.concat(field).join('/'), 'missing_property', field);
  }
  for (const [bound, code] of Object.entries({ minimum: 'below_minimum', maximum: 'above_maximum', minItems: 'too_few_items', maxItems: 'too_many_items' })) {
    if (!(bound in schema)) continue;
    const bad = structuredClone(base);
    const value = bound === 'minimum' ? schema[bound] - 1 : bound === 'maximum' ? schema[bound] + 1 : Array.from({ length: bound === 'minItems' ? schema[bound] - 1 : schema[bound] + 1 }, () => at(base, path)[0]);
    put(bad, path, value);
    probe(name, base, guard.concat(bound), bad, '/' + path.join('/'), code);
  }
  if (schema.enum) {
    const bad = structuredClone(base); put(bad, path, 'invalid_crow_phase');
    probe(name, base, guard.concat('enum'), bad, '/' + path.join('/'), 'not_in_enum');
  }
  for (const [field, node] of Object.entries(schema.properties ?? {})) if (field in at(base, path)) walk(name, base, node, guard.concat('properties', field), path.concat(field));
}
const row = fixture.cases[0].ops[0].value;
walk('CrowTransport', row, defs.CrowTransport, [], []);
const plan = chapter.populations['ashmere_missing_child@0.0.39:population/crow_green_1'];
walk('PopulationPlan', plan, defs.PopulationPlan.properties.scavenge, ['properties', 'scavenge'], ['scavenge']);
for (const [name, tag, base] of [
  ['DeltaOp', 'crow.transition', fixture.cases[0].ops[0]],
  ['DeltaOp', 'job.schedule', fixture.cases[2].ops[0]],
  ['DeltaOp', 'job.cancel', { op: 'job.cancel', writer_group: 0, job_id: id, crow_member_id: id, crow_generation: 1 }],
  ['MutationTarget', 'crow', { kind: 'crow', plan: fixture.cases[0].ops[0].plan, slot: 1 }],
  ['CommandPayload', 'shoo', { type: 'shoo', actor_id: id, crow_id: id }],
  ['EventPayload', 'shooed', { type: 'shooed', crow_id: id, item_id: id, room_id: id }],
] as const) {
  const path = ['oneOf', branch(name, tag)];
  walk(name, base, at(defs[name], path), path, []);
}
const cancel = { op: 'job.cancel', writer_group: 0, job_id: id, crow_member_id: id, crow_generation: 1 };
const cp = ['oneOf', branch('DeltaOp', 'job.cancel')];
for (const [trigger, required] of [['crow_member_id', 'crow_generation'], ['crow_generation', 'crow_member_id']]) {
  const bad: any = { ...cancel }; delete bad[required];
  probe('DeltaOp', cancel, cp.concat('dependentRequired', trigger), bad, '/' + required, 'missing_property', required);
}
const both = { ...cancel, encounter_id: id };
probe('DeltaOp', cancel, cp.concat('exactlyOneRequired'), both, '', 'exclusive_properties');
const view = { ...defs.EntityView.examples[0], carrying: 'npc.crow.carrying' };
probe('EntityView', view, ['properties', 'carrying', '$ref'], { ...view, carrying: 'Bad' }, '/carrying', 'pattern_mismatch');
console.log(JSON.stringify({ killed, survivors }, null, 2));
assert.equal(survivors.length, 0, 'every applicable guard removal changes its controlled rejection');
