// Toolbox row W2 at the cartridge trust boundary: per_subject (entity and pair) facts and subject fields
// need kernel_api 1.47 (twin of lib/loka/content/scoped_facts.ex); in the loader only
// (FACT_SCOPE_UNSUPPORTED), such a fact is named only where a subject is known (a fact_compare, a
// fact.assign or fact.adjust step, a reaction's fact_changed trigger), and a subject field names
// one NPC or item instance, of such a fact only.
import type { Diagnostic } from '../contracts.gen.ts';
import { refString } from '../runtime/decision.ts';
import { diag, step, type Obj } from './cartridge_refs.ts';
import { apiCmp } from './cartridge_installed.ts';

const SITES = ['fact_compare', 'fact.assign', 'fact.adjust', 'fact_changed'];
const SUBJECTS = ['subject', 'npc', 'item'];
// Choice fields whose saves are reconciled against their facts on reopen.
const BOUND = [
  'accept',
  'hand_over',
  'receive',
  'payment',
  'escort',
  'exchange',
  'lesson_payment',
  'patrol',
];

const scoped = (spec: Obj | undefined) => spec?.per_subject === true;
const fieldsOf = (o: Obj) =>
  SUBJECTS.filter((f) => (f !== 'subject' || o.op === 'fact_compare') && Object.hasOwn(o, f));

// Every fact_compare and fact.assign node with its path.
function nodes(c: Obj, visit: (o: Obj, at: string, parent?: Obj, field?: string) => void) {
  const walk = (v: unknown, at: string, parent?: Obj, field?: string): void => {
    if (Array.isArray(v)) return v.forEach((x, i) => walk(x, `${at}[${i}]`, parent, field));
    if (!v || typeof v !== 'object') return;
    visit(v as Obj, at, parent, field);
    for (const [k, x] of Object.entries(v)) walk(x, `${at}${step(k)}`, v as Obj, k);
  };
  for (const [k, v] of Object.entries(c)) if (k !== 'facts') walk(v, `.cartridge${step(k)}`);
}

/** KERNEL_API_RANGE_INVALID when the cartridge uses row W2 below kernel_api 1.47. */
export function scopedFacts(c: Obj): Diagnostic[] {
  let used = Object.values((c.facts ?? {}) as Record<string, Obj>).some(scoped);
  nodes(c, (o) => {
    if ((o.op === 'fact_compare' || o.op === 'fact.assign') && fieldsOf(o).length) used = true;
  });
  return used && apiCmp(c.manifest.requires.kernel_api.at_least, '1.47') < 0
    ? [diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least')]
    : [];
}

/** FACT_SCOPE_UNSUPPORTED at each site that names a subject this kernel cannot read (row W2). */
export function scopeSites(c: Obj): Diagnostic[] {
  const subjective = (ref: Obj) => scoped(c.facts?.[refString(ref as never)]);
  const out: string[] = [];
  nodes(c, (o, at, parent, field) => {
    if (o.kind === 'fact' && subjective(o))
      if (field !== 'fact' || !SITES.includes(parent?.op ?? parent?.event)) out.push(at);
    if ((o.op !== 'fact_compare' && o.op !== 'fact.assign') || !o.fact) return;
    const fields = fieldsOf(o);
    if (fields.length > 1 || (o.npc && c.npcs?.[refString(o.npc)]?.spawn_template))
      out.push(`${at}.${fields.at(-1)}`);
    else if (fields.length && !subjective(o.fact)) out.push(`${at}.${fields[0]}`);
    else if (o.op === 'fact_compare' && !fields.length && subjective(o.fact)) out.push(at);
  });
  // ponytail: save recovery reconciles these choices' facts without a subject (mobile
  // dialogue-save, topics-save, deadline-receipts); a per_subject fact there waits for a subject.
  for (const [ref, d] of Object.entries((c.dialogues ?? {}) as Record<string, Obj>))
    for (const [key, o] of Object.entries(d.choices as Record<string, Obj>))
      if (BOUND.some((f) => Object.hasOwn(o, f)) || d.riddle?.choice_id === key)
        (o.sequence ?? []).forEach((x: Obj, i: number) => {
          if (x.fact && subjective(x.fact))
            out.push(`.cartridge.dialogues${step(ref)}.choices${step(key)}.sequence[${i}].fact`);
        });
  return out.map((at) => diag('FACT_SCOPE_UNSUPPORTED', at));
}
