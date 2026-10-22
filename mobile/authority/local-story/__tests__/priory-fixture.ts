// Controlled authored custody for real SQLite and actual Book item tests: the frozen codex_sampler
// KAT, optionally with its lidded chest (kernel/ts/test/codex_fixture.ts).
import { createHash } from 'node:crypto';
import { chest, codex } from '../../../../kernel/ts/test/codex_fixture.ts';
import { fragment } from '../../../../kernel/ts/test/fragment.ts';
// Book tests reach the kernel only through local-story (spec document 10 §2).
export {
  chest,
  DESK_NOTE,
  notices,
  PLAQUE,
  realElapsed,
} from '../../../../kernel/ts/test/codex_fixture.ts';

type Change = (c: any) => void;
export const CONTEXT = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f';

export function bundle(change: Change = () => {}) {
  const b = codex.bundle(change);
  return { ...b, value: JSON.parse(b.canonical) };
}
export const chestBundle = (initial: 'open' | 'closed' = 'open') => bundle(chest(initial));

/** Initial ids by the numeric-profile.md genesis order, from SHA-256 alone (no kernel code). */
export function ids(c: any): Record<string, string> {
  const rooms = Object.entries<any>(c.rooms).sort(([a], [b]) => (a < b ? -1 : 1));
  const sorted = (m: any = {}) =>
    Object.entries<any>(m)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([, v]) => v);
  const labels = [
    'character',
    'body',
    ...rooms.map(([, r]) => `room/${r.key}`),
    ...rooms.flatMap(([, r]) => Object.keys(r.details ?? {}).map((d) => `detail/${r.key}/${d}`)),
    ...sorted(c.npcs).map((n) => `npc/${n.key}`),
    ...sorted(c.items).map((i) => `item/${i.key}`),
  ];
  // ponytail: canonical JSON gives detail keys sorted; no template items, schedule jobs or slots (codex_sampler
  // has none); add them in genesis order if a test needs them.
  return Object.fromEntries(
    labels.map((label, ordinal) => {
      const domain = ['loka-id-v1', CONTEXT, '00000000-0000-0000-0000-000000000000', ordinal];
      const b = createHash('sha256').update(JSON.stringify(domain)).digest().subarray(0, 16);
      b[6] = (b[6] & 15) | 128;
      b[8] = (b[8] & 63) | 128;
      const h = b.toString('hex');
      return [
        label,
        [h.slice(0, 8), h.slice(8, 12), h.slice(12, 16), h.slice(16, 20), h.slice(20)].join('-'),
      ];
    }),
  );
}

// polish_detail.test.ts (slice M6c's row) still reads the v027 marsh.
export function darkMarshBundle() {
  return fragment('protocol/fixtures/missing_child_v027_hash.json').bundle((c) => {
    c.entry.key = 'marsh_light';
    c.calendar.start = 0;
  });
}
