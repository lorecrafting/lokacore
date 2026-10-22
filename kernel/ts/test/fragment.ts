// A test fragment: a frozen KAT cartridge, changed, re-encoded, re-hashed and loaded.
// `katPath` is relative to the repository root (see read.ts).
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { decode, encode } from '../src/foundation/canonical.ts';
import { INSTALLED, loadCartridge, newWorld, type Cartridge } from '../src/index.ts';
import type { DefinitionRef } from '../src/contracts.gen.ts';
import { read } from './read.ts';

type Change = (c: any) => void;
const none: Change = () => {};

export function fragment(katPath: string) {
  const source: any = decode(read(katPath).canonical);
  const { id, version } = source.manifest;
  const prefix = `${id}@${version}`;
  const ref = (kind: string, key: string): DefinitionRef => ({
    cartridge_id: id,
    cartridge_version: version,
    kind: kind as never,
    key: key as never,
  });
  const bundle = (change = none) => {
    const c = structuredClone(source);
    change(c);
    const canonical = encode(c);
    return { canonical, sha256: createHash('sha256').update(canonical).digest('hex') };
  };
  const load = (change = none) => {
    const b = bundle(change);
    return loadCartridge(
      new TextEncoder().encode(`{"cartridge":${b.canonical},"content_hash":"${b.sha256}"}`),
      INSTALLED,
    );
  };
  const genesis = (change = none) => {
    const loaded = load(change);
    assert.ok(loaded.ok, JSON.stringify(loaded));
    return newWorld(
      loaded.cartridge as Cartridge,
      '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
      [1, 2, 3, 4],
    );
  };
  return { source, prefix, ref, bundle, load, genesis };
}
