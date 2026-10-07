// Controlled malformed values and one removed guard at a time; no production schema writes.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFS } from '../../../kernel/ts/src/contracts.gen.ts';
import { validate } from '../../../kernel/ts/src/foundation/validate.ts';
const defs: any = DEFS;
const id = '11111111-1111-4111-8111-111111111111';
const chapter = JSON.parse(readFileSync('protocol/fixtures/missing_child_v040_hash.json', 'utf8')).value;
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
    const bad = structuredClone(base); put(bad, path, 'invalid_d9_value');
    probe(name, base, guard.concat('enum'), bad, '/' + path.join('/'), 'not_in_enum');
  }
  for (const [field, node] of Object.entries(schema.properties ?? {})) if (field in at(base, path)) walk(name, base, node, guard.concat('properties', field), path.concat(field));
}
const cue = { source_event_id: id, command_id: id, actor_id: id, observer_id: id, room_id: id, logical_time: 64800, key: 'narration.bell_cue' };
const control = { job_id: id, next_wander_due: 64810, suppression: { generation: 1, ends_at: 237600, job_id: id, cause_event_id: id } };
const reaction = chapter.reactions['ashmere_missing_child@0.0.40:reaction/d9_suppress_hounds'];
for (const [name, base, path] of [
 ['WorldSettings', chapter.world, ['properties', 'bell_cue']],
 ['NarrationRecord', { command_id: id, lines: [{key: 'narration.ring_bell'}], cue }, ['properties', 'cue']],
 ['PopulationControl', control, ['properties', 'suppression']],
 ['Connection', chapter.rooms['ashmere_missing_child@0.0.40:room/chapel_nave'].exits.west, ['properties', 'corpse_ingress']],
] as const) walk(name, base, at(defs[name], path), [...path], [path[1]]);
const ri = defs.ReactionRule.properties.apply.items.oneOf.findIndex((b: any) => b.properties.op.const === 'population.suppress');
walk('ReactionRule', reaction, defs.ReactionRule.properties.apply.items.oneOf[ri], ['properties', 'apply', 'items', 'oneOf', ri], ['apply', 0]);
probe('PopulationControl', control, ['properties','suppression','properties','ends_at','anyOf',0,'minimum'], {...control, suppression: {...control.suppression, ends_at:0}}, '/suppression/ends_at', 'below_minimum');
console.log(JSON.stringify({ killed, survivors }, null, 2));
assert.equal(survivors.length, 0);
