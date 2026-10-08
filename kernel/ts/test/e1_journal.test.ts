import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { gameView } from '../src/index.ts';
import { hash } from '../src/foundation/canonical.ts';
import { admitCandidate } from './e1_policy.ts';
import { caseHost, witnessedObligations } from './e1_case_host.ts';
import { replayCase } from './e1_cases.ts';
import { search, childReturn } from './e1_paths.ts';
import { read } from './read.ts';

// Breaks: the recorder omits an intermediate active journal variant, credits a later
// matching variant instead of the displayed first match, or backfills from a resolved quest.
test('E1 witnesses only the selected active journal at each SQLite commit', () => {
  const pin = read('protocol/fixtures/missing_child_v042_hash.json');
  const bytes = new TextEncoder().encode(
    `{"cartridge":${pin.canonical},"content_hash":"${pin.sha256}"}`,
  );
  const loaded = admitCandidate(bytes);
  const dir = mkdtempSync(join(tmpdir(), 'loka-e1-journal-'));
  const source = {
    source_sha: '1'.repeat(40),
    check_hash: '2'.repeat(64),
    policy_hash: '3'.repeat(64),
  };
  const base = '/quests/ashmere_missing_child@0.0.42:quest/missing_child/journal/active_variants';
  const expected: Record<string, string[]> = {
    following: ['1/when/root', '1/when/root/items/0', '1/when/root/items/1'],
    deliver: ['2/when/root', '2/when/root/items/0'],
    answered: ['3/when/root', '3/when/root/items/0'],
    met: ['4/when/root', '4/when/root/items/0'],
  };
  try {
    for (const child of ['rescued', 'stays'] as const) {
      const log = join(dir, `${child}.jsonl`);
      const a = caseHost(loaded, join(dir, `${child}.db`), log, undefined, {
        case_id: `${child}-prior`,
        source,
        fault_schedule: [],
      });
      try {
        const selected: string[] = [];
        let last: string[] = [];
        a.watch((before, after, command, decision) => {
          const shown = gameView(after).journal.find((q) => q.quest.key === 'missing_child');
          const key = shown?.journal?.replace('quest.missing_child.', '') ?? '';
          last = witnessedObligations(before, after, command, decision).filter((p) =>
            p.startsWith(base),
          );
          assert.deepEqual(
            last,
            (expected[key] ?? []).map((p) => `${base}/${p}`),
          );
          if (expected[key] && selected.at(-1) !== key) selected.push(key);
        });
        search(a);
        childReturn(a, child);
        a.reopen();
        assert.deepEqual(selected, [
          'met',
          'answered',
          child === 'rescued' ? 'following' : 'deliver',
        ]);
        assert.equal(
          a.view().journal.find((q) => q.quest.key === 'missing_child')?.state,
          'resolved',
        );
        assert.deepEqual(last, []);
        a.record({
          kind: 'finish',
          steps: a.commands.length,
          digest: a.digest(),
          state_hash: hash(a.story.world().state as never),
        });
        const text = readFileSync(log, 'utf8');
        const replay = replayCase(bytes, text, source);
        const paths = selected.flatMap((key) => expected[key]!.map((p) => `${base}/${p}`)).sort();
        assert.deepEqual(
          replay.obligations.filter((p) => p.startsWith(base)),
          paths,
        );
        // Removing intermediate witnesses cannot be repaired from the final resolved save.
        const stripped = text
          .trim()
          .split('\n')
          .map((line) => {
            const entry = JSON.parse(line);
            if (entry.kind === 'step')
              entry.obligations = entry.obligations.filter((p: string) => !p.startsWith(base));
            return JSON.stringify(entry);
          })
          .join('\n');
        assert.deepEqual(
          replayCase(bytes, stripped, source).obligations.filter((p) => p.startsWith(base)),
          [],
        );
      } finally {
        a.close();
      }
    }
  } finally {
    rmSync(dir, { recursive: true });
  }
});
