// R2 (docs/design/story-tooling.md `### R2`): which story nodes the owner's recorded paths reach,
// as the names of the checkpoints that reach them, for the Story list's chips.
// `coverage.ts` answers the same question over `game_trace` transcripts; a cartridge has
// checkpoints (command steps), so the check's own replay is the path and the marker trick is the
// same one. Known cost, from the spec: a reaction is visible only through narration, so each path
// replays a second time against a marked copy.
import type { Step } from '../../../mobile/app/author/place.ts';
import type { DecisionResult } from '../src/contracts.gen.ts';
import type { Bundled } from '../../../mobile/authority/local-story/session.ts';
import { encode, hash, type Json } from '../src/foundation/canonical.ts';
import { refString } from '../src/runtime/decision.ts';
import { marked } from './coverage.ts';
import { names, play, stepsOf, type Each } from './checkpoints.ts';
import type { Covered } from './covered_type.ts';

export type { Covered } from './covered_type.ts';

/** `bundled` with every reaction marked, and the probe line back to its reaction. */
export function markedBundled(canonical: string) {
  const { cartridge, ruleOf } = marked(JSON.parse(canonical) as never);
  const json = cartridge as unknown as Json;
  return { bundled: { canonical: encode(json), sha256: hash(json) }, ruleOf };
}

/** The nodes one path reached, filled by `each`. A dialogue's continuation is remembered from its
 * `choice_opened`: `choice_resolved` names only the continuation, and by then its row is gone. */
export function reacher(ruleOf: (key: string) => string | undefined, at: string) {
  const opened = new Map<string, string>();
  const seen = new Set<string>();
  const each: Each = (game, d: DecisionResult) => {
    if (d.kind !== 'accepted') return;
    for (const line of d.narration ?? []) {
      const reaction = ruleOf(line.key);
      if (reaction) seen.add(reaction);
    }
    for (const { payload: p } of d.events) {
      if (p.type === 'quest_activated' || p.type === 'quest_resolved' || p.type === 'quest_failed')
        seen.add(refString(p.quest));
      else if (p.type === 'choice_opened') {
        const dialogue = game.dialogueOf(p.continuation_id);
        if (dialogue) opened.set(p.continuation_id, `${at}:dialogue/${dialogue}`);
      } else if (p.type === 'choice_resolved') {
        const node = opened.get(p.continuation_id);
        if (node) seen.add(node);
      }
    }
  };
  return { seen, each };
}

/** `covered(source, bundled)`: every node ref by the checkpoint names that reach it. A cartridge
 * with no `checkpoints/` answers `{}`. */
export function covered(source: string, bundled: Bundled): Covered {
  const { bundled: probe, ruleOf } = markedBundled(bundled.canonical);
  const { manifest } = JSON.parse(bundled.canonical) as {
    manifest: { id: string; version: string };
  };
  const at = `${manifest.id}@${manifest.version}`;
  const out: Covered = {};
  for (const file of names(source)) {
    const steps: Step[] | undefined = stepsOf(source, file);
    if (!steps) continue; // not a checkpoint: R1's verdict already says so
    const name = file.slice(0, -5);
    const { seen, each } = reacher(ruleOf, at);
    play(probe, steps, each);
    for (const node of seen) (out[node] ??= []).push(name);
  }
  return out;
}
