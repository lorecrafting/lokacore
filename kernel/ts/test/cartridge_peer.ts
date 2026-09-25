// Cross-kernel peer for test/loka/cartridge_cross_kernel_test.exs: loads each artifact file
// named in the JSON file argv[2] ({installed, paths}) and prints, per file, the re-encoded
// artifact, hash and lock, or the diagnostic.
import { readFileSync } from 'node:fs';
import { encode, type Json } from '../src/canonical.ts';
import { loadCartridge } from '../src/cartridge.ts';

const { installed, paths } = JSON.parse(readFileSync(process.argv[2]!, 'utf8'));
const out = paths.map((path: string) => {
  const r = loadCartridge(new Uint8Array(readFileSync(path)), installed);
  if (!r.ok) return { diagnostic: r.diagnostic };
  const artifact = encode({ content_hash: r.hash, cartridge: r.cartridge } as unknown as Json);
  return { artifact, hash: r.hash, lock: r.cartridge.lock };
});
process.stdout.write(encode(out as Json));
