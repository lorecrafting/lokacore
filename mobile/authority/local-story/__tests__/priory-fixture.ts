// Controlled authored custody for real SQLite and actual Book item tests.
import { bundle } from '../../../../kernel/ts/test/priory_fixture.ts';
import { encode, hash } from '../../../../kernel/ts/src/foundation/canonical.ts';
export { bundle, ids } from '../../../../kernel/ts/test/priory_fixture.ts';

export function openChestBundle() {
  const c = structuredClone(bundle.value);
  c.items['ashmere_missing_child@0.0.27:item/storage_chest'].location = {
    in: 'room',
    room: c.items['ashmere_missing_child@0.0.27:item/ward_of_the_fen'].location.room,
  };
  c.barriers['ashmere_missing_child@0.0.27:barrier/storage_chest_lid'].initial = 'open';
  return { value: c, canonical: encode(c), sha256: hash(c) };
}
