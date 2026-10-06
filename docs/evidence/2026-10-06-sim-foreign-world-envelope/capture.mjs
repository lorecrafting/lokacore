import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { loadCartridge, INSTALLED } from '../../../kernel/ts/src/index.ts';
import { simulate, KERNEL } from '../../../kernel/ts/test/sim.ts';

// Captures contain no device identifiers; redact local paths from any thrown diagnostics.
const redact = (text) => text.replace(/(?:file:\/\/)?\/(?:Users|private\/tmp|tmp)\/[^\s)]+/g, '[redacted-path]');
try {
  const k = JSON.parse(readFileSync(new URL('../../../protocol/fixtures/missing_child_v030_hash.json', import.meta.url), 'utf8'));
  const artifact = JSON.stringify({ cartridge: k.value, content_hash: k.sha256 });
  const loaded = loadCartridge(new TextEncoder().encode(artifact), INSTALLED);
  if (!loaded.ok) throw Error(JSON.stringify(loaded));
  const failures = [];
  let commands = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const o = simulate(seed, KERNEL, [{ cartridge: loaded.cartridge, hash: loaded.hash, artifact }]);
    commands += o.commands.length;
    if (o.failure) failures.push({ seed, ...o.failure, command: o.commands[o.failure.at] });
  }
  console.log(JSON.stringify({ source_head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), fixture: k.sha256, seeds: 200, commands, failures }, null, 2));
  if (failures.length) process.exitCode = 1;
} catch (e) {
  console.error(redact(String(e)));
  process.exitCode = 1;
}
