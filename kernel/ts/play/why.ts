// `node kernel/ts/play/why.ts <artifact> <transcript.jsonl> <ordinal> [--action <key> | --dialogue <key>]`
// (docs/system/cartridge.md#rule-explainer-loka-kgd1943): replays a transcript up to one step,
// decides that step and prints, per reaction rule, its trigger match, deliveries and `when`
// leaves; on demand one scripted action's or dialogue's policy. A report for authors, not a check.
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import type {
  CharacterId,
  Command,
  DecisionResult,
  Policy,
  ReactionRule,
} from '../src/contracts.gen.ts';
import { encode, type Json } from '../src/foundation/canonical.ts';
import { INSTALLED, loadCartridge, type Cartridge, type World } from '../src/index.ts';
import { primaryTarget } from '../src/commands/action_input.ts';
import { cmp } from '../src/foundation/validate.ts';
import { holds } from '../src/mechanics/policy.ts';
import { FILTERS } from '../src/mechanics/reaction.ts';
import { refString } from '../src/runtime/decision.ts';
import { marked, replay } from './coverage.ts';
import { ROOT } from './obs.ts';
import { replayRecords } from './replay.ts';
import { decideReplay, start, type Run } from './run.ts';

type Trace = ReturnType<typeof replayRecords>;
type Asked = { action?: string; dialogue?: string };
const leaves = (p: Policy): Policy[] =>
  p.op === 'all' || p.op === 'any'
    ? p.items.flatMap(leaves)
    : p.op === 'not'
      ? leaves(p.item)
      : [p];
// `p` with each leaf, in `leaves` order, extended by `at(leaf index)`.
const annotate = (p: Policy, at: (i: number) => object, n = { i: 0 }): Json =>
  (p.op === 'all' || p.op === 'any'
    ? { ...p, items: p.items.map((x) => annotate(x, at, n)) }
    : p.op === 'not'
      ? { ...p, item: annotate(p.item, at, n) }
      : { ...p, ...at(n.i++) }) as unknown as Json;
const said = (d: DecisionResult, is: (key: string) => boolean) =>
  d.kind === 'accepted' ? (d.narration ?? []).filter((x) => is(x.key)).length : 0;
/** Wrong arguments: the CLI exits 2. */
class Usage extends Error {}

/** The explanation of step `ordinal` of `trace` (cartridge.md Rule explainer lists the evidence). */
export function why(c: Cartridge, trace: Trace, ordinal: number, on: Asked = {}) {
  const { entries } = trace;
  if (!Number.isInteger(ordinal) || ordinal < 1 || ordinal > entries.length)
    throw new Usage(`ordinal ${ordinal} is not in 1..${entries.length}`);
  const { cartridge, ruleOf } = marked(c);
  const r = prefix(cartridge, trace, ordinal);
  const command: Command = entries[ordinal - 1]!.data.command;
  const before = r.world;
  const decide = (cart: Cartridge) => step(r, cart, command, ordinal);
  const d = decide(cartridge);
  const rules = cartridge.reactions ?? {};
  const probe = `coverage.m${Object.keys(rules).length}`; // no rule's, and never authored (marked)
  // The deliveries at which leaf `i` of `ref` held: `ref` replaced, under its own key, by that leaf.
  const held = (ref: string, i: number) => {
    const { key, on, when } = rules[ref]!;
    const leaf = leaves(when!)[i]!;
    const probed = { key, on, when: leaf, steps: [{ op: 'narrate', text: probe }] };
    const reactions = { ...rules, [ref]: probed };
    return said(decide({ ...cartridge, reactions } as Cartridge), (k) => k === probe);
  };
  return {
    ordinal,
    command: command.payload.type,
    outcome: d.kind === 'accepted' ? d.outcome : d.kind,
    reactions: Object.entries(rules)
      .sort(([, a], [, b]) => cmp(a.key, b.key))
      .map(([ref, rule]) => ({
        rule: ref,
        causes: causes(rule, d, before),
        fired: said(d, (key) => ruleOf(key) === ref),
        ...(rule.when && { when: annotate(rule.when, (i) => ({ held: held(ref, i) })) }),
      })),
    ...asked(c, on, before, command),
  };
}

// Step `ordinal` decided on a copy of `r` (decideReplay advances the Run it is given) with `cart`.
function step(r: Run, cart: Cartridge, command: Command, ordinal: number) {
  const d = decideReplay({ ...r, world: { ...r.world, cartridge: cart } }, command).decision;
  // closing() (mechanics/death/lines.ts:22) cuts narration to 64 lines: a cut marker is unknown
  if (d.kind === 'accepted' && (d.narration?.length ?? 0) >= 64)
    throw new Error(`narration cap reached at ordinal ${ordinal}`);
  return d;
}

