// `bin/loka check <cartridge dir>` (docs/guides/writing-the-game.md#test-your-checkpoints): compiles
// the cartridge as the author preview does, then replays each `checkpoints/*.json` on a fresh
// session through the preview's own replay(), with no Book and so no prompt. Prints one line per
// checkpoint, `ok` or the first refused step, and exits 1 if any failed. No `random` in the host
// and the frozen clock: the same seed and time as the preview, so a run repeats there.
//
// The replay itself is `checkpoints.ts`, which the watcher runs after each compile (R1,
// docs/design/story-tooling.md §2); one function, so the editor and this command cannot disagree.
import { resolve } from 'node:path';
import { names, replayed1 } from './checkpoints.ts';
import { compiled } from './compiled.ts';

/** The report's lines and whether every checkpoint passed. */
function check(source: string): { lines: string[]; ok: boolean } {
  const files = names(source);
  if (!files.length) return { lines: [`no checkpoints in ${source}/checkpoints`], ok: false };
  const bundled = compiled(source);
  if (typeof bundled === 'string') return { lines: [`not compiled: ${bundled}`], ok: false };
  let ok = true;
  const lines = files.map((file) => {
    const why = replayed1(source, file, bundled);
    if (why) ok = false;
    return `${file.slice(0, -5)}: ${why ?? 'ok'}`;
  });
  return { lines, ok };
}

const [dir, ...rest] = process.argv.slice(2);
if (!dir || rest.length) {
  console.error('usage: bin/loka check <cartridge dir>');
  process.exit(2);
}
const { lines, ok } = check(resolve(dir));
for (const line of lines) console.log(line);
process.exit(ok ? 0 : 1);
