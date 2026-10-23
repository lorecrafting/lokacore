// dialogue@1 farewell, moved out of proposal.ts for its size limit (loka-3w3q).
import type { DeltaOp } from '../contracts.gen.ts';
import type { World } from './decision.ts';
import type { Admitted } from './proposal_admit.ts';
import { anyPending as pending, parted } from '../mechanics/dialogue/selection.ts';

// dialogue@1: each conversation whose actor and speaker no longer share a room once the proposal
// is composed ends as Leave would (choice.close, no event), in the writer group that opened it here,
// else a new one. Composed only while a conversation may be open (no per-action apply otherwise).
export function farewell(
  p: { world: World; ops: DeltaOp[]; group: number },
  now: () => World | Admitted,
): Admitted | undefined {
  const opened = new Map<string, number>();
  for (const o of p.ops) if (o.op === 'choice.open') opened.set(o.continuation_id, o.writer_group);
  if (!opened.size && !pending(p.world)) return;
  const at = now();
  if (!('cartridge' in at)) return at;
  const ids = parted(at);
  const group = ids.some((id) => !opened.has(id)) ? ++p.group : p.group;
  for (const continuation_id of ids)
    p.ops.push({
      op: 'choice.close',
      writer_group: opened.get(continuation_id) ?? group,
      continuation_id,
    });
}
