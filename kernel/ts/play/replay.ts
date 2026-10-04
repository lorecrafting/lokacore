// Preflight the complete supported segment before any trusted replay command executes.
import { readFileSync } from 'node:fs';
import { decode } from '../src/foundation/canonical.ts';
import { validate } from '../src/foundation/validate.ts';

export function replayRecords(path: string, content_hash: string) {
  const file = readFileSync(path, 'utf8');
  const records = file
    .split('\n')
    .slice(0, -1)
    .map((line, i) => {
      try {
        const record = decode(line) as { event: string; ids: any; data: any };
        if (!validate('ObservationRecord', record).length) return record;
      } catch {}
      throw new Error(`${path}:${i + 1}: not an ObservationRecord line`);
    });
  const [head, ...entries] = records;
  if (head?.event !== 'trace.run' || entries.some((e) => e.event !== 'trace.command'))
    throw new Error(`${path}: not a game_trace (one trace.run, then trace.command entries)`);
  if (head.ids.content_hash !== content_hash)
    throw new Error(`${path}: a transcript of another cartridge`);
  if (entries.some((e) => e.ids.run_id !== head.ids.run_id))
    throw new Error('record run differs from trace header');
  const elapsed = entries.filter((e) => e.data.command.payload.type === 'elapsed');
  if (elapsed.some((e) => e.data.command.payload.run_id !== head.ids.run_id))
    throw new Error('elapsed run differs from trace header');
  if (
    elapsed.length &&
    (head.data.initial_state.state !== 'fresh' ||
      entries.some((e) => e.data.commit.state !== 'committed'))
  )
    throw new Error('elapsed replay requires a fresh committed segment');
  return { file, head, entries };
}
