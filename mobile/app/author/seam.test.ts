// The builder's Book seam (docs/rnd/in-game-builder-mode-2026-11-19.md §6.2, §6.6; slice 1.1).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { nodes } from '../book/__tests__/polish-book.test.ts';
import { BUILD } from './build/build.ts';

// Breaks: a Book line skips the seam (Text.tsx drawing without asking it), so the builder cannot see
// or decorate that line. A line is each Book Text, an inline link inside a sentence included.
test('a counting seam sees each line of a room page', async () => {
  const { RoomPage } = await import('../book/Body.tsx');
  const { install } = await import('./build/seam.ts');
  const text = (key: string) =>
    ({
      'room.loft.title': 'Loft',
      'room.loft.description': 'A low loft. A [hearth](hearth) smokes.',
    })[key] ?? key;
  const view = {
    place: { title: { key: 'room.loft.title' }, description: { key: 'room.loft.description' } },
    exits: [],
    entities: [],
    inventory: [],
    actions: [],
    notices: [],
  } as any;
  install();
  const g = globalThis as { loka_author_seam_lines?: number };
  delete g.loka_author_seam_lines; // the seam starts its own count
  const drawn = nodes(
    RoomPage({
      view,
      text,
      log: [],
      g: { place: [], door: () => [] },
      press() {},
      open() {},
      links: new Map([['hearth', () => {}]]),
    } as any),
  );
  // Hand count: the title "Loft", the sentence, and its "hearth" link.
  assert.equal(g.loka_author_seam_lines, 3);
});

// Breaks (F21 of loka-hcnlh.101): the live region's copy of the latest line (Heard) goes through the
// seam, so an unwritten prompt draws a second, hidden field whose box and focus steal the seen one's.
test('the seam never sees the line only a screen reader reads', async () => {
  const { Heard } = await import('../book/lines.tsx');
  const { install } = await import('./build/seam.ts');
  install();
  const g = globalThis as { loka_author_seam_lines?: number };
  delete g.loka_author_seam_lines;
  const drawn = nodes(Heard({ said: { key: 1, text: '~' } }));
  assert.ok(
    drawn.some((n) => n.props?.children === '~'),
    'Heard drew its line',
  ); // drawing nothing proves nothing
  assert.equal(g.loka_author_seam_lines, undefined);
});

// Breaks: the builder reaches a player build (build/Build.tsx, its seam and strip, required outside
// the author gate in panel.tsx), so a release carries author code. A real release web export
// (about 11 s on an M1).
test('a release web export holds no builder seam or Build strip', () => {
  const out = mkdtempSync(join(tmpdir(), 'loka-release-'));
  const env = { ...process.env, CI: '1', EXPO_NO_TELEMETRY: '1' };
  delete env.EXPO_PUBLIC_LOKA_DEV_CARTRIDGE;
  delete env.LOKA_DEV_CARTRIDGE;
  try {
    execFileSync(
      'node_modules/.bin/expo',
      ['export', '--platform', 'web', '--clear', '--output-dir', out],
      {
        cwd: join(import.meta.dirname, '..'),
        env,
        stdio: ['ignore', 'ignore', 'pipe'], // a failed export throws with Metro's stderr
      },
    );
    const dir = join(out, '_expo/static/js/web');
    const js = readdirSync(dir)
      .map((f) => readFileSync(join(dir, f), 'utf8'))
      .join('');
    assert.ok(js.includes('loka-kernel'), 'the export holds the app'); // a broken export proves nothing
    assert.ok(!js.includes('loka_author_seam_lines'), 'the builder seam is in a release bundle');
    assert.ok(!js.includes(BUILD), 'the Build strip is in a release bundle');
    assert.ok(!js.includes('Unwritten: '), 'the in-place field is in a release bundle');
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
