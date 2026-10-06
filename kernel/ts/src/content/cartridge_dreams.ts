// The consumed Rest-anchored presentation-only graph and its exclusive consequence owners.
import type { Diagnostic, DefinitionRef } from '../contracts.gen.ts';
import { checkers, diag, type Obj } from './cartridge_refs.ts';
import { refString } from '../runtime/decision.ts';
import { same } from '../foundation/compose.ts';

type Checks = ReturnType<typeof checkers>;
export function dream(c: Obj, s: Obj, at: string, checks: Checks): Diagnostic[] {
  const out: Diagnostic[] = [],
    bad = (field: string) => out.push(diag('OUTCOME_MISMATCH', at + field));
  const r = s.on.rest;
  for (const [field, kind] of [
    ['room', 'room'],
    ['entitlement', 'fact'],
    ['credit', 'fact'],
    ['quest', 'quest'],
  ])
    checks.named(r[field], kind, `${at}.on.rest.${field}`);
  requirements(c, out, bad);
  const bed = c.rooms?.[refString(r.room)]?.details?.[r.detail]?.bed;
  if (
    !bed ||
    !same(bed.entitlement, r.entitlement) ||
    !boolean(c, r.entitlement) ||
    !boolean(c, r.credit) ||
    same(r.credit, r.entitlement)
  )
    bad('.on.rest');
  if (
    !Object.values(c.services ?? {}).some(
      (service: any) =>
        service.benefit.kind === 'entitlement' && same(service.benefit.fact, r.entitlement),
    )
  )
    bad('.on.rest.entitlement');
  graph(s, at, checks, bad);
  ending(c, s, at, checks, bad);
  return out;
}

function requirements(c: Obj, out: Diagnostic[], bad: (field: string) => void) {
  for (const cap of [
    'position',
    'scene',
    'quest',
    'dialogue',
    'reaction',
    'fact',
    'resource',
    'death',
    'service',
  ])
    if (c.lock.capabilities[cap] !== 1) bad('.on.rest');
  const api = c.manifest.requires.kernel_api.at_least.split('.').map(Number);
  if (api[0] < 1 || (api[0] === 1 && api[1] < 25))
    out.push(diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'));
}

function graph(s: Obj, at: string, checks: Checks, bad: (field: string) => void) {
  const want = ['narrate', 'narrate', 'narrate', 'choice', 'branch', 'await_ack', 'end'];
  if (
    !same(
      s.steps.map((step: Obj) => step.type),
      want,
    )
  )
    bad('.steps');
  checks.text(s, ['title', 'description'], at);
  for (const [i, step] of s.steps.entries()) {
    if (step.type === 'narrate') checks.text(step, ['text'], `${at}.steps[${i}]`);
    if (step.type !== 'choice') continue;
    checks.text(step, ['prompt'], `${at}.steps[${i}]`);
    if (new Set(step.choices.map((c: Obj) => c.choice_id)).size !== 2) bad(`.steps[${i}].choices`);
    for (const [j, option] of step.choices.entries())
      checks.text(option, ['label', 'text'], `${at}.steps[${i}].choices[${j}]`);
  }
}

function ending(c: Obj, s: Obj, at: string, checks: Checks, bad: (field: string) => void) {
  const r = s.on.rest,
    end = s.on_end;
  checks.named(end.quest, 'quest', `${at}.on_end.quest`);
  if (!same(end.quest, r.quest) || end.assign.length !== 1) bad('.on_end');
  for (const [i, a] of end.assign.entries()) {
    checks.named(a.fact, 'fact', `${at}.on_end.assign[${i}].fact`);
    if (
      !boolean(c, a.fact) ||
      a.value !== true ||
      same(a.fact, r.credit) ||
      same(a.fact, r.entitlement)
    )
      bad(`.on_end.assign[${i}]`);
  }
  const q = c.quests?.[refString(r.quest)],
    memory = end.assign[0]?.fact;
  if (
    !q ||
    q.offer ||
    q.repeatable ||
    q.deadline ||
    q.exchange ||
    q.patrol ||
    q.objective.evidence !== 'current_state' ||
    !same(q.objective.policy.root, { op: 'fact_compare', fact: memory, equals: true })
  )
    bad('.on.rest.quest');
  ownership(c, s, r, memory, bad);
}

function ownership(c: Obj, s: Obj, r: Obj, memory: DefinitionRef, bad: (field: string) => void) {
  const other = Object.values(c.scenes ?? {}) as Obj[];
  if (
    other.some(
      (x) =>
        x !== s &&
        x.control === 'presentation_only' &&
        [r.credit, memory, r.quest].some(
          (ref) =>
            same(ref, x.on.rest.credit) ||
            same(ref, x.on.rest.quest) ||
            x.on_end.assign.some((a: Obj) => same(ref, a.fact)),
        ),
    )
  )
    bad('.on.rest');
  for (const d of Object.values(c.dialogues ?? {}) as Obj[])
    if (
      same(d.quest, r.quest) ||
      Object.values(d.choices as Obj).some((o) => same(o.accept, r.quest))
    )
      bad('.on.rest.quest');
  for (const rule of Object.values(c.reactions ?? {}) as Obj[])
    if (rule.apply.some((a: Obj) => same(a.quest, r.quest))) bad('.on.rest.quest');
}

const boolean = (c: Obj, ref: DefinitionRef) => {
  const f = c.facts[refString(ref)];
  return (
    f?.value_type.type === 'bool' && f.value_type.default === false && same(f.scopes, ['player'])
  );
};