// The marked Run before step `ordinal`, once ordinals 1..ordinal-1 replay byte for byte.
function prefix(cartridge: Cartridge, trace: Trace, ordinal: number) {
  replay(cartridge, trace, undefined, ordinal); // throws `replay differs at ordinal <n>`
  const { head, entries } = trace;
  const r = start(
    cartridge,
    head.ids.content_hash,
    head.ids.run_id,
    head.data.world_context_id,
    head.ids.seed,
    head.ids.kernel_version,
  );
  for (const e of entries.slice(0, ordinal - 1)) decideReplay(r, e.data.command);
  return r;
}

// The step's committed events of the rule's type, each declared filter matched on the world
// before the step, as the proposal matches triggers (mechanics/reaction.ts triggered).
const causes = (rule: ReactionRule, d: DecisionResult, before: World) =>
  (d.kind === 'accepted' ? d.events : [])
    .filter((e) => e.payload.type === rule.on.event)
    .map((e) => ({
      event: e.payload.type,
      position: e.position,
      filters: Object.fromEntries(
        Object.entries(rule.on)
          .filter(([f]) => f !== 'event')
          .map(([f, want]) => [f, FILTERS[f]!(before, want, e.payload as never, e)]),
      ),
    }));

// The policies asked for, on the world before the step: a scripted action's target is the command's,
// a dialogue's its authored NPC (dialogue/selection.ts:93; ponytail: not a choose row's bound
// speaker, dialogue/shared.ts:93; read speakerOf once a fixture binds a speaker other than the npc).
const asked = (c: Cartridge, on: Asked, before: World, command: Command) => ({
  ...(on.action !== undefined && {
    action: policy(c.scripted_actions, on.action, before, command, () =>
      primaryTarget(command.payload),
    ),
  }),
  ...(on.dialogue !== undefined && {
    dialogue: policy(
      c.dialogues,
      on.dialogue,
      before,
      command,
      (x) => before.entityIds[refString(x.npc)],
    ),
  }),
});

// The definition keyed `key`, its policy's leaves read on `world` as admission reads them; no
// policy, none (it holds).
function policy<D extends { key: string; policy?: Policy }>(
  defs: Readonly<Record<string, D>> | undefined,
  key: string,
  world: World,
  command: Command,
  target: (d: D) => string | undefined,
) {
  const [rule, d] = Object.entries(defs ?? {}).find(([, x]) => x.key === key) ?? [];
  if (!d) throw new Usage(`no definition keyed ${key}`);
  const ctx = () => ({ target: target(d) as never, steps: { n: 0 } });
  const actor = (command.payload as { actor_id: CharacterId }).actor_id; // scripted actions' and talk's commands carry one
  const root = d.policy;
  if (!root) return { rule };
  const at = (i: number) => ({ holds: holds(world, actor, leaves(root)[i]!, ctx()) });
  return { rule, policy: annotate(root, at) };
}

if (import.meta.main) {
  const [file, path, n, ...rest] = process.argv.slice(2);
  const flag = rest.length === 2 ? /^--(action|dialogue)$/.exec(rest[0]!)?.[1] : undefined;
  if (!n || (rest.length && !flag)) {
    console.error(
      'usage: node kernel/ts/play/why.ts <artifact> <transcript.jsonl> <ordinal> [--action <key> | --dialogue <key>]',
    );
    process.exit(2);
  }
  const loaded = loadCartridge(readFileSync(file), INSTALLED);
  if (!loaded.ok) {
    console.error(JSON.stringify(loaded.diagnostic));
    process.exit(1);
  }
  try {
    const pin = JSON.parse(readFileSync(path, 'utf8').split('\n')[0]!).ids.content_hash;
    const trace = replayRecords(path, pin);
    const on = flag ? { [flag]: rest[1] } : {};
    console.log(
      encode(why(loaded.cartridge as Cartridge, trace, Number(n), on) as unknown as Json),
    );
  } catch (e) {
    const at = e instanceof Usage ? '' : `${relative(ROOT, path)}: `; // the replay error has no path
    console.error(`${at}${(e as Error).message}`.replaceAll(ROOT, ''));
    process.exit(e instanceof Usage ? 2 : 1);
  }
}
