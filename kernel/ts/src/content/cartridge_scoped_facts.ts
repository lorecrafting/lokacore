// Toolbox rows W2 and FD4 at the cartridge trust boundary, in the loader only: FACT_SCOPE_UNSUPPORTED
// where a subject field names what this kernel cannot read (a per_subject or npc_pair fact named
// only where a subject is known; a subject field of such a fact only; subject "target" only where
// a target can be; `with` only on an npc_pair op). The compiler checks the rest.
import type { Diagnostic } from '../contracts.gen.ts';
import { refString } from '../runtime/decision.ts';
import { diag, step, type Obj } from './cartridge_refs.ts';

const SITES = [
  'fact_compare',
  'fact.assign',
  'fact.adjust',
  'fact.stamp',
  'time_since',
  'fact_changed',
];
const OPS = SITES.slice(0, 5); // the sites that are ops and may name a subject
const SUBJECTS = ['subject', 'npc', 'item'];
// Toolbox rows G8 and 22a: the group reads its member, stay and fight facts at each NPC.
// Row 33: theft writes its stolen fact at the taken item. Row 43b: riding is read at each mount.
const GROUP = ['member', 'stay', 'fight']
  .map((k) => `.cartridge.world.group.${k}`)
  .concat('.cartridge.world.theft.stolen', '.cartridge.world.mount.riding');
// Choices whose facts save recovery reconciles by fact alone, with no subject: escort, receive
// and hand_over (mobile dialogue-save), a riddle answer with a wrong_limit (topics-save) and a
// dialogue of a legacy deadline quest (deadline-receipts); other choices' receipts are checked
// at the speaker (dialogue-consequences).
const BOUND = ['escort', 'receive', 'hand_over'];
// Definitions whose policies are read with no action target (reaction when, quest offer, objective
// and journal, barrier opens_when, skill qualification, a room or exit lock): subject "target"
// there never holds. Rows W15, FD9: a name variant's target is the player's body, no fact subject.
const TARGETLESS = ['reactions', 'quests', 'barriers', 'skills', 'world.identity'].map(
  (k) => `.cartridge.${k}`,
);
const targetless = (at: string) =>
  TARGETLESS.some((p) => at.startsWith(p)) ||
  /^\.cartridge\.rooms\[[^\]]*\](\.exits\.[a-z_]+)?\.locks\.(enter|traverse)\./.test(at);
const scoped = (spec: Obj | undefined) => spec?.per_subject === true;
// Toolbox row 21: a weapon's durability and a repair benefit read their fact at the wielded weapon.
const wielded = (o?: Obj) => o?.wear !== undefined || o?.kind === 'repair';
const fieldsOf = (o: Obj) =>
  SUBJECTS.filter((f) => (f !== 'subject' || o.op === 'fact_compare') && Object.hasOwn(o, f));

// Visits every object of the cartridge but its facts map, with its path, parent and field name.
function nodes(c: Obj, visit: (o: Obj, at: string, parent?: Obj, field?: string) => void) {
  const walk = (v: unknown, at: string, parent?: Obj, field?: string): void => {
    if (Array.isArray(v)) return v.forEach((x, i) => walk(x, `${at}[${i}]`, parent, field));
    if (!v || typeof v !== 'object') return;
    visit(v as Obj, at, parent, field);
    for (const [k, x] of Object.entries(v)) walk(x, `${at}${step(k)}`, v as Obj, k);
  };
  for (const [k, v] of Object.entries(c)) if (k !== 'facts') walk(v, `.cartridge${step(k)}`);
}

/** FACT_SCOPE_UNSUPPORTED at each site that names a subject this kernel cannot read (row W2). */
export function scopeSites(c: Obj): Diagnostic[] {
  const subjective = (ref: Obj) => scoped(c.facts?.[refString(ref as never)]);
  const paired = (ref: Obj) => c.facts?.[refString(ref as never)]?.npc_pair === true;
  const out: string[] = [];
  for (const [k, f] of Object.entries((c.facts ?? {}) as Record<string, Obj>))
    if (f.npc_pair && !(f.per_subject && f.scopes.length === 1 && f.scopes[0] === 'instance'))
      out.push(`.cartridge.facts${step(k)}.npc_pair`);
  nodes(c, (o, at, parent, field) => {
    if (o.kind === 'fact' && subjective(o))
      if (field !== 'fact' || !(SITES.includes(parent?.op ?? parent?.event) || wielded(parent)))
        if (!GROUP.includes(at)) out.push(at);
    if (!OPS.includes(o.op) || !o.fact) return;
    const fields = fieldsOf(o);
    if (paired(o.fact) !== Object.hasOwn(o, 'with')) out.push(`${at}.with`);
    else if (o.with && o.item) out.push(`${at}.item`);
    else if (o.with && c.npcs?.[refString(o.with)]?.spawn_template) out.push(`${at}.with`);
    else if (o.with && o.npc && refString(o.with) === refString(o.npc)) out.push(`${at}.with`);
    else if (fields.length > 1 || (o.npc && c.npcs?.[refString(o.npc)]?.spawn_template))
      out.push(`${at}.${fields.at(-1)}`);
    else if (fields.length && !subjective(o.fact)) out.push(`${at}.${fields[0]}`);
    else if (o.subject === 'target' && targetless(at)) out.push(`${at}.subject`);
    else if (/^(fact_compare|time_since)$/.test(o.op) && !fields.length && subjective(o.fact))
      out.push(at);
  });
  // ponytail: a per_subject fact there waits for a subject-aware reconciler.
  for (const [ref, d] of Object.entries((c.dialogues ?? {}) as Record<string, Obj>)) {
    const legacy = !!d.quest && !!c.quests?.[refString(d.quest)]?.deadline?.fact;
    for (const [key, o] of Object.entries(d.choices as Record<string, Obj>))
      if (
        legacy ||
        BOUND.some((f) => Object.hasOwn(o, f)) ||
        (d.riddle?.choice_id === key && d.riddle.wrong_limit !== undefined)
      )
        (o.sequence ?? []).forEach((x: Obj, i: number) => {
          if (x.fact && subjective(x.fact))
            out.push(`.cartridge.dialogues${step(ref)}.choices${step(key)}.sequence[${i}].fact`);
        });
  }
  return out.map((at) => diag('FACT_SCOPE_UNSUPPORTED', at));
}
