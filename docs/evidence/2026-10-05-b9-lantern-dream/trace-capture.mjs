// Disposable real SQLite paths; emitted identifiers are deterministic fixture worlds only.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { redact } from '../../../kernel/ts/play/obs.ts';
import { dreamHost } from '../../../mobile/authority/local-story/__tests__/dream-host.test.ts';
import { phase, mv } from '../../../kernel/ts/test/dream_fixture.ts';
const dir = mkdtempSync(join(tmpdir(), 'loka-b9-trace-'));
const branches = [];
try {
  for (const branch of ['follow_fox', 'wake']) {
    const a = dreamHost(join(dir, branch + '.db')), checkpoints = [];
    try {
      a.start();
      for (const index of [1, 2, 3, 4, 5, -1]) {
        a.reopen();
        const row = a.sql.prepare('SELECT revision,command,response FROM receipt ORDER BY revision DESC LIMIT 1').get();
        checkpoints.push({ phase: phase(a.story.world()), mv: mv(a.story.world()), clock: a.story.world().state.clock, branch: a.dream().branch ?? null, revision: row.revision, command: JSON.parse(row.command), decision: JSON.parse(row.response) });
        if (index !== -1) index === 4 ? a.choose(branch) : a.next();
      }
      branches.push({ branch, checkpoints, completion_reports: a.sql.prepare('SELECT count(*) AS n FROM report').get().n });
    } finally { a.sql.close(); }
  }
  process.stdout.write(JSON.stringify(redact({ format: 'b9-shared-sqlite-trace-v1', candidate: { version: '0.0.26', api: '1.24', provisional: true }, branches }), null, 2) + '\n');
} finally { rmSync(dir, { recursive: true }); }
