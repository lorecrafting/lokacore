// Invariant peer for test/loka/core/registries_test.exs: prints, as a JSON array, the ids of
// argv[2] (a JSON array) that a TypeScript check knows, invariants.ts check (observations) or
// world.ts holds (a world). Each throws `unknown invariant <id>` for any other id; a known
// check given an empty observation or world returns or throws something else.
import { check } from '../src/invariants.ts';
import type { World } from '../src/index.ts';
import { holds } from '../src/world.ts';

const knows = (f: () => unknown) => {
  try {
    f();
  } catch (e) {
    return !(e instanceof Error && e.message.startsWith('unknown invariant'));
  }
  return true;
};
const ids: string[] = JSON.parse(process.argv[2]!);
const known = ids.filter((id) => knows(() => check(id, {})) || knows(() => holds(id, {} as World)));
process.stdout.write(JSON.stringify(known));
